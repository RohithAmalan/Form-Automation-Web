
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
    id: string;
    display_name: string;
    email: string;
    photo_url: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => { } });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkUser = async () => {
            try {
                const res = await fetch("http://localhost:3001/auth/me", { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
                        setUser(data.user);
                    }
                } else if (pathname !== '/login') {
                    // router.push('/login'); // Optional: enforce login
                }
            } catch (err) {
                console.error("Auth check failed", err);
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, [pathname]);

    const logout = async () => {
        await fetch("http://localhost:3001/auth/logout", { method: "POST", credentials: 'include' });
        setUser(null);
        router.push('/login');
    };

    if (loading) {
        return <div className="min-h-screen bg-[#050511] flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
