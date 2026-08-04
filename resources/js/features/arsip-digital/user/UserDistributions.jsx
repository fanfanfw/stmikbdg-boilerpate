import { useState, useEffect, useRef } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import { recipientPageRequest, recipientStatusView, runPreview, runRecipientAction, userDistributionController } from '../admin/institutionalArchiveUi';
import PageHeader from '../../../components/PageHeader';
import CustomLoading from '../../../components/CustomLoading';
import {
    Button,
    Alert,
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    IconButton,
    Tooltip,
    Pagination,
} from '@mui/material';
import {
    DownloadOutlined,
    LocalShippingOutlined,
    RefreshOutlined,
    DescriptionOutlined,
    CalendarTodayOutlined,
} from '@mui/icons-material';

function unwrapListResponse(response, key) {
    const payload = response?.data ?? response;
    const list = payload?.[key] ?? payload?.data ?? payload;
    return {
        data: Array.isArray(list) ? list : [],
        meta: payload?.meta ?? payload?.pagination ?? response?.meta ?? null,
    };
}

export default function UserDistributions() {
    const [listData, setListData] = useState({ data: [], meta: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); const [page, setPage] = useState(1); const controller = useRef(null); if (!controller.current) controller.current = userDistributionController();

    const fetchDistributions = async (nextPage = page, parentCapture = null) => {
        const capture = controller.current.capture();
        if (capture.valid()) { setLoading(true); setError(null); }
        try {
            const res = await arsipApi.userDistributions(recipientPageRequest(nextPage));
            if (capture.valid() && (!parentCapture || parentCapture.valid())) { setListData(unwrapListResponse(res, 'distributions')); setPage(nextPage); }
        } catch (err) {
            if (!capture.valid() || (parentCapture && !parentCapture.valid())) return false;
            const formatted = await formatArsipError(err);
            if (capture.valid() && (!parentCapture || parentCapture.valid())) setError(formatted.message);
        } finally {
            if (capture.valid() && (!parentCapture || parentCapture.valid())) setLoading(false);
        }
        return capture.valid();
    };

    useEffect(() => { fetchDistributions(1); return () => controller.current.close(); }, []);

    const fileError = async (capture, err, formatted) => { if (err?.response?.status === 410) await fetchDistributions(page, capture); if (capture.valid()) customSwal.toast.error({ title: err?.response?.status === 410 ? 'Berkas tidak tersedia' : 'Berkas gagal dibuka', message: formatted.message }); };
    const handleDownload = file => {
        const capture = controller.current.begin(); if (!capture) return false;
        return runRecipientAction({ capture, action: () => arsipApi.downloadDistributionFile(file), refresh: () => fetchDistributions(page, capture), onSuccess: () => customSwal.toast.success({ title: 'Unduhan dimulai' }), onError: (err, formatted) => fileError(capture, err, formatted), formatError: formatArsipError }).finally(() => controller.current.release(capture));
    };
    const handlePreview = file => {
        const capture = controller.current.begin(); if (!capture) return false;
        return runRecipientAction({ capture, action: () => runPreview(window.open.bind(window), () => arsipApi.previewDistributionRecipient(file.recipient_id), URL, error => { throw error; }, async error => error, setTimeout, capture), onError: (err, formatted) => fileError(capture, err, formatted), formatError: formatArsipError }).finally(() => controller.current.release(capture));
    };

    return (
        <Box className="font-jakarta">
            <PageHeader
                title="Berkas Kampus"
                subtitle="Berkas yang didistribusikan oleh kampus untuk Anda"
                icon={<LocalShippingOutlined />}
                actions={
                    <Button
                        variant="outlined"
                        startIcon={<RefreshOutlined />}
                        onClick={() => fetchDistributions(page)}
                        disabled={loading}
                        size="small"
                        sx={{
                            borderColor: '#e4e4e7',
                            color: '#3f3f46',
                            borderRadius: '0.5rem',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: '#a1a1aa',
                                backgroundColor: '#f4f4f5',
                            },
                        }}
                    >
                        Refresh
                    </Button>
                }
            />

            {loading && <CustomLoading />}

            {!loading && error && (
                <Alert
                    severity="error"
                    sx={{ borderRadius: '0.5rem', mb: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => fetchDistributions(page)}
                        >
                            Coba Lagi
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            {!loading && !error && listData.data.length === 0 && (
                <Card
                    sx={{
                        borderRadius: '0.5rem',
                        border: '1px solid #e4e4e7',
                        boxShadow: 'none',
                    }}
                >
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <LocalShippingOutlined
                            sx={{ fontSize: 48, color: '#a1a1aa', mb: 1 }}
                        />
                        <Typography
                            variant="body1"
                            sx={{ color: '#71717a', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                        >
                            Belum ada berkas kampus yang tersedia untuk Anda
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {!loading && !error && listData.data.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {listData.data.map((dist) => (
                        <Card
                            key={dist.distribution_id}
                            sx={{
                                borderRadius: '0.5rem',
                                border: '1px solid #e4e4e7',
                                boxShadow: 'none',
                                transition: 'box-shadow 0.2s ease',
                                '&:hover': {
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                },
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 600,
                                            color: '#18181b',
                                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                                            fontSize: '1rem',
                                        }}
                                    >
                                        {dist.title}
                                    </Typography>
                                    {(() => { const view = recipientStatusView({ ...dist, download_count: dist.recipients?.[0]?.download_count || 0 }); return <Chip label={view.status} size="small" color={view.color} />; })()}
                                    {dist.published_at && (
                                        <Chip
                                            icon={<CalendarTodayOutlined sx={{ fontSize: 14 }} />}
                                            label={dateTime(dist.published_at)}
                                            size="small"
                                            sx={{
                                                backgroundColor: '#eff6ff',
                                                color: '#2563eb',
                                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                                fontSize: '0.75rem',
                                                borderRadius: '0.375rem',
                                                '& .MuiChip-icon': { color: '#2563eb' },
                                            }}
                                        />
                                    )}
                                </Box>

                                {dist.institutional_archive && <Typography variant="body2" sx={{ color: '#52525b', mb: 1 }}>Arsip: {dist.institutional_archive.title} · Unit: {dist.institutional_archive.unit?.name || '-'} · Nomor: {dist.institutional_archive.document_number || '-'} · Kedaluwarsa: {dist.expires_at ? dateTime(dist.expires_at) : 'Tanpa batas'}</Typography>}
                                {dist.description && (
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: '#52525b',
                                            mb: 2,
                                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {dist.description}
                                    </Typography>
                                )}

                                {dist.files && dist.files.length > 0 && (
                                    <Box
                                        sx={{
                                            mt: 2,
                                            borderTop: '1px solid #f4f4f5',
                                            pt: 2,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: '#71717a',
                                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                                fontWeight: 500,
                                                mb: 1,
                                                display: 'block',
                                            }}
                                        >
                                            File ({dist.files.length})
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {dist.files.map((file) => (
                                                <Box
                                                    key={file.recipient_id}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        px: 1.5,
                                                        py: 1,
                                                        borderRadius: '0.375rem',
                                                        backgroundColor: '#fafafa',
                                                        border: '1px solid #f4f4f5',
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                                        <DescriptionOutlined sx={{ fontSize: 18, color: '#a1a1aa', flexShrink: 0 }} />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: '#3f3f46',
                                                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                                                                fontSize: '0.8125rem',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}
                                                        >
                                                            {file.display_filename || file.original_filename}
                                                        </Typography>
                                                    </Box>
                                                    <Button size="small" onClick={() => handlePreview(file)}>Preview</Button>
                                                    <Tooltip title="Unduh file" arrow>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDownload(file)}
                                                            sx={{
                                                                color: '#2563eb',
                                                                '&:hover': {
                                                                    backgroundColor: '#eff6ff',
                                                                },
                                                            }}
                                                        >
                                                            <DownloadOutlined fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </Box>
            )}
            {!loading && !error && <Pagination page={page} count={listData.meta?.last_page || 1} onChange={(_, nextPage) => fetchDistributions(nextPage)} />}
        </Box>
    );
}
