"use client";

import { useState, useEffect } from "react";
import LogTimeline, { LogEntry } from "../../components/LogTimeline";

const SERVER_URL = "http://localhost:3001";

import LogTable from "../../components/LogTable";

export default function SystemLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

    const fetchLogs = () => {
        fetch(`${SERVER_URL}/logs`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setLogs(data);
                } else {
                    console.error("Logs format error or unauthorized:", data);
                    setLogs([]); // Default to empty to prevent crash
                }
                setLoading(false);
            })
            .catch((err) => console.error("Failed to fetch logs:", err));
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000); // Poll frequently
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Global System Logs</h1>
                    <p className="text-gray-400">Real-time stream of all agent activities across all jobs.</p>
                </div>
                <div className="flex gap-4 items-center">

                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'timeline' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Timeline
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Database View
                        </button>
                    </div>

                    <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        Live Polling
                    </span>
                </div>
            </div>

            <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl min-h-[600px] relative overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 space-y-4">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-gray-400">Connecting to Log Stream...</p>
                    </div>
                ) : (
                    viewMode === 'timeline' ? (
                        <LogTimeline logs={logs} />
                    ) : (
                        <LogTable logs={logs} />
                    )
                )}
            </div>
        </div>
    );
}

