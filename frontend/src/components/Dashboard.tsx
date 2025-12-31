'use client';

import { useState } from 'react';
import {
    OffenseCode,
    CATEGORY_CONFIG,
    VIOLENT_OFFENSES,
    PROPERTY_OFFENSES,
    OTHER_OFFENSES,
} from '@/lib/offenseConfig';
import ThemeToggle from './ThemeToggle';
import LevelNavigator from './LevelNavigator';
import SearchBar from './SearchBar';
import NationalView from './views/NationalView';
import StateView from './views/StateView';
import CountyView from './views/CountyView';
import SystemStatus from './SystemStatus';
import ConsolePanel from './ConsolePanel';

type Level = 'national' | 'state' | 'county';

interface NavigationState {
    level: Level;
    stateAbbr?: string;
    stateName?: string;
    countyId?: string;
    countyName?: string;
}

// State names lookup
const STATE_NAMES: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia',
};

// Offense Sidebar Content Component (defined before main component)
function OffenseSidebarContent({
    selectedOffense,
    onSelectOffense
}: {
    selectedOffense: OffenseCode;
    onSelectOffense: (code: OffenseCode) => void;
}) {
    const renderCategory = (
        categoryKey: 'violent' | 'property' | 'other',
        offenses: typeof VIOLENT_OFFENSES
    ) => {
        const category = CATEGORY_CONFIG[categoryKey];

        return (
            <div key={categoryKey} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{category.icon}</span>
                    <span
                        className="text-xs font-bold uppercase tracking-wide"
                        style={{ color: category.color }}
                    >
                        {category.label}
                    </span>
                </div>

                <div className="space-y-1">
                    {offenses.map((offense) => (
                        <button
                            key={offense.code}
                            onClick={() => onSelectOffense(
                                selectedOffense === offense.code ? 'ALL' : offense.code
                            )}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedOffense === offense.code
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'hover:bg-[var(--danger-bg)] text-[var(--text-secondary)]'
                                }`}
                        >
                            <span>{offense.icon}</span>
                            <span className="flex-1 text-left truncate">{offense.shortLabel}</span>
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: selectedOffense === offense.code ? 'white' : offense.color }}
                            />
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* All Offenses */}
            <button
                onClick={() => onSelectOffense('ALL')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-4 transition-all ${selectedOffense === 'ALL'
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'hover:bg-[var(--danger-bg)] text-[var(--text-secondary)]'
                    }`}
            >
                <span>📊</span>
                <span className="font-medium">All Offenses</span>
            </button>

            {renderCategory('violent', VIOLENT_OFFENSES)}
            {renderCategory('property', PROPERTY_OFFENSES)}
            {renderCategory('other', OTHER_OFFENSES)}
        </div>
    );
}

// Main Dashboard Component
export default function Dashboard() {
    const [navigation, setNavigation] = useState<NavigationState>({ level: 'national' });
    const [selectedOffense, setSelectedOffense] = useState<OffenseCode>('HOM');
    const [year] = useState(2024);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleNavigate = (level: Level) => {
        if (level === 'national') {
            setNavigation({ level: 'national' });
        } else if (level === 'state' && navigation.stateAbbr) {
            setNavigation({
                level: 'state',
                stateAbbr: navigation.stateAbbr,
                stateName: navigation.stateName,
            });
        }
    };

    const handleSelectState = (stateAbbr: string) => {
        setNavigation({
            level: 'state',
            stateAbbr,
            stateName: STATE_NAMES[stateAbbr] || stateAbbr,
        });
    };

    const handleSelectCounty = (countyId: string) => {
        const parts = countyId.split('_');
        const countyName = parts[0] || countyId;
        const stateAbbr = parts[1] || navigation.stateAbbr;

        setNavigation({
            level: 'county',
            stateAbbr,
            stateName: STATE_NAMES[stateAbbr || ''] || stateAbbr,
            countyId,
            countyName,
        });
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex-shrink-0">
                {/* Caution Stripe */}
                <div className="caution-stripe" />

                <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left: Menu + Logo */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <button
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                className="p-2 rounded-lg hover:bg-[var(--danger-bg)] transition-colors"
                                aria-label="Toggle sidebar"
                            >
                                <span className="text-xl">{sidebarOpen ? '✕' : '☰'}</span>
                            </button>

                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🚨</span>
                                <div className="hidden sm:block">
                                    <h1 className="text-lg font-black text-[var(--accent-primary)] tracking-tight leading-tight">
                                        FBI CRIME DATA
                                    </h1>
                                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">
                                        Explorer Dashboard
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Center: Search */}
                        <div className="hidden lg:block flex-1 max-w-md">
                            <SearchBar
                                onSelectCounty={handleSelectCounty}
                                placeholder="Search any county..."
                            />
                        </div>

                        {/* Right: Controls */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <SystemStatus />
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Navigation Breadcrumb */}
                <LevelNavigator
                    level={navigation.level}
                    stateAbbr={navigation.stateAbbr}
                    stateName={navigation.stateName}
                    countyName={navigation.countyName}
                    onNavigate={handleNavigate}
                />
            </header>

            {/* Main Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                {sidebarOpen && (
                    <aside className="w-64 flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-y-auto">
                        <div className="p-4">
                            {/* Sidebar Header */}
                            <div className="mb-4 pb-3 border-b border-[var(--border-color)]">
                                <h2 className="text-base font-bold text-[var(--accent-primary)]">
                                    Crime Types
                                </h2>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Select offense to filter
                                </p>
                            </div>

                            {/* Offense selector */}
                            <OffenseSidebarContent
                                selectedOffense={selectedOffense}
                                onSelectOffense={setSelectedOffense}
                            />
                        </div>

                        {/* System Console */}
                        <ConsolePanel />
                    </aside>
                )}

                {/* Main Content */}
                <main className="flex-1 p-6 overflow-y-auto">
                    {navigation.level === 'national' && selectedOffense && (
                        <NationalView
                            selectedOffense={selectedOffense}
                            year={year}
                            onSelectState={handleSelectState}
                        />
                    )}

                    {navigation.level === 'state' && navigation.stateAbbr && selectedOffense && (
                        <StateView
                            stateAbbr={navigation.stateAbbr}
                            stateName={navigation.stateName || navigation.stateAbbr}
                            selectedOffense={selectedOffense}
                            year={year}
                            onSelectCounty={handleSelectCounty}
                        />
                    )}

                    {navigation.level === 'county' && navigation.countyId && (
                        <CountyView
                            countyId={navigation.countyId}
                            countyName={navigation.countyName || navigation.countyId}
                            stateAbbr={navigation.stateAbbr || ''}
                            selectedOffense={selectedOffense}
                            year={year}
                        />
                    )}
                </main>
            </div>

            {/* Footer */}
            <footer className="flex-shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] py-3 px-6">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <p>
                        Data sourced from{' '}
                        <a
                            href="https://cde.ucr.cjis.gov"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--accent-primary)] hover:underline"
                        >
                            FBI Crime Data Explorer
                        </a>
                    </p>
                    <p>Updated: December 2024</p>
                </div>
            </footer>
        </div>
    );
}
