"""Nearest populated place from a bundled GeoNames extract; no location leaves this PC."""
from functools import lru_cache
import gzip
import json
import math
from pathlib import Path

@lru_cache(maxsize=1)
def town_index():
    with gzip.open(Path(__file__).resolve().parent / 'geodata/towns.json.gz', 'rt', encoding='utf-8') as stream:
        towns = json.load(stream)
    result = []
    for name, lat, lon in towns:
        latitude, longitude = math.radians(lat), math.radians(lon)
        result.append((name, math.cos(latitude)*math.cos(longitude), math.cos(latitude)*math.sin(longitude), math.sin(latitude)))
    return result

@lru_cache(maxsize=256)
def nearest_town(lat, lon):
    if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError('Invalid location')
    latitude, longitude = math.radians(lat), math.radians(lon)
    x, y, z = math.cos(latitude)*math.cos(longitude), math.cos(latitude)*math.sin(longitude), math.sin(latitude)
    town = min(town_index(), key=lambda row: (row[1]-x)**2+(row[2]-y)**2+(row[3]-z)**2)
    distance = 6371 * math.acos(max(-1, min(1, town[1]*x+town[2]*y+town[3]*z)))
    return {'name': town[0] if distance <= 50 else '', 'distance_km': round(distance, 1), 'source': 'GeoNames'}
