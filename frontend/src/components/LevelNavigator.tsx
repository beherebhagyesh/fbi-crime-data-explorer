'use client';

interface LevelNavigatorProps {
    level: 'national' | 'state' | 'county';
    stateName?: string;
    stateAbbr?: string;
    countyName?: string;
    onNavigate: (level: 'national' | 'state' | 'county') => void;
}

export default function LevelNavigator({
    level,
    stateName,
    stateAbbr,
    countyName,
    onNavigate,
}: LevelNavigatorProps) {
    return (
        <nav className="level-nav">
            {/* National Level */}
            <button
                onClick={() => onNavigate('national')}
                className={`level-nav-item ${level === 'national' ? 'active' : ''}`}
            >
                <span className="text-lg">🇺🇸</span>
                <span className="font-medium">National</span>
            </button>

            {/* State Level */}
            {(level === 'state' || level === 'county') && stateAbbr && (
                <>
                    <span className="level-nav-separator">→</span>
                    <button
                        onClick={() => onNavigate('state')}
                        className={`level-nav-item ${level === 'state' ? 'active' : ''}`}
                    >
                        <span className="text-lg">📍</span>
                        <span className="font-medium">{stateAbbr}</span>
                        {stateName && (
                            <span className="text-sm text-[var(--text-muted)]">({stateName})</span>
                        )}
                    </button>
                </>
            )}

            {/* County Level */}
            {level === 'county' && countyName && (
                <>
                    <span className="level-nav-separator">→</span>
                    <button
                        onClick={() => onNavigate('county')}
                        className={`level-nav-item ${level === 'county' ? 'active' : ''}`}
                    >
                        <span className="text-lg">🏘️</span>
                        <span className="font-medium">{countyName}</span>
                    </button>
                </>
            )}
        </nav>
    );
}
