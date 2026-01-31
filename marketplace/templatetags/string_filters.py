from django import template
from django.template.defaultfilters import stringfilter

register = template.Library()


@register.filter
@stringfilter
def split(value, arg):
    """Splits a string by the given delimiter"""
    if not value:
        return []
    return [item.strip() for item in value.split(arg)]


@register.filter
@stringfilter
def trim(value):
    """Removes leading and trailing whitespace"""
    return value.strip()