from django.contrib import admin
from .models import Campaign, CampaignForm, CampaignArea, CampaignEmployee

# Register your models here.

@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'brand_color_hex', 'created_by', 'created_at', 'updated_at')
    list_filter = ('created_at', 'updated_at')
    search_fields = ('name', 'description', 'created_by__name')
    readonly_fields = ('id', 'created_at', 'updated_at')

@admin.register(CampaignForm)
class CampaignFormAdmin(admin.ModelAdmin):
    list_display = ('unique_id', 'campaign', 'first_name', 'last_name', 'status', 'current_date', 'sales_rep_id')
    list_filter = ('status', 'current_date', 'campaign', 'skip')
    search_fields = ('first_name', 'last_name', 'email', 'sms_phone_number', 'unique_id')
    readonly_fields = ('unique_id', 'created_at', 'updated_at')
    fieldsets = (
        ('Basic Information', {
            'fields': ('unique_id', 'campaign', 'status', 'sales_rep_id', 'current_date')
        }),
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'email', 'sms_phone_number', 'date_of_birth', 'kidnumber')
        }),
        ('Address Information', {
            'fields': ('address', 'address_text', 'postnummer', 'posted')
        }),
        ('Financial Information', {
            'fields': ('kontonummer', 'gavebeløp', 'beløpsgrense', 'skattefradrag_fødselsnummer')
        }),
        ('Additional Information', {
            'fields': ('personel_number', 'skip', 'signature')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(CampaignArea)
class CampaignAreaAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'area')
    list_filter = ('campaign', 'area')
    search_fields = ('campaign__name', 'area__name')

@admin.register(CampaignEmployee)
class CampaignEmployeeAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'employee', 'assigned_at')
    list_filter = ('campaign', 'assigned_at')
    search_fields = ('campaign__name', 'employee__name')
    readonly_fields = ('assigned_at',)
