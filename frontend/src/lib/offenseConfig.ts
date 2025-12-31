/**
 * Offense configuration with colors, icons, and labels.
 * 16 Neighborhood-Relevant Offenses for Home Buyer Safety.
 */

export type OffenseCode =
    | 'ALL'
    | 'HOM' | 'RPE' | 'ROB' | 'ASS' | '100'
    | 'BUR' | 'LAR' | 'MVT' | 'ARS' | '23D'
    | '13B' | '11A' | '280' | '290' | '520' | '35A';

export type OffenseCategory = 'violent' | 'property' | 'other';

export interface OffenseConfig {
    code: OffenseCode;
    label: string;
    shortLabel: string;
    icon: string;
    color: string;
    colorDark: string;
    category: OffenseCategory;
    dangerLevel: number; // 1-10
}

export const OFFENSE_CONFIGS: Record<Exclude<OffenseCode, 'ALL'>, OffenseConfig> = {
    // Violent Offenses (5) - Personal Safety
    HOM: {
        code: 'HOM',
        label: 'Homicide',
        shortLabel: 'Homicide',
        icon: '💀',
        color: '#7F1D1D',
        colorDark: '#FCA5A5',
        category: 'violent',
        dangerLevel: 10,
    },
    RPE: {
        code: 'RPE',
        label: 'Rape',
        shortLabel: 'Rape',
        icon: '⚠️',
        color: '#991B1B',
        colorDark: '#FCA5A5',
        category: 'violent',
        dangerLevel: 9,
    },
    ROB: {
        code: 'ROB',
        label: 'Robbery',
        shortLabel: 'Robbery',
        icon: '🔫',
        color: '#B91C1C',
        colorDark: '#F87171',
        category: 'violent',
        dangerLevel: 8,
    },
    ASS: {
        code: 'ASS',
        label: 'Aggravated Assault',
        shortLabel: 'Assault',
        icon: '🔪',
        color: '#DC2626',
        colorDark: '#EF4444',
        category: 'violent',
        dangerLevel: 7,
    },
    '100': {
        code: '100',
        label: 'Kidnapping/Abduction',
        shortLabel: 'Kidnapping',
        icon: '🚨',
        color: '#881337',
        colorDark: '#FDA4AF',
        category: 'violent',
        dangerLevel: 9,
    },

    // Property Offenses (5) - Home & Vehicle Security
    BUR: {
        code: 'BUR',
        label: 'Burglary',
        shortLabel: 'Burglary',
        icon: '🏠',
        color: '#EA580C',
        colorDark: '#FB923C',
        category: 'property',
        dangerLevel: 6,
    },
    LAR: {
        code: 'LAR',
        label: 'Larceny-theft',
        shortLabel: 'Larceny',
        icon: '💰',
        color: '#D97706',
        colorDark: '#FBBF24',
        category: 'property',
        dangerLevel: 5,
    },
    MVT: {
        code: 'MVT',
        label: 'Motor Vehicle Theft',
        shortLabel: 'Vehicle Theft',
        icon: '🚗',
        color: '#CA8A04',
        colorDark: '#FACC15',
        category: 'property',
        dangerLevel: 4,
    },
    ARS: {
        code: 'ARS',
        label: 'Arson',
        shortLabel: 'Arson',
        icon: '🔥',
        color: '#EF4444',
        colorDark: '#F87171',
        category: 'property',
        dangerLevel: 8,
    },
    '23D': {
        code: '23D',
        label: 'Theft From Building',
        shortLabel: 'Building Theft',
        icon: '🏢',
        color: '#C2410C',
        colorDark: '#FDBA74',
        category: 'property',
        dangerLevel: 5,
    },

    // Neighborhood Safety Offenses (6) - Quality of Life
    '13B': {
        code: '13B',
        label: 'Simple Assault',
        shortLabel: 'Simple Assault',
        icon: '👊',
        color: '#F87171',
        colorDark: '#FCA5A5',
        category: 'other',
        dangerLevel: 4,
    },
    '11A': {
        code: '11A',
        label: 'Sex Offenses',
        shortLabel: 'Sex Offenses',
        icon: '🛡️',
        color: '#BE185D',
        colorDark: '#F9A8D4',
        category: 'other',
        dangerLevel: 8,
    },
    '280': {
        code: '280',
        label: 'Stolen Property Offenses',
        shortLabel: 'Stolen Property',
        icon: '📦',
        color: '#EC4899',
        colorDark: '#F9A8D4',
        category: 'other',
        dangerLevel: 4,
    },
    '290': {
        code: '290',
        label: 'Vandalism',
        shortLabel: 'Vandalism',
        icon: '🔨',
        color: '#F59E0B',
        colorDark: '#FCD34D',
        category: 'other',
        dangerLevel: 3,
    },
    '520': {
        code: '520',
        label: 'Weapon Law Violations',
        shortLabel: 'Weapons',
        icon: '💣',
        color: '#374151',
        colorDark: '#9CA3AF',
        category: 'other',
        dangerLevel: 6,
    },
    '35A': {
        code: '35A',
        label: 'Drug/Narcotic Violations',
        shortLabel: 'Drugs',
        icon: '💊',
        color: '#10B981',
        colorDark: '#6EE7B7',
        category: 'other',
        dangerLevel: 4,
    },
};

