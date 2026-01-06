"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LogTimeline, { LogEntry } from "../components/LogTimeline";
import LogTable from "../components/LogTable";

const SERVER_URL = "http://localhost:3001";

interface Job {
  id: string;
  status: string;
  form_name?: string;
  url: string;
  profile_name?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custom_data?: any;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [initialLoading, setInitialLoading] = useState(true);

  // Resume State
  const [resumeJobId, setResumeJobId] = useState("");
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeTextInput, setResumeTextInput] = useState("");

  const fetchJobs = () => {
    fetch(`${SERVER_URL}/jobs`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setJobs(data);
          // AUTO-OPEN RESUME MODAL if a job is waiting (and not already showing)
          const waitingJob = data.find(j => j.status === 'WAITING_INPUT');
          if (waitingJob && !showResumeModal && !resumeJobId) {
            console.log("Auto-opening resume modal for:", waitingJob.id);
            setResumeJobId(waitingJob.id);
            setShowResumeModal(true);
          }
        } else {
          console.error("Jobs fetch error:", data);
          setJobs([]);
        }
        setInitialLoading(false);
      })
      .catch((err) => console.error("Failed to fetch jobs:", err));
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  const deleteJob = async (jobId: string) => {
    if (!confirm("Delete this job record?")) return;
    try {
      const res = await fetch(`${SERVER_URL}/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        setJobs(prev => prev.filter(j => j.id !== jobId));
        fetchJobs();
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pauseJob = async (jobId: string) => {
    try {
      await fetch(`${SERVER_URL}/jobs/${jobId}/pause`, { method: 'POST' });
      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const continueJob = async (jobId: string) => {
    try {
      await fetch(`${SERVER_URL}/jobs/${jobId}/continue`, { method: 'POST' });
      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const cancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to stop this job?")) return;
    try {
      await fetch(`${SERVER_URL}/jobs/${jobId}/cancel`, { method: 'POST' });
      fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const viewLogs = async (jobId: string) => {
    setShowLogs(true);
    setLogs([]);
    setViewMode('timeline');
    try {
      const res = await fetch(`${SERVER_URL}/jobs/${jobId}/logs`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        console.error("Logs fetch error:", data);
        setLogs([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ... (resume helper functions remain same, but avoiding huge replace block)

  // ... (skipping to render part)
  /* I will use a separate replacement for the render part to be safer */


  const handleResumeSubmit = async () => {
    if (!resumeJobId) return;
    const job = jobs.find(j => j.id === resumeJobId);
    const missingType = job?.custom_data?._missing_type || 'file';
    const missingLabel = job?.custom_data?._missing_label || 'user_response';

    const formData = new FormData();
    if (missingType === 'file') {
      if (resumeFile) formData.append("file", resumeFile);
    } else {
      const payload = { [missingLabel]: resumeTextInput };
      formData.append("custom_data", JSON.stringify(payload));
    }

    try {
      const res = await fetch(`${SERVER_URL}/jobs/${resumeJobId}/resume`, { method: 'POST', body: formData });
      if (res.ok) {
        setShowResumeModal(false);
        setResumeFile(null);
        setResumeTextInput("");
        fetchJobs();
      } else {
        const d = await res.json();
        alert("Error: " + d.error);
      }
    } catch (e) {
      if (e instanceof Error) {
        alert("Network Error: " + e.message);
      } else {
        alert("Network Error");
      }
    }
  };

  const openResumeModal = (id: string) => {
    setResumeJobId(id);
    setShowResumeModal(true);
    setResumeFile(null);
    setResumeTextInput("");
  };

  // derived stats
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
  // const failedJobs = jobs.filter(j => j.status === 'FAILED').length;
  const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  // Timer for live duration updates
  const [now, setNow] = useState(0);

  useEffect(() => {
    setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getDuration = (job: Job) => {
    if (!job.started_at) return "-";
    const start = new Date(job.started_at).getTime();
    const end = job.completed_at ? new Date(job.completed_at).getTime() : now;
    const diff = end - start;
    if (diff < 0) return "-";

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="animate-in fade-in duration-500 text-white pb-20">

      {/* Hero Section */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2 tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-400 text-lg">Manage your automated workforce.</p>
        </div>

        <div className="flex gap-4">
          <Link href="/create">
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              <span>New Automation</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Grid - Dark Glass UI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Total Deployments - Blue Accent */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-20 bg-blue-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:text-white transition-colors duration-300 ring-1 ring-blue-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            </div>
            {/* Trend Indicator (Static for now) */}
            <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">+12%</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-white">{totalJobs}</h3>
            <p className="text-slate-400 text-sm font-medium mt-1">Total Deployments</p>
          </div>
        </div>

        {/* Success Rate - Green Accent */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-20 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-emerald-500/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:text-white transition-colors duration-300 ring-1 ring-emerald-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Optimal</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-white">{successRate}%</h3>
            <p className="text-slate-400 text-sm font-medium mt-1">Success Rate</p>
          </div>
          <div className="w-full bg-slate-700/50 h-1.5 mt-4 rounded-full overflow-hidden relative z-10">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${successRate}%` }}></div>
          </div>
        </div>

        {/* Active Agents - Purple Accent */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-20 bg-purple-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-colors"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:text-white transition-colors duration-300 ring-1 ring-purple-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
            </div>
            <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">Online</span>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-bold text-white">
              {jobs.filter(j => ['PROCESSING', 'WAITING_INPUT'].includes(j.status)).length}
            </h3>
            <p className="text-slate-400 text-sm font-medium mt-1">Active Agents</p>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-lg border border-white/5">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <h2 className="font-bold text-lg text-white">Recent Activity</h2>
          <button onClick={fetchJobs} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Task</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Profile</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {initialLoading && jobs.length === 0 ? (
                // Skeleton Loader
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-6 bg-slate-800 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-800 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : jobs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500">No activity yet.</td></tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border
                                        ${job.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                          job.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            job.status === 'CANCELLED' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                              job.status === 'WAITING_INPUT' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 animate-pulse' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {job.status === 'WAITING_INPUT' ? (
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            INPUT REQUIRED
                          </span>
                        ) : job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-semibold">{job.form_name || 'Untitled Task'}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{job.url}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
                          {(job.profile_name || 'S')[0].toUpperCase()}
                        </div>
                        <span className="text-slate-400 font-medium">{job.profile_name || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs font-bold text-blue-300/80">
                      {getDuration(job)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => viewLogs(job.id)} className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline transition-all">View Logs</button>

                        {/* PAUSE / CONTINUE */}
                        {job.status === 'PROCESSING' && (
                          <button onClick={() => pauseJob(job.id)} className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600 text-slate-300 rounded text-[10px] font-bold transition-all uppercase tracking-wide border border-slate-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Pause
                          </button>
                        )}
                        {job.status === 'PAUSED' && (
                          <button onClick={() => continueJob(job.id)} className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold transition-all uppercase tracking-wide border border-emerald-500/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Continue
                          </button>
                        )}

                        {job.status === 'WAITING_INPUT' && (
                          <button onClick={() => openResumeModal(job.id)} className="px-3 py-1 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded text-[10px] font-bold transition-all uppercase tracking-wide border border-yellow-500/30">Resume</button>
                        )}
                        {/* STOP BUTTON */}
                        {['PROCESSING', 'PAUSED', 'WAITING_INPUT'].includes(job.status) && (
                          <button onClick={() => cancelJob(job.id)} className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[10px] font-bold transition-all uppercase tracking-wide border border-red-500/20 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            Stop
                          </button>
                        )}
                        <button onClick={() => deleteJob(job.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border-2 border-slate-900 ring-1 ring-emerald-500/50"></div>
                <div>
                  <h3 className="font-bold text-white text-sm">Agent Live Stream</h3>
                </div>
              </div>

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

              <button
                onClick={() => setShowLogs(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-0 bg-black/30 custom-scrollbar">
              {viewMode === 'timeline' ? (
                <LogTimeline logs={logs} />
              ) : (
                <LogTable logs={logs} />
              )}
            </div>
          </div>
        </div>
      )}


      {/* Resume Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in zoom-in-95 duration-200">
          <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl relative overflow-hidden ring-1 ring-white/10">
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500"></div>

            <div className="mb-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Input Required</h3>
                <p className="text-slate-400 text-sm mt-1">The agent has paused for your input.</p>
              </div>
            </div>

            {(() => {
              const job = jobs.find(j => j.id === resumeJobId);
              const missingType = job?.custom_data?._missing_type || 'file';
              const missingLabel = job?.custom_data?._missing_label || 'Information';

              return (
                <>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-6">
                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Requesting</p>
                    <p className="text-white font-medium text-base">{missingLabel}</p>
                  </div>

                  {missingType === 'file' ? (
                    <div className="mb-6">
                      <label className="block w-full cursor-pointer hover:bg-white/5 transition-colors border-2 border-dashed border-slate-600 rounded-xl p-8 text-center group">
                        <input type="file" onChange={e => e.target.files && setResumeFile(e.target.files[0])} className="hidden" />
                        <div className="w-12 h-12 mx-auto mb-3 text-slate-500 group-hover:text-blue-400 transition-colors">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-400 group-hover:text-white transition-colors block">
                          {resumeFile ? resumeFile.name : "Click to upload file"}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <input type="text" value={resumeTextInput} onChange={e => setResumeTextInput(e.target.value)} className="glass-input w-full px-4 py-3 rounded-xl text-lg text-white placeholder:text-slate-600 bg-black/20" placeholder="Type answer..." autoFocus onKeyDown={e => e.key === 'Enter' && handleResumeSubmit()} />
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowResumeModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleResumeSubmit} className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-sm shadow-lg shadow-yellow-500/20 transition-all hover:scale-105">
                      Submit & Resume
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

    </div>
  );
}
