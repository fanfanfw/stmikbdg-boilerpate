import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime, lines } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import TargetPicker from '../components/TargetPicker';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';

const buttonSx = {
    borderRadius: '0.5rem',
    textTransform: 'none',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
};

const emptyForm = {
    title: '',
    description: '',
    deadline_at: '',
    category_id: '',
    allowed_extensions: 'pdf, jpg, jpeg, png, doc, docx, xls, xlsx',
    max_file_size_mb: '',
    max_files: 1,
    requires_verification: true,
    allow_file_reuse: true,
    close_after_deadline: false,
};

function unwrapList(response) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : payload.requests ?? payload.data ?? [];
    return {
        data: Array.isArray(list) ? list : [],
        meta: payload.meta ?? payload.pagination ?? response?.meta ?? null,
    };
}

function unwrapCategories(response) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : payload.categories ?? payload.data ?? [];
    return Array.isArray(list) ? list : [];
}

function unwrapPreview(response) {
    const payload = response?.data ?? response ?? {};
    return payload.preview ?? payload;
}

function requestId(row) {
    return row.request_id ?? row.id;
}

function requestProgress(row) {
    const total = row.assignments_count ?? row.total_assignments ?? row.progress?.total_assignments;
    const submitted = row.submitted_assignments_count ?? row.progress?.submitted;
    const approved = row.approved_assignments_count ?? row.progress?.approved;
    if (total === undefined && submitted === undefined && approved === undefined) return '-';
    return `${submitted ?? 0}/${total ?? 0}${approved !== undefined ? ` · ${approved} approved` : ''}`;
}

function normalizeForm(request) {
    if (!request) return emptyForm;
    return {
        title: request.title || '',
        description: request.description || '',
        deadline_at: request.deadline_at ? String(request.deadline_at).slice(0, 16) : '',
        category_id: request.category_id || '',
        allowed_extensions: Array.isArray(request.allowed_extensions) ? request.allowed_extensions.join(', ') : request.allowed_extensions || '',
        max_file_size_mb: request.max_file_size_mb || '',
        max_files: request.max_files || 1,
        requires_verification: request.requires_verification !== false,
        allow_file_reuse: request.allow_file_reuse !== false,
        close_after_deadline: Boolean(request.close_after_deadline),
    };
}

function normalizeTargetPayload(request) {
    if (!request) return null;
    return {
        target_role: request.target_role || 'mahasiswa',
        scope_type: request.scope_type || 'filter',
        target_filters: request.target_filters || {},
        target_identifiers: request.target_identifiers || [],
    };
}

function canSubmitTarget(payload) {
    if (!payload?.target_role || !payload?.scope_type) return false;
    if (payload.scope_type === 'specific') return (payload.target_identifiers || []).length > 0;
    return true;
}

async function confirmAction(title, text, confirmButtonText = 'Ya') {
    const result = await Swal.fire({
        title,
        text,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText: 'Batal',
    });
    return result.isConfirmed;
}

