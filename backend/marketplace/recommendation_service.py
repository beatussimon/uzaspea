"""DEPRECATED (recommendations v3): kept only so old imports keep working. Use marketplace.recs.* instead."""
from .recs.context import build_context
from .recs.engine import ymal_for_product, category_picks, top_picks
from .recs.queries import hydrate


class RecommendationEngine:
    @classmethod
    def get_recommendations(cls, target_product=None, user=None, category_slug=None, recent_ids=None,
                            active_vehicle_id=None, region=None, limit=12, exclude_ids=None, request=None):
        if request is not None and user is None:
            user = getattr(request, 'user', None)
        ctx = build_context(user=user, recent_ids=recent_ids, vehicle_id=active_vehicle_id,
                            region=region or '', exclude_ids=exclude_ids)
        try:
            limit = max(1, min(50, int(limit or 12)))
        except (TypeError, ValueError):
            limit = 12
        if target_product is not None:
            items = ymal_for_product(target_product.id, ctx, limit)
        elif category_slug:
            from .models import Category
            category = Category.objects.filter(slug=category_slug).first()
            items = category_picks(category, ctx, limit) if category else top_picks(ctx, limit)
        else:
            items = top_picks(ctx, limit)
        return hydrate([s.product_id for s in items])


def get_product_recommendations(product=None, user=None, limit=8, exclude_ids=None, recent_ids=None,
                                active_vehicle_id=None, region=None):
    return RecommendationEngine.get_recommendations(
        target_product=product, user=user, limit=limit, exclude_ids=exclude_ids, recent_ids=recent_ids,
        active_vehicle_id=active_vehicle_id, region=region)
