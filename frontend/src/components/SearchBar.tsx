'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchResult {
    countyId: string;
    countyName: string;
    stateAbbr: string;
    agencyCount: number;
}

interface SearchBarProps {
    onSelectCounty: (countyId: string) => void;
    placeholder?: string;
}

export default function SearchBar({
    onSelectCounty,
    placeholder = "Search counties...",
}: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Debounced search using Elasticsearch
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:49080';
                const response = await fetch(
                    `${apiUrl}/api/system/search/counties?q=${encodeURIComponent(query)}&limit=10`
                );

                if (!response.ok) {
                    throw new Error('Search failed');
                }

                const data = await response.json();
                setResults(data);
                setIsOpen(data.length > 0);
            } catch (error) {
                console.error('Search error:', error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSelectedIndex(-1);
                break;
        }
    };

    const handleSelect = (result: SearchResult) => {
        onSelectCounty(result.countyId);
        setQuery('');
        setIsOpen(false);
        setSelectedIndex(-1);
    };

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative">
            {/* Search Input */}
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    🔍
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-[var(--border-color)]
                     bg-[var(--bg-card)] text-[var(--text-primary)]
                     focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2
                     focus:ring-[var(--accent-glow)] transition-all"
                />
                {isLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                    </span>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-2 py-2 rounded-lg border border-[var(--border-color)]
                     bg-[var(--bg-card)] shadow-lg max-h-80 overflow-y-auto animate-fade-in"
                >
                    {results.length === 0 ? (
                        <p className="px-4 py-3 text-[var(--text-muted)] text-center">
                            No counties found
                        </p>
                    ) : (
                        results.map((result, index) => (
                            <button
                                key={result.countyId}
                                onClick={() => handleSelect(result)}
                                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all
                           ${selectedIndex === index
                                        ? 'bg-[var(--danger-bg)]'
                                        : 'hover:bg-[var(--bg-secondary)]'}`}
                            >
                                <span className="text-lg">🏘️</span>
                                <div className="flex-1">
                                    <p className="font-medium">{result.countyName}</p>
                                    <p className="text-sm text-[var(--text-muted)]">
                                        {result.stateAbbr} • {result.agencyCount} agencies
                                    </p>
                                </div>
                                <span className="text-[var(--text-muted)]">→</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
