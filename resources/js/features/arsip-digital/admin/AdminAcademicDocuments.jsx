import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import PageHeader from '../../../components/PageHeader';
import CustomDataTable from '../../../components/CustomDataTable';
import StatusChip from '../../../components/StatusChip';
import { customSwal } from '../../../components/CustomSwal';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyForm = { document_type: 'transcript', document_number: '', semester: '', student: null };

function unwrap(response, key) {
    return response?.data?.[key] ?? response?.data ?? response ?? {};
}

export default function AdminAcademicDocuments() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [studentSearch, setStudentSearch] = useState('');
    const [students, setStudents] = useState([]);
    const [searching, setSearching] = useState(false);
    const [snapshot, setSnapshot] = useState(null);
    const [saving, setSaving] = useState(false);

    const loadDocuments = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.academicDocuments({ per_page: 100 });
            setRows(unwrap(response, 'documents') || []);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDocuments(); }, []);

    const searchStudents = async () => {
        setSearching(true);
        try {
            const response = await arsipApi.adminTargets({ role: 'mahasiswa', search: studentSearch, has_account: true, per_page: 25 });
            setStudents(unwrap(response, 'targets') || []);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSearching(false);
        }
    };

    const selectStudent = async (student) => {
        setForm((current) => ({ ...current, student }));
        setSnapshot(null);
        try {
            const response = await arsipApi.academicTranscript(student.mhs_id);
            setSnapshot(response?.data ?? response);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const distribute = async (document) => {
        const result = await Swal.fire({
            title: 'Distribusikan dokumen resmi?',
            text: 'Dokumen akan tersedia pada akun mahasiswa pemiliknya.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Distribusikan',
            cancelButtonText: 'Batal',
        });
        if (!result.isConfirmed) return;

        try {
            await arsipApi.distributeAcademicDocument(document.official_document_id);
            customSwal.toast.success({ message: 'Dokumen resmi berhasil didistribusikan.' });
            await loadDocuments();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const revoke = async (document) => {
        const result = await Swal.fire({
            title: 'Cabut dokumen resmi?',
            text: 'QR dokumen akan berubah menjadi tidak valid.',
            icon: 'warning',
            input: 'textarea',
            inputLabel: 'Alasan pencabutan',
            inputPlaceholder: 'Jelaskan alasan pencabutan dokumen',
            showCancelButton: true,
            confirmButtonText: 'Cabut Dokumen',
            cancelButtonText: 'Batal',
            inputValidator: (value) => (!value || value.trim().length < 5 ? 'Alasan minimal 5 karakter.' : undefined),
        });
        if (!result.isConfirmed) return;

        try {
            await arsipApi.revokeAcademicDocument(document.official_document_id, result.value.trim());
            customSwal.toast.success({ message: 'Dokumen resmi berhasil dicabut.' });
            await loadDocuments();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const issue = async () => {
        if (!form.student || !form.document_number || (form.document_type === 'khs' && !form.semester)) return;
        setSaving(true);
        try {
            await arsipApi.issueAcademicDocument({
                document_type: form.document_type,
                document_number: form.document_number,
                mhs_id: form.student.mhs_id,
                ...(form.document_type === 'khs' ? { semester: Number(form.semester) } : {}),
            });
            customSwal.toast.success({ message: 'Dokumen akademik resmi berhasil diterbitkan.' });
            setDialogOpen(false);
            setForm(emptyForm);
            setSnapshot(null);
            setStudents([]);
            setStudentSearch('');
            await loadDocuments();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const columns = [
        { field: 'document_number', headerName: 'Nomor Dokumen', flex: 1.4, minWidth: 190 },
        { field: 'document_type', headerName: 'Jenis', width: 120, valueFormatter: (value) => value === 'khs' ? 'KHS' : 'Transkrip' },
        { field: 'subject_identifier', headerName: 'NIM', width: 130 },
        { field: 'subject_name_snapshot', headerName: 'Mahasiswa', flex: 1.3, minWidth: 190 },
        { field: 'semester', headerName: 'Semester', width: 100, valueFormatter: (value) => value || '-' },
        { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value} /> },
        { field: 'issued_at', headerName: 'Diterbitkan', width: 180, valueFormatter: (value) => dateTime(value) },
        {
            field: 'actions',
            headerName: 'Aksi',
            width: 240,
            sortable: false,
            renderCell: ({ row }) => row.status === 'issued' ? (
                <div className="flex gap-1">
                    {!row.distribution && <Button size="small" startIcon={<SendOutlined />} onClick={() => distribute(row)} sx={buttonSx}>Distribusi</Button>}
                    <Button color="error" size="small" startIcon={<BlockOutlined />} onClick={() => revoke(row)} sx={buttonSx}>Cabut</Button>
                </div>
            ) : '-',
        },
    ];

    return (
        <div className="p-4 md:p-6">
            <PageHeader
                title="Dokumen Akademik Resmi"
                subtitle="Terbitkan KHS dan transkrip resmi dari snapshot data SIMAK."
                actions={<>
                    <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={loadDocuments} sx={buttonSx}>Muat Ulang</Button>
                    <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialogOpen(true)} sx={buttonSx}>Terbitkan</Button>
                </>}
            />
            {error && <Alert severity="error" className="mb-4">{error}</Alert>}
            <div className="bg-white border border-zinc-200 rounded-xl p-3">
                <CustomDataTable rows={rows} columns={columns} loading={loading} getRowId={(row) => row.official_document_id} pageSize={25} />
            </div>

            <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>Terbitkan Dokumen Akademik Resmi</DialogTitle>
                <DialogContent className="space-y-4 pt-3">
                    <div className="flex gap-2 pt-2">
                        <TextField fullWidth size="small" label="Cari NIM atau nama mahasiswa" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
                        <Button variant="outlined" disabled={searching} onClick={searchStudents} sx={buttonSx}>{searching ? 'Mencari...' : 'Cari'}</Button>
                    </div>
                    {students.length > 0 && (
                        <div className="border border-zinc-200 rounded-lg divide-y max-h-48 overflow-auto">
                            {students.map((student) => (
                                <button key={student.mhs_id} type="button" onClick={() => selectStudent(student)} className={`w-full text-left p-3 hover:bg-blue-50 ${form.student?.mhs_id === student.mhs_id ? 'bg-blue-50' : ''}`}>
                                    <p className="font-semibold text-sm">{student.identifier} — {student.name}</p>
                                    <p className="text-xs text-zinc-500">Angkatan {student.angkatan || '-'} · Status {student.status || '-'}</p>
                                </button>
                            ))}
                        </div>
                    )}
                    {form.student && <Alert severity="info">Mahasiswa: {form.student.identifier} — {form.student.name}. Data SIMAK: {snapshot?.records?.length ?? 0} record nilai.</Alert>}
                    <TextField select fullWidth size="small" label="Jenis dokumen" value={form.document_type} onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value, semester: '' }))}>
                        <MenuItem value="transcript">Transkrip Nilai</MenuItem>
                        <MenuItem value="khs">KHS</MenuItem>
                    </TextField>
                    {form.document_type === 'khs' && (
                        <TextField select fullWidth size="small" label="Semester" value={form.semester} onChange={(event) => setForm((current) => ({ ...current, semester: event.target.value }))}>
                            {[...new Set((snapshot?.records || []).map((record) => record.semester))].filter(Boolean).sort((a, b) => a - b).map((semester) => <MenuItem key={semester} value={semester}>Semester {semester}</MenuItem>)}
                        </TextField>
                    )}
                    <TextField fullWidth size="small" label="Nomor dokumen resmi" value={form.document_number} onChange={(event) => setForm((current) => ({ ...current, document_number: event.target.value }))} helperText="Gunakan nomor yang sudah ditetapkan admin akademik." />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={buttonSx}>Batal</Button>
                    <Button variant="contained" onClick={issue} disabled={saving || !snapshot || !form.student || !form.document_number || (form.document_type === 'khs' && !form.semester)} sx={buttonSx}>{saving ? 'Menerbitkan...' : 'Terbitkan Resmi'}</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
