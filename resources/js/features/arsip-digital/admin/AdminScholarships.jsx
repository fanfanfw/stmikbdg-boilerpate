import { useEffect, useState } from 'react';
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
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyType = { code: '', name: '', description: '', is_active: true };
const emptyStudent = { nim: '', student_name_snapshot: '', angkatan_snapshot: '', scholarship_type_id: '', status: 'active', period_label: '' };

function unwrapList(response, keys) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : keys.map((key) => payload[key]).find(Array.isArray) ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function typeId(row) {
    return row.scholarship_type_id ?? row.id;
}

function studentId(row) {
    return row.student_scholarship_id ?? row.id;
}

async function confirmAction(title, text, confirmButtonText = 'Ya') {
    const result = await Swal.fire({ title, text, icon: 'question', showCancelButton: true, confirmButtonText, cancelButtonText: 'Batal' });
    return result.isConfirmed;
}

function parseImport(text) {
    return lines(text).map((line) => {
        const [nim, scholarship_type_id, student_name_snapshot, angkatan_snapshot, status, period_label] = line.split(',').map((item) => item?.trim());
        const item = { nim };
        if (scholarship_type_id) item.scholarship_type_id = Number(scholarship_type_id) || scholarship_type_id;
        if (student_name_snapshot) item.student_name_snapshot = student_name_snapshot;
        if (angkatan_snapshot) item.angkatan_snapshot = angkatan_snapshot;
        if (status) item.status = status;
        if (period_label) item.period_label = period_label;
        return item;
    }).filter((item) => item.nim);
}

