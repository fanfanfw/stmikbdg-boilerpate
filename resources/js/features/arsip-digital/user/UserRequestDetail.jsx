import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime, bytes } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomLoading from '../../../components/CustomLoading';
import {
    Button,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Divider,
    Typography,
    Box,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
} from '@mui/material';
import {
    CloudUploadOutlined,
    ContentCopyOutlined,
    DownloadOutlined,
    ArrowBackOutlined,
    DescriptionOutlined,
    CheckCircleOutlined,
} from '@mui/icons-material';

const buttonSx = {
    borderRadius: '0.5rem',
    textTransform: 'none',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
};

const panelClass = 'bg-white rounded-lg border border-zinc-200 p-4';

function unwrapRequest(response) {
    const data = response?.data || response || {};
    return data.request || data;
}

function unwrapFiles(response) {
    const data = response?.data ?? response ?? {};
    const files = data.files ?? data.data ?? data;
    return Array.isArray(files) ? files : [];
}

const safeUploadSettings = {
    default_max_file_size_mb: 10,
    default_allowed_extensions: [],
    allow_file_reuse: true,
};

function normalizeExtensions(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase().replace(/^\./, ''));
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
            .filter(Boolean);
    }
    return [];
}

function fileName(file) {
    return file?.display_filename || file?.original_filename || file?.filename || `File #${file?.file_id || '-'}`;
}

function fileSize(file) {
    return file?.file_size_bytes ?? file?.file_size ?? file?.size;
}

function fileExtension(file) {
    return String(file?.extension || file?.name?.split('.').pop() || fileName(file).split('.').pop() || '').toLowerCase().replace(/^\./, '');
}

function assignmentOf(request) {
    return request?.assignment || request?.assignments?.[0] || null;
}

function currentFiles(assignment) {
    return (assignment?.request_files || assignment?.files || []).filter((item) => item.is_current !== false);
}

