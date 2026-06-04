import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import {
    FolderOutlined,
    DescriptionOutlined,
    LocalShippingOutlined,
    ArrowForwardOutlined,
} from '@mui/icons-material';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { useUser } from '../../../contexts/UserContext';
import PageHeader from '../../../components/PageHeader';
import CustomLoading from '../../../components/CustomLoading';

function countValue(...values) {
    for (const value of values) {
        const numberValue = Number(value);
        if (Number.isFinite(numberValue)) return numberValue;
    }
    return '-';
}

export default function UserDashboard() {
    const { userdata } = useUser();
    const navigate = useNavigate();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await arsipApi.summary();
            if (res.success) {
                setSummary(res.data);
            } else {
                setError(res.message || 'Gagal memuat ringkasan.');
            }
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setLoading(false);
        }
    };

    const displayName = userdata?.profile?.nama || userdata?.account?.name || 'Pengguna';
    const pendingRequests = Number(summary?.pending_requests);
    const rejectedRequests = Number(summary?.rejected_requests);
    const requestCount = Number.isFinite(pendingRequests) && Number.isFinite(rejectedRequests)
        ? pendingRequests + rejectedRequests
        : countValue(summary?.total_requests, summary?.active_requests);
    const distributionCount = countValue(summary?.distribution_files, summary?.total_distributions);

    const cards = [
        {
            label: 'Arsip Saya',
            value: summary?.total_files ?? '-',
            description: 'Total file tersimpan',
            icon: FolderOutlined,
            path: '/arsip-saya',
            color: 'text-blue-600 bg-blue-50 border-blue-100',
        },
        {
            label: 'Permintaan Berkas',
            value: requestCount,
            description: 'Permintaan aktif',
            icon: DescriptionOutlined,
            path: '/permintaan',
            color: 'text-amber-600 bg-amber-50 border-amber-100',
        },
        {
            label: 'Berkas Kampus',
            value: distributionCount,
            description: 'Berkas tersedia',
            icon: LocalShippingOutlined,
            path: '/distribusi',
            color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        },
    ];

    return (
        <div>
            <PageHeader
                title={`Halo, ${displayName}`}
                subtitle="Ringkasan arsip pribadi, permintaan resmi, dan berkas kampus untuk akun aktif Anda."
            />

            {error && (
                <Alert severity="warning" className="mb-4" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <CustomLoading loading={loading}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {cards.map((card) => (
                        <button
                            type="button"
                            key={card.path}
                            className="group text-left rounded-lg border border-zinc-200 bg-white p-4 hover:-translate-y-0.5 hover:shadow-md hover:border-zinc-300 transition-all duration-150 cursor-pointer"
                            onClick={() => navigate(card.path)}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`h-10 w-10 rounded-md border flex items-center justify-center shadow-sm ${card.color}`}>
                                    <card.icon fontSize="small" />
                                </div>
                                <ArrowForwardOutlined fontSize="small" className="text-zinc-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <p className="text-2xl font-semibold text-zinc-800">{card.value}</p>
                            <p className="text-xs text-zinc-500 mt-1">{card.description}</p>
                            <p className="text-xs font-medium text-zinc-700 mt-2">{card.label}</p>
                        </button>
                    ))}
                </div>

                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-zinc-800">Mulai kelola arsip Anda</p>
                        <p className="text-xs text-zinc-500 mt-1">Upload file pribadi atau penuhi permintaan berkas dari admin.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate('/arsip-saya')}
                            sx={{ textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', borderRadius: '0.5rem' }}
                        >
                            Buka Arsip Saya
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => navigate('/permintaan')}
                            sx={{ textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', borderRadius: '0.5rem' }}
                        >
                            Lihat Permintaan
                        </Button>
                    </div>
                </div>
            </CustomLoading>
        </div>
    );
}
