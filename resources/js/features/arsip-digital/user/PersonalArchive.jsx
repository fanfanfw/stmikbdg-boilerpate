import { useState, useEffect, useCallback } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime, bytes } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import {
    Button,
    TextField,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Alert,
    Tooltip,
} from '@mui/material';
import {
    CloudUploadOutlined,
    DownloadOutlined,
    DeleteOutlined,
    RestoreOutlined,
} from '@mui/icons-material';

const initialFilters = {
    search: '',
    category_id: '',
    page: 0,
    per_page: 10,
};

const safeUploadSettings = {
    default_max_file_size_mb: 10,
    default_allowed_extensions: [],
    personal_quota_bytes: null,
    personal_used_bytes: 0,
    personal_remaining_bytes: null,
    personal_usage_percent: null,
};

function unwrapListResponse(response, key) {
    const payload = response?.data ?? response;
    const list = payload?.[key] ?? payload?.data ?? payload;
    return {
        data: Array.isArray(list) ? list : [],
        meta: payload?.meta ?? payload?.pagination ?? response?.meta ?? null,
    };
}

function fileId(file) {
    return file?.file_id ?? file?.id;
}

function normalizeExtensions(value) {
    if (Array.isArray(value)) {
        return value
            .map((ext) => String(ext).trim().toLowerCase().replace(/^\./, ''))
            .filter(Boolean);
    }
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((ext) => ext.trim().toLowerCase().replace(/^\./, ''))
            .filter(Boolean);
    }
    return [];
}

