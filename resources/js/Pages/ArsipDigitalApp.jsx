import { useEffect, useState } from "react";
import { useUser } from "../contexts/UserContext";
import MainLayout from "../layouts/MainLayout";
import ArsipDigitalRoutes from "../features/arsip-digital/routes";

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
        <MainLayout>
            <ArsipDigitalRoutes />
        </MainLayout>
    );
}
