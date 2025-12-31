import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { ToastProvider } from '@/components/ToastProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'FBI Crime Data Explorer | County Crime Statistics Dashboard',
    description: 'Explore FBI crime statistics at national, state, and county levels. View trends, predictions, and detailed offense data.',
    keywords: 'FBI, crime statistics, county data, crime trends, law enforcement data',
    icons: {
        icon: '/favicon.ico',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" data-theme="dark" suppressHydrationWarning>
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className={inter.className}>
                <Providers>
                    {children}
                    <ToastProvider />
                </Providers>
            </body>
        </html>
    );
}
