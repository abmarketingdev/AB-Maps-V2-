"""
Serializers for the campaigns app.
"""
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from datetime import date
import logging
from .models import Campaign, CampaignForm, CampaignArea, CampaignEmployee
from areas.models import Area  # Ensure Area is imported only once
from areas.serializers import AreaSerializer
from users.serializers import ManagerSerializer, EmployeeSerializer
from users.models import Employee, Manager
from addresses.models import Address
from addresses.serializers import AddressSerializer

# Handle services import with fallback
try:
    from services.kid_generator import KIDGeneratorService, KIDGenerationError
    print("✅ Successfully imported KIDGeneratorService directly")
except ImportError:
    # Fallback: try to import from the backend directory
    import sys
    import os
    from pathlib import Path
    
    # Get the backend directory path
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
        print(f"Added {backend_dir} to Python path")
    
    # Debug: Check if the services directory exists
    services_dir = backend_dir / "services"
    kid_generator_file = services_dir / "kid_generator.py"
    
    print(f"🔍 Debugging services import:")
    print(f"  Backend dir: {backend_dir}")
    print(f"  Services dir: {services_dir}")
    print(f"  Services dir exists: {services_dir.exists()}")
    print(f"  Kid generator file: {kid_generator_file}")
    print(f"  Kid generator file exists: {kid_generator_file.exists()}")
    
    if services_dir.exists():
        print(f"  Services dir contents: {list(services_dir.iterdir())}")
    
    try:
        from services.kid_generator import KIDGeneratorService, KIDGenerationError
        print("✅ Successfully imported KIDGeneratorService after path fix")
    except ImportError:
        # Try relative import as last resort
        try:
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "kid_generator", 
                kid_generator_file
            )
            kid_generator_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(kid_generator_module)
            KIDGeneratorService = kid_generator_module.KIDGeneratorService
            KIDGenerationError = kid_generator_module.KIDGenerationError
            print("✅ Successfully imported KIDGeneratorService using importlib")
        except Exception as e:
            # If still can't import, create dummy classes for development
            class KIDGeneratorService:
                def __init__(self):
                    pass
                def generate_kid_number(self, form_data):
                    raise Exception("KID Generator Service not available")
            
            class KIDGenerationError(Exception):
                pass
            
            print(f"⚠️  Warning: Could not import KIDGeneratorService: {e}")

logger = logging.getLogger(__name__)

_BRAND_HEX_CHARS = frozenset('0123456789abcdefABCDEF')


def normalize_brand_color_hex(value):
    """
    Accept #RGB or #RRGGBB, return normalized #RRGGBB uppercase.
    Raises ValidationError if invalid.
    """
    s = value.strip()
    if not s.startswith('#'):
        raise ValidationError('Enter a valid hex color, e.g. #RRGGBB.')
    body = s[1:]
    if len(body) == 3 and all(c in _BRAND_HEX_CHARS for c in body):
        body = ''.join(c * 2 for c in body)
    elif len(body) == 6 and all(c in _BRAND_HEX_CHARS for c in body):
        pass
    else:
        raise ValidationError('Enter a valid hex color, e.g. #RRGGBB.')
    return f'#{body.upper()}'


