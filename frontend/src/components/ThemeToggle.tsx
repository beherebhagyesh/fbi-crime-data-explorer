'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem('fbi-theme') as Theme;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            // Default to dark for dangerous aesthetic
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('fbi-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    if (!mounted) {
        return <div className="w-24 h-10" />;
    }

    return (
        <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] 
                 bg-[var(--bg-card)] hover:border-[var(--accent-primary)] transition-all duration-300
                 hover:shadow-glow"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                <>
                    <span className="text-xl">☀️</span>
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Light</span>
                </>
            ) : (
                <>
                    <span className="text-xl">🌙</span>
                    <span className="text-sm font-medium text-[var(--text-secondary)]">Dark</span>
                </>
            )}
        </button>
    );
}
