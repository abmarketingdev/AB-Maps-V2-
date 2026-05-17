"""
Serializers for the QC System app.
"""
from django.conf import settings
from rest_framework import serializers
from users.models import User
from .models import (
    QCContact, QCHistory, QCSettings, ImportRecord, ContactAssignment,
    QCFavourite, QCCheckOff, QCTransferRequest, QCTransferRequestItem,
    STATUS_CHOICES, QC_RESULT_CHOICES, SVARTE_CATEGORY_CHOICES, SI_OPP_CHOICES,
)


# ──────────────────────────────────────────────
# Auth Serializers
# ──────────────────────────────────────────────

class QCLoginSerializer(serializers.Serializer):
    """Serializer for QC login requests."""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)


class QCUserSerializer(serializers.Serializer):
    """
    Serializer for QC user info in auth responses.
    Returns user data formatted for the QC frontend.
    """
    id = serializers.CharField()
    name = serializers.CharField()
    agentId = serializers.CharField()
    email = serializers.EmailField()
    userType = serializers.CharField()


class QCLogoutSerializer(serializers.Serializer):
    """Serializer for QC logout requests."""
    refresh = serializers.CharField()


# ──────────────────────────────────────────────
# Status / category → display label (Ris, Ros, Oppsigelse, etc.)
# ──────────────────────────────────────────────

STATUS_TO_LABEL = {
    'negativ_tilbakemelding': 'Ris',
    'positiv_tilbakemelding': 'Ros',
    'noeytral_tilbakemelding': 'Nøytral',
    'other_inquiries': 'Andre henvendelser',
    'giverinspill': 'Giverinnspill',
    'reservert': 'Reservert',
    'si_opp': 'Oppsigelse',
    'utmeldt': 'Utmeldt',
}
SVARTE_CATEGORY_TO_LABEL = {
    'negativ': 'Ris',
    'positiv': 'Ros',
    'noeytral': 'Nøytral',
    'annen': 'Andre henvendelser',
    'giverinspill': 'Giverinnspill',
    'reservert': 'Reservert',
}


def _status_label_from_contact(obj):
    """Primary status display label for contact (e.g. Ris, Ros).
    For utmeldt contacts the label shows the svarte_category (e.g. Ros, Ris) not 'Utmeldt'."""
    if getattr(obj, 'is_utmeldt', False):
        return SVARTE_CATEGORY_TO_LABEL.get(obj.svarte_category or '', obj.svarte_category or '')
    return STATUS_TO_LABEL.get(obj.status, obj.status or '')


def _display_labels_contact(obj):
    """List of display labels so case shows as both Ris and Oppsigelse when applicable."""
    labels = []
    primary = _status_label_from_contact(obj)
    if primary:
        labels.append(primary)
    if getattr(obj, 'si_opp', None) == 'JA':
        if 'Oppsigelse' not in labels:
            labels.append('Oppsigelse')
    if getattr(obj, 'is_utmeldt', False):
        if 'Utmeldt' not in labels:
            labels.append('Utmeldt')
    return labels


def _status_label_from_history(obj):
    """Primary status display label for history (from svarte_category)."""
    return SVARTE_CATEGORY_TO_LABEL.get(obj.svarte_category or '', obj.svarte_category or '')


def _display_labels_history(obj):
    """List of display labels for history entry (e.g. Ris, Oppsigelse)."""
    labels = []
    primary = _status_label_from_history(obj)
    if primary:
        labels.append(primary)
    if getattr(obj, 'si_opp', None) == 'JA':
        if 'Oppsigelse' not in labels:
            labels.append('Oppsigelse')
    return labels


# ──────────────────────────────────────────────
# Contact Serializers
# ──────────────────────────────────────────────