export default function UserRequestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [reuseOpen, setReuseOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const [personalFiles, setPersonalFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [selectedReuseFileId, setSelectedReuseFileId] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [fallbackSettings, setFallbackSettings] = useState(null);
    const [fallbackSettingsUnavailable, setFallbackSettingsUnavailable] = useState(false);

    const assignment = assignmentOf(request);
    const uploadedFiles = currentFiles(assignment);
    const requestAllowedExtensions = normalizeExtensions(request?.allowed_extensions);
    const fallbackAllowedExtensions = normalizeExtensions(fallbackSettings?.default_allowed_extensions);
    const allowedExtensions = requestAllowedExtensions.length ? requestAllowedExtensions : fallbackAllowedExtensions;
    const maxFileSizeMb = Number(request?.max_file_size_mb || fallbackSettings?.default_max_file_size_mb || safeUploadSettings.default_max_file_size_mb);
    const allowFileReuse = request?.allow_file_reuse ?? fallbackSettings?.allow_file_reuse ?? safeUploadSettings.allow_file_reuse;
    const allowLateSubmission = request?.allow_late_submission ?? request?.allow_late_upload ?? request?.allow_late_submissions ?? false;
    const isOverdue = request?.deadline_at && assignment?.status !== 'approved' && new Date(request.deadline_at) < new Date();
    const isLocked = ['closed', 'archived'].includes(request?.status) || assignment?.status === 'approved' || (isOverdue && !allowLateSubmission);

    const fetchDetail = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.userRequestDetail(id);
            setRequest(unwrapRequest(response));
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchFallbackSettings = async () => {
        try {
            const response = await arsipApi.summary();
            setFallbackSettings({ ...safeUploadSettings, ...(response.data || response) });
            setFallbackSettingsUnavailable(false);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setFallbackSettings(safeUploadSettings);
            setFallbackSettingsUnavailable(true);
            if (formatted.status !== 403) {
                customSwal.toast.error({ message: formatted.message });
            }
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    useEffect(() => {
        fetchFallbackSettings();
    }, []);

    const validateFile = (file) => {
        if (!file) return 'Pilih file terlebih dahulu';
        if (allowedExtensions.length && !allowedExtensions.includes(fileExtension(file))) {
            return `Ekstensi file tidak diizinkan. Ekstensi yang diizinkan: ${allowedExtensions.join(', ')}`;
        }
        if (maxFileSizeMb && file.size > maxFileSizeMb * 1024 * 1024) {
            return `Ukuran file melebihi batas maksimum ${maxFileSizeMb} MB`;
        }
        return '';
    };

    const openUploadDialog = () => {
        setSelectedFile(null);
        setUploadError('');
        setUploadOpen(true);
    };

    const handleUpload = async () => {
        const validation = validateFile(selectedFile);
        if (validation) {
            setUploadError(validation);
            return;
        }

        setActionLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('display_filename', selectedFile.name);
            await arsipApi.uploadAssignmentFile(assignment.assignment_id, formData);
            customSwal.toast.success({ message: 'File berhasil diunggah' });
            setUploadOpen(false);
            await fetchDetail();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setUploadError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const openReuseDialog = async () => {
        setSelectedReuseFileId(null);
        setReuseOpen(true);
        setFilesLoading(true);
        try {
            const response = await arsipApi.files({ is_current: true });
            setPersonalFiles(unwrapFiles(response));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setFilesLoading(false);
        }
    };

    const handleReuse = async () => {
        if (!selectedReuseFileId) return;
        setActionLoading(true);
        try {
            await arsipApi.reuseAssignmentFile(assignment.assignment_id, selectedReuseFileId);
            customSwal.toast.success({ message: 'File lama berhasil dipakai' });
            setReuseOpen(false);
            await fetchDetail();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownload = async (requestFile) => {
        try {
            await arsipApi.downloadFile(requestFile.file || requestFile);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    if (loading) return <CustomLoading />;

    return (
        <div className="font-jakarta">
            <PageHeader
                title={request?.title || 'Detail Permintaan'}
                subtitle="Detail permintaan berkas dan file yang sudah Anda kirim"
                breadcrumbs={[
                    { label: 'Permintaan Berkas', href: '/home/permintaan' },
                    { label: request?.title || 'Detail Permintaan' },
                ]}
                actions={
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackOutlined />}
                        onClick={() => navigate('/home/permintaan')}
                        sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}
                    >
                        Kembali
                    </Button>
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <section className={panelClass}>
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Metadata Permintaan</p>
                                <h2 className="text-base font-semibold text-zinc-800">{request?.title || '-'}</h2>
                            </div>
                            <StatusChip status={request?.status} />
                        </div>
                        <p className="text-sm text-zinc-600 mb-4 whitespace-pre-line">{request?.description || 'Tidak ada deskripsi.'}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <Box className="rounded-lg bg-zinc-50 p-3">
                                <Typography variant="caption" className="!font-jakarta !text-zinc-500">Deadline</Typography>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-zinc-800'}>{dateTime(request?.deadline_at)}</span>
                                    {isOverdue && <StatusChip status="late" />}
                                </div>
                            </Box>
                            <Box className="rounded-lg bg-zinc-50 p-3">
                                <Typography variant="caption" className="!font-jakarta !text-zinc-500">Aturan File</Typography>
                                <p className="text-zinc-800 mt-1">Maks. {maxFileSizeMb || '-'} MB · {allowedExtensions.length ? allowedExtensions.join(', ') : 'Default'}</p>
                            </Box>
                        </div>
                    </section>

                    {assignment?.status === 'rejected' && assignment?.reject_reason && (
                        <Alert severity="error" sx={{ borderRadius: '0.5rem' }}>
                            Alasan penolakan: {assignment.reject_reason}
                        </Alert>
                    )}

                    <section className={panelClass}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-800">File Terunggah</h3>
                                <p className="text-xs text-zinc-500">{uploadedFiles.length} file dalam permintaan ini</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="contained"
                                    startIcon={<CloudUploadOutlined />}
                                    onClick={openUploadDialog}
                                    disabled={isLocked || !assignment}
                                    sx={{ ...buttonSx, backgroundColor: '#2563eb' }}
                                >
                                    Upload
                                </Button>
                                {allowFileReuse !== false && (
                                    <Button
                                        variant="outlined"
                                        startIcon={<ContentCopyOutlined />}
                                        onClick={openReuseDialog}
                                        disabled={isLocked || !assignment}
                                        sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}
                                    >
                                        Pakai File Lama
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Divider />
                        {uploadedFiles.length ? (
                            <List>
                                {uploadedFiles.map((requestFile) => {
                                    const file = requestFile.file || requestFile;
                                    return (
                                        <ListItem key={requestFile.request_file_id || file.file_id} divider>
                                            <DescriptionOutlined sx={{ color: '#71717a', mr: 2 }} />
                                            <ListItemText
                                                primary={fileName(file)}
                                                secondary={`${bytes(fileSize(file))} · ${dateTime(requestFile.created_at || file.created_at)}`}
                                                primaryTypographyProps={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: '#27272a' }}
                                                secondaryTypographyProps={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#71717a' }}
                                            />
                                            <StatusChip status={requestFile.status || assignment?.status} />
                                            <ListItemSecondaryAction>
                                                <IconButton edge="end" onClick={() => handleDownload(requestFile)}>
                                                    <DownloadOutlined />
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        ) : (
                            <div className="text-sm text-zinc-500 py-6 text-center">Belum ada file yang dikirim.</div>
                        )}
                    </section>
                </div>

                <aside className="space-y-4">
                    <section className={panelClass}>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Status Assignment</p>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-sm text-zinc-600">Status</span>
                            <StatusChip status={assignment?.status || 'not_submitted'} />
                        </div>
                        <div className="space-y-2 text-sm text-zinc-600">
                            <div className="flex justify-between gap-3"><span>Dikirim</span><span className="text-zinc-800">{dateTime(assignment?.submitted_at)}</span></div>
                            <div className="flex justify-between gap-3"><span>Diverifikasi</span><span className="text-zinc-800">{dateTime(assignment?.verified_at)}</span></div>
                            <div className="flex justify-between gap-3"><span>Jumlah File</span><span className="text-zinc-800">{uploadedFiles.length} / {request?.max_files || '-'}</span></div>
                        </div>
                    </section>
                    {isLocked && (
                        <Alert severity="info" sx={{ borderRadius: '0.5rem' }}>
                            Upload dan reuse dinonaktifkan karena permintaan ditutup/diarsipkan atau assignment sudah disetujui.
                        </Alert>
                    )}
                </aside>
            </div>

            <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle className="!font-jakarta">Upload File Assignment</DialogTitle>
                <DialogContent dividers>
                    {uploadError && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{uploadError}</Alert>}
                    <Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />} fullWidth sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46', py: 2 }}>
                        {selectedFile ? selectedFile.name : 'Pilih File'}
                        <input type="file" hidden onChange={(event) => { setSelectedFile(event.target.files?.[0] || null); setUploadError(''); }} />
                    </Button>
                    <p className="text-xs text-zinc-500 mt-2">
                        Maks. {maxFileSizeMb || '-'} MB · Ekstensi: {allowedExtensions.length ? allowedExtensions.join(', ') : 'Semua ekstensi'}
                        {fallbackSettingsUnavailable ? ' · Memakai batas aman karena aturan default tidak tersedia' : ''}
                    </p>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUploadOpen(false)} sx={buttonSx}>Batal</Button>
                    <Button onClick={handleUpload} variant="contained" disabled={actionLoading} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Upload</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={reuseOpen} onClose={() => setReuseOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle className="!font-jakarta">Pakai File dari Arsip Personal</DialogTitle>
                <DialogContent dividers>
                    {filesLoading ? <CustomLoading /> : (
                        <List>
                            {personalFiles.map((file) => {
                                const isSelected = selectedReuseFileId === file.file_id;

                                return (
                                    <ListItem
                                        key={file.file_id}
                                        button
                                        selected={isSelected}
                                        onClick={() => setSelectedReuseFileId(file.file_id)}
                                        divider
                                        sx={{
                                            borderRadius: '0.5rem',
                                            border: isSelected ? '1px solid #2563eb' : '1px solid transparent',
                                            bgcolor: isSelected ? '#eff6ff' : 'transparent',
                                            '&.Mui-selected': { bgcolor: '#eff6ff' },
                                            '&.Mui-selected:hover': { bgcolor: '#dbeafe' },
                                        }}
                                    >
                                        <DescriptionOutlined sx={{ color: isSelected ? '#2563eb' : '#71717a', mr: 2 }} />
                                        <ListItemText
                                            primary={fileName(file)}
                                            secondary={`${bytes(fileSize(file))} · ${dateTime(file.created_at)}`}
                                            primaryTypographyProps={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: isSelected ? '#1d4ed8' : '#27272a' }}
                                            secondaryTypographyProps={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                                        />
                                        {isSelected && <CheckCircleOutlined sx={{ color: '#2563eb' }} />}
                                    </ListItem>
                                );
                            })}
                            {!personalFiles.length && <div className="text-sm text-zinc-500 py-6 text-center">Tidak ada file personal yang tersedia.</div>}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReuseOpen(false)} sx={buttonSx}>Batal</Button>
                    <Button onClick={handleReuse} variant="contained" disabled={actionLoading || !selectedReuseFileId} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Pakai File</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
