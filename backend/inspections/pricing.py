"""
Inspection Pricing Engine
All pricing logic lives here. Change rates here only — nothing else needs updating.
"""
from decimal import Decimal


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


def calculate_bill(category, scope, turnaround, is_complex=False, item_age_years=None,
                   add_reinspection_coverage=False):
    """
    Returns a dict of all line items and totals.
    All values are Decimal.
    """
    base = Decimal(str(category.base_price))
    inspector_level = category.required_inspector_level

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

    total = (
        adjusted_base
        + turnaround_surcharge
        + inspector_surcharge
        + complexity_surcharge
        + reinspection_fee
    )

    deposit = (total * DEPOSIT_RATE).quantize(Decimal('0.01'))
    remaining = (total - deposit).quantize(Decimal('0.01'))

    return {
        'base_rate': adjusted_base.quantize(Decimal('0.01')),
        'scope_multiplier': scope_mult,
        'turnaround_surcharge': turnaround_surcharge.quantize(Decimal('0.01')),
        'inspector_level_surcharge': inspector_surcharge.quantize(Decimal('0.01')),
        'complexity_surcharge': complexity_surcharge.quantize(Decimal('0.01')),
        'travel_surcharge': Decimal('0.00'),
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
            'Re-Inspection Coverage': float(reinspection_fee),
        },
    }