export default function AdminRequests() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ search: '', status: '', target_role: '' });
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [targetPayload, setTargetPayload] = useState(null);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [categories, setCategories] = useState([]);

    const fetchRequests = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.adminRequests({
                search: filters.search,
                status: filters.status,
                target_role: filters.target_role,
            });
            const unwrapped = unwrapList(response);
            setRows(unwrapped.data);
            setMeta(unwrapped.meta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await arsipApi.categories();
            setCategories(unwrapCategories(response));
        } catch {
            setCategories([]);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const openCreate = () => {
        setEditingRequest(null);
        setForm(emptyForm);
        setTargetPayload(null);
        setPreview(null);
        setDialogOpen(true);
    };

    const openEdit = (request) => {
        setEditingRequest(request);
        setForm(normalizeForm(request));
        setTargetPayload(normalizeTargetPayload(request));
        setPreview(null);
        setDialogOpen(true);
    };

    const buildSubmitPayload = () => {
        const payload = {
            title: form.title,
            description: form.description || null,
            deadline_at: form.deadline_at || null,
            max_files: Number(form.max_files || 1),
            max_file_size_mb: form.max_file_size_mb ? Number(form.max_file_size_mb) : null,
            allowed_extensions: lines(form.allowed_extensions),
            requires_verification: Boolean(form.requires_verification),
            allow_file_reuse: Boolean(form.allow_file_reuse),
            close_after_deadline: Boolean(form.close_after_deadline),
            ...targetPayload,
        };
        if (form.category_id) payload.category_id = Number(form.category_id);
        return payload;
    };

    const handlePreview = async () => {
        if (!canSubmitTarget(targetPayload)) {
            customSwal.toast.error({ message: 'Pilih target terlebih dahulu.' });
            return;
        }
        setPreviewLoading(true);
        try {
            const response = await arsipApi.previewRequestTargets(buildSubmitPayload());
            setPreview(unwrapPreview(response));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) {
            customSwal.toast.error({ message: 'Judul wajib diisi.' });
            return;
        }
        if (!canSubmitTarget(targetPayload)) {
            customSwal.toast.error({ message: 'Pilih target terlebih dahulu.' });
            return;
        }
        setSaving(true);
        try {
            const payload = buildSubmitPayload();
            if (editingRequest) {
                await arsipApi.updateRequest(requestId(editingRequest), payload);
                customSwal.toast.success({ message: 'Draft request berhasil diperbarui.' });
            } else {
                await arsipApi.createRequest(payload);
                customSwal.toast.success({ message: 'Draft request berhasil dibuat.' });
            }
            setDialogOpen(false);
            await fetchRequests();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const runLifecycle = async (request, action, title, text, success) => {
        if (!(await confirmAction(title, text))) return;
        try {
            await action(requestId(request));
            customSwal.toast.success({ message: success });
            await fetchRequests();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const deleteRequest = async (request) => {
        if (!(await confirmAction('Hapus request?', 'Request akan dihapus permanen.', 'Hapus'))) return;
        try {
            await arsipApi.deleteRequest(requestId(request));
            customSwal.toast.success({ message: 'Request berhasil dihapus.' });
            await fetchRequests();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const columns = [
        { field: 'title', headerName: 'Judul', flex: 1, minWidth: 220, renderCell: (params) => <button type="button" className="text-blue-600 font-semibold hover:underline text-left" onClick={() => navigate(`/permintaan/${requestId(params.row)}`)}>{params.row.title || '-'}</button> },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => <StatusChip status={params.row.status} /> },
        { field: 'target_role', headerName: 'Target Role', width: 130, valueGetter: (value, row) => row.target_role || '-' },
        { field: 'deadline_at', headerName: 'Deadline', width: 170, renderCell: (params) => dateTime(params.row.deadline_at) },
        { field: 'progress', headerName: 'Progress', width: 160, sortable: false, renderCell: (params) => requestProgress(params.row) },
        { field: 'created_at', headerName: 'Dibuat', width: 170, renderCell: (params) => dateTime(params.row.created_at) },
        {
            field: 'actions',
            headerName: 'Aksi',
            width: 340,
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const request = params.row;
                return (
                    <div className="flex gap-1 flex-wrap">
                        <Button size="small" variant="outlined" component={Link} to={`/permintaan/${requestId(request)}`} sx={{ ...buttonSx, minWidth: 0, borderColor: '#e4e4e7', color: '#3f3f46' }}><VisibilityOutlined sx={{ fontSize: 17 }} /></Button>
                        {request.status === 'draft' && <Button size="small" onClick={() => openEdit(request)} sx={buttonSx}>Edit</Button>}
                        {request.status === 'draft' && <Button size="small" onClick={() => runLifecycle(request, arsipApi.publishRequest, 'Publish request?', 'Assignment akan dibuat untuk target request ini.', 'Request berhasil dipublish.')} sx={buttonSx}>Publish</Button>}
                        {request.status === 'published' && <Button size="small" onClick={() => runLifecycle(request, arsipApi.closeRequest, 'Tutup request?', 'Penerima tidak bisa upload file baru.', 'Request berhasil ditutup.')} sx={buttonSx}>Tutup</Button>}
                        {request.status === 'closed' && <Button size="small" onClick={() => runLifecycle(request, arsipApi.reopenRequest, 'Buka lagi request?', 'Request akan aktif kembali.', 'Request berhasil dibuka lagi.')} sx={buttonSx}>Reopen</Button>}
                        {['draft', 'closed'].includes(request.status) && <Button size="small" color="warning" onClick={() => runLifecycle(request, arsipApi.archiveRequest, 'Arsipkan request?', 'Request akan menjadi read-only.', 'Request berhasil diarsipkan.')} sx={buttonSx}>Arsip</Button>}
                        {request.status === 'draft' && <Button size="small" color="error" onClick={() => deleteRequest(request)} sx={buttonSx}>Hapus</Button>}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader
                title="Permintaan Berkas"
                subtitle="Kelola request, target penerima, dan lifecycle permintaan berkas."
                actions={
                    <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>
                        Buat Request
                    </Button>
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}

            <div className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3">
                <TextField size="small" placeholder="Cari request..." value={filters.search} onChange={(event) => handleFilterChange('search', event.target.value)} InputProps={{ startAdornment: <SearchOutlined sx={{ color: '#a1a1aa', mr: 1, fontSize: 18 }} /> }} sx={{ minWidth: 240 }} />
                <TextField size="small" select label="Status" value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)} sx={{ minWidth: 160 }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                </TextField>
                <TextField size="small" select label="Target" value={filters.target_role} onChange={(event) => handleFilterChange('target_role', event.target.value)} sx={{ minWidth: 160 }}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="mahasiswa">Mahasiswa</MenuItem>
                    <MenuItem value="dosen">Dosen</MenuItem>
                </TextField>
                <Button variant="contained" startIcon={<SearchOutlined />} onClick={fetchRequests} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button>
                <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={fetchRequests} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>
            </div>

            {!meta && <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Backend pagination belum tersedia. Data difilter backend lalu dipaginasi di browser.</Alert>}

            <div className="bg-white rounded-lg border border-zinc-200">
                <CustomDataTable
                    rows={rows}
                    columns={columns}
                    loading={loading}
                    getRowId={(row) => requestId(row)}
                    pageSize={50}
                    pageSizeOptions={[50]}
                />
            </div>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="lg">
                <DialogTitle className="!font-jakarta">{editingRequest ? 'Edit Draft Request' : 'Buat Request'}</DialogTitle>
                <DialogContent dividers className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <TextField size="small" label="Judul" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required />
                        <TextField size="small" type="datetime-local" label="Deadline" value={form.deadline_at} onChange={(event) => setForm((prev) => ({ ...prev, deadline_at: event.target.value }))} InputLabelProps={{ shrink: true }} />
                        {categories.length > 0 && (
                            <TextField size="small" select label="Kategori" value={form.category_id} onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}>
                                <MenuItem value="">Tanpa kategori</MenuItem>
                                {categories.map((category) => <MenuItem key={category.category_id || category.id} value={category.category_id || category.id}>{category.name || category.category_name || `Kategori #${category.category_id || category.id}`}</MenuItem>)}
                            </TextField>
                        )}
                        <TextField size="small" type="number" label="Maks file" value={form.max_files} onChange={(event) => setForm((prev) => ({ ...prev, max_files: event.target.value }))} />
                        <TextField size="small" type="number" label="Maks ukuran MB" value={form.max_file_size_mb} onChange={(event) => setForm((prev) => ({ ...prev, max_file_size_mb: event.target.value }))} />
                        <TextField size="small" label="Ekstensi diizinkan" value={form.allowed_extensions} onChange={(event) => setForm((prev) => ({ ...prev, allowed_extensions: event.target.value }))} helperText="Pisahkan dengan koma/baris." />
                        <TextField className="md:col-span-2" size="small" multiline minRows={3} label="Deskripsi / Instruksi" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-zinc-600">
                        <label><input type="checkbox" checked={form.requires_verification} onChange={(event) => setForm((prev) => ({ ...prev, requires_verification: event.target.checked }))} /> Perlu verifikasi admin</label>
                        <label><input type="checkbox" checked={form.allow_file_reuse} onChange={(event) => setForm((prev) => ({ ...prev, allow_file_reuse: event.target.checked }))} /> Izinkan reuse file</label>
                        <label><input type="checkbox" checked={form.close_after_deadline} onChange={(event) => setForm((prev) => ({ ...prev, close_after_deadline: event.target.checked }))} /> Tutup setelah deadline</label>
                    </div>

                    <TargetPicker value={targetPayload} onChange={setTargetPayload} initialRole={targetPayload?.target_role || 'mahasiswa'} />

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-zinc-600">
                            <strong>Preview target</strong>
                            <p>{preview ? `${preview.total_valid ?? 0} valid · ${preview.total_invalid ?? 0} invalid · ${preview.total_targets ?? 0} total` : 'Belum divalidasi.'}</p>
                        </div>
                        <Button variant="outlined" disabled={previewLoading} onClick={handlePreview} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>{previewLoading ? 'Memvalidasi...' : 'Preview Target'}</Button>
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} sx={buttonSx}>Batal</Button>
                    <Button variant="contained" disabled={saving} onClick={handleSubmit} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>{saving ? 'Menyimpan...' : 'Simpan Draft'}</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
