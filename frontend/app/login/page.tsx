
"use client";

import { ShieldCheck } from 'lucide-react';

const SERVER_URL = "http://localhost:3001";

export default function LoginPage() {
    const handleLogin = () => {
        window.location.href = `${SERVER_URL}/auth/google`;
    };

    return (
        <div className="min-h-screen bg-[#050511] flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-white/10 flex flex-col items-center text-center">

                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
                    <ShieldCheck className="w-8 h-8 text-white" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
                <p className="text-gray-400 mb-8">Sign in to access your automation dashboard.</p>

                {/* Email / Password Form */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        const email = (e.target as any).email.value;
                        const password = (e.target as any).password.value;

                        fetch(`${SERVER_URL}/auth/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, password })
                        })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    window.location.href = '/';
                                } else {
                                    alert(data.error || "Login Failed");
                                }
                            })
                            .catch(() => alert("Login Error"));
                    }}
                    className="w-full space-y-4 mb-6"
                >
                    <input
                        name="email"
                        type="email"
                        placeholder="admin@local"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        required
                    />
                    <input
                        name="password"
                        type="password"
                        placeholder="Password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        required
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-blue-500/20"
                    >
                        Login as Admin
                    </button>
                </form>

                <div className="relative w-full mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-[#050511] text-gray-500">Or continue with</span>
                    </div>
                </div>

                <button
                    onClick={handleLogin}
                    className="w-full bg-white text-gray-900 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all hover:scale-[1.02] shadow-xl"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="G" className="w-6 h-6" />
                    <span>Google Workspace</span>
                </button>

                <p className="text-xs text-gray-500 mt-8">
                    Secure access provided by OAuth 2.0
                </p>
            </div>
        </div>
    );
}
