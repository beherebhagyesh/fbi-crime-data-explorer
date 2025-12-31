/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: ['class', '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                // Base theme colors
                danger: {
                    50: '#FEF2F2',
                    100: '#FEE2E2',
                    200: '#FECACA',
                    300: '#FCA5A5',
                    400: '#F87171',
                    500: '#EF4444',
                    600: '#DC2626',
                    700: '#B91C1C',
                    800: '#991B1B',
                    900: '#7F1D1D',
                    950: '#450A0A',
                },
                // Offense-specific colors
                offense: {
                    hom: '#7F1D1D',
                    rpe: '#991B1B',
                    rob: '#B91C1C',
                    ass: '#DC2626',
                    bur: '#EA580C',
                    lar: '#D97706',
                    mvt: '#CA8A04',
                    ars: '#EF4444',
                    '13b': '#F87171',
                    '250': '#6366F1',
                    '270': '#8B5CF6',
                    '280': '#EC4899',
                    '290': '#F59E0B',
                    '520': '#374151',
                    '35a': '#10B981',
                },
                // Theme variables
                surface: {
                    primary: 'var(--bg-primary)',
                    secondary: 'var(--bg-secondary)',
                    card: 'var(--bg-card)',
                },
                content: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                },
                accent: {
                    primary: 'var(--accent-primary)',
                    secondary: 'var(--accent-secondary)',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'glow': '0 0 20px var(--accent-glow)',
                'glow-lg': '0 0 40px var(--accent-glow)',
                'danger': '0 4px 20px rgba(220, 38, 38, 0.3)',
            },
            animation: {
                'pulse-danger': 'pulse-danger 2s infinite',
                'glow': 'glow-text 2s infinite',
                'fade-in': 'fade-in 0.3s ease-out',
                'slide-in': 'slide-in-right 0.3s ease-out',
            },
            backgroundImage: {
                'gradient-danger': 'linear-gradient(135deg, #7F1D1D 0%, #DC2626 50%, #B91C1C 100%)',
                'gradient-dark': 'linear-gradient(180deg, #000000 0%, #1A1A1A 100%)',
                'caution-stripe': 'repeating-linear-gradient(45deg, var(--accent-primary), var(--accent-primary) 10px, #FFCC00 10px, #FFCC00 20px)',
            },
        },
    },
    plugins: [],
}
