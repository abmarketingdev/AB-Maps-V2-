# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.contrib.gis.db import models


class Activity(models.Model):
    id = models.BigAutoField(primary_key=True)
    activity_time = models.DateTimeField()
    activity_type = models.CharField(max_length=100, blank=True, null=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    outcome = models.CharField(max_length=100, blank=True, null=True)
    campaign = models.ForeignKey('Campaign', models.DO_NOTHING)
    employee = models.ForeignKey('Employee', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'activity'


class Address(models.Model):
    id = models.UUIDField(primary_key=True)
    address_text = models.TextField()
    position = models.PointField(blank=True, null=True)
    tags = models.JSONField()
    recorded_at = models.DateTimeField()
    employee = models.ForeignKey('Employee', models.DO_NOTHING, blank=True, null=True)
    manager = models.ForeignKey('Manager', models.DO_NOTHING, blank=True, null=True)
    status = models.CharField(max_length=20)

    class Meta:
        managed = False
        db_table = 'address'


class Area(models.Model):
    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255)
    polygon_geometry = models.PolygonField(blank=True, null=True)
    color = models.CharField(max_length=7, blank=True, null=True)
    status = models.CharField(max_length=20)
    fylke = models.CharField(max_length=100, blank=True, null=True)
    house_count = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('Manager', models.DO_NOTHING)
    manager = models.ForeignKey('Manager', models.DO_NOTHING, related_name='area_manager_set', blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'area'


class AreaEmployee(models.Model):
    id = models.BigAutoField(primary_key=True)
    area = models.ForeignKey(Area, models.DO_NOTHING)
    employee = models.ForeignKey('Employee', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'area_employee'
        unique_together = (('area', 'employee'),)


class AreasAreateam(models.Model):
    id = models.BigAutoField(primary_key=True)
    assigned_at = models.DateTimeField()
    area = models.ForeignKey(Area, models.DO_NOTHING)
    team = models.ForeignKey('Team', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'areas_areateam'
        unique_together = (('area', 'team'),)


class AuthGroup(models.Model):
    name = models.CharField(unique=True, max_length=150)

    class Meta:
        managed = False
        db_table = 'auth_group'


class AuthGroupPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)
    permission = models.ForeignKey('AuthPermission', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_group_permissions'
        unique_together = (('group', 'permission'),)


class AuthPermission(models.Model):
    name = models.CharField(max_length=255)
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING)
    codename = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'auth_permission'
        unique_together = (('content_type', 'codename'),)


class AuthUser(models.Model):
    password = models.CharField(max_length=128)
    last_login = models.DateTimeField(blank=True, null=True)
    is_superuser = models.BooleanField()
    username = models.CharField(unique=True, max_length=150)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.CharField(max_length=254)
    is_staff = models.BooleanField()
    is_active = models.BooleanField()
    date_joined = models.DateTimeField()
    id = models.UUIDField(primary_key=True)
    employee = models.OneToOneField('Employee', models.DO_NOTHING, blank=True, null=True)
    manager = models.OneToOneField('Manager', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'auth_user'


class AuthUserGroups(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(AuthUser, models.DO_NOTHING)
    group = models.ForeignKey(AuthGroup, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_user_groups'
        unique_together = (('user', 'group'),)


class AuthUserUserPermissions(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(AuthUser, models.DO_NOTHING)
    permission = models.ForeignKey(AuthPermission, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'auth_user_user_permissions'
        unique_together = (('user', 'permission'),)


class Campaign(models.Model):
    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    created_by = models.ForeignKey('Manager', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'campaign'


class CampaignArea(models.Model):
    id = models.BigAutoField(primary_key=True)
    area_id = models.UUIDField()
    campaign = models.ForeignKey(Campaign, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'campaign_area'
        unique_together = (('campaign', 'area_id'),)


class CampaignMetrics(models.Model):
    id = models.BigAutoField(primary_key=True)
    value = models.FloatField()
    campaign = models.ForeignKey(Campaign, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'campaign_metrics'


class CampaignTeam(models.Model):
    id = models.BigAutoField(primary_key=True)
    campaign = models.ForeignKey(Campaign, models.DO_NOTHING)
    team = models.ForeignKey('Team', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'campaign_team'
        unique_together = (('campaign', 'team'),)


class ConversionMetrics(models.Model):
    id = models.BigAutoField(primary_key=True)
    stage = models.CharField(max_length=100)
    value = models.FloatField()

    class Meta:
        managed = False
        db_table = 'conversion_metrics'


class DjangoAdminLog(models.Model):
    action_time = models.DateTimeField()
    object_id = models.TextField(blank=True, null=True)
    object_repr = models.CharField(max_length=200)
    action_flag = models.SmallIntegerField()
    change_message = models.TextField()
    content_type = models.ForeignKey('DjangoContentType', models.DO_NOTHING, blank=True, null=True)
    user = models.ForeignKey(AuthUser, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'django_admin_log'


class DjangoContentType(models.Model):
    app_label = models.CharField(max_length=100)
    model = models.CharField(max_length=100)

    class Meta:
        managed = False
        db_table = 'django_content_type'
        unique_together = (('app_label', 'model'),)


class DjangoMigrations(models.Model):
    id = models.BigAutoField(primary_key=True)
    app = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    applied = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_migrations'


class DjangoSession(models.Model):
    session_key = models.CharField(primary_key=True, max_length=40)
    session_data = models.TextField()
    expire_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'django_session'


class Employee(models.Model):
    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.CharField(unique=True, max_length=254)
    phone = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20)
    is_online = models.BooleanField()
    last_seen = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    manager = models.ForeignKey('Manager', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'employee'


class LocationPing(models.Model):
    id = models.UUIDField(primary_key=True)
    device_id = models.CharField(max_length=100)
    timestamp = models.DateTimeField()
    point = models.PointField()
    accuracy = models.FloatField(blank=True, null=True)
    employee = models.ForeignKey(Employee, models.DO_NOTHING, blank=True, null=True)
    manager = models.ForeignKey('Manager', models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'location_ping'


class Manager(models.Model):
    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.CharField(unique=True, max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20)
    is_online = models.BooleanField()
    last_seen = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'manager'


class PerformanceMetrics(models.Model):
    id = models.BigAutoField(primary_key=True)
    metric_time = models.DateTimeField()
    calls = models.IntegerField()
    orders = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'performance_metrics'


class Rapport(models.Model):
    id = models.BigAutoField(primary_key=True)
    client = models.CharField(max_length=255)
    o1 = models.IntegerField()
    o2 = models.IntegerField()
    o3 = models.IntegerField()
    sms_pr = models.IntegerField()
    con = models.IntegerField()
    trans = models.IntegerField()
    conver = models.IntegerField()
    s = models.IntegerField()
    y1 = models.IntegerField()
    y2 = models.IntegerField()
    y3 = models.IntegerField()
    y4 = models.IntegerField()
    y5 = models.IntegerField()
    y6 = models.IntegerField()
    agent_employee = models.ForeignKey(Employee, models.DO_NOTHING)
    campaign = models.ForeignKey(Campaign, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'rapport'


class Sale(models.Model):
    id = models.BigAutoField(primary_key=True)
    sale_time = models.DateTimeField()
    mobile = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20)
    activity = models.CharField(max_length=255, blank=True, null=True)
    campaign = models.ForeignKey(Campaign, models.DO_NOTHING)
    contact_employee = models.ForeignKey(Employee, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'sale'


class Team(models.Model):
    id = models.UUIDField(primary_key=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    manager = models.ForeignKey(Manager, models.DO_NOTHING, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'team'


class TeamMember(models.Model):
    id = models.BigAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, models.DO_NOTHING)
    team = models.ForeignKey(Team, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'team_member'
        unique_together = (('team', 'employee'),)
