from django.contrib import admin
from .models import QCContact, QCHistory, QCSettings, ImportRecord, ContactAssignment, QCFavourite, QCCheckOff


@admin.register(QCContact)
class QCContactAdmin(admin.ModelAdmin):
    list_display = (
        'customer_name', 'phone_number', 'status', 'assigned_to', 
        'seller_name', 'urgent', 'created_at'
    )
    list_filter = ('status', 'urgent', 'qc_result', 'created_at', 'assigned_to')
    search_fields = ('customer_name', 'phone_number', 'seller_name', 'qc_agent_name')
    readonly_fields = ('id', 'created_at', 'last_attempt_at', 'qc_approved_at')
    fieldsets = (
        ('Customer Information', {
            'fields': ('customer_name', 'phone_number')
        }),
        ('Assignment', {
            'fields': ('assigned_to', 'seller_name', 'campaign')
        }),
        ('Workflow Status', {
            'fields': ('status', 'attempt_count', 'urgent', 'urgent_message')
        }),
        ('QC Results', {
            'fields': ('qc_result', 'svarte_category', 'si_opp', 'comment', 'qc_agent_name')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'last_attempt_at', 'qc_approved_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(QCHistory)
class QCHistoryAdmin(admin.ModelAdmin):
    list_display = (
        'customer_name', 'phone_number', 'qc_result', 'svarte_category',
        'qc_agent_name', 'tid', 'date', 'created_at'
    )
    list_filter = ('qc_result', 'svarte_category', 'date', 'qc_agent')
    search_fields = ('customer_name', 'phone_number', 'qc_agent_name', 'comment')
    readonly_fields = ('id', 'created_at', 'date')
    fieldsets = (
        ('Contact Reference', {
            'fields': ('contact',)
        }),
        ('Customer Information', {
            'fields': ('customer_name', 'phone_number')
        }),
        ('QC Results', {
            'fields': ('qc_result', 'svarte_category', 'si_opp', 'comment')
        }),
        ('Agent Information', {
            'fields': ('qc_agent_name', 'qc_agent')
        }),
        ('Timestamps', {
            'fields': ('tid', 'date', 'created_at')
        }),
    )


@admin.register(QCSettings)
class QCSettingsAdmin(admin.ModelAdmin):
    list_display = ('user', 'daily_goal', 'auto_copy_phone', 'theme', 'updated_at')
    list_filter = ('theme', 'auto_copy_phone')
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ImportRecord)
class ImportRecordAdmin(admin.ModelAdmin):
    list_display = ('filename', 'campaign', 'count', 'status', 'imported_by', 'date', 'created_at')
    list_filter = ('status', 'date', 'campaign')
    search_fields = ('filename', 'imported_by__username')
    readonly_fields = ('id', 'created_at', 'date')


@admin.register(ContactAssignment)
class ContactAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        'qc_employee', 'total_assigned', 'active_assigned',
        'completed_today', 'last_assigned_at', 'last_reset_at'
    )
    search_fields = ('qc_employee__username', 'qc_employee__email')
    readonly_fields = ('updated_at',)


@admin.register(QCFavourite)
class QCFavouriteAdmin(admin.ModelAdmin):
    list_display = ('user', 'contact', 'created_at')
    list_filter = ('user', 'created_at')
    search_fields = ('user__username', 'contact__customer_name', 'contact__phone_number')
    readonly_fields = ('created_at',)
    raw_id_fields = ('contact',)


@admin.register(QCCheckOff)
class QCCheckOffAdmin(admin.ModelAdmin):
    list_display = ('user', 'contact', 'scope', 'checked_at')
    list_filter = ('user', 'scope', 'checked_at')
    search_fields = ('user__username', 'contact__customer_name', 'contact__phone_number')
    readonly_fields = ('checked_at',)
    raw_id_fields = ('contact',)
