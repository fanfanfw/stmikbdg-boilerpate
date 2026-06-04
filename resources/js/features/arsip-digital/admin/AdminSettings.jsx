import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { lines } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyCategory = { name: '', description: '', category_type: 'personal', parent_category_id: '' };

function unwrapList(response) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : payload.categories ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function unwrapSettings(response) {
    const payload = response?.data ?? response ?? {};
    return payload.settings ?? payload;
}

function categoryId(row) {
    return row.category_id ?? row.id;
}

function normalizeExtensions(value) {
    const source = Array.isArray(value) ? value.join(',') : value;
    return lines(source).map((item) => item.toLowerCase().replace(/^\./, '')).filter(Boolean);
}

async function confirmAction(title, text, confirmButtonText = 'Ya') {
    const result = await Swal.fire({ title, text, icon: 'question', showCancelButton: true, confirmButtonText, cancelButtonText: 'Batal' });
    return result.isConfirmed;
}

export default function AdminSettings() {
    const [settings, setSettings] = useState({});
    const [form, setForm] = useState({});
    const [extensionsInput, setExtensionsInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [categories, setCategories] = useState([]);
    const [categoriesMeta, setCategoriesMeta] = useState(null);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [categoryForm, setCategoryForm] = useState(emptyCategory);
    const allowedKeys = useMemo(() => Object.keys(settings), [settings]);

    const loadSettings = async () => {
        setLoading(true);
        setError('');
        try {
            const data = unwrapSettings(await arsipApi.settings());
            setSettings(data);
            setForm(data);
            setExtensionsInput((data.default_allowed_extensions || []).join(', '));
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        setCategoriesLoading(true);
        try {
            const unwrapped = unwrapList(await arsipApi.categories({ with_deleted: true, per_page: 50 }));
            setCategories(unwrapped.data);
            setCategoriesMeta(unwrapped.meta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setCategoriesLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
        loadCategories();
    }, []);

    const saveSettings = async () => {
        const payload = {};
        if (allowedKeys.includes('default_max_file_size_mb')) payload.default_max_file_size_mb = Number(form.default_max_file_size_mb || 0);
        if (allowedKeys.includes('default_allowed_extensions')) payload.default_allowed_extensions = normalizeExtensions(extensionsInput);
        if (allowedKeys.includes('retention_days')) payload.retention_days = Number(form.retention_days || 0);
        if (payload.default_max_file_size_mb !== undefined && payload.default_max_file_size_mb <= 0) {
            customSwal.toast.error({ message: 'Maks ukuran file harus angka positif.' });
            return;
        }
        setSaving(true);
        try {
            await arsipApi.updateSettings(payload);
            customSwal.toast.success({ message: 'Pengaturan disimpan.' });
            await loadSettings();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const openCategory = (row = null) => {
        setEditingCategory(row);
        setCategoryForm(row ? { name: row.name || '', description: row.description || '', category_type: row.category_type || 'personal', parent_category_id: row.parent_category_id || '' } : emptyCategory);
        setCategoryOpen(true);
    };

    const saveCategory = async () => {
        if (!categoryForm.name.trim()) {
            customSwal.toast.error({ message: 'Nama kategori wajib diisi.' });
            return;
        }
        const payload = { name: categoryForm.name, description: categoryForm.description || null, category_type: categoryForm.category_type || 'personal' };
        if (categoryForm.parent_category_id) payload.parent_category_id = Number(categoryForm.parent_category_id);
        try {
            if (editingCategory) await arsipApi.updateCategory(categoryId(editingCategory), payload);
            else await arsipApi.createCategory(payload);
            customSwal.toast.success({ message: 'Kategori disimpan.' });
            setCategoryOpen(false);
            await loadCategories();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const deleteCategory = async (row) => {
        if (!(await confirmAction('Hapus kategori?', row.name || 'Kategori', 'Hapus'))) return;
        try {
            await arsipApi.deleteCategory(categoryId(row));
            customSwal.toast.success({ message: 'Kategori dihapus.' });
            await loadCategories();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const restoreCategory = async (row) => {
        try {
            await arsipApi.restoreCategory(categoryId(row));
            customSwal.toast.success({ message: 'Kategori direstore.' });
            await loadCategories();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const columns = [
        { field: 'name', headerName: 'Nama', flex: 1, minWidth: 180, valueGetter: (value, row) => row.name || '-' },
        { field: 'category_type', headerName: 'Tipe', width: 130, valueGetter: (value, row) => row.category_type || '-' },
        { field: 'parent_category_id', headerName: 'Parent', width: 110, valueGetter: (value, row) => row.parent_category_id || '-' },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => <StatusChip status={params.row.deleted_at ? 'inactive' : 'active'} /> },
        { field: 'actions', headerName: 'Aksi', width: 260, sortable: false, renderCell: (params) => <div className="flex gap-1 flex-wrap"><Button size="small" onClick={() => openCategory(params.row)} sx={buttonSx}>Edit</Button>{params.row.deleted_at ? <Button size="small" onClick={() => restoreCategory(params.row)} sx={buttonSx}>Restore</Button> : <Button size="small" color="error" onClick={() => deleteCategory(params.row)} sx={buttonSx}>Hapus</Button>}</div> },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader title="Pengaturan" subtitle="Kelola default validasi file dan kategori arsip." actions={<Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => { loadSettings(); loadCategories(); }} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>} />
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4"><h2 className="text-sm font-semibold text-zinc-800 mb-3">Default Validasi File</h2>{!loading && allowedKeys.length === 0 && <Alert severity="warning" sx={{ mb: 2, borderRadius: '0.5rem' }}>Endpoint settings belum mengembalikan field yang bisa diedit.</Alert>}<div className="grid grid-cols-1 md:grid-cols-3 gap-3">{allowedKeys.includes('default_max_file_size_mb') && <TextField size="small" type="number" label="Maks ukuran MB" value={form.default_max_file_size_mb || ''} onChange={(event) => setForm((prev) => ({ ...prev, default_max_file_size_mb: event.target.value }))} />}{allowedKeys.includes('retention_days') && <TextField size="small" type="number" label="Retention days" value={form.retention_days || ''} onChange={(event) => setForm((prev) => ({ ...prev, retention_days: event.target.value }))} />}{allowedKeys.includes('default_allowed_extensions') && <TextField className="md:col-span-3" size="small" multiline minRows={3} label="Ekstensi diizinkan" value={extensionsInput} onChange={(event) => setExtensionsInput(event.target.value)} helperText="Dipisahkan koma/baris, disimpan lower-case tanpa titik." />}</div><div className="mt-3"><Button variant="contained" disabled={saving || loading} onClick={saveSettings} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Simpan Pengaturan</Button></div></section>
            <section className="bg-white rounded-lg border border-zinc-200 p-4"><div className="flex items-center justify-between gap-3 flex-wrap mb-3"><div><h2 className="text-sm font-semibold text-zinc-800">Kategori</h2><p className="text-xs text-zinc-500">CRUD kategori arsip, termasuk restore jika backend mendukung.</p></div><Button variant="contained" startIcon={<AddOutlined />} onClick={() => openCategory()} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Tambah Kategori</Button></div>{!categoriesMeta && categories.length > 0 && <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Backend pagination kategori belum tersedia. Data dipaginasi di browser.</Alert>}<CustomDataTable rows={categories} columns={columns} loading={categoriesLoading} getRowId={(row) => categoryId(row)} pageSize={25} pageSizeOptions={[25, 50]} /></section>
            <Dialog open={categoryOpen} onClose={() => setCategoryOpen(false)} fullWidth maxWidth="sm"><DialogTitle className="!font-jakarta">{editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle><DialogContent dividers className="space-y-3"><TextField fullWidth size="small" label="Nama" value={categoryForm.name} onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} /><TextField fullWidth size="small" select label="Tipe" value={categoryForm.category_type} onChange={(event) => setCategoryForm((prev) => ({ ...prev, category_type: event.target.value }))}><MenuItem value="personal">Personal</MenuItem><MenuItem value="request">Request</MenuItem><MenuItem value="distribution">Distribution</MenuItem></TextField><TextField fullWidth size="small" label="Parent category ID" value={categoryForm.parent_category_id} onChange={(event) => setCategoryForm((prev) => ({ ...prev, parent_category_id: event.target.value }))} /><TextField fullWidth size="small" multiline minRows={3} label="Deskripsi" value={categoryForm.description} onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))} /></DialogContent><DialogActions><Button onClick={() => setCategoryOpen(false)} sx={buttonSx}>Batal</Button><Button variant="contained" onClick={saveCategory} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Simpan</Button></DialogActions></Dialog>
        </div>
    );
}