export default function PersonalArchive() {
    const [listData, setListData] = useState({ data: [], meta: null, loading: true });
    const [filters, setFilters] = useState(initialFilters);
    const [categories, setCategories] = useState([]);
    const [settings, setSettings] = useState(safeUploadSettings);
    const [settingsFallback, setSettingsFallback] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        file: null,
        category_id: '',
        display_filename: '',
    });
    const [uploadError, setUploadError] = useState('');
    const [uploading, setUploading] = useState(false);

    const fetchFiles = useCallback(async () => {
        setListData((prev) => ({ ...prev, loading: true }));
        try {
            const params = {
                page: filters.page + 1,
                per_page: filters.per_page,
            };
            if (filters.search) params.search = filters.search;
            if (filters.category_id) params.category_id = filters.category_id;
            const res = await arsipApi.files(params);
            const unwrapped = unwrapListResponse(res, 'files');
            setListData({ data: unwrapped.data, meta: unwrapped.meta, loading: false });
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
            setListData((prev) => ({ ...prev, loading: false }));
        }
    }, [filters]);

    const fetchCategories = async () => {
        try {
            const res = await arsipApi.categories();
            setCategories(unwrapListResponse(res, 'categories').data);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await arsipApi.summary();
            setSettings({ ...safeUploadSettings, ...(res.data || res) });
            setSettingsFallback(false);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setSettings(safeUploadSettings);
            setSettingsFallback(true);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    useEffect(() => {
        fetchCategories();
        fetchSettings();
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
    };

    const handlePaginationChange = (model) => {
        setFilters((prev) => ({ ...prev, page: model.page, per_page: model.pageSize }));
    };

    const handleDownload = async (file) => {
        try {
            await arsipApi.downloadFile(file);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const handleDelete = (file) => {
        customSwal.question({
            title: 'Hapus file?',
            message: `Apakah Anda yakin ingin menghapus "${file.display_filename}"?`,
            callback: async () => {
                try {
                    await arsipApi.deleteFile(fileId(file), 'Dihapus oleh pengguna');
                    customSwal.toast.success({ message: 'File berhasil dihapus permanen' });
                    fetchFiles();
                    fetchSettings();
                } catch (err) {
                    const formatted = await formatArsipError(err);
                    customSwal.toast.error({ message: formatted.message });
                }
            },
        });
    };

    const handleRestore = async (file) => {
        try {
            await arsipApi.restoreFile(fileId(file));
            customSwal.toast.success({ message: 'File berhasil dipulihkan' });
            fetchFiles();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const uploadMaxFileSizeMb = Number(settings?.default_max_file_size_mb || safeUploadSettings.default_max_file_size_mb);
    const uploadAllowedExtensions = normalizeExtensions(settings?.default_allowed_extensions);
    const quotaUsedBytes = Number(settings?.personal_used_bytes || 0);
    const quotaBytes = settings?.personal_quota_bytes ?? null;
    const quotaRemainingBytes = settings?.personal_remaining_bytes ?? null;
    const quotaPercent = Math.min(100, Number(settings?.personal_usage_percent || 0));
    const quotaFull = quotaRemainingBytes !== null && quotaRemainingBytes <= 0;

    const validateFile = (file) => {
        if (!file) return 'Pilih file terlebih dahulu';
        const maxBytes = uploadMaxFileSizeMb * 1024 * 1024;
        if (file.size > maxBytes) {
            return `Ukuran file melebihi batas maksimum (${uploadMaxFileSizeMb} MB)`;
        }
        if (quotaRemainingBytes !== null && file.size > quotaRemainingBytes) {
            return `Sisa kuota arsip pribadi tidak cukup. Sisa kuota: ${bytes(quotaRemainingBytes)}.`;
        }
        if (uploadAllowedExtensions.length) {
            const fileExt = file.name.split('.').pop().toLowerCase();
            if (!uploadAllowedExtensions.includes(fileExt)) {
                return `Ekstensi file tidak diizinkan. Ekstensi yang diizinkan: ${uploadAllowedExtensions.join(', ')}`;
            }
        }
        return '';
    };

    const handleUploadOpen = () => {
        setUploadForm({ file: null, category_id: '', display_filename: '' });
        setUploadError('');
        setUploadOpen(true);
    };

    const handleUploadClose = () => {
        setUploadOpen(false);
        setUploadError('');
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        setUploadForm((prev) => ({
            ...prev,
            file,
            display_filename: file ? file.name : prev.display_filename,
        }));
        setUploadError('');
    };

    const handleUploadSubmit = async () => {
        const validationError = validateFile(uploadForm.file);
        if (validationError) {
            setUploadError(validationError);
            return;
        }
        if (!uploadForm.category_id) {
            setUploadError('Pilih kategori terlebih dahulu');
            return;
        }
        if (!uploadForm.display_filename.trim()) {
            setUploadError('Nama file tidak boleh kosong');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadForm.file);
            formData.append('category_id', uploadForm.category_id);
            formData.append('display_filename', uploadForm.display_filename.trim());
            await arsipApi.uploadFile(formData);
            customSwal.toast.success({ message: 'File berhasil diunggah' });
            handleUploadClose();
            fetchFiles();
            fetchSettings();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setUploadError(formatted.message);
        } finally {
            setUploading(false);
        }
    };

    const columns = [
        {
            field: 'display_filename',
            headerName: 'Nama File',
            flex: 1,
            minWidth: 200,
            renderCell: (params) => (
                <span className="font-medium text-zinc-800">{params.value}</span>
            ),
        },
        {
            field: 'category',
            headerName: 'Kategori',
            width: 150,
            valueGetter: (value, row) => row.category?.name || '-',
        },
        {
            field: 'file_size',
            headerName: 'Ukuran',
            width: 100,
            valueGetter: (value) => bytes(value),
        },
        {
            field: 'created_at',
            headerName: 'Tanggal Upload',
            width: 170,
            valueGetter: (value) => dateTime(value),
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 130,
            renderCell: (params) => <StatusChip status={params.value} />,
        },
        {
            field: 'actions',
            headerName: 'Aksi',
            width: 140,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <div className="flex items-center gap-1">
                    <Tooltip title="Download">
                        <IconButton
                            size="small"
                            color="primary"
                            aria-label="Download file"
                            disabled={!fileId(params.row)}
                            onClick={() => handleDownload(params.row)}
                        >
                            <DownloadOutlined fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    {params.row.status === 'deleted' ? (
                        <Tooltip title="Pulihkan">
                            <IconButton
                                size="small"
                                color="success"
                                aria-label="Pulihkan file"
                                disabled={!fileId(params.row)}
                                onClick={() => handleRestore(params.row)}
                            >
                                <RestoreOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Hapus">
                            <IconButton
                                size="small"
                                color="error"
                                aria-label="Hapus file"
                                disabled={!fileId(params.row)}
                                onClick={() => handleDelete(params.row)}
                            >
                                <DeleteOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </div>
            ),
        },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader
                title="Arsip Saya"
                subtitle="Kelola file arsip pribadi Anda"
                actions={
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<CloudUploadOutlined />}
                        onClick={handleUploadOpen}
                        disabled={quotaFull}
                        sx={{ textTransform: 'none', borderRadius: '0.5rem' }}
                    >
                        Upload File
                    </Button>
                }
            />

            <div className="bg-white rounded-lg border border-zinc-200 p-4 mb-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <p className="text-sm font-semibold text-zinc-800">Kuota Arsip Pribadi</p>
                        <p className="text-xs text-zinc-500">
                            Terpakai {bytes(quotaUsedBytes)} dari {quotaBytes === null ? 'Tidak terbatas' : bytes(quotaBytes)}
                            {quotaRemainingBytes !== null ? ` · Sisa ${bytes(quotaRemainingBytes)}` : ''}
                        </p>
                    </div>
                    <p className="text-sm font-semibold text-zinc-800">{quotaBytes === null ? '-' : `${quotaPercent}%`}</p>
                </div>
                {quotaBytes !== null && (
                    <div className="mt-3 h-2 rounded-full bg-zinc-100 overflow-hidden">
                        <div className={`h-full rounded-full ${quotaFull ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${quotaPercent}%` }} />
                    </div>
                )}
                {quotaFull && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        Kuota arsip pribadi Anda sudah penuh. Upload arsip pribadi dinonaktifkan sampai Anda menghapus file.
                    </Alert>
                )}
            </div>

            <CustomDataTable
                rows={listData.data}
                columns={columns}
                loading={listData.loading}
                paginationMode={listData.meta ? 'server' : 'client'}
                rowCount={listData.meta?.total ?? listData.meta?.total_count ?? listData.meta?.recordsTotal ?? listData.data.length}
                paginationModel={{ page: filters.page, pageSize: filters.per_page }}
                onPaginationModelChange={handlePaginationChange}
                getRowId={(row) => fileId(row)}
                pageSize={filters.per_page}
                pageSizeOptions={[10, 25, 50]}
            />

            {/* Upload Dialog */}
            <Dialog
                open={uploadOpen}
                onClose={handleUploadClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    Upload File Baru
                </DialogTitle>
                <DialogContent>
                    <div className="flex flex-col gap-4 mt-2">
                        {uploadError && (
                            <Alert severity="error">
                                {uploadError}
                            </Alert>
                        )}
                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={<CloudUploadOutlined />}
                            sx={{ textTransform: 'none' }}
                        >
                            {uploadForm.file ? uploadForm.file.name : 'Pilih File'}
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                        <p className="text-xs text-zinc-500">
                            Maks: {uploadMaxFileSizeMb} MB | Ekstensi: {uploadAllowedExtensions.length ? uploadAllowedExtensions.join(', ') : 'Semua ekstensi'}
                            {settingsFallback ? ' | Memakai batas aman karena pengaturan server tidak tersedia' : ''}
                        </p>
                        <TextField
                            select
                            size="small"
                            label="Kategori"
                            value={uploadForm.category_id}
                            onChange={(e) => setUploadForm((prev) => ({ ...prev, category_id: e.target.value }))}
                            fullWidth
                        >
                            {categories.map((cat) => (
                                <MenuItem key={cat.category_id} value={cat.category_id}>
                                    {cat.name}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            size="small"
                            label="Nama File Tampilan"
                            value={uploadForm.display_filename}
                            onChange={(e) => setUploadForm((prev) => ({ ...prev, display_filename: e.target.value }))}
                            fullWidth
                        />
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={handleUploadClose}
                        size="small"
                        sx={{ textTransform: 'none' }}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleUploadSubmit}
                        disabled={uploading}
                        size="small"
                        sx={{ textTransform: 'none' }}
                    >
                        {uploading ? 'Mengunggah...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
