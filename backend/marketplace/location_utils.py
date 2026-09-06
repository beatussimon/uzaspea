"""
Location utilities for geocoding and coordinates resolution.
Provides accurate coordinates for regions and cities in Tanzania and scalable resolution.
"""

TANZANIA_REGION_COORDS = {
    "dar es salaam": (-6.7924, 39.2083),
    "mwanza": (-2.5167, 32.9000),
    "arusha": (-3.3869, 36.6830),
    "dodoma": (-6.1630, 35.7516),
    "mbeya": (-8.9000, 33.4500),
    "morogoro": (-6.8210, 37.6614),
    "tanga": (-5.0689, 39.0989),
    "kilimanjaro": (-3.1667, 37.3333),
    "moshi": (-3.3500, 37.3333),
    "kagera": (-1.5000, 31.5833),
    "bukoba": (-1.3317, 31.8122),
    "ngara": (-2.5122, 30.6558),
    "nyamiaga": (-2.5150, 30.6500),
    "mara": (-1.7500, 34.0000),
    "musoma": (-1.5000, 33.8000),
    "shinyanga": (-3.6617, 33.4233),
    "tabora": (-5.0167, 32.8000),
    "kigoma": (-4.8769, 29.6267),
    "iringa": (-7.7700, 35.6900),
    "rukwa": (-7.9667, 31.6167),
    "sumbawanga": (-7.9667, 31.6167),
    "ruvuma": (-10.6833, 35.6833),
    "songea": (-10.6833, 35.6500),
    "lindi": (-10.0000, 39.7167),
    "mtwara": (-10.2736, 40.1828),
    "singida": (-4.8167, 34.7500),
    "pwani": (-7.3250, 38.8333),
    "kibaha": (-6.7725, 38.9222),
    "bagamoyo": (-6.4333, 38.9000),
    "geita": (-2.8714, 32.2311),
    "katavi": (-6.3667, 31.2500),
    "mpanda": (-6.3431, 31.0664),
    "njombe": (-9.3333, 34.7667),
    "simiyu": (-3.0333, 34.1333),
    "bariadi": (-2.8000, 33.9833),
    "songwe": (-8.6833, 32.7833),
    "vwawa": (-9.1089, 32.9347),
    "zanzibar": (-6.1659, 39.1989),
    "kariakoo": (-6.8206, 39.2778),
    "kinondoni": (-6.7761, 39.2483),
    "ilala": (-6.8286, 39.2625),
    "temeke": (-6.8572, 39.2656),
    "ubungo": (-6.7825, 39.2089),
    "kigamboni": (-6.8647, 39.3142),
}

DEFAULT_COUNTRY_CENTER = {
    "Tanzania": (-6.7924, 39.2083),  # Dar es Salaam commercial center
}

def resolve_location_coords(location_name: str | None, country: str = "Tanzania") -> tuple[float, float]:
    """
    Resolves (latitude, longitude) for a given place name.
    Checks exact and fuzzy matches against known city and region centers.
    Falls back to default country commercial center.
    """
    if not location_name or not location_name.strip():
        return DEFAULT_COUNTRY_CENTER.get(country, (-6.7924, 39.2083))
    
    clean_name = location_name.lower().strip()
    # Check known place names
    for name, coords in TANZANIA_REGION_COORDS.items():
        if name in clean_name:
            return coords
            
    # Check parts split by comma
    for part in clean_name.split(','):
        p = part.strip()
        if p in TANZANIA_REGION_COORDS:
            return TANZANIA_REGION_COORDS[p]
            
    return DEFAULT_COUNTRY_CENTER.get(country, (-6.7924, 39.2083))
