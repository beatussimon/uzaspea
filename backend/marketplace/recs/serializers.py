"""Slim product card for every recommendation surface. Never includes buying_price."""
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from marketplace.serializers import ProductListSerializer
from .queries import active_sponsored_ids, liked_ids


def _stats(obj):
    try:
        return obj.stats
    except ObjectDoesNotExist:
        return None


class ProductCardSerializer(ProductListSerializer):
    description = serializers.SerializerMethodField()
    is_verified = serializers.SerializerMethodField()
    rec_slot = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = [f for f in ProductListSerializer.Meta.fields if f != 'buying_price'] + ['rec_slot']

    def get_description(self, obj):
        return (obj.description or '')[:160]

    def get_is_verified(self, obj):
        s = _stats(obj)
        return bool(s and s.inspection_pass)

    def get_avg_rating(self, obj):
        s = _stats(obj)
        return int(s.rating_avg) if s else 0

    def get_like_count(self, obj):
        s = _stats(obj)
        return s.likes if s else 0

    def get_weekly_sales(self, obj):
        s = _stats(obj)
        return s.orders_7d if s else 0

    def get_is_liked(self, obj):
        return obj.id in self.context.get('liked_ids', set())

    def get_is_sponsored(self, obj):
        return obj.id in self.context.get('sponsored_ids', set())

    def get_has_inspection(self, obj):
        s = _stats(obj)
        return bool(s and s.has_inspection)

    def get_inspection_verdict(self, obj):
        s = _stats(obj)
        return (s.inspection_verdict or None) if s else None

    def get_rec_slot(self, obj):
        return self.context.get('slots', {}).get(obj.id, '')


def serialize_cards(products, request, slots=None, personal=True):
    """personal=False -> no per-user fields (safe for shared caches)."""
    products = list(products)
    user = getattr(request, 'user', None) if (personal and request is not None) else None
    context = {
        'request': request,
        'liked_ids': liked_ids(user, [p.id for p in products]) if user else set(),
        'sponsored_ids': active_sponsored_ids(),
        'slots': slots or {},
    }
    return ProductCardSerializer(products, many=True, context=context).data