export default function AdminScholarships() {
    const [types, setTypes] = useState([]);
    const [students, setStudents] = useState([]);
    const [studentsMeta, setStudentsMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ search: '', status: '', scholarship_type_id: '' });
    const [typeOpen, setTypeOpen] = useState(false);
    const [studentOpen, setStudentOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [editingStudent, setEditingStudent] = useState(null);
    const [typeForm, setTypeForm] = useState(emptyType);
    const [studentForm, setStudentForm] = useState(emptyStudent);
    const [importText, setImportText] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [typeResponse, studentResponse] = await Promise.all([
                arsipApi.scholarshipTypes(),
                arsipApi.studentScholarships({ ...filters, per_page: 50 }),
            ]);
            setTypes(unwrapList(typeResponse, ['scholarship_types', 'types']).data);
            const unwrappedStudents = unwrapList(studentResponse, ['student_scholarships', 'students']);
            setStudents(unwrappedStudents.data);
            setStudentsMeta(unwrappedStudents.meta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openType = (row = null) => {
        setEditingType(row);
        setTypeForm(row ? { code: row.code || '', name: row.name || '', description: row.description || '', is_active: row.is_active !== false } : emptyType);
        setTypeOpen(true);
    };

    const openStudent = (row = null) => {
        setEditingStudent(row);
        setStudentForm(row ? { nim: row.nim || row.identifier || '', student_name_snapshot: row.student_name_snapshot || row.name_snapshot || '', angkatan_snapshot: row.angkatan_snapshot || '', scholarship_type_id: row.scholarship_type_id || row.scholarship_type?.scholarship_type_id || '', status: row.status || 'active', period_label: row.period_label || '' } : emptyStudent);
        setStudentOpen(true);
    };

    const saveType = async () => {
        if (!typeForm.name.trim()) {
            customSwal.toast.error({ message: 'Nama jenis beasiswa wajib diisi.' });
            return;
        }
        setSaving(true);
        try {
            if (editingType) await arsipApi.updateScholarshipType(typeId(editingType), typeForm);
            else await arsipApi.createScholarshipType(typeForm);
            customSwal.toast.success({ message: 'Jenis beasiswa disimpan.' });
            setTypeOpen(false);
            await load();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const deleteType = async (row) => {
        if (!(await confirmAction('Hapus jenis beasiswa?', row.name || 'Jenis beasiswa', 'Hapus'))) return;
        try {
            await arsipApi.deleteScholarshipType(typeId(row));
            customSwal.toast.success({ message: 'Jenis beasiswa dihapus.' });
            await load();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const saveStudent = async () => {
        if (!studentForm.nim.trim() || !studentForm.scholarship_type_id) {
            customSwal.toast.error({ message: 'NIM dan jenis beasiswa wajib diisi.' });
            return;
        }
        const payload = { ...studentForm, scholarship_type_id: Number(studentForm.scholarship_type_id) || studentForm.scholarship_type_id };
        setSaving(true);
        try {
            if (editingStudent) await arsipApi.updateStudentScholarship(studentId(editingStudent), payload);
            else await arsipApi.createStudentScholarship(payload);
            customSwal.toast.success({ message: 'Penerima beasiswa disimpan.' });
            setStudentOpen(false);
            await load();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const importStudents = async () => {
        const items = parseImport(importText);
        if (!items.length) {
            customSwal.toast.error({ message: 'Isi minimal satu baris import.' });
            return;
        }
        setSaving(true);
        try {
            await arsipApi.importStudentScholarships(items);
            customSwal.toast.success({ message: 'Import beasiswa diproses.' });
            setImportOpen(false);
            setImportText('');
            await load();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const typeColumns = [
        { field: 'code', headerName: 'Kode', width: 100, valueGetter: (value, row) => row.code || '-' },
        { field: 'name', headerName: 'Nama', flex: 1, minWidth: 180, valueGetter: (value, row) => row.name || '-' },
        { field: 'is_active', headerName: 'Status', width: 120, renderCell: (params) => <StatusChip status={params.row.is_active === false ? 'inactive' : 'active'} /> },
        { field: 'actions', headerName: 'Aksi', width: 200, sortable: false, renderCell: (params) => <div className="flex gap-1"><Button size="small" onClick={() => openType(params.row)} sx={buttonSx}>Edit</Button><Button size="small" color="error" onClick={() => deleteType(params.row)} sx={buttonSx}>Hapus</Button></div> },
    ];

    const studentColumns = [
        { field: 'nim', headerName: 'NIM', width: 140, valueGetter: (value, row) => row.nim || row.identifier || '-' },
        { field: 'student_name_snapshot', headerName: 'Nama', flex: 1, minWidth: 190, valueGetter: (value, row) => row.student_name_snapshot || row.name_snapshot || '-' },
        { field: 'scholarship_type', headerName: 'Beasiswa', width: 180, renderCell: (params) => params.row.scholarship_type?.name || types.find((type) => typeId(type) === params.row.scholarship_type_id)?.name || params.row.scholarship_type_id || '-' },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => <StatusChip status={params.row.status} /> },
        { field: 'period_label', headerName: 'Periode', width: 150, valueGetter: (value, row) => row.period_label || '-' },
        { field: 'actions', headerName: 'Aksi', width: 120, sortable: false, renderCell: (params) => <Button size="small" onClick={() => openStudent(params.row)} sx={buttonSx}>Edit</Button> },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader title="Beasiswa" subtitle="Kelola jenis beasiswa dan snapshot penerima mahasiswa." actions={<Button variant="outlined" startIcon={<RefreshOutlined />} onClick={load} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>} />
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4"><div className="flex items-center justify-between gap-3 flex-wrap mb-3"><div><h2 className="text-sm font-semibold text-zinc-800">Jenis Beasiswa</h2><p className="text-xs text-zinc-500">CRUD master jenis beasiswa.</p></div><Button variant="contained" startIcon={<AddOutlined />} onClick={() => openType()} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Tambah Jenis</Button></div><CustomDataTable rows={types} columns={typeColumns} loading={loading} getRowId={(row) => typeId(row)} pageSize={10} pageSizeOptions={[10, 25]} /></section>
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3"><TextField size="small" label="Cari" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} sx={{ minWidth: 220 }} /><TextField size="small" select label="Jenis" value={filters.scholarship_type_id} onChange={(event) => setFilters((prev) => ({ ...prev, scholarship_type_id: event.target.value }))} sx={{ minWidth: 180 }}><MenuItem value="">Semua</MenuItem>{types.map((type) => <MenuItem key={typeId(type)} value={typeId(type)}>{type.name}</MenuItem>)}</TextField><TextField size="small" select label="Status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} sx={{ minWidth: 150 }}><MenuItem value="">Semua</MenuItem><MenuItem value="active">Aktif</MenuItem><MenuItem value="inactive">Nonaktif</MenuItem><MenuItem value="expired">Expired</MenuItem><MenuItem value="unknown">Unknown</MenuItem></TextField><Button variant="contained" startIcon={<SearchOutlined />} onClick={load} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button><Button variant="outlined" onClick={() => openStudent()} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Tambah Penerima</Button><Button variant="outlined" onClick={() => setImportOpen(true)} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Import</Button></section>
            {!studentsMeta && students.length > 0 && <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Backend pagination beasiswa belum tersedia. Data dipaginasi di browser.</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200"><CustomDataTable rows={students} columns={studentColumns} loading={loading} getRowId={(row) => studentId(row)} pageSize={50} pageSizeOptions={[50, 100]} /></section>
            <Dialog open={typeOpen} onClose={() => setTypeOpen(false)} fullWidth maxWidth="sm"><DialogTitle className="!font-jakarta">{editingType ? 'Edit Jenis Beasiswa' : 'Tambah Jenis Beasiswa'}</DialogTitle><DialogContent dividers className="space-y-3"><TextField fullWidth size="small" label="Kode" value={typeForm.code} onChange={(event) => setTypeForm((prev) => ({ ...prev, code: event.target.value }))} /><TextField fullWidth size="small" label="Nama" value={typeForm.name} onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))} /><TextField fullWidth size="small" select label="Status" value={typeForm.is_active ? '1' : '0'} onChange={(event) => setTypeForm((prev) => ({ ...prev, is_active: event.target.value === '1' }))}><MenuItem value="1">Aktif</MenuItem><MenuItem value="0">Nonaktif</MenuItem></TextField><TextField fullWidth size="small" multiline minRows={3} label="Deskripsi" value={typeForm.description} onChange={(event) => setTypeForm((prev) => ({ ...prev, description: event.target.value }))} /></DialogContent><DialogActions><Button onClick={() => setTypeOpen(false)} sx={buttonSx}>Batal</Button><Button variant="contained" disabled={saving} onClick={saveType} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Simpan</Button></DialogActions></Dialog>
            <Dialog open={studentOpen} onClose={() => setStudentOpen(false)} fullWidth maxWidth="sm"><DialogTitle className="!font-jakarta">{editingStudent ? 'Edit Penerima Beasiswa' : 'Tambah Penerima Beasiswa'}</DialogTitle><DialogContent dividers className="space-y-3"><TextField fullWidth size="small" label="NIM" value={studentForm.nim} onChange={(event) => setStudentForm((prev) => ({ ...prev, nim: event.target.value }))} /><TextField fullWidth size="small" label="Nama snapshot" value={studentForm.student_name_snapshot} onChange={(event) => setStudentForm((prev) => ({ ...prev, student_name_snapshot: event.target.value }))} /><TextField fullWidth size="small" label="Angkatan" value={studentForm.angkatan_snapshot} onChange={(event) => setStudentForm((prev) => ({ ...prev, angkatan_snapshot: event.target.value }))} /><TextField fullWidth size="small" select label="Jenis" value={studentForm.scholarship_type_id} onChange={(event) => setStudentForm((prev) => ({ ...prev, scholarship_type_id: event.target.value }))}><MenuItem value="">Pilih</MenuItem>{types.map((type) => <MenuItem key={typeId(type)} value={typeId(type)}>{type.name}</MenuItem>)}</TextField><TextField fullWidth size="small" select label="Status" value={studentForm.status} onChange={(event) => setStudentForm((prev) => ({ ...prev, status: event.target.value }))}><MenuItem value="active">Aktif</MenuItem><MenuItem value="inactive">Nonaktif</MenuItem><MenuItem value="expired">Expired</MenuItem><MenuItem value="unknown">Unknown</MenuItem></TextField><TextField fullWidth size="small" label="Periode" value={studentForm.period_label} onChange={(event) => setStudentForm((prev) => ({ ...prev, period_label: event.target.value }))} /></DialogContent><DialogActions><Button onClick={() => setStudentOpen(false)} sx={buttonSx}>Batal</Button><Button variant="contained" disabled={saving} onClick={saveStudent} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Simpan</Button></DialogActions></Dialog>
            <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="md"><DialogTitle className="!font-jakarta">Import Penerima Beasiswa</DialogTitle><DialogContent dividers className="space-y-3"><Alert severity="info" sx={{ borderRadius: '0.5rem' }}>Format baris: nim, scholarship_type_id, nama, angkatan, status, periode. Backend tetap memvalidasi payload import.</Alert><TextField fullWidth multiline minRows={8} label="Data import" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="22123456,1,Nama Mahasiswa,2022,active,2025" /></DialogContent><DialogActions><Button onClick={() => setImportOpen(false)} sx={buttonSx}>Batal</Button><Button variant="contained" disabled={saving} onClick={importStudents} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Import</Button></DialogActions></Dialog>
        </div>
    );
}