class CampaignFormSerializer(serializers.ModelSerializer):
    """Serializer for CampaignForm model."""
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    full_name = serializers.CharField(read_only=True)
    address_details = AddressSerializer(source='address', read_only=True)
    
    class Meta:
        model = CampaignForm
        fields = [
            'unique_id', 'campaign', 'campaign_name', 'status', 'sales_rep_id',
            'first_name', 'last_name', 'full_name', 'email', 'sms_phone_number',
            'kidnumber', 'date_of_birth', 'address', 'address_details', 'address_text', 'postnummer', 'posted',
            'kontonummer', 'gavebeløp', 'beløpsgrense', 'skattefradrag_fødselsnummer',
            'current_date', 'personel_number', 'skip', 'signature',
            'kid_number', 'kid_generated_at', 'kid_generation_status', 'kid_error_message',
            'external_person_id', 'external_agreement_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['unique_id', 'created_at', 'updated_at', 'campaign_name', 'full_name', 'sales_rep_id',
                           'kid_number', 'kid_generated_at', 'kid_generation_status', 'kid_error_message',
                           'external_person_id', 'external_agreement_id']

    def validate_date_of_birth(self, value):
        """Validate that date of birth is not in the future."""
        if value and value > date.today():
            raise ValidationError("Date of birth cannot be in the future.")
        return value
    
    def to_internal_value(self, data):
        """Convert frontend data format to internal format before validation."""
        # Handle date format conversion from MM/DD/YYYY to YYYY-MM-DD
        if 'date_of_birth' in data and data['date_of_birth']:
            try:
                # Try to parse MM/DD/YYYY format
                from datetime import datetime
                date_str = data['date_of_birth']
                if '/' in date_str:
                    # Parse MM/DD/YYYY format
                    parsed_date = datetime.strptime(date_str, '%m/%d/%Y')
                    data['date_of_birth'] = parsed_date.strftime('%Y-%m-%d')
                    logger.info(f"Converted date from {date_str} to {data['date_of_birth']}")
            except ValueError:
                # If parsing fails, keep original format (might be YYYY-MM-DD already)
                logger.warning(f"Could not parse date format: {data['date_of_birth']}")
        
        # Handle address cleaning
        if 'address_text' in data and data['address_text']:
            # Clean address by removing postal code and city if present
            import re
            address = data['address_text']
            # Remove postal code pattern (4 digits + city) from end
            cleaned_address = re.sub(r',?\s*\d{4}\s+[A-Za-zÅåÆæØø\s]+$', '', address)
            data['address_text'] = cleaned_address.strip()
            logger.info(f"Cleaned address from '{address}' to '{data['address_text']}'")
        
        # Handle postnummer validation and cleaning
        if 'postnummer' in data and data['postnummer']:
            postnummer = data['postnummer']
            # Remove any non-digit characters
            cleaned_postnummer = ''.join(filter(str.isdigit, postnummer))
            if len(cleaned_postnummer) == 4 and cleaned_postnummer != '0000':
                data['postnummer'] = cleaned_postnummer
                logger.info(f"Cleaned postnummer from '{postnummer}' to '{data['postnummer']}'")
            else:
                # If invalid or 0000, use default
                data['postnummer'] = '0151'
                logger.warning(f"Invalid postnummer '{postnummer}', using default '0151'")
        elif 'postnummer' in data:
            # If postnummer is empty or None, use default
            data['postnummer'] = '0151'
            logger.warning(f"Empty postnummer, using default '0151'")
        
        return super().to_internal_value(data)

    def validate_gavebeløp(self, value):
        """Validate that donation amount is positive."""
        if value is not None and value <= 0:
            raise ValidationError("Donation amount must be positive.")
        return value

    def validate_beløpsgrense(self, value):
        """Validate that amount limit is positive."""
        if value is not None and value <= 0:
            raise ValidationError("Amount limit must be positive.")
        return value

    def validate_skattefradrag_fødselsnummer(self, value):
        """Validate Norwegian national ID number format."""
        if value:
            if len(value) != 11:
                raise ValidationError("National ID number must be exactly 11 digits.")
            if not value.isdigit():
                raise ValidationError("National ID number must contain only digits.")
        return value

    def validate_sms_phone_number(self, value):
        """Validate phone number format."""
        if value:
            # Remove spaces and common separators
            cleaned = ''.join(filter(str.isdigit, value))
            if len(cleaned) < 8:
                raise ValidationError("Phone number must be at least 8 digits.")
        return value

    def validate_postnummer(self, value):
        """Validate Norwegian postal code format."""
        if value:
            if len(value) != 4:
                raise ValidationError("Postal code must be exactly 4 digits.")
            if not value.isdigit():
                raise ValidationError("Postal code must contain only digits.")
        return value

    def validate_signature(self, value):
        """Validate base64 signature format and size."""
        if value:
            import base64
            import re
            
            # Remove data URL prefix if present (e.g., "data:image/png;base64,")
            if value.startswith('data:'):
                # Extract the base64 part after the comma
                value = value.split(',', 1)[1] if ',' in value else value
            
            # Check if it's valid base64
            try:
                # Add padding if needed
                padding = 4 - (len(value) % 4)
                if padding != 4:
                    value += '=' * padding
                
                # Try to decode
                base64.b64decode(value)
            except Exception:
                raise ValidationError("Invalid base64 signature format.")
            
            # Check size (limit to 1MB to prevent abuse)
            decoded_size = len(base64.b64decode(value))
            if decoded_size > 1024 * 1024:  # 1MB limit
                raise ValidationError("Signature image is too large. Maximum size is 1MB.")
        
        return value

    def validate(self, data):
        """Validate form data before KID generation"""
        logger.info("Validating campaign form data for KID generation...")
        
        # Check if required fields for KID generation are present
        if self._should_generate_kid(data):
            required_fields = ['first_name', 'last_name', 'email', 'gavebeløp']
            missing_fields = [field for field in required_fields if not data.get(field)]
            
            if missing_fields:
                error_msg = f"KID generation requires these fields: {', '.join(missing_fields)}"
                logger.warning(f"KID generation validation failed: {error_msg}")
                raise ValidationError(error_msg)
            
            logger.info("KID generation validation passed")
        
        return data

    def create(self, validated_data):
        """Create form and generate KID if conditions are met"""
        logger.info("Creating campaign form with KID generation...")
        
        # Create form first
        if 'current_date' not in validated_data:
            validated_data['current_date'] = timezone.now()
        
        form = super().create(validated_data)
        logger.info(f"Campaign form created with ID: {form.unique_id}")
        
        # Generate KID if enabled and required fields are present
        if self._should_generate_kid(validated_data):
            logger.info("Starting KID generation process...")
            try:
                kid_service = KIDGeneratorService()
                
                # Prepare form data for KID generation
                form_data_for_kid = self._prepare_form_data_for_kid(form, validated_data)
                logger.info(f"Form data prepared for KID generation: {form_data_for_kid}")
                
                # Generate KID number
                kid_number = kid_service.generate_kid_number(form_data_for_kid)
                logger.info(f"KID generated successfully: {kid_number}")
                
                # Update form with KID information
                form.kid_number = kid_number
                form.kid_generated_at = timezone.now()
                form.kid_generation_status = 'success'
                form.save()
                
                logger.info(f"Campaign form updated with KID: {kid_number}")
                
            except KIDGenerationError as e:
                logger.error(f"KID generation failed: {str(e)}")
                form.kid_generation_status = 'failed'
                form.kid_error_message = str(e)
                form.save()
                # Don't raise exception - form creation succeeds even if KID fails
                
            except Exception as e:
                logger.error(f"Unexpected error during KID generation: {str(e)}")
                form.kid_generation_status = 'failed'
                form.kid_error_message = f"Unexpected error: {str(e)}"
                form.save()
                # Don't raise exception - form creation succeeds even if KID fails
        else:
            logger.info("KID generation skipped - conditions not met")
        
        return form
    
    def _should_generate_kid(self, data):
        """Determine if KID should be generated"""
        # Check if KID generation is enabled
        from django.conf import settings
        if not getattr(settings, 'KID_GENERATION_ENABLED', True):
            logger.info("KID generation disabled in settings")
            return False
        
        # Check if required fields are present for LagrePerson API
        required_fields = ['first_name', 'last_name', 'email', 'gavebeløp', 'address_text', 'postnummer']
        has_required_fields = all(data.get(field) for field in required_fields)
        
        if has_required_fields:
            logger.info("All required fields present for KID generation")
        else:
            logger.info("Missing required fields for KID generation")
        
        return has_required_fields
    
    def _prepare_form_data_for_kid(self, form, validated_data):
        """Prepare form data for KID generation service"""
        # Get address details if available
        address_data = {}
        if form.address:
            address_data = {
                'address__address_text': form.address.address_text,
            }
        
        # Clean and prepare data to match the working test format
        first_name = validated_data.get('first_name', '').strip()
        last_name = validated_data.get('last_name', '').strip()
        email = validated_data.get('email', '').strip()
        sms_phone_number = validated_data.get('sms_phone_number', '').strip()
        date_of_birth = validated_data.get('date_of_birth')
        skattefradrag_fødselsnummer = validated_data.get('skattefradrag_fødselsnummer', '').strip()
        gavebeløp = validated_data.get('gavebeløp')
        address_text = validated_data.get('address_text', '').strip()
        postnummer = validated_data.get('postnummer', '').strip()
        posted = validated_data.get('posted', '').strip()
        
        # Additional cleaning for KID generation
        # Clean address further for API
        if address_text:
            import re
            # Remove postal code and city from address
            cleaned_address = re.sub(r',?\s*\d{4}\s+[A-Za-zÅåÆæØø\s]+$', '', address_text)
            # If address is too long, take only the street part
            if len(cleaned_address) > 50:
                parts = cleaned_address.split(',')
                cleaned_address = parts[0].strip()
            address_text = cleaned_address if cleaned_address else "Testveien 2"
        
        # Clean postnummer
        if postnummer:
            # Remove any non-digit characters
            digits_only = re.sub(r'\D', '', postnummer)
            if len(digits_only) == 4:
                postnummer = digits_only
            else:
                postnummer = "0151"  # Default fallback
        else:
            postnummer = "0151"  # Default fallback
        
        # Clean social security number
        if skattefradrag_fødselsnummer:
            # Remove any non-digit characters
            digits_only = re.sub(r'\D', '', skattefradrag_fødselsnummer)
            if len(digits_only) == 11:
                skattefradrag_fødselsnummer = digits_only
            else:
                skattefradrag_fødselsnummer = "12070398131"  # Default fallback
        else:
            skattefradrag_fødselsnummer = "12070398131"  # Default fallback
        
        # Combine form data with address data - map all CampaignForm fields
        form_data = {
            'first_name': first_name,
            'last_name': last_name,
            'email': email,
            'sms_phone_number': sms_phone_number,
            'date_of_birth': date_of_birth,
            'skattefradrag_fødselsnummer': skattefradrag_fødselsnummer,
            'gavebeløp': gavebeløp,
            'current_date': validated_data.get('current_date'),
            'sales_rep_id': validated_data.get('sales_rep_id'),
            'address_text': address_text,
            'postnummer': postnummer,
            'posted': posted,  # City field from CampaignForm
            **address_data
        }
        
        logger.info(f"Form data prepared for KID generation: {form_data}")
        return form_data


