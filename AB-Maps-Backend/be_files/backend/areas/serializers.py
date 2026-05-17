"""
Serializers for the areas app.
"""
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from users.serializers import EmployeeSerializer, ManagerSerializer
from users.models import Employee, Manager
from .models import Area, AreaEmployee


class UnifiedPersonSerializer(serializers.Serializer):
    """Serializer for unified person (employee or manager) in area assignment lists."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_null=True)
    status = serializers.CharField()
    is_online = serializers.BooleanField()
    person_type = serializers.CharField(help_text="Either 'employee' or 'manager'")
    ab_person_id = serializers.CharField(required=False, allow_null=True)
    
    @classmethod
    def from_area_employee(cls, area_employee):
        """Create serializer instance from AreaEmployee object."""
        person = area_employee.person
        user = getattr(person, 'user', None)
        
        return cls({
            'id': person.id,
            'name': person.name,
            'email': person.email or '',
            'phone': person.phone,
            'status': person.status,
            'is_online': person.is_online,
            'person_type': area_employee.person_type,
            'ab_person_id': user.ab_person_id if user else None,
        })


class AreaEmployeeSerializer(serializers.ModelSerializer):
    """Serializer for AreaEmployee supporting both employees and managers."""
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
        model = AreaEmployee
        fields = ['id', 'area', 'employee', 'employee_id', 'manager', 'manager_id', 'person_type', 'person']
        read_only_fields = ['id', 'employee', 'manager', 'person_type', 'person']

    def get_person(self, obj):
        """Return serialized person (employee or manager)."""
        if obj.employee:
            return EmployeeSerializer(obj.employee).data
        elif obj.manager:
            return ManagerSerializer(obj.manager).data
        return None

    def validate(self, attrs):
        area = attrs.get('area')
        employee = attrs.get('employee')
        manager = attrs.get('manager')
        
        # Ensure exactly one is provided
        if not employee and not manager:
            raise ValidationError({'detail': 'Either employee_id or manager_id must be provided.'})
        if employee and manager:
            raise ValidationError({'detail': 'Cannot provide both employee_id and manager_id.'})
        
        # Check for existing assignments (exclude current instance if updating)
        if area:
            queryset = AreaEmployee.objects.filter(area=area)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            
            if employee:
                if queryset.filter(employee=employee).exists():
                    raise ValidationError({'detail': 'This employee is already assigned to this area.'})
            elif manager:
                if queryset.filter(manager=manager).exists():
                    raise ValidationError({'detail': 'This manager is already assigned to this area.'})
        
        return attrs


class AreaSerializer(serializers.ModelSerializer):
    manager = ManagerSerializer(read_only=True)
    manager_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    employees = serializers.SerializerMethodField()  # Now includes both employees and managers
    employee_count = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    start_date = serializers.DateTimeField(required=False, allow_null=True)
    end_date = serializers.DateTimeField(required=False, allow_null=True)
    is_expired = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    enrichment_job_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Area
        fields = [
            'id', 'name', 'polygon_geometry', 'color', 'status', 'fylke', 'house_count', 'apartment_count',
            'created_by', 'manager', 'manager_id',
            'employees', 'employee_count', 
            'start_date', 'end_date', 'is_expired', 'is_active',
            'enrichment_job_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 
                           'manager', 'manager_id', 'is_expired', 'is_active', 'enrichment_job_id']
    
    def to_internal_value(self, data):
        """Handle apartment_counts input field and map it to apartment_count."""
        if 'apartment_counts' in data:
            data = data.copy()
            data['apartment_count'] = data.pop('apartment_counts')
        return super().to_internal_value(data)
    
    def get_employees(self, obj):
        """Return all assigned persons (employees and managers) as unified format."""
        assignments = AreaEmployee.objects.filter(area=obj).select_related('employee', 'manager')
        result = []
        for assignment in assignments:
            person = assignment.person
            user = getattr(person, 'user', None)
            result.append({
                'id': person.id,
                'name': person.name,
                'email': person.email or '',
                'phone': person.phone,
                'status': person.status,
                'is_online': person.is_online,
                'person_type': assignment.person_type,
                'ab_person_id': user.ab_person_id if user else None,
            })
        return result
    
    def get_employee_count(self, obj):
        """Count both employees and managers assigned to the area."""
        return AreaEmployee.objects.filter(area=obj).count()
    
    def get_created_by(self, obj):
        """Return created_by as UUID string instead of object."""
        return str(obj.created_by.id) if obj.created_by else None
    
    def get_is_expired(self, obj):
        """Check if area has expired."""
        return obj.is_expired
    
    def get_is_active(self, obj):
        """Check if area is currently active."""
        return obj.is_active
    
    def get_enrichment_job_id(self, obj):
        """Return enrichment job ID if it exists."""
        # Check if job_id was passed via context (for newly created jobs)
        if 'enrichment_job_id' in self.context:
            return str(self.context['enrichment_job_id'])
        # Otherwise, check if area has an enrichment_job relationship
        try:
            if hasattr(obj, 'enrichment_job'):
                return str(obj.enrichment_job.id)
        except AttributeError:
            pass
        return None


class AreaDetailSerializer(AreaSerializer):
    """Detailed serializer for Area with full assignment details."""
    
    class Meta(AreaSerializer.Meta):
        fields = [
            'id', 'name', 'polygon_geometry', 'color', 'status', 'fylke', 'house_count', 'apartment_count',
            'created_by', 'manager', 'manager_id',
            'employees', 'employee_count', 
            'start_date', 'end_date', 'is_expired', 'is_active',
            'created_at', 'updated_at'
        ]
    
    def get_employees(self, obj):
        """Override to use AreaEmployeeSerializer for detailed view with full assignment info."""
        assignments = AreaEmployee.objects.filter(area=obj).select_related('employee', 'manager')
        return AreaEmployeeSerializer(assignments, many=True).data


class AreaGeoSerializer(GeoFeatureModelSerializer):
    """GeoJSON serializer for areas with geometry."""
    start_date = serializers.DateTimeField(read_only=True)
    end_date = serializers.DateTimeField(read_only=True)
    is_expired = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    
    class Meta:
        model = Area
        geo_field = 'polygon_geometry'
        fields = [
            'id', 'name', 'color', 'status', 'fylke', 'house_count', 'apartment_count',
            'created_by', 'manager', 
            'start_date', 'end_date', 'is_expired', 'is_active',
            'created_at', 'updated_at'
        ]
    
    def get_is_expired(self, obj):
        """Check if area has expired."""
        return obj.is_expired
    
    def get_is_active(self, obj):
        """Check if area is currently active."""
        return obj.is_active


class AreaNearbySerializer(serializers.ModelSerializer):
    """Serializer for nearby areas with distance field - matches regular AreaSerializer format."""
    manager = ManagerSerializer(read_only=True)
    employees = serializers.SerializerMethodField()  # Now includes both employees and managers
    employee_count = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    distance_m = serializers.SerializerMethodField()
    polygon_geometry = serializers.SerializerMethodField()
    start_date = serializers.DateTimeField(read_only=True)
    end_date = serializers.DateTimeField(read_only=True)
    is_expired = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()
    
    class Meta:
        model = Area
        fields = [
            'id', 'name', 'polygon_geometry', 'color', 'status', 'fylke', 'house_count', 'apartment_count',
            'created_by', 'manager', 'employees', 'employee_count', 
            'distance_m', 'start_date', 'end_date', 'is_expired', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields
    
    def get_employees(self, obj):
        """Return all assigned persons (employees and managers) as unified format."""
        # Use prefetched assignments if available to avoid N+1 queries
        assignments = getattr(obj, 'prefetched_assignments', None)
        if assignments is None:
            assignments = AreaEmployee.objects.filter(area=obj).select_related('employee', 'manager')
        
        result = []
        for assignment in assignments:
            person = assignment.person
            user = getattr(person, 'user', None)
            result.append({
                'id': person.id,
                'name': person.name,
                'email': person.email or '',
                'phone': person.phone,
                'status': person.status,
                'is_online': person.is_online,
                'person_type': assignment.person_type,
                'ab_person_id': user.ab_person_id if user else None,
            })
        return result
    
    def get_employee_count(self, obj):
        """Count both employees and managers assigned to the area."""
        # Use prefetched assignments if available to avoid N+1 queries
        assignments = getattr(obj, 'prefetched_assignments', None)
        return len(assignments) if assignments is not None else AreaEmployee.objects.filter(area=obj).count()
    
    def get_created_by(self, obj):
        """Return created_by as UUID string instead of object."""
        return str(obj.created_by.id) if obj.created_by else None
    
    def get_is_expired(self, obj):
        """Check if area has expired."""
        return obj.is_expired
    
    def get_is_active(self, obj):
        """Check if area is currently active."""
        return obj.is_active
    
    def get_distance_m(self, obj):
        """Return distance in meters from extra() select."""
        # The distance_m comes from the extra() select in the query
        return getattr(obj, 'distance_m', None)
    
    def get_polygon_geometry(self, obj):
        """Return polygon geometry based on include_geometry parameter."""
        # Check if include_geometry is False in the context
        request = self.context.get('request')
        if request and request.query_params.get('include_geometry', 'true').lower() == 'false':
            return None
        
        # Convert geometry to GeoJSON format - parse string to object to match regular areas format
        if obj.polygon_geometry:
            import json
            geojson_str = obj.polygon_geometry.geojson
            return json.loads(geojson_str)  # Parse JSON string to object
        return None 