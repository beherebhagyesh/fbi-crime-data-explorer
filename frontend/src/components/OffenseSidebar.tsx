'use client';

import {
    OFFENSE_CONFIGS,
    CATEGORY_CONFIG,
    VIOLENT_OFFENSES,
    PROPERTY_OFFENSES,
    OTHER_OFFENSES,
    OffenseCode
} from '@/lib/offenseConfig';

interface OffenseSidebarProps {
    selectedOffense: OffenseCode | null;
    onSelectOffense: (code: OffenseCode | null) => void;
}

export default function OffenseSidebar({
    selectedOffense,
    onSelectOffense
}: OffenseSidebarProps) {
    const renderCategory = (
        categoryKey: 'violent' | 'property' | 'other',
        offenses: typeof VIOLENT_OFFENSES
    ) => {
        const category = CATEGORY_CONFIG[categoryKey];

        return (
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 px-2">
                    <span className="text-lg">{category.icon}</span>
                    <span
                        className="text-sm font-bold uppercase tracking-wide"
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
                                selectedOffense === offense.code ? null : offense.code
                            )}
                            className={`sidebar-item w-full ${selectedOffense === offense.code ? 'active' : ''
                                }`}
                            style={{
                                borderLeft: selectedOffense === offense.code
                                    ? `4px solid ${offense.color}`
                                    : '4px solid transparent',
                            }}
                        >
                            <span className="text-xl">{offense.icon}</span>
                            <span className="flex-1 text-left">{offense.shortLabel}</span>
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: offense.color }}
                            />
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <aside className="sidebar">
            {/* Header */}
            <div className="mb-6 pb-4 border-b border-[var(--border-color)]">
                <h2 className="text-lg font-bold text-[var(--accent-primary)]">
                    Crime Types
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                    Select offense to filter
                </p>
            </div>

            {/* All Offenses Option */}
            <button
                onClick={() => onSelectOffense(null)}
                className={`sidebar-item w-full mb-4 ${selectedOffense === null ? 'active' : ''
                    }`}
            >
                <span className="text-xl">📊</span>
                <span className="flex-1 text-left font-medium">All Offenses</span>
            </button>

            {/* Categories */}
            {renderCategory('violent', VIOLENT_OFFENSES)}
            {renderCategory('property', PROPERTY_OFFENSES)}
            {renderCategory('other', OTHER_OFFENSES)}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-muted)] mb-2">Danger Level</p>
                <div className="flex items-center gap-1">
                    {[...Array(10)].map((_, i) => (
                        <div
                            key={i}
                            className="w-2 h-4 rounded-sm"
                            style={{
                                backgroundColor: i < 4 ? '#10B981' : i < 7 ? '#F59E0B' : '#DC2626',
                                opacity: 0.3 + (i * 0.07),
                            }}
                        />
                    ))}
                </div>
                <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                    <span>Low</span>
                    <span>High</span>
                </div>
            </div>
        </aside>
    );
}