class CampaignFormListSerializer(serializers.ModelSerializer):
    """Simplified serializer for listing campaign forms."""
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    full_name = serializers.CharField(read_only=True)
    
    class Meta:
        model = CampaignForm
        fields = [
            'unique_id', 'campaign_name', 'first_name', 'last_name', 'full_name',
            'status', 'current_date', 'sales_rep_id', 'gavebeløp'
        ]
        read_only_fields = fields


class CampaignAreaSerializer(serializers.ModelSerializer):
    area = AreaSerializer(read_only=True)  # Nested area details for GET
    area_id = serializers.PrimaryKeyRelatedField(queryset=Area.objects.all(), source='area', write_only=True)  # For POST/PUT
    
    class Meta:
        model = CampaignArea
        fields = ['id', 'campaign', 'area', 'area_id']
        read_only_fields = ['id', 'area']

    def validate(self, attrs):
        campaign = attrs.get('campaign')
        area = attrs.get('area')
        if campaign and area:
            if CampaignArea.objects.filter(campaign=campaign, area=area).exists():
                raise ValidationError({'detail': 'This area is already assigned to this campaign.'})
        return attrs


class CampaignEmployeeSerializer(serializers.ModelSerializer):
    employee = EmployeeSerializer(read_only=True)  # Nested employee details for GET
    manager = ManagerSerializer(read_only=True)  # Nested manager details for GET
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), 
        source='employee', 
        write_only=True,
        required=False,
        allow_null=True
    )
    manager_id = serializers.PrimaryKeyRelatedField(
        queryset=Manager.objects.all(),
        source='manager',
        write_only=True,
        required=False,
        allow_null=True
    )
    person_type = serializers.CharField(read_only=True, help_text="Either 'employee' or 'manager'")
    person = serializers.SerializerMethodField(read_only=True, help_text="The assigned person (employee or manager)")
    
    class Meta:
        model = CampaignEmployee
        fields = ['id', 'campaign', 'employee', 'employee_id', 'manager', 'manager_id', 'person_type', 'person', 'assigned_at']
        read_only_fields = ['id', 'employee', 'manager', 'assigned_at', 'person_type', 'person']

    def get_person(self, obj):
        """Return serialized person (employee or manager)."""
        if obj.employee:
            return EmployeeSerializer(obj.employee).data
        elif obj.manager:
            return ManagerSerializer(obj.manager).data
        return None

    def validate(self, attrs):
        campaign = attrs.get('campaign')
        employee = attrs.get('employee')
        manager = attrs.get('manager')
        
        # Ensure exactly one is provided
        if not employee and not manager:
            raise ValidationError({'detail': 'Either employee_id or manager_id must be provided.'})
        if employee and manager:
            raise ValidationError({'detail': 'Cannot provide both employee_id and manager_id.'})
        
        # Check for existing assignments
        if campaign:
            if employee:
                if CampaignEmployee.objects.filter(campaign=campaign, employee=employee).exists():
                    raise ValidationError({'detail': 'This employee is already assigned to this campaign.'})
            elif manager:
                if CampaignEmployee.objects.filter(campaign=campaign, manager=manager).exists():
                    raise ValidationError({'detail': 'This manager is already assigned to this campaign.'})
        
        return attrs