def _contact_categories(obj):
    """Return list of category slugs that are True for this contact."""
    out = []
    if getattr(obj, 'is_oppsigelse', False):
        out.append('si_opp')
    if getattr(obj, 'is_giverinspill', False):
        out.append('giverinspill')
    if getattr(obj, 'is_ris', False):
        out.append('ris')
    if getattr(obj, 'is_noeytral', False):
        out.append('noeytral')
    if getattr(obj, 'is_annen', False):
        out.append('annen')
    if getattr(obj, 'is_positiv', False):
        out.append('positiv')
    if getattr(obj, 'is_reservert', False):
        out.append('reservert')
    if getattr(obj, 'is_utmeldt', False):
        out.append('utmeldt')
    return out


CALL_STAGE_STATUSES = frozenset({
    'til_behandling', 'forste_oppring', 'andre_oppring', 'tredje_oppring',
})


class QCContactListSerializer(serializers.ModelSerializer):
    """
    Optimized serializer for listing contacts.
    Includes only fields needed for list/kanban views.
    """
    assignedTo = serializers.SerializerMethodField()
    campaignName = serializers.SerializerMethodField()
    campaignBrandColorHex = serializers.SerializerMethodField()
    is_favourite = serializers.SerializerMethodField()
    checked_off_by_me = serializers.SerializerMethodField()
    checked_off_by_scope = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    is_oppsigelse = serializers.SerializerMethodField()
    is_utmeldt = serializers.SerializerMethodField()
    display_labels = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    current_call_stage = serializers.SerializerMethodField()
    calling_call = serializers.SerializerMethodField()
    list_category = serializers.SerializerMethodField()
    contactId = serializers.CharField(source='contact_id', read_only=True, allow_null=True)

    class Meta:
        model = QCContact
        fields = [
            'id', 'customer_name', 'first_name', 'last_name', 'full_name',
            'phone_number', 'seller_name', 'sales_id',
            'contact_id', 'contactId',
            'status', 'status_label', 'is_oppsigelse', 'is_utmeldt', 'display_labels',
            'current_call_stage', 'calling_call', 'list_category',
            'attempt_count', 'urgent', 'urgent_message',
            'qc_result', 'svarte_category', 'si_opp',
            'comment', 'qc_agent_name',
            'assignedTo', 'campaignName', 'campaignBrandColorHex',
            'is_favourite', 'checked_off_by_me', 'checked_off_by_scope', 'categories',
            'user_added_import_date',
            'created_at', 'last_attempt_at', 'qc_approved_at',
        ]

    def get_current_call_stage(self, obj):
        if obj.status in CALL_STAGE_STATUSES:
            return obj.status
        return None

    def get_calling_call(self, obj):
        return self.get_current_call_stage(obj)

    def get_list_category(self, obj):
        return self.context.get('list_category')

    def get_full_name(self, obj):
        first = (obj.first_name or '').strip()
        last = (obj.last_name or '').strip()
        return f"{first} {last}".strip() or (obj.customer_name or '')

    def get_status_label(self, obj):
        return _status_label_from_contact(obj)

    def get_is_oppsigelse(self, obj):
        return getattr(obj, 'si_opp', None) == 'JA'

    def get_is_utmeldt(self, obj):
        return bool(getattr(obj, 'is_utmeldt', False))

    def get_display_labels(self, obj):
        return _display_labels_contact(obj)

    def get_checked_off_by_me(self, obj):
        """True if the current user checked off this contact for the default overview (legacy field)."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if getattr(obj, '_checked_off_default', None) is not None:
            return bool(obj._checked_off_default)
        return QCCheckOff.objects.filter(
            user=request.user,
            contact=obj,
            scope=QCCheckOff.Scope.DEFAULT,
        ).exists()

    def get_checked_off_by_scope(self, obj):
        """Per-board check-off for the current user: default vs siopp_ah."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {'default': False, 'siopp_ah': False}
        d = getattr(obj, '_checked_off_default', None)
        s = getattr(obj, '_checked_off_siopp_ah', None)
        if d is not None and s is not None:
            return {'default': bool(d), 'siopp_ah': bool(s)}
        user = request.user
        return {
            'default': QCCheckOff.objects.filter(
                user=user, contact=obj, scope=QCCheckOff.Scope.DEFAULT
            ).exists(),
            'siopp_ah': QCCheckOff.objects.filter(
                user=user, contact=obj, scope=QCCheckOff.Scope.SIOPP_AH
            ).exists(),
        }

    def get_is_favourite(self, obj):
        """True if the current user has this contact in their favourites."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if getattr(obj, '_is_favourited_by_user', None) is not None:
            return obj._is_favourited_by_user
        return QCFavourite.objects.filter(user=request.user, contact=obj).exists()

    def get_assignedTo(self, obj):
        if obj.assigned_to:
            return {
                'id': str(obj.assigned_to.id),
                'name': (
                    f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
                    or obj.assigned_to.username
                ),
            }
        return None

    def get_campaignName(self, obj):
        if obj.campaign:
            return obj.campaign.name
        return None

    def get_campaignBrandColorHex(self, obj):
        if not obj.campaign_id or not obj.campaign:
            return None
        v = obj.campaign.brand_color_hex
        return v if v else None

    def get_categories(self, obj):
        return _contact_categories(obj)


class QCContactDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for a single contact detail view.
    Includes related history entries.
    """
    assignedTo = serializers.SerializerMethodField()
    campaignName = serializers.SerializerMethodField()
    campaignBrandColorHex = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    is_favourite = serializers.SerializerMethodField()
    checked_off_by_me = serializers.SerializerMethodField()
    checked_off_by_scope = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()
    is_oppsigelse = serializers.SerializerMethodField()
    is_utmeldt = serializers.SerializerMethodField()
    display_labels = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    current_call_stage = serializers.SerializerMethodField()
    calling_call = serializers.SerializerMethodField()
    contactId = serializers.CharField(source='contact_id', read_only=True, allow_null=True)

    class Meta:
        model = QCContact
        fields = [
            'id', 'customer_name', 'first_name', 'last_name', 'full_name',
            'phone_number', 'seller_name', 'sales_id',
            'contact_id', 'contactId',
            'status', 'status_label', 'is_oppsigelse', 'is_utmeldt', 'display_labels',
            'current_call_stage', 'calling_call',
            'attempt_count', 'urgent', 'urgent_message',
            'qc_result', 'svarte_category', 'si_opp',
            'comment', 'qc_agent_name',
            'assignedTo', 'campaignName', 'campaignBrandColorHex', 'history',
            'is_favourite', 'checked_off_by_me', 'checked_off_by_scope', 'categories',
            'user_added_import_date',
            'created_at', 'last_attempt_at', 'qc_approved_at',
        ]

    def get_current_call_stage(self, obj):
        if obj.status in CALL_STAGE_STATUSES:
            return obj.status
        return None

    def get_calling_call(self, obj):
        return self.get_current_call_stage(obj)

    def get_full_name(self, obj):
        first = (obj.first_name or '').strip()
        last = (obj.last_name or '').strip()
        return f"{first} {last}".strip() or (obj.customer_name or '')

    def get_status_label(self, obj):
        return _status_label_from_contact(obj)

    def get_is_oppsigelse(self, obj):
        return getattr(obj, 'si_opp', None) == 'JA'

    def get_is_utmeldt(self, obj):
        return bool(getattr(obj, 'is_utmeldt', False))

    def get_display_labels(self, obj):
        return _display_labels_contact(obj)

    def get_is_favourite(self, obj):
        """True if the current user has this contact in their favourites."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return QCFavourite.objects.filter(user=request.user, contact=obj).exists()

    def get_checked_off_by_me(self, obj):
        """True if the current user checked off this contact for the default overview (legacy field)."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if getattr(obj, '_checked_off_default', None) is not None:
            return bool(obj._checked_off_default)
        return QCCheckOff.objects.filter(
            user=request.user,
            contact=obj,
            scope=QCCheckOff.Scope.DEFAULT,
        ).exists()

    def get_checked_off_by_scope(self, obj):
        """Per-board check-off for the current user: default vs siopp_ah."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return {'default': False, 'siopp_ah': False}
        d = getattr(obj, '_checked_off_default', None)
        s = getattr(obj, '_checked_off_siopp_ah', None)
        if d is not None and s is not None:
            return {'default': bool(d), 'siopp_ah': bool(s)}
        user = request.user
        return {
            'default': QCCheckOff.objects.filter(
                user=user, contact=obj, scope=QCCheckOff.Scope.DEFAULT
            ).exists(),
            'siopp_ah': QCCheckOff.objects.filter(
                user=user, contact=obj, scope=QCCheckOff.Scope.SIOPP_AH
            ).exists(),
        }

    def get_assignedTo(self, obj):
        if obj.assigned_to:
            return {
                'id': str(obj.assigned_to.id),
                'name': (
                    f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
                    or obj.assigned_to.username
                ),
            }
        return None

    def get_campaignName(self, obj):
        if obj.campaign:
            return obj.campaign.name
        return None

    def get_campaignBrandColorHex(self, obj):
        if not obj.campaign_id or not obj.campaign:
            return None
        v = obj.campaign.brand_color_hex
        return v if v else None

    def get_categories(self, obj):
        return _contact_categories(obj)

    def get_history(self, obj):
        entries = obj.history_entries.all().order_by('-created_at')[:20]
        return QCHistorySerializer(entries, many=True).data


# ──────────────────────────────────────────────
# History Serializers
# ──────────────────────────────────────────────

class QCHistorySerializer(serializers.ModelSerializer):
    """Serializer for QC history entries. Includes status_label, display_labels, first_name, last_name, full_name for cards and NRC."""
    contactId = serializers.UUIDField(source='contact_id', read_only=True)
    status_label = serializers.SerializerMethodField()
    is_oppsigelse = serializers.SerializerMethodField()
    display_labels = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = QCHistory
        fields = [
            'id', 'contactId',
            'customer_name', 'first_name', 'last_name', 'full_name',
            'phone_number',
            'qc_result', 'svarte_category', 'si_opp',
            'status_label', 'is_oppsigelse', 'display_labels',
            'comment', 'qc_agent_name',
            'tid', 'date', 'created_at',
        ]

    def get_full_name(self, obj):
        first = (getattr(obj, 'first_name', None) or '').strip()
        last = (getattr(obj, 'last_name', None) or '').strip()
        return f"{first} {last}".strip() or (obj.customer_name or '')

    def get_status_label(self, obj):
        return _status_label_from_history(obj)

    def get_is_oppsigelse(self, obj):
        return getattr(obj, 'si_opp', None) == 'JA'

    def get_display_labels(self, obj):
        return _display_labels_history(obj)


# ──────────────────────────────────────────────
# Approve Serializer (request body)
# ──────────────────────────────────────────────

class QCApproveSerializer(serializers.Serializer):
    """
    Serializer for the approve / complete-call action.
    Validates the incoming QC result data.
    """
    qcResult = serializers.ChoiceField(
        choices=[c[0] for c in QC_RESULT_CHOICES],
        help_text="Result of the QC call: 'Svarte', 'Ikke svar', 'Opptatt'"
    )
    svarteCategory = serializers.ChoiceField(
        choices=[c[0] for c in SVARTE_CATEGORY_CHOICES],
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Sub-category when qcResult is 'Svarte': 'positiv', 'negativ', 'annen', 'noeytral', 'giverinspill', 'reservert'"
    )
    siOpp = serializers.ChoiceField(
        choices=[c[0] for c in SI_OPP_CHOICES],
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Whether customer wants to cancel: 'JA', 'NEI'"
    )
    categories = serializers.ListField(
        child=serializers.ChoiceField(choices=[
            'giverinspill', 'si_opp', 'ris', 'noeytral', 'annen', 'positiv', 'reservert', 'utmeldt',
        ]),
        required=False,
        allow_empty=True,
        help_text="All categories that apply (contact will appear in each list): giverinspill, si_opp, ris, noeytral, annen, positiv, reservert, utmeldt",
    )
    comment = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Optional agent comment"
    )

    def validate(self, attrs):
        qc_result = attrs.get('qcResult')
        svarte_category = attrs.get('svarteCategory')

        if qc_result == 'Svarte' and not svarte_category:
            raise serializers.ValidationError({
                'svarteCategory': "svarteCategory is required when qcResult is 'Svarte'."
            })

        return attrs


# ──────────────────────────────────────────────
# Bulk Transfer Serializer
# ──────────────────────────────────────────────

class BulkTransferSerializer(serializers.Serializer):
    """
    Serializer for bulk-transferring contacts between agents.
    """
    contactIds = serializers.ListField(
        child=serializers.UUIDField(),
        help_text="List of contact UUIDs to transfer"
    )
    targetAgentId = serializers.UUIDField(
        help_text="UUID of the target QC agent"
    )


class SalesChiefNotifySerializer(serializers.Serializer):
    """Body for POST /api/qc/sales-chiefs/notify/ — email digest to a sales chief."""
    salesChiefId = serializers.UUIDField(help_text="User UUID of the sales chief (must have is_sales_chief=True)")
    contactIds = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        help_text="QC contact UUIDs to include in the email",
    )

    def validate_contactIds(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError('contactIds must not contain duplicates.')
        max_n = getattr(settings, 'QC_SALES_CHIEF_NOTIFY_MAX_CONTACTS', 200)
        if len(value) > max_n:
            raise serializers.ValidationError(f'At most {max_n} contacts per request.')
        return value


class QCTransferRequestItemSerializer(serializers.ModelSerializer):
    contactId = serializers.UUIDField(source='contact_id', read_only=True)
    customerName = serializers.CharField(source='contact.customer_name', read_only=True)
    phoneNumber = serializers.CharField(source='contact.phone_number', read_only=True)

    class Meta:
        model = QCTransferRequestItem
        fields = ['id', 'contactId', 'customerName', 'phoneNumber', 'created_at']


class QCTransferRequestSerializer(serializers.ModelSerializer):
    requestedBy = serializers.SerializerMethodField()
    targetAgent = serializers.SerializerMethodField()
    reviewedBy = serializers.SerializerMethodField()
    items = QCTransferRequestItemSerializer(many=True, read_only=True)

    class Meta:
        model = QCTransferRequest
        fields = [
            'id', 'status', 'requested_count', 'note', 'decline_reason',
            'created_at', 'updated_at', 'reviewed_at',
            'requestedBy', 'targetAgent', 'reviewedBy', 'items',
        ]

    def _user_payload(self, user):
        if not user:
            return None
        return {
            'id': str(user.id),
            'name': f"{user.first_name} {user.last_name}".strip() or user.username,
        }

    def get_requestedBy(self, obj):
        return self._user_payload(obj.requested_by)

    def get_targetAgent(self, obj):
        return self._user_payload(obj.target_agent)

    def get_reviewedBy(self, obj):
        return self._user_payload(obj.reviewed_by)


class QCTransferRequestDecisionSerializer(serializers.Serializer):
    declineReason = serializers.CharField(required=False, allow_blank=True, default='')


# ──────────────────────────────────────────────
# Agent Serializer (for listing QC agents)
# ──────────────────────────────────────────────

class QCAgentSerializer(serializers.Serializer):
    """Serializer for listing QC agents (used in bulk transfer UI and assignment dropdowns)."""
    id = serializers.UUIDField()
    name = serializers.SerializerMethodField()
    email = serializers.EmailField()
    agentId = serializers.CharField(source='ab_person_id')
    activeContacts = serializers.SerializerMethodField()
    userType = serializers.SerializerMethodField()

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_activeContacts(self, obj):
        return obj.assigned_qc_contacts.filter(
            status__in=[
                'til_behandling', 'forste_oppring',
                'andre_oppring', 'tredje_oppring',
            ]
        ).count()

    def get_userType(self, obj):
        if obj.admin_type == 'qc_admin' and obj.is_superuser:
            return 'qc_admin'
        return 'qc_employee'


# ──────────────────────────────────────────────
# Settings Serializer (Phase 4)
# ──────────────────────────────────────────────

class QCSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer for QC user settings / preferences.
    Used for both retrieve and update operations.
    """
    selectedImportId = serializers.SerializerMethodField()
    selectedListName = serializers.SerializerMethodField()
    selectedListSlug = serializers.SerializerMethodField()

    class Meta:
        model = QCSettings
        fields = [
            'daily_goal', 'auto_copy_phone', 'theme',
            'selected_import_record', 'selectedImportId', 'selectedListName', 'selectedListSlug',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_selectedImportId(self, obj):
        if obj.selected_import_record_id:
            return str(obj.selected_import_record_id)
        return None

    def get_selectedListName(self, obj):
        if obj.selected_import_record:
            return obj.selected_import_record.list_name
        return None

    def get_selectedListSlug(self, obj):
        if obj.selected_import_record:
            return obj.selected_import_record.list_slug
        return None


# ──────────────────────────────────────────────
# History Update Serializer (Phase 4)
# ──────────────────────────────────────────────

class QCHistoryUpdateSerializer(serializers.Serializer):
    """Serializer for updating a history entry comment."""
    comment = serializers.CharField(
        required=True,
        allow_blank=True,
        help_text="Updated comment for this history entry"
    )


# ──────────────────────────────────────────────
# Import Serializers (Phase 6)
# ──────────────────────────────────────────────

class ImportRecordSerializer(serializers.ModelSerializer):
    """Serializer for ImportRecord list / detail."""
    campaignName = serializers.SerializerMethodField()
    importedByName = serializers.SerializerMethodField()
    listName = serializers.CharField(source='list_name', read_only=True)
    listSlug = serializers.CharField(source='list_slug', read_only=True)

    class Meta:
        model = ImportRecord
        fields = [
            'id', 'filename', 'campaign', 'campaignName',
            'list_name', 'list_slug', 'listName', 'listSlug',
            'count', 'status',
            'imported_by', 'importedByName',
            'created_at', 'date', 'user_added_import_date',
        ]
        read_only_fields = fields

    def get_campaignName(self, obj):
        if obj.campaign:
            return obj.campaign.name
        return None

    def get_importedByName(self, obj):
        if obj.imported_by:
            return (
                f"{obj.imported_by.first_name} {obj.imported_by.last_name}".strip()
                or obj.imported_by.username
            )
        return None


class ImportRecordUpdateSerializer(serializers.Serializer):
    """
    Admin-only serializer for patching an ImportRecord's list name and/or sale date.
    At least one field must be provided.
    """
    listName = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=255,
        help_text="New display name for this import list",
    )
    userAddedImportDate = serializers.DateField(
        required=False,
        allow_null=True,
        help_text="Corrected sale/batch date (YYYY-MM-DD). Cascades to all contacts in this list.",
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "At least one of 'listName' or 'userAddedImportDate' must be provided."
            )
        return attrs


