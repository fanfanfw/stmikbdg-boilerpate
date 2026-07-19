import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { archiveSourceLabel, dateTime, bytes } from '../../../libs/format';
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
    Checkbox,
    Chip,
} from '@mui/material';
import {
    CloudUploadOutlined,
    DownloadOutlined,
    DeleteOutlined,
    RestoreOutlined,
    FolderOutlined,
    InsertDriveFileOutlined,
    ArrowBackOutlined,
    DriveFileMoveOutlined,
    HistoryOutlined,
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

function categoryId(category) {
    return category?.category_id ?? category?.id;
}

function canMoveFile(file) {
    return file?.is_current !== false
        && file?.status === 'active'
        && ['personal', 'admin_upload'].includes(file?.source_type)
        && !file?.request_file
        && !file?.requestFile;
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
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [categoryError, setCategoryError] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState('');
    const [selectedFileIds, setSelectedFileIds] = useState([]);
    const [moveOpen, setMoveOpen] = useState(false);
    const [moveCategoryId, setMoveCategoryId] = useState('');
    const [moveError, setMoveError] = useState('');
    const [moving, setMoving] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyFile, setHistoryFile] = useState(null);
    const [historyVersions, setHistoryVersions] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const filesRequestRef = useRef(0);

    const fetchFiles = useCallback(async () => {
        const requestId = ++filesRequestRef.current;
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
            if (requestId !== filesRequestRef.current) return;
            setListData({ data: unwrapped.data, meta: unwrapped.meta, loading: false });
            setSelectedFileIds([]);
        } catch (err) {
            if (requestId !== filesRequestRef.current) return;
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
            setListData((prev) => ({ ...prev, loading: false }));
        }
    }, [filters]);

    const fetchCategories = async () => {
        try {
            const res = await arsipApi.categories();
            const nextCategories = unwrapListResponse(res, 'categories').data;
            setCategories(nextCategories);
            return nextCategories;
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
            return [];
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
            if (file?.source_type === 'distribution') {
                await arsipApi.downloadDistributionFile(file);
            } else {
                await arsipApi.downloadFile(file);
            }
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const fetchHistory = async (file) => {
        setHistoryLoading(true);
        setHistoryError('');
        try {
            const res = await arsipApi.fileVersions(fileId(file));
            setHistoryVersions(unwrapListResponse(res, 'versions').data);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setHistoryError(formatted.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    const openHistory = async (file) => {
        setHistoryFile(file);
        setHistoryVersions([]);
        setHistoryOpen(true);
        await fetchHistory(file);
    };

    const closeHistory = () => {
        setHistoryOpen(false);
        setHistoryFile(null);
        setHistoryVersions([]);
        setHistoryError('');
    };

    const handleDeleteHistory = (version) => {
        customSwal.question({
            title: 'Hapus versi lama?',
            message: `Versi ${version.version_number} dari "${version.display_filename}" akan dihapus permanen dan kuota akan dikembalikan.`,
            callback: async () => {
                try {
                    await arsipApi.deleteFile(fileId(version), 'Versi lama dihapus oleh pengguna');
                    customSwal.toast.success({ message: 'Versi lama berhasil dihapus permanen' });
                    await Promise.all([fetchHistory(historyFile), fetchSettings(), fetchFiles()]);
                } catch (err) {
                    const formatted = await formatArsipError(err);
                    customSwal.toast.error({ message: formatted.message });
                }
            },
        });
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

    const openFolder = (category) => {
        const id = categoryId(category);
        setActiveCategoryId(id);
        setFilters((prev) => ({ ...prev, category_id: id, page: 0 }));
        setSelectedFileIds([]);
    };

    const closeFolder = () => {
        setActiveCategoryId('');
        setFilters((prev) => ({ ...prev, category_id: '', page: 0 }));
        setSelectedFileIds([]);
    };

    const handleDeleteCategory = (category) => {
        if (category.files_count > 0) return;
        customSwal.question({
            title: 'Hapus kategori?',
            message: `Kategori "${category.name}" akan dihapus.`,
            callback: async () => {
                try {
                    await arsipApi.deleteCategory(categoryId(category));
                    customSwal.toast.success({ message: 'Kategori berhasil dihapus' });
                    fetchCategories();
                } catch (err) {
                    const formatted = await formatArsipError(err);
                    customSwal.toast.error({ message: formatted.message });
                }
            },
        });
    };

    const toggleFileSelection = (file) => {
        const id = fileId(file);
        setSelectedFileIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
    };

    const toggleAllVisibleFiles = (checked) => {
        setSelectedFileIds(checked ? visibleFiles.map(fileId).filter(Boolean) : []);
    };

    const bulkDownload = async () => {
        for (const file of selectedFiles) {
            await handleDownload(file);
        }
    };

    const openMoveDialog = () => {
        if (!selectedFiles.length) return;
        setMoveCategoryId('__unset__');
        setMoveError('');
        setMoveOpen(true);
    };

    const closeMoveDialog = () => {
        setMoveOpen(false);
        setMoveCategoryId('__unset__');
        setMoveError('');
    };

    const handleMove = async () => {
        if (moveCategoryId === '__unset__') {
            setMoveError('Pilih kategori tujuan');
            return;
        }

        const targetCategoryId = moveCategoryId === 'root' ? null : Number(moveCategoryId);
        if ((!activeCategoryId && targetCategoryId === null) || String(activeCategoryId) === String(targetCategoryId)) {
            setMoveError('File sudah berada di lokasi tersebut');
            return;
        }

        setMoving(true);
        try {
            await arsipApi.moveFiles(selectedFileIds, targetCategoryId);
            customSwal.toast.success({ message: `${selectedFiles.length} file berhasil dipindahkan` });
            closeMoveDialog();
            setSelectedFileIds([]);
            await Promise.all([fetchFiles(), fetchCategories()]);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setMoveError(formatted.message);
        } finally {
            setMoving(false);
        }
    };

    const bulkDelete = () => {
        if (!selectedFiles.length) return;
        customSwal.question({
            title: 'Hapus file terpilih?',
            message: `${selectedFiles.length} file akan dihapus.`,
            callback: async () => {
                for (const file of selectedFiles) {
                    await arsipApi.deleteFile(fileId(file), 'Dihapus bulk oleh pengguna');
                }
                customSwal.toast.success({ message: 'File terpilih berhasil dihapus' });
                setSelectedFileIds([]);
                fetchFiles();
                fetchSettings();
            },
        });
    };

    const uploadMaxFileSizeMb = Number(settings?.default_max_file_size_mb || safeUploadSettings.default_max_file_size_mb);
    const uploadAllowedExtensions = normalizeExtensions(settings?.default_allowed_extensions);
    const quotaUsedBytes = Number(settings?.personal_used_bytes || 0);
    const quotaBytes = settings?.personal_quota_bytes ?? null;
    const quotaRemainingBytes = settings?.personal_remaining_bytes ?? null;
    const quotaPercent = Math.min(100, Number(settings?.personal_usage_percent || 0));
    const quotaFull = quotaRemainingBytes !== null && quotaRemainingBytes <= 0;
    const personalCategories = useMemo(
        () => categories.filter((category) => category.category_type === 'personal'),
        [categories],
    );
    const activeCategory = useMemo(
        () => personalCategories.find((category) => String(categoryId(category)) === String(activeCategoryId)),
        [personalCategories, activeCategoryId],
    );
    const visibleFiles = useMemo(() => listData.data.filter((file) => {
        const currentCategoryId = file.category_id ?? file.category?.category_id ?? file.category?.id ?? '';
        return activeCategoryId ? String(currentCategoryId) === String(activeCategoryId) : !currentCategoryId;
    }), [listData.data, activeCategoryId]);
    const tableRows = useMemo(() => {
        const counts = new Map();
        listData.data.forEach((file) => {
            const id = String(file.category_id ?? file.category?.category_id ?? file.category?.id ?? '');
            counts.set(id, (counts.get(id) || 0) + 1);
        });
        const fileRows = visibleFiles.map((file) => ({ ...file, row_type: 'file' }));
        if (activeCategoryId) return fileRows;
        return [
            ...personalCategories.map((category) => ({
                ...category,
                row_type: 'folder',
                row_id: `folder-${categoryId(category)}`,
                files_count: category.files_count ?? counts.get(String(categoryId(category))) ?? 0,
            })),
            ...fileRows,
        ];
    }, [activeCategoryId, listData.data, personalCategories, visibleFiles]);
    const selectedFileIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);
    const selectedFiles = useMemo(
        () => visibleFiles.filter((file) => selectedFileIdSet.has(fileId(file))),
        [visibleFiles, selectedFileIdSet],
    );
    const canMoveSelection = selectedFiles.length > 0 && selectedFiles.every(canMoveFile);

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
        setUploadForm({ file: null, category_id: activeCategoryId || '', display_filename: '' });
        setUploadError('');
        setUploadOpen(true);
    };

    const handleUploadClose = () => {
        setUploadOpen(false);
        setUploadError('');
    };

    const handleCategoryOpen = () => {
        setCategoryForm({ name: '', description: '' });
        setCategoryError('');
        setCategoryOpen(true);
    };

    const handleCategoryClose = () => {
        setCategoryOpen(false);
        setCategoryError('');
    };

    const handleCategorySubmit = async () => {
        const name = categoryForm.name.trim();
        const description = categoryForm.description.trim();
        if (!name) {
            setCategoryError('Nama kategori tidak boleh kosong');
            return;
        }

        setCreatingCategory(true);
        try {
            const res = await arsipApi.createCategory({
                category_type: 'personal',
                name,
                ...(description ? { description } : {}),
            });
            const created = res?.data?.category ?? res?.category ?? res?.data ?? res;
            const nextCategories = await fetchCategories();
            const newCategory = nextCategories.find((cat) => String(cat.category_id ?? cat.id) === String(created?.category_id ?? created?.id))
                ?? nextCategories.find((cat) => cat.name === name);
            const newCategoryId = newCategory?.category_id ?? newCategory?.id ?? created?.category_id ?? created?.id;
            if (uploadOpen && newCategoryId) {
                setUploadForm((prev) => ({ ...prev, category_id: newCategoryId }));
            }
            customSwal.toast.success({ message: 'Kategori berhasil ditambahkan' });
            handleCategoryClose();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setCategoryError(formatted.message);
        } finally {
            setCreatingCategory(false);
        }
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
        if (!uploadForm.display_filename.trim()) {
            setUploadError('Nama file tidak boleh kosong');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadForm.file);
            if (uploadForm.category_id) {
                formData.append('category_id', uploadForm.category_id);
            }
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
            field: 'select',
            headerName: '',
            width: 56,
            sortable: false,
            filterable: false,
            renderHeader: () => (
                <Checkbox
                    size="small"
                    disabled={!visibleFiles.length}
                    checked={visibleFiles.length > 0 && selectedFileIds.length === visibleFiles.length}
                    indeterminate={selectedFileIds.length > 0 && selectedFileIds.length < visibleFiles.length}
                    onChange={(event) => toggleAllVisibleFiles(event.target.checked)}
                />
            ),
            renderCell: (params) => params.row.row_type === 'file' ? (
                <Checkbox
                    size="small"
                    checked={selectedFileIdSet.has(fileId(params.row))}
                    onChange={() => toggleFileSelection(params.row)}
                />
            ) : null,
        },
        {
            field: 'display_filename',
            headerName: activeCategory ? `Isi ${activeCategory.name}` : 'Nama',
            flex: 1,
            minWidth: 220,
            renderCell: (params) => params.row.row_type === 'folder' ? (
                <button type="button" className="flex items-center gap-2 font-semibold text-blue-700 hover:underline" onClick={() => openFolder(params.row)}>
                    <FolderOutlined fontSize="small" />
                    {params.row.name}
                    <span className="text-xs font-normal text-zinc-500">({params.row.files_count || 0})</span>
                </button>
            ) : (
                <span className="flex items-center gap-2 font-medium text-zinc-800">
                    <InsertDriveFileOutlined fontSize="small" />
                    {params.row.display_filename || params.row.original_filename || params.row.filename || '-'}
                </span>
            ),
        },
        {
            field: 'source_type',
            headerName: 'Jenis Arsip',
            width: 300,
            renderCell: (params) => params.row.row_type === 'file' ? (
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <Chip label={archiveSourceLabel(params.row.source_type)} size="small" variant="outlined" />
                    {['personal', 'admin_upload'].includes(params.row.source_type) && (params.row.request_file || params.row.requestFile) && (
                        <Chip label="Dipakai di Permintaan" size="small" color="warning" variant="outlined" />
                    )}
                </div>
            ) : '-',
        },
        {
            field: 'file_size',
            headerName: 'Ukuran',
            width: 100,
            renderCell: (params) => params.row.row_type === 'file' ? bytes(params.row.file_size ?? params.row.file_size_bytes ?? params.row.size) : '-',
        },
        {
            field: 'created_at',
            headerName: 'Tanggal Upload',
            width: 170,
            renderCell: (params) => params.row.row_type === 'file' ? dateTime(params.row.created_at) : '-',
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 130,
            renderCell: (params) => params.row.row_type === 'file' ? <StatusChip status={params.row.status} /> : '-',
        },
        {
            field: 'actions',
            headerName: 'Aksi',
            width: 170,
            sortable: false,
            filterable: false,
            renderCell: (params) => params.row.row_type === 'file' ? (
                <div className="flex items-center gap-1">
                    <Tooltip title="Download">
                        <IconButton size="small" color="primary" aria-label="Download file" disabled={!fileId(params.row)} onClick={() => handleDownload(params.row)}>
                            <DownloadOutlined fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    {['personal', 'admin_upload'].includes(params.row.source_type) && (
                        <Tooltip title="Riwayat versi">
                            <IconButton size="small" color="inherit" aria-label="Riwayat versi file" onClick={() => openHistory(params.row)}>
                                <HistoryOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    {params.row.status === 'deleted' ? (
                        <Tooltip title="Pulihkan">
                            <IconButton size="small" color="success" aria-label="Pulihkan file" disabled={!fileId(params.row)} onClick={() => handleRestore(params.row)}>
                                <RestoreOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Hapus">
                            <IconButton size="small" color="error" aria-label="Hapus file" disabled={!fileId(params.row)} onClick={() => handleDelete(params.row)}>
                                <DeleteOutlined fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </div>
            ) : (
                <Tooltip title={params.row.files_count > 0 ? 'Kategori harus kosong' : 'Hapus kategori'}>
                    <span>
                        <IconButton size="small" color="error" disabled={params.row.files_count > 0} onClick={() => handleDeleteCategory(params.row)}>
                            <DeleteOutlined fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            ),
        },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader
                title="Arsip Saya"
                subtitle="Kelola file arsip pribadi Anda"
                actions={
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCategoryOpen}
                            sx={{ textTransform: 'none', borderRadius: '0.5rem' }}
                        >
                            Tambah Kategori
                        </Button>
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
                    </div>
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

            <div className="bg-white rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        {activeCategory && (
                            <Button size="small" startIcon={<ArrowBackOutlined />} onClick={closeFolder} sx={{ textTransform: 'none' }}>
                                Arsip Saya
                            </Button>
                        )}
                        <span className="font-semibold text-zinc-800">{activeCategory ? activeCategory.name : 'Arsip Saya'}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Tooltip title={selectedFiles.length && !canMoveSelection ? 'Hanya file personal aktif yang dapat dipindahkan' : ''}>
                            <span>
                                <Button size="small" variant="outlined" disabled={!canMoveSelection} startIcon={<DriveFileMoveOutlined />} onClick={openMoveDialog} sx={{ textTransform: 'none', borderRadius: '0.5rem' }}>
                                    Pindahkan ({selectedFiles.length})
                                </Button>
                            </span>
                        </Tooltip>
                        <Button size="small" variant="outlined" disabled={!selectedFiles.length} startIcon={<DownloadOutlined />} onClick={bulkDownload} sx={{ textTransform: 'none', borderRadius: '0.5rem' }}>
                            Download ({selectedFiles.length})
                        </Button>
                        <Button size="small" variant="outlined" color="error" disabled={!selectedFiles.length} startIcon={<DeleteOutlined />} onClick={bulkDelete} sx={{ textTransform: 'none', borderRadius: '0.5rem' }}>
                            Hapus ({selectedFiles.length})
                        </Button>
                    </div>
                </div>
                <CustomDataTable
                    rows={tableRows}
                    columns={columns}
                    loading={listData.loading}
                    paginationMode="server"
                    rowCount={(listData.meta?.total ?? listData.data.length) + (activeCategoryId ? 0 : personalCategories.length)}
                    paginationModel={{ page: filters.page, pageSize: filters.per_page }}
                    onPaginationModelChange={handlePaginationChange}
                    getRowId={(row) => row.row_type === 'folder' ? row.row_id : fileId(row)}
                    pageSizeOptions={[10, 25, 50]}
                />
            </div>

            <Dialog open={historyOpen} onClose={closeHistory} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    Riwayat Versi — {historyFile?.display_filename || '-'}
                </DialogTitle>
                <DialogContent dividers>
                    {historyError && <Alert severity="error" sx={{ mb: 2 }}>{historyError}</Alert>}
                    {historyLoading ? (
                        <p className="py-8 text-center text-sm text-zinc-500">Memuat riwayat...</p>
                    ) : historyVersions.length === 0 ? (
                        <p className="py-8 text-center text-sm text-zinc-500">Belum ada riwayat versi.</p>
                    ) : (
                        <div className="divide-y divide-zinc-200">
                            {historyVersions.map((version) => (
                                <div key={fileId(version)} className="flex items-center gap-3 py-3 max-sm:flex-wrap">
                                    <InsertDriveFileOutlined sx={{ color: '#71717a', flexShrink: 0 }} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-zinc-800">
                                            Versi {version.version_number} · {version.display_filename}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {bytes(version.file_size_bytes)} · {dateTime(version.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:pl-9">
                                        <Chip label={archiveSourceLabel(version.source_type)} size="small" variant="outlined" />
                                        <StatusChip status={version.status} />
                                        <Tooltip title="Download versi ini">
                                            <IconButton size="small" color="primary" onClick={() => handleDownload(version)}>
                                                <DownloadOutlined fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {!version.is_current && version.status === 'replaced' && (
                                            <Tooltip title="Hapus permanen versi lama">
                                                <IconButton size="small" color="error" onClick={() => handleDeleteHistory(version)}>
                                                    <DeleteOutlined fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={closeHistory} size="small" sx={{ textTransform: 'none' }}>Tutup</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={moveOpen} onClose={closeMoveDialog} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Pindahkan File</DialogTitle>
                <DialogContent>
                    <div className="flex flex-col gap-4 mt-2">
                        {moveError && <Alert severity="error">{moveError}</Alert>}
                        <p className="text-sm text-zinc-600">
                            {selectedFiles.length} file akan dipindahkan dari {activeCategory?.name || 'Arsip Saya'}.
                        </p>
                        <TextField
                            select
                            size="small"
                            label="Tujuan"
                            value={moveCategoryId}
                            onChange={(event) => { setMoveCategoryId(event.target.value); setMoveError(''); }}
                            fullWidth
                        >
                            <MenuItem value="root" disabled={!activeCategoryId}>Arsip Saya (Root)</MenuItem>
                            {personalCategories
                                .filter((category) => String(categoryId(category)) !== String(activeCategoryId))
                                .map((category) => (
                                    <MenuItem key={categoryId(category)} value={categoryId(category)}>{category.name}</MenuItem>
                                ))}
                        </TextField>
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeMoveDialog} size="small" sx={{ textTransform: 'none' }}>Batal</Button>
                    <Button variant="contained" onClick={handleMove} disabled={moving} size="small" sx={{ textTransform: 'none' }}>
                        {moving ? 'Memindahkan...' : 'Pindahkan'}
                    </Button>
                </DialogActions>
            </Dialog>

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
                        <div className="flex gap-2 items-start">
                            <TextField
                                select
                                size="small"
                                label="Kategori (opsional)"
                                value={uploadForm.category_id}
                                onChange={(e) => setUploadForm((prev) => ({ ...prev, category_id: e.target.value }))}
                                fullWidth
                            >
                                {personalCategories.map((cat) => (
                                    <MenuItem key={cat.category_id ?? cat.id} value={cat.category_id ?? cat.id}>
                                        {cat.name}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleCategoryOpen}
                                sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                            >
                                Tambah Kategori
                            </Button>
                        </div>
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

            {/* Category Dialog */}
            <Dialog
                open={categoryOpen}
                onClose={handleCategoryClose}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    Tambah Kategori
                </DialogTitle>
                <DialogContent>
                    <div className="flex flex-col gap-4 mt-2">
                        {categoryError && (
                            <Alert severity="error">
                                {categoryError}
                            </Alert>
                        )}
                        <TextField
                            size="small"
                            label="Nama Kategori"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                            fullWidth
                            autoFocus
                        />
                        <TextField
                            size="small"
                            label="Deskripsi (opsional)"
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={handleCategoryClose}
                        size="small"
                        sx={{ textTransform: 'none' }}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCategorySubmit}
                        disabled={creatingCategory}
                        size="small"
                        sx={{ textTransform: 'none' }}
                    >
                        {creatingCategory ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
