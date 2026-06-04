import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import PageHeader from '../../../components/PageHeader';
import CustomLoading from '../../../components/CustomLoading';
import { Alert, Button } from '@mui/material';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import PeopleAltOutlined from '@mui/icons-material/PeopleAltOutlined';

const cardClass = 'bg-white rounded-lg border border-zinc-200 p-4 flex items-start justify-between gap-4';

function unwrapSummary(response) {
    const data = response?.data ?? response ?? {};
    return data.summary ?? data.archive_summary ?? data;
}

function valueFrom(summary, keys) {
    for (const key of keys) {
        if (summary?.[key] !== undefined && summary?.[key] !== null) return summary[key];
    }
    return 0;
}

export default function AdminDashboard() {
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSummary = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await arsipApi.summary();
                setSummary(unwrapSummary(response));
            } catch (err) {
                const formatted = await formatArsipError(err);
                setError(formatted.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, []);

    const cards = useMemo(() => [
        {
            title: 'Permintaan Berkas',
            value: valueFrom(summary, ['requests_count', 'total_requests', 'request_count']),
            subtitle: 'Kelola request, target, dan verifikasi berkas.',
            href: '/permintaan',
            icon: <DescriptionOutlined sx={{ color: '#2563eb' }} />,
        },
        {
            title: 'Arsip Pengguna',
            value: valueFrom(summary, ['users_count', 'archive_users_count', 'total_users']),
            subtitle: 'Buka daftar arsip pengguna.',
            href: '/arsip-pengguna',
            icon: <PeopleAltOutlined sx={{ color: '#16a34a' }} />,
        },
        {
            title: 'File Arsip',
            value: valueFrom(summary, ['files_count', 'total_files', 'current_files_count']),
            subtitle: 'Ringkasan file yang tersedia di sistem.',
            href: '/arsip-pengguna',
            icon: <FolderOutlined sx={{ color: '#9333ea' }} />,
        },
    ], [summary]);

    if (loading) return <CustomLoading />;

    return (
        <div className="font-jakarta">
            <PageHeader
                title="Dashboard Admin"
                subtitle="Ringkasan minimal arsip digital dan pintasan admin."
            />

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {cards.map((card) => (
                    <section key={card.title} className={cardClass}>
                        <div>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{card.title}</p>
                            <strong className="block text-2xl text-zinc-800 mt-2">{card.value}</strong>
                            <p className="text-xs text-zinc-500 mt-2">{card.subtitle}</p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                            {card.icon}
                        </div>
                    </section>
                ))}
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 p-4 flex flex-wrap gap-2">
                <Button component={Link} to="/permintaan" variant="contained" sx={{ borderRadius: '0.5rem', textTransform: 'none', backgroundColor: '#2563eb', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    Kelola Permintaan
                </Button>
                <Button component={Link} to="/arsip-pengguna" variant="outlined" sx={{ borderRadius: '0.5rem', textTransform: 'none', borderColor: '#e4e4e7', color: '#3f3f46', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    Arsip Pengguna
                </Button>
            </div>
        </div>
    );
}
