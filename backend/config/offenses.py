"""
Offense codes and categorization.
These are the 15 selected crime types for extraction.
"""
from typing import Dict, List, NamedTuple
from enum import Enum


class OffenseCategory(str, Enum):
    """Crime category classification."""
    VIOLENT = "violent"
    PROPERTY = "property"
    INDIVIDUAL = "individual"


class OffenseInfo(NamedTuple):
    """Offense metadata structure."""
    code: str
    label: str
    category: OffenseCategory


# Selected 16 offense types for extraction (Neighborhood Safety Focus)
SELECTED_OFFENSES: List[OffenseInfo] = [
    # Violent Offenses (5) - Personal Safety
    OffenseInfo("HOM", "Homicide", OffenseCategory.VIOLENT),
    OffenseInfo("RPE", "Rape", OffenseCategory.VIOLENT),
    OffenseInfo("ROB", "Robbery", OffenseCategory.VIOLENT),
    OffenseInfo("ASS", "Aggravated Assault", OffenseCategory.VIOLENT),
    OffenseInfo("100", "Kidnapping/Abduction", OffenseCategory.VIOLENT),
    
    # Property Offenses (5) - Home & Vehicle Security
    OffenseInfo("BUR", "Burglary", OffenseCategory.PROPERTY),
    OffenseInfo("LAR", "Larceny-theft", OffenseCategory.PROPERTY),
    OffenseInfo("MVT", "Motor Vehicle Theft", OffenseCategory.PROPERTY),
    OffenseInfo("ARS", "Arson", OffenseCategory.PROPERTY),
    OffenseInfo("23D", "Theft From Building", OffenseCategory.PROPERTY),
    
    # Neighborhood Safety Offenses (6) - Quality of Life
    OffenseInfo("13B", "Simple Assault", OffenseCategory.INDIVIDUAL),
    OffenseInfo("11A", "Sex Offenses", OffenseCategory.INDIVIDUAL),
    OffenseInfo("280", "Stolen Property Offenses", OffenseCategory.INDIVIDUAL),
    OffenseInfo("290", "Vandalism", OffenseCategory.INDIVIDUAL),
    OffenseInfo("520", "Weapon Law Violations", OffenseCategory.INDIVIDUAL),
    OffenseInfo("35A", "Drug/Narcotic Violations", OffenseCategory.INDIVIDUAL),
]

# Quick lookup dictionaries
OFFENSE_CODES: List[str] = [o.code for o in SELECTED_OFFENSES]
OFFENSE_LABELS: Dict[str, str] = {o.code: o.label for o in SELECTED_OFFENSES}
OFFENSE_CATEGORIES: Dict[str, OffenseCategory] = {o.code: o.category for o in SELECTED_OFFENSES}


def get_offense_label(code: str) -> str:
    """Get human-readable label for offense code."""
    return OFFENSE_LABELS.get(code, code)


def get_offenses_by_category(category: OffenseCategory) -> List[OffenseInfo]:
    """Get all offenses in a category."""
    return [o for o in SELECTED_OFFENSES if o.category == category]


def is_valid_offense(code: str) -> bool:
    """Check if offense code is in selected list."""
    return code in OFFENSE_CODES


# Years to extract (5 years for trend analysis)
EXTRACTION_YEARS: List[int] = [2020, 2021, 2022, 2023, 2024]

# Valid agency types (to prevent double-counting)
VALID_AGENCY_TYPES: List[str] = ["City", "County"]

# Excluded agency types
EXCLUDED_AGENCY_TYPES: List[str] = ["State", "Federal", "Other", "Tribal"]
