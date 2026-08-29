from decimal import Decimal
from django.core.cache import cache
from django.db.models import Avg


# ── Multipliers ──────────────────────────────
SCOPE_MULTIPLIERS = {
    'basic': Decimal('1.00'),
    'standard': Decimal('1.40'),
    'deep': Decimal('2.00'),
}

TURNAROUND_RATES = {
    'standard': Decimal('0.00'),   # no surcharge
    'express': Decimal('0.30'),    # 30% of base
    'instant': Decimal('0.60'),    # 60% of base
}

INSPECTOR_LEVEL_RATES = {
    'junior': Decimal('0.00'),
    'senior': Decimal('0.20'),     # 20% of base
    'specialist': Decimal('0.40'), # 40% of base
}

COMPLEXITY_SURCHARGE_RATE = Decimal('0.20')   # 20% of base if complex
AGE_SURCHARGE_RATE = Decimal('0.15')          # 15% of base if > 5 years old
DEPOSIT_RATE = Decimal('0.30')                # 30% of total as deposit
REINSPECTION_COVERAGE_RATE = Decimal('0.10')  # 10% of total


def get_category_intelligent_base_price(category):
    """
    Computes a market-calibrated base rate for a category by averaging historical
    actual base rates from completed/approved bills in this category (or subcategories).
    Caches the result in Redis with a 1-hour TTL.
    """
    if not category:
        return Decimal('50000.00')

    cache_key = f'cat_dynamic_base_{category.id}'
    cached = cache.get(cache_key)
    if cached is not None:
        try:
            return Decimal(str(cached))
        except Exception:
            pass

    try:
        from inspections.models import InspectionBill
        cat_ids = [category.id]
        queue = [category]
        while queue:
            curr = queue.pop(0)
            for child in curr.children.all():
                cat_ids.append(child.id)
                queue.append(child)

        avg_res = InspectionBill.objects.filter(
            request__category_id__in=cat_ids,
            request__status__in=['published', 'deposit_paid', 'in_progress', 'submitted', 'qa_review']
        ).aggregate(avg_base=Avg('base_rate'))

        avg_val = avg_res.get('avg_base')
        seed_price = Decimal(str(category.base_price or 50000))
        if avg_val and float(avg_val) > 0:
            computed = (Decimal(str(avg_val)) * Decimal('0.7')) + (seed_price * Decimal('0.3'))
            result = computed.quantize(Decimal('100.00'))
        else:
            result = seed_price

        cache.set(cache_key, str(result), timeout=3600)
        return result
    except Exception:
        return Decimal(str(category.base_price or 50000))


def calculate_bill(category, scope, turnaround, is_complex=False, item_age_years=None,
                   add_reinspection_coverage=False, travel_distance_km=None, use_dynamic_base=True):
    """
    Returns a dict of all line items and totals.
    All values are Decimal.
    """
    if use_dynamic_base and category:
        base = get_category_intelligent_base_price(category)
    else:
        base = Decimal(str(category.base_price)) if category else Decimal('50000.00')

    inspector_level = category.required_inspector_level if category else 'junior'

    scope_mult = SCOPE_MULTIPLIERS.get(scope, Decimal('1.00'))
    adjusted_base = base * scope_mult

    turnaround_surcharge = base * TURNAROUND_RATES.get(turnaround, Decimal('0'))
    inspector_surcharge = base * INSPECTOR_LEVEL_RATES.get(inspector_level, Decimal('0'))

    complexity_surcharge = Decimal('0')
    if is_complex:
        complexity_surcharge = base * COMPLEXITY_SURCHARGE_RATE
    if item_age_years and item_age_years > 5:
        complexity_surcharge += base * AGE_SURCHARGE_RATE

    reinspection_fee = Decimal('0')
    if add_reinspection_coverage:
        reinspection_fee = adjusted_base * REINSPECTION_COVERAGE_RATE

    travel_surcharge = Decimal('0.00')
    if travel_distance_km:
        travel_surcharge = Decimal(str(travel_distance_km)) * Decimal('1000.00')

    total = (
        adjusted_base
        + turnaround_surcharge
        + inspector_surcharge
        + complexity_surcharge
        + reinspection_fee
        + travel_surcharge
    )

    deposit = (total * DEPOSIT_RATE).quantize(Decimal('0.01'))
    remaining = (total - deposit).quantize(Decimal('0.01'))

    return {
        'base_rate': adjusted_base.quantize(Decimal('0.01')),
        'scope_multiplier': scope_mult,
        'turnaround_surcharge': turnaround_surcharge.quantize(Decimal('0.01')),
        'inspector_level_surcharge': inspector_surcharge.quantize(Decimal('0.01')),
        'complexity_surcharge': complexity_surcharge.quantize(Decimal('0.01')),
        'travel_surcharge': travel_surcharge.quantize(Decimal('0.01')),
        'reinspection_coverage_fee': reinspection_fee.quantize(Decimal('0.01')),
        'total_amount': total.quantize(Decimal('0.01')),
        'deposit_amount': deposit,
        'remaining_balance': remaining,
        'currency': 'TZS',
        'inspector_level_required': inspector_level,
        'breakdown': {
            'Base Rate': float(adjusted_base),
            'Turnaround Surcharge': float(turnaround_surcharge),
            'Inspector Level Surcharge': float(inspector_surcharge),
            'Complexity / Age Surcharge': float(complexity_surcharge),
            'Travel Surcharge': float(travel_surcharge),
            'Re-Inspection Coverage': float(reinspection_fee),
        },
    }


def record_billed_pricing(bill):
    """
    Self-learning feedback hook: Called whenever staff generates or updates a bill.
    Caches the real billed rate for this exact configuration in Redis and refreshes
    the category base rolling average.
    """
    try:
        req = bill.request
        cat = req.category
        if not cat:
            return

        # 1. Invalidate & refresh category dynamic base
        cache.delete(f'cat_dynamic_base_{cat.id}')
        get_category_intelligent_base_price(cat)

        # 2. Record configuration benchmark
        level = cat.required_inspector_level or 'junior'
        config_key = f'config_benchmark_{cat.id}_{req.scope}_{req.turnaround}_{level}'
        benchmark_data = {
            'base_rate': str(bill.base_rate),
            'total_amount': str(bill.total_amount),
            'turnaround_surcharge': str(bill.turnaround_surcharge),
            'complexity_surcharge': str(bill.complexity_surcharge),
            'travel_surcharge': str(bill.travel_surcharge),
        }
        cache.set(config_key, benchmark_data, timeout=86400 * 7) # 7-day TTL
    except Exception:
        pass


def get_configuration_benchmark(category, scope='standard', turnaround='standard', inspector_level=None):
    """
    Retrieves the last staff-billed benchmark for this exact configuration.
    """
    if not category:
        return None
    level = inspector_level or getattr(category, 'required_inspector_level', 'junior')
    config_key = f'config_benchmark_{category.id}_{scope}_{turnaround}_{level}'
    return cache.get(config_key)
