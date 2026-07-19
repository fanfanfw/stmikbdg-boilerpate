import { Component, useEffect, useState } from "react";
import { useUser } from "../contexts/UserContext";
import MainLayout from "../layouts/MainLayout";
import ArsipDigitalRoutes from "../features/arsip-digital/routes";

class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Arsip Digital render error', error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex min-h-[60vh] items-center justify-center p-6 font-jakarta">
                <div className="max-w-md text-center">
                    <h1 className="text-lg font-semibold text-zinc-800">Halaman gagal ditampilkan</h1>
                    <p className="mt-2 text-sm text-zinc-500">Terjadi kesalahan saat merender halaman. Muat ulang untuk memulihkan tampilan.</p>
                    <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                        Muat Ulang
                    </button>
                </div>
            </div>
        );
    }
}

export default function ArsipDigitalApp() {
    const { setUserdata, setRole, setProfile, setLoadingUserdata } = useUser();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                const res = await fetch('/session/me', {
                    headers: {
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || '',
                    },
                    credentials: 'same-origin',
                });

                if (!res.ok) {
                    throw new Error('Gagal mengambil data sesi');
                }

                const data = await res.json();
                setUserdata(data);
                setRole(data.role);
                setProfile(data.profile);
                setLoadingUserdata(false);
            } catch (err) {
                setError(err.message);
                setLoadingUserdata(false);
            } finally {
                setLoading(false);
            }
        };

        fetchSession();
    }, []);

    if (loading) {
        return (
            <div className="font-jakarta flex items-center justify-center min-h-screen bg-gradient-to-b from-zinc-100 to-white">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-sm text-zinc-500">Memuat...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="font-jakarta flex items-center justify-center min-h-screen bg-gradient-to-b from-zinc-100 to-white">
                <div className="text-center">
                    <p className="text-sm text-red-500">{error}</p>
                    <a href="/logout" className="text-xs text-blue-500 underline mt-2 inline-block">Kembali ke login</a>
                </div>
            </div>
        );
    }

    return (
        <AppErrorBoundary>
            <MainLayout>
                <ArsipDigitalRoutes />
            </MainLayout>
        </AppErrorBoundary>
    );
}
