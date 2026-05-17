"""
Views for the uploaded_addresses app.
"""
import csv
import json
import logging
import io
import uuid
import threading
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from .models import UploadedAddress, BatchStatus
from .serializers import (
    UploadedAddressSerializer,
    UploadedAddressNDJSONSerializer,
    UploadedAddressCreateSerializer,
    CSVUploadSerializer,
    UpdateAddressTextSerializer
)
from .permissions import UploadedAddressPermission, ManagerOnlyPermission
from .tasks import geocode_address

logger = logging.getLogger(__name__)

# Constants for upload limits
MAX_ADDRESSES_PER_UPLOAD = None

def check_batch_cancelled(batch_id):
    """Check if a batch has been cancelled. Returns True if cancelled."""
    try:
        batch_status = BatchStatus.objects.get(batch_id=batch_id)
        return batch_status.status == 'cancelled'
    except BatchStatus.DoesNotExist:
        return False


def process_upload_background(batch_id, csv_reader, total_addresses, manager, campaign, file_extension):
    """Process upload in background thread with cancellation support."""
    logger.info(f"Starting background processing for batch {batch_id}")
    
    # Initialize or update batch status
    batch_status, created = BatchStatus.objects.get_or_create(
        batch_id=batch_id,
        defaults={
            'manager': manager,
            'campaign': campaign,
            'status': 'processing',
            'total_addresses': total_addresses,
            'processed_addresses': 0
        }
    )
    
    if not created:
        batch_status.status = 'processing'
        batch_status.total_addresses = total_addresses
        batch_status.processed_addresses = 0
        batch_status.save()
    
    addresses_created = []
    addresses_failed = []
    
    try:
        # Process each row
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 because row 1 is header
            # ⚠️ CANCELLATION CHECK #1: Before processing each row (check every 5 rows for performance)
            if row_num % 5 == 0:
                batch_status.refresh_from_db()
                if batch_status.status == 'cancelled':
                    logger.info(f"Batch {batch_id} cancelled. Stopping at row {row_num}")
                    break
            
            # Extract address components (Norwegian format)
            street = (row.get('Gate/vei 2') or '').strip()
            postal_code = (row.get('Postnummer') or '').strip()
            city = (row.get('Poststed') or '').strip()

            # 1) Skip rows that are completely empty
            if not street and not postal_code and not city:
                logger.info(f"Skipping empty row {row_num}")
                # Optionally record as skipped for diagnostics
                addresses_failed.append({
                    'row': row_num,
                    'reason': 'Skipped empty row',
                    'data': {'Gate/vei 2': street, 'Postnummer': postal_code, 'Poststed': city}
                })
                continue

            # 2) Skip rows with only Postnummer/Poststed and no street
            if not street and (postal_code or city):
                logger.info(f"Skipping row {row_num}: has postal/city but missing street")
                addresses_failed.append({
                    'row': row_num,
                    'reason': 'Skipped: missing Gate/vei 2 while Postnummer/Poststed present',
                    'data': {'Gate/vei 2': street, 'Postnummer': postal_code, 'Poststed': city}
                })
                continue

            # 3) Allow rows where the full address is in Gate/vei 2
            # Build address text. If only street provided, use it alone; otherwise include postal code and city.
            address_parts = []
            if street:
                address_parts.append(street)
            if postal_code:
                address_parts.append(postal_code)
            if city:
                address_parts.append(city)
            # Add Norway as default country for geocoding
            address_parts.append('Norway')

            address_text = ', '.join(address_parts)
            
            try:
                # ⚠️ CANCELLATION CHECK #2: Before creating address
                batch_status.refresh_from_db()
                if batch_status.status == 'cancelled':
                    logger.info(f"Batch {batch_id} cancelled before creating address for row {row_num}")
                    break
                
                # Create the uploaded address with batch tracking
                uploaded_address = UploadedAddress.objects.create(
                    manager=manager,
                    campaign=campaign,
                    address_text=address_text,
                    upload_batch_id=batch_id,
                    batch_sequence=row_num - 1,  # Convert to 0-based index
                    batch_total=total_addresses
                )
                addresses_created.append(uploaded_address)
                
                # ⚠️ CANCELLATION CHECK #3: After creating address, before geocoding
                batch_status.refresh_from_db()
                if batch_status.status == 'cancelled':
                    logger.info(f"Batch {batch_id} cancelled. Deleting address {uploaded_address.id}")
                    uploaded_address.delete()
                    break
                
                # Geocode immediately
                try:
                    logger.info(f"Starting geocoding for address {uploaded_address.id}: {address_text}")
                    result = geocode_address(str(uploaded_address.id))
                    logger.info(f"Geocoding result: {result}")
                    
                    # ⚠️ CANCELLATION CHECK #4: After geocoding (slow operation)
                    batch_status.refresh_from_db()
                    if batch_status.status == 'cancelled':
                        logger.info(f"Batch {batch_id} cancelled after geocoding. Deleting address {uploaded_address.id}")
                        uploaded_address.delete()
                        break
                    
                    if result.get('status') == 'success':
                        logger.info(f"Successfully geocoded address {uploaded_address.id}: {address_text}")
                    else:
                        logger.warning(f"Failed to geocode address {uploaded_address.id}: {address_text}")
                except Exception as e:
                    logger.error(f"Error geocoding address {uploaded_address.id}: {str(e)}")
                    import traceback
                    logger.error(f"Traceback: {traceback.format_exc()}")
                
                logger.info(f"Created uploaded address {uploaded_address.id} for address: {address_text}")
                
                # Update progress counter
                batch_status.processed_addresses = len(addresses_created)
                batch_status.save(update_fields=['processed_addresses'])
                
            except Exception as e:
                logger.error(f"Failed to create uploaded address for row {row_num}: {e}")
                addresses_failed.append({
                    'row': row_num,
                    'address': address_text,
                    'reason': str(e)
                })
        
        # Finalize batch status
        batch_status.refresh_from_db()
        if batch_status.status != 'cancelled':
            batch_status.status = 'completed'
            batch_status.processed_addresses = len(addresses_created)
            batch_status.save()
            logger.info(f"Background processing completed for batch {batch_id}. Created: {len(addresses_created)}, Failed: {len(addresses_failed)}")
        else:
            logger.info(f"Background processing stopped for cancelled batch {batch_id}. Created before cancellation: {len(addresses_created)}")
        
    except Exception as e:
        # Mark batch as failed if not cancelled
        try:
            batch_status.refresh_from_db()
            if batch_status.status != 'cancelled':
                batch_status.status = 'failed'
                batch_status.save()
        except Exception:
            pass
        logger.error(f"Error in background processing for batch {batch_id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

def process_remaining_addresses(batch_id, remaining_addresses, total_addresses):
    """Process remaining addresses for a resumed upload."""
    logger.info(f"Starting to process {len(remaining_addresses)} remaining addresses for batch {batch_id}")
    
    try:
        for i, address in enumerate(remaining_addresses):
            # Update batch tracking
            address.batch_sequence = total_addresses - len(remaining_addresses) + i + 1
            address.batch_total = total_addresses
            address.save()
            
            # Geocode the address
            try:
                logger.info(f"Geocoding remaining address {address.id}: {address.address_text}")
                result = geocode_address(str(address.id))
                if result.get('status') == 'success':
                    logger.info(f"Successfully geocoded remaining address {address.id}")
                else:
                    logger.warning(f"Failed to geocode remaining address {address.id}")
            except Exception as e:
                logger.error(f"Error geocoding remaining address {address.id}: {str(e)}")
        
        logger.info(f"Completed processing remaining addresses for batch {batch_id}")
        
    except Exception as e:
        logger.error(f"Error processing remaining addresses for batch {batch_id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")


@extend_schema(
    tags=['Uploaded Addresses'],
    description='API endpoints for uploading and managing addresses via CSV files with automatic geocoding'
)
class UploadedAddressViewSet(viewsets.ModelViewSet):
    """ViewSet for UploadedAddress model."""
    queryset = UploadedAddress.objects.all()
    serializer_class = UploadedAddressSerializer
    permission_classes = [UploadedAddressPermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['campaign', 'manager', 'geocoded_at', 'added_at']
    search_fields = ['address_text', 'campaign__name', 'manager__name']
    ordering_fields = ['added_at', 'geocoded_at', 'address_text']
    ordering = ['-added_at']
    http_method_names = ['get', 'post', 'patch', 'delete']  # Allow GET, POST, PATCH, DELETE

    def get_queryset(self):
        """Filter queryset based on user permissions."""
        queryset = UploadedAddress.objects.all()
        
        # Get campaign_id from query params
        campaign_id = self.request.query_params.get('campaign_id')
        if campaign_id:
            queryset = queryset.filter(campaign_id=campaign_id)
            logger.info(f"Filtered uploaded addresses for campaign {campaign_id}")
        
        # Get manager_id from query params
        manager_id = self.request.query_params.get('manager_id')
        if manager_id:
            queryset = queryset.filter(manager_id=manager_id)
            logger.info(f"Filtered uploaded addresses for manager {manager_id}")
        
        # Apply user-specific filtering
        user = self.request.user
        if hasattr(user, 'manager') and user.manager:
            # Managers can see all addresses
            pass
        elif hasattr(user, 'employee') and user.employee:
            # Employees can only see addresses in their campaigns
            queryset = queryset.filter(
                campaign__campaign_employees__employee=user.employee
            ).distinct()
        
        return queryset

    @extend_schema(
        summary="Create a new uploaded address",
        description="Create a single uploaded address record",
        request=UploadedAddressCreateSerializer,
        responses={
            201: UploadedAddressSerializer,
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden"
        }
    )
    def create(self, request, *args, **kwargs):
        """Create a new uploaded address."""
        return super().create(request, *args, **kwargs)

    # No custom throttling for bulk; rely on global settings (currently disabled for bulk)

    @extend_schema(
        summary="Delete an uploaded address",
        description="Delete a specific uploaded address by ID",
        responses={
            204: "No Content - Successfully deleted",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found"
        }
    )
    def destroy(self, request, *args, **kwargs):
        """Delete an uploaded address."""
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        summary="Get a specific uploaded address",
        description="Retrieve details of a specific uploaded address by ID",
        responses={
            200: UploadedAddressSerializer,
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found"
        }
    )
    def retrieve(self, request, *args, **kwargs):
        """Get a specific uploaded address."""
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Upload addresses from CSV/Excel file",
        description="Upload a CSV or Excel file containing Norwegian addresses with columns: Gate/vei 2, Postnummer, Poststed. Requires batch_id from /generate-batch-id/ endpoint. Returns immediately for progress tracking.",
        request=CSVUploadSerializer,
        responses={
            202: "Upload started - use batch_id for progress tracking",
            400: "Bad Request - Invalid file or data",
            403: "Forbidden - Only managers can upload addresses",
            500: "Internal Server Error"
        },
        examples=[
            OpenApiExample(
                'CSV Format Example',
                value={
                    'file': 'addresses.csv',
                    'campaign_id': '123e4567-e89b-12d3-a456-426614174000',
                    'batch_id': '7b52e526-ec5f-4849-9dff-85cf047748ed'
                },
                request_only=True,
                description="CSV/Excel should have columns: Gate/vei 2, Postnummer, Poststed. batch_id from /generate-batch-id/"
            ),
            OpenApiExample(
                'Success Response',
                value={
                    'batch_id': '7b52e526-ec5f-4849-9dff-85cf047748ed',
                    'total_addresses': 4,
                    'message': 'Upload started. Processing 4 addresses...',
                    'status': 'processing'
                },
                response_only=True
            )
        ]
    )
    @action(
        detail=False,
        methods=['post'],
        url_path='upload-file',
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[ManagerOnlyPermission]
    )
    def upload_csv(self, request):
        """Upload addresses from CSV or Excel file with batch tracking."""
        try:
            # Validate the request data
            serializer = CSVUploadSerializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"CSV upload validation failed: {serializer.errors}")
                return Response(
                    {'error': 'Invalid data', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            csv_file = serializer.validated_data['file']
            campaign_id = serializer.validated_data['campaign_id']
            batch_id = serializer.validated_data['batch_id']
            
            # Get the campaign
            from campaigns.models import Campaign
            campaign = Campaign.objects.get(id=campaign_id)
            
            # Get the manager from the request user
            manager = request.user.manager
            
            # Read and process the CSV file
            addresses_created = []
            addresses_failed = []
            
            # For now, we'll process the file synchronously but with batch tracking
            # In a future iteration, this will be moved to a background task
            
            # Check file type and process accordingly
            file_extension = csv_file.name.lower().split('.')[-1]
            
            # Store file content and reader data for later use
            csv_content = None
            excel_rows = None
            excel_headers = None
            delimiter = ','  # Default delimiter
            column_mapping = {}  # Column name mapping for normalization
            
            if file_extension == 'csv':
                # Process CSV file with encoding detection
                csv_bytes = csv_file.read()
                
                # Try multiple encodings in order of likelihood
                encodings_to_try = ['utf-8', 'utf-8-sig', 'windows-1252', 'iso-8859-1', 'latin-1', 'cp1252']
                csv_content = None
                encoding_used = None
                
                for encoding in encodings_to_try:
                    try:
                        csv_content = csv_bytes.decode(encoding)
                        encoding_used = encoding
                        logger.info(f"Successfully decoded CSV file using {encoding} encoding")
                        break
                    except (UnicodeDecodeError, UnicodeError):
                        continue
                
                if csv_content is None:
                    # Last resort: try with error handling
                    try:
                        csv_content = csv_bytes.decode('utf-8', errors='replace')
                        encoding_used = 'utf-8 (with error replacement)'
                        logger.warning(f"CSV file decoded with error replacement. Some characters may be corrupted.")
                    except Exception as e:
                        logger.error(f"Failed to decode CSV file with all attempted encodings: {e}")
                        return Response(
                            {'error': f'Failed to decode CSV file. Please ensure the file is encoded in UTF-8, Windows-1252, or ISO-8859-1. Error: {str(e)}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # Detect delimiter (semicolon, comma, or tab)
                delimiter = None
                first_line = csv_content.split('\n')[0] if csv_content else ''
                
                # Count occurrences of each delimiter in the first line
                semicolon_count = first_line.count(';')
                comma_count = first_line.count(',')
                tab_count = first_line.count('\t')
                
                # Choose delimiter with highest count
                if tab_count > 0 and tab_count >= semicolon_count and tab_count >= comma_count:
                    delimiter = '\t'
                elif semicolon_count > 0 and semicolon_count >= comma_count:
                    delimiter = ';'
                else:
                    delimiter = ','  # Default to comma
                
                logger.info(f"Detected CSV delimiter: {repr(delimiter)} (semicolon: {semicolon_count}, comma: {comma_count}, tab: {tab_count})")
                
                csv_reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
            elif file_extension == 'xlsx':
                # Process Excel file
                import openpyxl
                from io import BytesIO
                
                # Read the Excel file
                workbook = openpyxl.load_workbook(BytesIO(csv_file.read()), data_only=True)
                worksheet = workbook.active
                
                # Get headers from first row
                excel_headers = [cell.value for cell in worksheet[1] if cell.value]
                
                # Create a list of dictionaries for each row
                excel_rows = []
                for row in worksheet.iter_rows(min_row=2, values_only=True):
                    if any(cell for cell in row):  # Skip empty rows
                        row_dict = dict(zip(excel_headers, row))
                        excel_rows.append(row_dict)
                
                # Create a CSV-like reader interface
                class ExcelDictReader:
                    def __init__(self, rows, fieldnames):
                        self.rows = rows
                        self.fieldnames = fieldnames
                    
                    def __iter__(self):
                        return iter(self.rows)
                
                csv_reader = ExcelDictReader(excel_rows, excel_headers)
            else:
                return Response(
                    {'error': 'Unsupported file format. Please use .csv or .xlsx files.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                
                # Validate CSV structure - check for required columns (Norwegian format)
                # Expected column names (case-insensitive matching)
                required_columns_map = {
                    'gate/vei 2': 'Gate/vei 2',
                    'postnummer': 'Postnummer',
                    'poststed': 'Poststed'
                }
                
                # Normalize column names (case-insensitive matching)
                column_mapping = {}
                found_columns = []
                missing_columns = []
                
                # Create a case-insensitive lookup of fieldnames
                fieldnames_lower = {name.lower().strip(): name for name in csv_reader.fieldnames}
                
                for expected_lower, expected_original in required_columns_map.items():
                    if expected_lower in fieldnames_lower:
                        actual_name = fieldnames_lower[expected_lower]
                        column_mapping[expected_original] = actual_name
                        found_columns.append(actual_name)
                    else:
                        missing_columns.append(expected_original)
                
                if missing_columns:
                    logger.error(f"CSV file missing required columns: {missing_columns}. Found: {csv_reader.fieldnames}")
                    return Response(
                        {'error': f'CSV file must contain these columns: {", ".join(required_columns_map.values())}. Found: {", ".join(csv_reader.fieldnames)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                logger.info(f"Column mapping: {column_mapping}")
                
                # Create a wrapper reader that normalizes column names
                class NormalizedDictReader:
                    def __init__(self, reader, column_mapping):
                        self.reader = reader
                        self.column_mapping = column_mapping
                        self.fieldnames = list(required_columns_map.values())
                    
                    def __iter__(self):
                        for row in self.reader:
                            normalized_row = {}
                            for expected_name, actual_name in self.column_mapping.items():
                                normalized_row[expected_name] = row.get(actual_name, '')
                            yield normalized_row
                
                csv_reader = NormalizedDictReader(csv_reader, column_mapping)
                
                # Count total addresses for batch tracking (only processable rows)
                def _is_processable(row_dict):
                    s = (row_dict.get('Gate/vei 2') or '').strip()
                    p = (row_dict.get('Postnummer') or '').strip()
                    c = (row_dict.get('Poststed') or '').strip()
                    if not s and not p and not c:
                        return False  # fully empty row
                    if not s and (p or c):
                        return False  # only postal/city without street
                    return True

                if hasattr(csv_reader, 'rows'):
                    # Excel reader: rows already materialized
                    total_addresses = sum(1 for r in csv_reader.rows if _is_processable(r))
                else:
                    # CSV reader - convert to list and filter
                    csv_rows = list(csv_reader)
                    total_addresses = sum(1 for r in csv_rows if _is_processable(r))
                    # Recreate reader for processing
                    if file_extension == 'csv':
                        # Use the same delimiter that was detected earlier
                        csv_reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
                        # Re-apply column normalization
                        csv_reader = NormalizedDictReader(csv_reader, column_mapping)
                    else:
                        # Recreate Excel reader with the same data
                        csv_reader = ExcelDictReader(excel_rows, excel_headers)
                
                # Validate batch size
                
                # Start background processing
                logger.info(f"Starting upload batch {batch_id} with {total_addresses} addresses")
                
                # Create a copy of the CSV reader for background processing
                if file_extension == 'csv':
                    # Use the same delimiter and column normalization
                    background_csv_reader = csv.DictReader(io.StringIO(csv_content), delimiter=delimiter)
                    background_csv_reader = NormalizedDictReader(background_csv_reader, column_mapping)
                else:
                    background_csv_reader = ExcelDictReader(excel_rows, excel_headers)
                
                # Start background thread
                background_thread = threading.Thread(
                    target=process_upload_background,
                    args=(batch_id, background_csv_reader, total_addresses, manager, campaign, file_extension)
                )
                background_thread.daemon = True  # Thread will be killed when main process exits
                background_thread.start()
                
                # Return immediate response
                return Response({
                    'batch_id': str(batch_id),
                    'total_addresses': total_addresses,
                    'message': f'Upload started. Processing {total_addresses} addresses...',
                    'status': 'processing'
                }, status=status.HTTP_202_ACCEPTED)
                
            except UnicodeDecodeError:
                logger.error("Failed to decode CSV file - invalid encoding")
                return Response(
                    {'error': 'Invalid file encoding. Please use UTF-8 encoding for CSV files.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except csv.Error as e:
                logger.error(f"CSV parsing error: {e}")
                return Response(
                    {'error': f'Invalid CSV format: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                if 'openpyxl' in str(e):
                    logger.error(f"Excel parsing error: {e}")
                    return Response(
                        {'error': f'Invalid Excel file format: {str(e)}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                else:
                    raise
                
        except Exception as e:
            logger.error(f"Unexpected error in CSV upload: {e}")
            return Response(
                {'error': 'Internal server error occurred during upload'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Get uploaded addresses",
        description="Retrieve uploaded addresses with optional filtering by campaign_id and manager_id",
        parameters=[
            OpenApiParameter(
                name='campaign_id',
                type=str,
                description='Filter by campaign ID',
                required=False
            ),
            OpenApiParameter(
                name='manager_id',
                type=str,
                description='Filter by manager ID',
                required=False
            ),
            OpenApiParameter(
                name='geocoded',
                type=bool,
                description='Filter by geocoding status (true for geocoded, false for not geocoded)',
                required=False
            ),
        ],
        responses={
            200: UploadedAddressSerializer(many=True),
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden"
        }
    )
    def list(self, request, *args, **kwargs):
        """List uploaded addresses with filtering and optional bulk streaming.

        - Default: paginated (unchanged)
        - bulk=true: stream all matching items in one response
            - format=ndjson -> application/x-ndjson, one JSON object per line
            - format=json   -> application/json, standard envelope with results array streamed
        """
        bulk = request.query_params.get('bulk', '').lower() == 'true'
        try:
            queryset = self.get_queryset()

            # Additional filtering for geocoding status (existing behavior)
            geocoded_param = request.query_params.get('geocoded')
            if geocoded_param is not None:
                geocoded = geocoded_param.lower() == 'true'
                if geocoded:
                    queryset = queryset.filter(latitude__isnull=False, longitude__isnull=False)
                else:
                    queryset = queryset.filter(latitude__isnull=True, longitude__isnull=True)

            # Apply standard filter backends for both paths to preserve existing behavior
            queryset = self.filter_queryset(queryset)

            if not bulk:
                # Paginated path unchanged
                page = self.paginate_queryset(queryset)
                if page is not None:
                    serializer = self.get_serializer(page, many=True)
                    return self.get_paginated_response(serializer.data)
                serializer = self.get_serializer(queryset, many=True)
                return Response(serializer.data)

            # Bulk path
            # Optimize queryset for bulk
            queryset = queryset.select_related('campaign', 'manager').prefetch_related(
                # Prefetch relations used by campaign serializer paths to avoid N+1
                'campaign__campaignarea_set__area',
                'campaign__campaign_employees__employee',
            )
            if not request.query_params.get('ordering'):
                queryset = queryset.order_by()

            # Use bulk_format instead of format to avoid DRF renderer negotiation affecting routing
            fmt = request.query_params.get('bulk_format', 'json').lower()
            def serialize_instance(instance):
                if fmt == 'ndjson':
                    data = UploadedAddressNDJSONSerializer(instance).data
                else:
                    data = self.get_serializer(instance).data
                return json.dumps(data)

            if fmt == 'ndjson':
                def ndjson_stream():
                    for obj in queryset.iterator(chunk_size=200):
                        yield serialize_instance(obj) + "\n"

                response = StreamingHttpResponse(ndjson_stream(), content_type='application/x-ndjson')
                response['Cache-Control'] = 'no-cache, no-transform'
                response['X-Accel-Buffering'] = 'no'
                return response

            def json_stream():
                total_count = queryset.count()
                yield '{"count": ' + str(total_count) + ', "next": null, "previous": null, "results":['
                first = True
                for obj in queryset.iterator(chunk_size=200):
                    if not first:
                        yield ','
                    first = False
                    yield serialize_instance(obj)
                yield ']}'

            response = StreamingHttpResponse(json_stream(), content_type='application/json')
            response['Cache-Control'] = 'no-cache, no-transform'
            response['X-Accel-Buffering'] = 'no'
            return response

        except Exception as e:
            logger.error(f"Error listing uploaded addresses: {e}")
            return Response(
                {'error': 'Internal server error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Retry geocoding for an address",
        description="Manually trigger geocoding for a specific uploaded address",
        responses={
            200: "Geocoding task triggered successfully",
            404: "Address not found",
            500: "Internal Server Error"
        }
    )
    @action(detail=True, methods=['post'], url_path='retry-geocoding')
    def retry_geocoding(self, request, pk=None):
        """Retry geocoding for a specific address."""
        try:
            uploaded_address = self.get_object()
            
            # Trigger geocoding task
            geocode_address.delay(str(uploaded_address.id))
            
            logger.info(f"Retry geocoding triggered for address {uploaded_address.id}")
            
            return Response({
                'message': 'Geocoding task triggered successfully',
                'address_id': str(uploaded_address.id)
            })
            
        except UploadedAddress.DoesNotExist:
            return Response(
                {'error': 'Address not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error retrying geocoding for address {pk}: {e}")
            return Response(
                {'error': 'Internal server error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Update address text and re-geocode",
        description="Update the address_text of an uploaded address and trigger re-geocoding to update latitude, longitude, and geocoded_at fields",
        request=UpdateAddressTextSerializer,
        responses={
            200: "Address updated and geocoding triggered successfully",
            400: "Bad Request - Invalid address text",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Address not found",
            500: "Internal Server Error"
        },
        examples=[
            OpenApiExample(
                'Update Address Text',
                value={
                    'address_text': 'Trosteveien 27, 9512, ALTA, Norway'
                },
                request_only=True,
                description="New address text to update and re-geocode"
            ),
            OpenApiExample(
                'Success Response',
                value={
                    'message': 'Address updated and geocoding triggered successfully',
                    'address_id': '123e4567-e89b-12d3-a456-426614174000',
                    'old_address_text': 'Old address text',
                    'new_address_text': 'Trosteveien 27, 9512, ALTA, Norway',
                    'geocoding_status': 'triggered'
                },
                response_only=True
            ),
            OpenApiExample(
                'Geocoding Failed Response',
                value={
                    'message': 'Geocoding failed. Retry address',
                    'address_id': '123e4567-e89b-12d3-a456-426614174000',
                    'old_address_text': 'Old address text',
                    'new_address_text': 'Invalid address text',
                    'geocoding_status': 'failed',
                    'error': 'No results found'
                },
                response_only=True
            )
        ]
    )
    @action(detail=True, methods=['patch'], url_path='update-address-text')
    def update_address_text(self, request, pk=None):
        """Update address_text and trigger re-geocoding."""
        try:
            # Get the uploaded address
            uploaded_address = self.get_object()
            
            # Validate the request data
            serializer = UpdateAddressTextSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            new_address_text = serializer.validated_data['address_text']
            old_address_text = uploaded_address.address_text
            
            # Update the address text
            uploaded_address.address_text = new_address_text
            
            # Clear previous geocoding data to force re-geocoding
            uploaded_address.latitude = None
            uploaded_address.longitude = None
            uploaded_address.geocoded_at = None
            
            # Save the updated address
            uploaded_address.save()
            
            logger.info(f"Updated address text for {uploaded_address.id}: '{old_address_text}' -> '{new_address_text}'")
            
            # Trigger geocoding
            from .tasks import geocode_address
            geocoding_result = geocode_address(str(uploaded_address.id))
            
            if geocoding_result['status'] == 'success':
                # Geocoding succeeded - refresh the object to get updated values
                uploaded_address.refresh_from_db()
                logger.info(f"Re-geocoding successful for address {uploaded_address.id}")
                return Response({
                    'message': 'Address updated and geocoding triggered successfully',
                    'address_id': str(uploaded_address.id),
                    'old_address_text': old_address_text,
                    'new_address_text': new_address_text,
                    'geocoding_status': 'success',
                    'latitude': uploaded_address.latitude,
                    'longitude': uploaded_address.longitude,
                    'geocoded_at': uploaded_address.geocoded_at.isoformat() if uploaded_address.geocoded_at else None
                })
            else:
                # Geocoding failed
                logger.warning(f"Re-geocoding failed for address {uploaded_address.id}: {geocoding_result.get('reason', 'Unknown error')}")
                return Response({
                    'message': 'Geocoding failed. Retry address',
                    'address_id': str(uploaded_address.id),
                    'old_address_text': old_address_text,
                    'new_address_text': new_address_text,
                    'geocoding_status': 'failed',
                    'error': geocoding_result.get('reason', 'Unknown error')
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except UploadedAddress.DoesNotExist:
            return Response(
                {'error': 'Address not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating address text for {pk}: {e}")
            return Response(
                {'error': 'Internal server error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Download failed geocoding addresses as CSV",
        description="Download all addresses with null geocoded_at timestamp as a CSV file containing only the address_text column",
        parameters=[
            OpenApiParameter(
                name='campaign_id',
                type=str,
                description='Filter by campaign ID (optional)',
                required=False
            ),
            OpenApiParameter(
                name='manager_id',
                type=str,
                description='Filter by manager ID (optional)',
                required=False
            ),
        ],
        responses={
            200: "CSV file with failed geocoding addresses",
            401: "Unauthorized",
            403: "Forbidden",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['get'], url_path='download-failed-geocoding')
    def download_failed_geocoding(self, request):
        """Download addresses with null geocoded_at as CSV file."""
        try:
            # Get queryset with user permissions applied
            queryset = self.get_queryset()
            
            # Filter for addresses with null geocoded_at
            failed_addresses = queryset.filter(geocoded_at__isnull=True)
            
            # Apply additional filters if provided
            campaign_id = request.query_params.get('campaign_id')
            if campaign_id:
                failed_addresses = failed_addresses.filter(campaign_id=campaign_id)
            
            manager_id = request.query_params.get('manager_id')
            if manager_id:
                failed_addresses = failed_addresses.filter(manager_id=manager_id)
            
            # Count the addresses
            count = failed_addresses.count()
            logger.info(f"Downloading {count} failed geocoding addresses")
            
            if count == 0:
                return Response({
                    'message': 'No failed geocoding addresses found',
                    'count': 0
                }, status=status.HTTP_200_OK)
            
            # Create CSV content
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(['address_text'])
            
            # Write data
            for address in failed_addresses:
                writer.writerow([address.address_text])
            
            # Prepare response
            csv_content = output.getvalue()
            output.close()
            
            # Create filename with timestamp
            from django.utils import timezone
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            filename = f'failed_geocoding_addresses_{timestamp}.csv'
            
            # Create HTTP response with CSV content
            from django.http import HttpResponse
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            logger.info(f"Successfully generated CSV with {count} failed geocoding addresses")
            
            return response
            
        except Exception as e:
            logger.error(f"Error downloading failed geocoding addresses: {e}")
            return Response(
                {'error': 'Internal server error occurred while generating CSV'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Get upload progress for a batch",
        description="Get progress information for a specific upload batch",
        parameters=[
            OpenApiParameter(
                name='batch_id',
                type=str,
                description='Batch ID to get progress for',
                required=True
            ),
        ],
        responses={
            200: "Progress information",
            400: "Bad Request - Missing batch_id",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Batch not found",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['get'], url_path='upload-progress')
    def upload_progress(self, request):
        """Get progress for a specific upload batch with cancellation support."""
        batch_id = request.query_params.get('batch_id')
        
        if not batch_id:
            return Response(
                {'error': 'batch_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            manager = request.user.manager
            
            # First check BatchStatus for authoritative status (including cancellation)
            batch_status_record = None
            try:
                batch_status_record = BatchStatus.objects.get(batch_id=batch_id, manager=manager)
            except BatchStatus.DoesNotExist:
                pass
            
            # If batch was cancelled, return cancelled status even if no addresses exist
            if batch_status_record and batch_status_record.status == 'cancelled':
                return Response({
                    'batch_id': batch_id,
                    'status': 'cancelled',
                    'progress_percentage': batch_status_record.progress_percentage,
                    'processed_addresses': batch_status_record.processed_addresses,
                    'total_addresses': batch_status_record.total_addresses,
                    'geocoded_addresses': 0,
                    'failed_addresses': 0,
                    'created_at': batch_status_record.created_at,
                    'cancelled_at': batch_status_record.cancelled_at.isoformat() if batch_status_record.cancelled_at else None,
                    'can_be_cancelled': False
                })
            
            # Get batch info from addresses
            batch_addresses = UploadedAddress.objects.filter(
                upload_batch_id=batch_id,
                manager=manager  # Security: only user's own batches
            ).order_by('batch_sequence')
            
            if not batch_addresses.exists():
                # Check if BatchStatus exists but no addresses (batch may have been deleted)
                if batch_status_record:
                    return Response({
                        'batch_id': batch_id,
                        'status': batch_status_record.status,
                        'progress_percentage': batch_status_record.progress_percentage,
                        'processed_addresses': batch_status_record.processed_addresses,
                        'total_addresses': batch_status_record.total_addresses,
                        'geocoded_addresses': 0,
                        'failed_addresses': 0,
                        'created_at': batch_status_record.created_at,
                        'can_be_cancelled': batch_status_record.can_be_cancelled
                    })
                return Response(
                    {'error': 'Batch not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get batch details from addresses
            first_address = batch_addresses.first()
            total_addresses = batch_status_record.total_addresses if batch_status_record else (first_address.batch_total or batch_addresses.count())
            processed_addresses = batch_status_record.processed_addresses if batch_status_record else batch_addresses.count()
            
            # Calculate progress
            if total_addresses > 0:
                progress_percentage = (processed_addresses / total_addresses) * 100
            else:
                progress_percentage = 0
            
            # Get geocoding stats
            geocoded_count = batch_addresses.filter(geocoded_at__isnull=False).count()
            failed_count = batch_addresses.filter(geocoded_at__isnull=True).count()
            
            # Determine status from BatchStatus if available, otherwise calculate
            if batch_status_record:
                batch_status_value = batch_status_record.status
                can_be_cancelled = batch_status_record.can_be_cancelled
            else:
                # Legacy: determine status from address data
                if processed_addresses >= total_addresses:
                    batch_status_value = 'completed'
                    can_be_cancelled = False
                elif processed_addresses > 0:
                    batch_status_value = 'processing'
                    can_be_cancelled = True
                else:
                    batch_status_value = 'not_started'
                    can_be_cancelled = True
            
            return Response({
                'batch_id': batch_id,
                'status': batch_status_value,
                'progress_percentage': round(progress_percentage, 2),
                'processed_addresses': processed_addresses,
                'total_addresses': total_addresses,
                'geocoded_addresses': geocoded_count,
                'failed_addresses': failed_count,
                'created_at': first_address.added_at,
                'can_be_cancelled': can_be_cancelled
            })
            
        except Exception as e:
            logger.error(f"Error getting upload progress: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Resume interrupted upload",
        description="Resume processing for an interrupted upload batch",
        parameters=[
            OpenApiParameter(
                name='batch_id',
                type=str,
                description='Batch ID to resume',
                required=True
            ),
        ],
        responses={
            200: "Upload resumed successfully",
            400: "Bad Request - Invalid batch_id or already completed",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Batch not found",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['post'], url_path='resume-upload')
    def resume_upload(self, request):
        """Resume processing for an interrupted upload batch."""
        try:
            batch_id = request.query_params.get('batch_id')
            if not batch_id:
                return Response(
                    {'error': 'batch_id parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the manager instance for the current user
            if hasattr(request.user, 'manager') and request.user.manager:
                manager = request.user.manager
            else:
                return Response(
                    {'error': 'Only managers can resume uploads'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Check if batch exists and belongs to manager
            batch_addresses = UploadedAddress.objects.filter(
                manager=manager,
                upload_batch_id=batch_id
            )
            
            if not batch_addresses.exists():
                return Response(
                    {'error': 'Batch not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if batch is already completed
            total_addresses = batch_addresses.count()
            processed_addresses = batch_addresses.filter(
                batch_sequence__isnull=False
            ).count()
            
            if processed_addresses >= total_addresses:
                return Response(
                    {'error': 'Batch is already completed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get unprocessed addresses (those without batch_sequence)
            unprocessed_addresses = batch_addresses.filter(
                batch_sequence__isnull=True
            ).order_by('added_at')
            
            if not unprocessed_addresses.exists():
                return Response(
                    {'error': 'No unprocessed addresses found'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Start background processing for remaining addresses
            logger.info(f"Resuming upload batch {batch_id} for user {request.user}")
            
            # Create a simple iterator for remaining addresses
            remaining_addresses = list(unprocessed_addresses)
            
            # Start background thread for remaining processing
            background_thread = threading.Thread(
                target=process_remaining_addresses,
                args=(batch_id, remaining_addresses, total_addresses)
            )
            background_thread.daemon = True
            background_thread.start()
            
            return Response({
                'batch_id': str(batch_id),
                'message': f'Upload resumed. Processing {len(remaining_addresses)} remaining addresses...',
                'status': 'processing',
                'remaining_addresses': len(remaining_addresses),
                'total_addresses': total_addresses
            })
            
        except Exception as e:
            logger.error(f"Error resuming upload batch {batch_id}: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Get user's upload history",
        description="Get all upload batches for the current user with their status and progress",
        responses={
            200: "List of user's upload batches",
            401: "Unauthorized",
            403: "Forbidden",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['get'], url_path='my-uploads')
    def my_uploads(self, request):
        """Get all upload batches for the current user."""
        try:
            # Get the manager instance for the current user
            if hasattr(request.user, 'manager') and request.user.manager:
                manager = request.user.manager
            else:
                # If user is not a manager, return empty result
                logger.warning(f"User {request.user} is not a manager, cannot retrieve upload history")
                return Response({
                    'upload_history': [],
                    'total_batches': 0,
                    'message': 'Only managers can have upload history'
                })
            
            # Get all unique batch IDs for this manager
            user_batches = UploadedAddress.objects.filter(
                manager=manager
            ).values('upload_batch_id').distinct()
            
            upload_history = []
            
            for batch in user_batches:
                batch_id = batch['upload_batch_id']
                if not batch_id:
                    continue
                
                # Get batch details
                batch_addresses = UploadedAddress.objects.filter(
                    manager=manager,
                    upload_batch_id=batch_id
                )
                
                if not batch_addresses.exists():
                    continue
                
                # Calculate progress - use same logic as upload-progress endpoint
                first_address = batch_addresses.first()
                total_addresses = first_address.batch_total if first_address else batch_addresses.count()
                processed_addresses = batch_addresses.filter(
                    batch_sequence__isnull=False
                ).count()
                geocoded_count = batch_addresses.filter(
                    geocoded_at__isnull=False
                ).count()
                failed_count = total_addresses - geocoded_count
                
                # Determine status - use same logic as upload-progress endpoint
                if processed_addresses == 0:
                    status = 'not_started'
                elif processed_addresses < total_addresses:
                    status = 'processing'
                else:
                    # All addresses processed
                    status = 'completed'
                
                # Calculate progress percentage - use same logic as upload-progress endpoint
                progress_percentage = (processed_addresses / total_addresses * 100) if total_addresses > 0 else 0
                
                # Get first address creation time as batch start time
                first_address = batch_addresses.order_by('added_at').first()
                created_at = first_address.added_at if first_address else None
                
                upload_history.append({
                    'batch_id': str(batch_id),
                    'status': status,
                    'progress_percentage': round(progress_percentage, 2),
                    'processed_addresses': processed_addresses,
                    'total_addresses': total_addresses,
                    'geocoded_addresses': geocoded_count,
                    'failed_addresses': failed_count,
                    'pending_geocoding': total_addresses - geocoded_count,
                    'created_at': created_at.isoformat() if created_at else None,
                    'campaign_name': first_address.campaign.name if first_address else None,
                    'campaign_id': str(first_address.campaign.id) if first_address else None
                })
            
            # Sort by creation time (newest first)
            upload_history.sort(key=lambda x: x['created_at'] or '', reverse=True)
            
            logger.info(f"Retrieved {len(upload_history)} upload batches for manager: {manager}")
            
            return Response({
                'upload_history': upload_history,
                'total_batches': len(upload_history)
            })
            
        except Exception as e:
            logger.error(f"Error retrieving upload history for user {request.user}: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @extend_schema(
        summary="Generate a new batch ID",
        description="Generate a unique batch ID for file uploads",
        responses={
            200: "Batch ID generated successfully",
            401: "Unauthorized",
            403: "Forbidden",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['get'], url_path='generate-batch-id')
    def generate_batch_id(self, request):
        """Generate a unique batch ID for file uploads."""
        try:
            # Generate a unique batch ID
            batch_id = uuid.uuid4()
            
            logger.info(f"Generated batch ID: {batch_id} for user: {request.user}")
            
            return Response({
                'batch_id': str(batch_id),
                'message': 'Batch ID generated successfully'
            })
            
        except Exception as e:
            logger.error(f"Error generating batch ID: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @extend_schema(
        summary="Delete all addresses in a batch",
        description="Delete all uploaded addresses belonging to a specific batch ID. Only the manager who created the batch can delete it.",
        parameters=[
            OpenApiParameter(
                name='batch_id',
                type=str,
                description='Batch ID to delete',
                required=True
            ),
        ],
        responses={
            200: "Batch deleted successfully",
            400: "Bad Request - Missing batch_id",
            401: "Unauthorized",
            403: "Forbidden - Only batch owner can delete",
            404: "Batch not found",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['delete'], url_path='delete-batch')
    def delete_batch(self, request):
        """Delete all addresses in a specific batch."""
        try:
            batch_id = request.query_params.get('batch_id')
            if not batch_id:
                return Response(
                    {'error': 'batch_id parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the manager instance for the current user
            if hasattr(request.user, 'manager') and request.user.manager:
                manager = request.user.manager
            else:
                return Response(
                    {'error': 'Only managers can delete batches'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get all addresses in the batch that belong to this manager
            batch_addresses = UploadedAddress.objects.filter(
                upload_batch_id=batch_id,
                manager=manager
            )
            
            if not batch_addresses.exists():
                return Response(
                    {'error': 'Batch not found or you do not have permission to delete it'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Count addresses before deletion
            count = batch_addresses.count()
            
            # Delete all addresses in the batch
            batch_addresses.delete()
            
            logger.info(f"Deleted batch {batch_id} with {count} addresses for manager {manager}")
            
            return Response({
                'message': f'Batch deleted successfully',
                'batch_id': str(batch_id),
                'deleted_count': count
            })
            
        except Exception as e:
            logger.error(f"Error deleting batch {batch_id}: {e}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @extend_schema(
        summary="Cancel batch processing",
        description="Cancel an ongoing batch upload. Sets cancellation flag and immediately deletes all addresses in the batch. The background thread will detect cancellation and stop processing.",
        parameters=[
            OpenApiParameter(
                name='batch_id',
                type=str,
                description='Batch ID to cancel',
                required=True
            ),
        ],
        responses={
            200: "Batch cancelled successfully",
            400: "Bad Request - Missing batch_id or batch cannot be cancelled",
            401: "Unauthorized",
            403: "Forbidden - Only batch owner can cancel",
            404: "Batch not found",
            500: "Internal Server Error"
        }
    )
    @action(detail=False, methods=['post'], url_path='cancel-batch')
    def cancel_batch(self, request):
        """Cancel an ongoing batch upload with immediate deletion (Strategy A)."""
        try:
            batch_id = request.query_params.get('batch_id')
            if not batch_id:
                return Response(
                    {'error': 'batch_id parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the manager instance for the current user
            if hasattr(request.user, 'manager') and request.user.manager:
                manager = request.user.manager
            else:
                return Response(
                    {'error': 'Only managers can cancel batches'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get or check batch status
            try:
                batch_status = BatchStatus.objects.get(batch_id=batch_id, manager=manager)
            except BatchStatus.DoesNotExist:
                # Check if batch exists in addresses but no BatchStatus record
                batch_addresses = UploadedAddress.objects.filter(
                    upload_batch_id=batch_id,
                    manager=manager
                )
                if batch_addresses.exists():
                    # Create BatchStatus record and mark as cancelled
                    batch_status = BatchStatus.objects.create(
                        batch_id=batch_id,
                        manager=manager,
                        campaign=batch_addresses.first().campaign,
                        status='cancelled',
                        total_addresses=batch_addresses.count(),
                        processed_addresses=batch_addresses.count(),
                        cancelled_at=timezone.now(),
                        cancelled_by=manager
                    )
                    # Delete all addresses
                    deleted_count = batch_addresses.delete()[0]
                    
                    logger.info(f"Cancelled batch {batch_id} (legacy - no BatchStatus). Deleted {deleted_count} addresses")
                    
                    return Response({
                        'message': 'Batch cancelled successfully',
                        'batch_id': str(batch_id),
                        'status': 'cancelled',
                        'deleted_addresses': deleted_count,
                        'cancelled_at': batch_status.cancelled_at.isoformat()
                    })
                else:
                    return Response(
                        {'error': 'Batch not found or you do not have permission to cancel it'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            
            # Check if batch can be cancelled
            if not batch_status.can_be_cancelled:
                return Response(
                    {
                        'error': f'Batch cannot be cancelled. Current status: {batch_status.status}',
                        'batch_id': str(batch_id),
                        'current_status': batch_status.status
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # STRATEGY A: Immediate Deletion
            # Step 1: Get all addresses in the batch
            batch_addresses = UploadedAddress.objects.filter(
                upload_batch_id=batch_id,
                manager=manager
            )
            
            # Step 2: Count addresses before deletion
            count_before = batch_addresses.count()
            processed_before = batch_status.processed_addresses
            
            # Step 3: Set batch status to cancelled (this signals background thread to stop)
            batch_status.status = 'cancelled'
            batch_status.cancelled_at = timezone.now()
            batch_status.cancelled_by = manager
            batch_status.save()
            
            # Step 4: Immediately delete all addresses in the batch
            deleted_count = batch_addresses.delete()[0]
            
            logger.info(
                f"Cancelled batch {batch_id} for manager {manager}. "
                f"Deleted {deleted_count} addresses (found {count_before} total, processed {processed_before} before cancellation)"
            )
            
            return Response({
                'message': 'Batch cancelled successfully',
                'batch_id': str(batch_id),
                'status': 'cancelled',
                'deleted_addresses': deleted_count,
                'total_addresses': batch_status.total_addresses,
                'processed_before_cancel': processed_before,
                'cancelled_at': batch_status.cancelled_at.isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error cancelling batch: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'error': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
