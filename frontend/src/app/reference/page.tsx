"use client";

import React from 'react';

const ReferencePage = () => {
    // Verified data from debug script (31 Dec 2025)
    const homicideData = [
        { year: 2020, al: 242, us: 21592 },
        { year: 2021, al: 422, us: 17907 },
        { year: 2022, al: 527, us: 21868 },
        { year: 2023, al: 504, us: 19745 },
        { year: 2024, al: 471, us: 17094 },
    ];

    const assaultData = [
        { year: 2020, al: 8317, us: 884776 },
        { year: 2021, al: 12275, us: 662025 },
        { year: 2022, al: 15798, us: 886486 },
        { year: 2023, al: 15975, us: 875324 },
        { year: 2024, al: 15492, us: 847229 },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-12">
            <header className="border-b border-gray-700 pb-4">
                <h1 className="text-3xl font-bold text-white">FBI Crime Data Reference</h1>
                <p className="text-gray-400 mt-2">
                    Visualizing National vs State (Alabama) trends for 2020-2024.
                    This data was fetched using the new <b>Range API</b> logic.
                </p>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Homicide Card */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-xl">
                    <h2 className="text-xl font-semibold text-red-400 mb-6 flex items-center gap-2">
                        <span>🩸</span> Homicides (HOM)
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs uppercase bg-[#252525] text-gray-400">
                                <tr>
                                    <th className="px-4 py-3">Year</th>
                                    <th className="px-4 py-3 text-right">Alabama</th>
                                    <th className="px-4 py-3 text-right">United States</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {homicideData.map((d) => (
                                    <tr key={d.year} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono">{d.year}</td>
                                        <td className="px-4 py-3 text-right text-white">{d.al.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-gray-400">{d.us.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Assault Card */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-xl">
                    <h2 className="text-xl font-semibold text-orange-400 mb-6 flex items-center gap-2">
                        <span>⚔️</span> Aggravated Assault (ASS)
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs uppercase bg-[#252525] text-gray-400">
                                <tr>
                                    <th className="px-4 py-3">Year</th>
                                    <th className="px-4 py-3 text-right">Alabama</th>
                                    <th className="px-4 py-3 text-right">United States</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {assaultData.map((d) => (
                                    <tr key={d.year} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-mono">{d.year}</td>
                                        <td className="px-4 py-3 text-right text-white">{d.al.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right text-gray-400">{d.us.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-lg">
                <h3 className="text-blue-400 font-bold mb-2">💡 Implementation Note</h3>
                <p className="text-sm text-gray-300">
                    The backend now supports range-based fetching (e.g., <code>from=01-2020&to=12-2025</code>).
                    This drastically reduces API latency and prevents data gaps caused by single-year requests.
                </p>
                <div className="mt-4 p-3 bg-black/40 rounded font-mono text-xs text-green-400">
                    GET /api/crimes/range?offense=HOM&start=2020&end=2024
                </div>
            </section>

            <div className="text-center">
                <a href="/" className="text-[var(--accent-primary)] hover:underline">← Back to Dashboard</a>
            </div>
        </div>
    );
};

export default ReferencePage;
