from rest_framework import serializers

from qc_system.gamification_services import XP_RULES


class XPEventRequestSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=sorted(XP_RULES.keys()))
    contact_id = serializers.UUIDField(required=False, allow_null=True)
    metadata = serializers.JSONField(required=False)