class ContactSaleDateSerializer(serializers.Serializer):
    """Admin-only serializer for updating the sale date on a single QCContact."""
    userAddedImportDate = serializers.DateField(
        allow_null=True,
        help_text="Corrected sale/batch date for this contact (YYYY-MM-DD). Pass null to clear.",
    )


class FileUploadSerializer(serializers.Serializer):
    """
    Validates the file-upload request body.

    Expected multipart/form-data fields:
        file          – CSV or XLSX file
        campaignId    – UUID of the target Campaign
        listName      – Required name for this import list
        mappings      – JSON string mapping file columns → model fields
                        Supported keys: name, first_name, last_name, phone, seller,
                        sales_id, contact_id, sales_date
                        Example: {"name": "Navn", "phone": "Telefon", "seller": "Selger",
                                  "sales_date": "Salgsdato"}
        agentIds      – JSON string list of QC-employee UUIDs for even distribution
                        (optional; if omitted contacts stay unassigned)
    """
    file = serializers.FileField(help_text="CSV or XLSX file")
    campaignId = serializers.UUIDField(help_text="Campaign UUID")
    listName = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=255,
        help_text="Required list name to identify this imported batch",
    )
    mappings = serializers.CharField(
        required=False,
        default='{}',
        help_text="JSON string: column mapping"
    )
    agentIds = serializers.CharField(
        required=False,
        default='[]',
        help_text="JSON string: list of agent UUIDs for even distribution"
    )