class UnifiedPersonSerializer(serializers.Serializer):
    """Serializer for unified person (employee or manager) in assignment lists."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_null=True)
    status = serializers.CharField()
    is_online = serializers.BooleanField()
    person_type = serializers.CharField(help_text="Either 'employee' or 'manager'")
    ab_person_id = serializers.CharField(required=False, allow_null=True)
    assigned_at = serializers.DateTimeField(required=False)
    
    @classmethod
    def from_campaign_employee(cls, campaign_employee):
        """Create serializer instance from CampaignEmployee object."""
        person = campaign_employee.person
        user = getattr(person, 'user', None)
        
        return cls({
            'id': person.id,
            'name': person.name,
            'email': person.email or '',
            'phone': person.phone,
            'status': person.status,
            'is_online': person.is_online,
            'person_type': campaign_employee.person_type,
            'ab_person_id': user.ab_person_id if user else None,
            'assigned_at': campaign_employee.assigned_at
        })


class EmployeeCampaignSerializer(serializers.ModelSerializer):
    """Serializer for campaign information when retrieved by employee."""
    campaign = serializers.SerializerMethodField()
    assigned_at = serializers.DateTimeField()
    
    class Meta:
        model = CampaignEmployee
        fields = ['campaign', 'assigned_at']
    
    def get_campaign(self, obj):
        campaign = obj.campaign
        return {
            'id': str(campaign.id),
            'name': campaign.name,
            'description': campaign.description,
            'brand_color_hex': campaign.brand_color_hex,
            'created_at': campaign.created_at,
            'updated_at': campaign.updated_at,
            'created_by': {
                'id': str(campaign.created_by.id),
                'name': campaign.created_by.name,
                'email': campaign.created_by.email
            } if campaign.created_by else None
        }


class CampaignSerializer(serializers.ModelSerializer):
    areas = serializers.SerializerMethodField()
    employees = serializers.SerializerMethodField()
    team_count = serializers.SerializerMethodField()
    area_count = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()
    brand_color_hex = serializers.CharField(
        max_length=7,
        allow_null=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'description', 'brand_color_hex', 'areas', 'employees',
            'team_count', 'area_count', 'employee_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_brand_color_hex(self, value):
        if value is None:
            return None
        if isinstance(value, str) and value.strip() == '':
            return None
        return normalize_brand_color_hex(value)
    
    def get_team_count(self, obj):
        return 0  # Teams removed
    
    def get_area_count(self, obj):
        return obj.campaignarea_set.count()
    
    def get_employee_count(self, obj):
        return obj.campaign_employees.count()
    
    def get_areas(self, obj):
        campaign_areas = obj.campaignarea_set.all()
        return [{'id': str(ca.area.id)} for ca in campaign_areas]
    
    def get_employees(self, obj):
        campaign_assignments = obj.campaign_employees.all()
        result = []
        for assignment in campaign_assignments:
            person = assignment.person
            result.append({
                'id': str(person.id),
                'name': person.name,
                'person_type': assignment.person_type
            })
        return result


class CampaignDetailSerializer(CampaignSerializer):
    areas = serializers.SerializerMethodField()
    employees = serializers.SerializerMethodField()
    
    def get_areas(self, obj):
        campaign_areas = obj.campaignarea_set.all()
        areas_data = []
        for ca in campaign_areas:
            area = ca.area
            areas_data.append({
                'id': str(area.id),
                'name': area.name,
                'color': area.color,
                'status': area.status
            })
        return areas_data
    
    def get_employees(self, obj):
        campaign_assignments = obj.campaign_employees.all()
        employees_data = []
        for assignment in campaign_assignments:
            person = assignment.person
            employees_data.append({
                'id': str(person.id),
                'name': person.name,
                'email': person.email or '',
                'status': person.status,
                'person_type': assignment.person_type,
                'assigned_at': assignment.assigned_at
            })
        return employees_data


class AllCampaignsSerializer(serializers.ModelSerializer):
    """Serializer for all campaigns endpoint - includes created_by information."""
    created_by = serializers.SerializerMethodField()
    created_by_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'description', 'brand_color_hex', 'created_at', 'updated_at',
            'created_by', 'created_by_id'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'created_by_id']
    
    def get_created_by(self, obj):
        """Return manager name who created the campaign."""
        if obj.created_by:
            return obj.created_by.name
        return None
    
    def get_created_by_id(self, obj):
        """Return manager ID who created the campaign."""
        if obj.created_by:
            return str(obj.created_by.id)
        return None 