// Helper functions
export const getOffenseConfig = (code: string): OffenseConfig | undefined => {
    if (!code || code === 'ALL') return undefined;
    const normalized = normalizeOffenseCode(code);
    if (normalized === 'ALL') return undefined;
    return OFFENSE_CONFIGS[normalized as Exclude<OffenseCode, 'ALL'>];
};

export const getOffenseLabel = (code: string): string => {
    return getOffenseConfig(code)?.label || code;
};

/**
 * Normalizes any string (code, label, or slug) to a valid OffenseCode.
 * Returns 'ALL' as fallback if not matched.
 */
export const normalizeOffenseCode = (input: string): OffenseCode => {
    if (!input) return 'ALL';
    const clean = input.trim().toUpperCase();

    // 1. Direct match (shorthand)
    if (Object.keys(OFFENSE_CONFIGS).includes(clean)) {
        return clean as OffenseCode;
    }

    // 2. Label match (e.g. "Homicide" -> "HOM")
    const foundByLabel = Object.values(OFFENSE_CONFIGS).find(
        c => c.label.toUpperCase() === clean || c.shortLabel.toUpperCase() === clean
    );
    if (foundByLabel) return foundByLabel.code;

    // 3. Fallback/Mappings for common FBI variants
    const mappings: Record<string, OffenseCode> = {
        'MURDER': 'HOM',
        'HOMICIDE': 'HOM',
        'RAPE': 'RPE',
        'ROBBERY': 'ROB',
        'AGGRAVATED ASSAULT': 'ASS',
        'ASSAULT': 'ASS',
        'KIDNAPPING': '100',
        'ABDUCTION': '100',
        'BURGLARY': 'BUR',
        'BREAKING AND ENTERING': 'BUR',
        'LARCENY': 'LAR',
        'LARCENY-THEFT': 'LAR',
        'THEFT': 'LAR',
        'MOTOR VEHICLE THEFT': 'MVT',
        'VEHICLE THEFT': 'MVT',
        'CAR THEFT': 'MVT',
        'ARSON': 'ARS',
        'THEFT FROM BUILDING': '23D',
        'BUILDING THEFT': '23D',
        'SIMPLE ASSAULT': '13B',
        'SEX OFFENSE': '11A',
        'SEXUAL ASSAULT': '11A',
        'FONDLING': '11A',
        'STOLEN PROPERTY': '280',
        'VANDALISM': '290',
        'PROPERTY DAMAGE': '290',
        'WEAPON': '520',
        'GUN': '520',
        'FIREARM': '520',
        'DRUG': '35A',
        'NARCOTIC': '35A'
    };

    for (const [key, code] of Object.entries(mappings)) {
        if (clean.includes(key)) return code;
    }

    return 'ALL';
};

export const getOffensesByCategory = (category: OffenseCategory): OffenseConfig[] => {
    return Object.values(OFFENSE_CONFIGS).filter(o => o.category === category);
};

export const VIOLENT_OFFENSES = getOffensesByCategory('violent');
export const PROPERTY_OFFENSES = getOffensesByCategory('property');
export const OTHER_OFFENSES = getOffensesByCategory('other');

export const ALL_OFFENSE_CODES: OffenseCode[] = Object.keys(OFFENSE_CONFIGS) as OffenseCode[];

// Category labels with icons
export const CATEGORY_CONFIG = {
    violent: { label: 'Violent Crimes', icon: '🔴', color: '#DC2626' },
    property: { label: 'Property Crimes', icon: '🟠', color: '#EA580C' },
    other: { label: 'Other Offenses', icon: '🟡', color: '#F59E0B' },
};
