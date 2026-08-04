import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import PageHeader from '../../../components/PageHeader';
import CustomDataTable from '../../../components/CustomDataTable';
import StatusChip from '../../../components/StatusChip';
import { customSwal } from '../../../components/CustomSwal';
import { confirmAction } from '../../../services/dialogs';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyForm = { document_type: 'transcript', document_number: '', semester: '', student: null, signer_user_id: '', signer_title: 'Ketua Program Studi', replaces_document_id: null, replacement_reason: '' };

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
    const [filters, setFilters] = useState({ document_type: '', status: '' });
    const [signers, setSigners] = useState([]);

    const loadDocuments = async (nextFilters = filters) => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.academicDocuments({
                per_page: 100,
                ...(nextFilters.document_type ? { document_type: nextFilters.document_type } : {}),
                ...(nextFilters.status ? { status: nextFilters.status } : {}),
            });
            setRows(unwrap(response, 'documents') || []);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadDocuments(); }, []);

    const suggestNumber = async (documentType) => {
        try {
            const response = await arsipApi.nextAcademicDocumentNumber(documentType);
            return unwrap(response, 'document_number') || '';
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
            return '';
        }
    };

    const loadSigners = async () => {
        try {
            const response = await arsipApi.academicDocumentSigners();
            const items = unwrap(response, 'signers') || [];
            setSigners(items);
            return items;
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
            return [];
        }
    };

    const openIssueDialog = async () => {
        setSnapshot(null);
        setStudents([]);
        setStudentSearch('');
        setDialogOpen(true);
        const [documentNumber, signerItems] = await Promise.all([suggestNumber('transcript'), loadSigners()]);
        setForm({ ...emptyForm, document_number: documentNumber, signer_user_id: signerItems[0]?.user_id || '' });
    };

    const openPdfBlob = (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const previewIssued = async (document) => {
        try {
            openPdfBlob(await arsipApi.previewAcademicDocument(document.official_document_id));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const downloadIssued = async (document) => {
        try {
            await arsipApi.downloadAcademicDocument(document.official_document_id, document.file?.display_filename || `${document.document_number}.pdf`);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const changeDocumentType = async (documentType) => {
        const documentNumber = await suggestNumber(documentType);
        setForm((current) => ({ ...current, document_type: documentType, document_number: documentNumber }));
    };

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

    const beginReplacement = async (document) => {
        const student = {
            mhs_id: document.subject_mhs_id,
            identifier: document.subject_identifier,
            name: document.subject_name_snapshot,
        };
        const [documentNumber, signerItems] = await Promise.all([suggestNumber(document.document_type), loadSigners()]);
        setForm({
            document_type: document.document_type,
            document_number: documentNumber,
            semester: document.semester || '',
            student,
            signer_user_id: document.signer_user_id || signerItems[0]?.user_id || '',
            signer_title: document.signer_title_snapshot || 'Ketua Program Studi',
            replaces_document_id: document.official_document_id,
            replacement_reason: '',
        });
        setStudents([]);
        setStudentSearch('');
        setSnapshot(null);
        setDialogOpen(true);
        try {
            const response = await arsipApi.academicTranscript(student.mhs_id);
            setSnapshot(response?.data ?? response);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const distribute = async (document) => {
        if (!(await confirmAction({ title: 'Distribusikan dokumen resmi?', text: 'Dokumen akan tersedia pada akun mahasiswa pemiliknya.', confirmText: 'Distribusikan' }))) return;

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

    const documentPayload = () => ({
        document_type: form.document_type,
        document_number: form.document_number,
        mhs_id: form.student.mhs_id,
        signer_user_id: Number(form.signer_user_id),
        signer_title: form.signer_title.trim(),
    });

    const previewDraft = async () => {
        if (!form.student || !form.document_number || !form.signer_user_id || !form.signer_title.trim()) return;
        try {
            openPdfBlob(await arsipApi.previewAcademicDocumentDraft(documentPayload()));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const issue = async () => {
        if (!form.student || !form.document_number || !form.signer_user_id || !form.signer_title.trim() || (form.replaces_document_id && form.replacement_reason.trim().length < 5)) return;
        setSaving(true);
        try {
            await arsipApi.issueAcademicDocument({
                ...documentPayload(),
                ...(form.replaces_document_id ? {
                    replaces_document_id: form.replaces_document_id,
                    replacement_reason: form.replacement_reason.trim(),
                } : {}),
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
        { field: 'document_type', headerName: 'Jenis', width: 130, valueFormatter: (value) => value === 'transcript' ? 'Transkrip Nilai' : value },
        { field: 'subject_identifier', headerName: 'NIM', width: 130 },
        { field: 'subject_name_snapshot', headerName: 'Mahasiswa', flex: 1.3, minWidth: 190 },
        { field: 'semester_summary', headerName: 'Semester Tercakup', minWidth: 180, flex: 1 },
        { field: 'course_count', headerName: 'Jumlah MK', width: 100 },
        { field: 'status', headerName: 'Status', width: 130, renderCell: ({ value }) => <StatusChip status={value} /> },
        { field: 'issued_at', headerName: 'Diterbitkan', width: 180, valueFormatter: (value) => dateTime(value) },
        {
            field: 'actions',
            headerName: 'Aksi',
            width: 520,
            sortable: false,
            renderCell: ({ row }) => (
                <div className="flex gap-1">
                    <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => previewIssued(row)} sx={buttonSx}>Lihat</Button>
                    <Button size="small" startIcon={<DownloadOutlined />} onClick={() => downloadIssued(row)} sx={buttonSx}>Unduh</Button>
                    {row.status === 'issued' && <>
                        <Button size="small" startIcon={<AutorenewOutlined />} onClick={() => beginReplacement(row)} sx={buttonSx}>Ganti</Button>
                        {!row.distribution && <Button size="small" startIcon={<SendOutlined />} onClick={() => distribute(row)} sx={buttonSx}>Distribusi</Button>}
                        <Button color="error" size="small" startIcon={<BlockOutlined />} onClick={() => revoke(row)} sx={buttonSx}>Cabut</Button>
                    </>}
                </div>
            ),
        },
    ];

    return (
        <div className="p-4 md:p-6">
            <PageHeader
                title="Dokumen Akademik Resmi"
                subtitle="Terbitkan transkrip nilai resmi dari snapshot data SIMAK."
                actions={<>
                    <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={loadDocuments} sx={buttonSx}>Muat Ulang</Button>
                    <Button variant="contained" startIcon={<AddOutlined />} onClick={openIssueDialog} sx={buttonSx}>Terbitkan</Button>
                </>}
            />
            {error && <Alert severity="error" className="mb-4">{error}</Alert>}
            <div className="bg-white border border-zinc-200 rounded-xl p-3">
                <div className="grid grid-cols-1 md:grid-cols-[220px_220px_auto] gap-3 mb-4">
                    <TextField select size="small" label="Jenis dokumen" value={filters.document_type} onChange={(event) => setFilters((current) => ({ ...current, document_type: event.target.value }))}>
                        <MenuItem value="">Semua jenis</MenuItem>
                        <MenuItem value="transcript">Transkrip Nilai</MenuItem>
                    </TextField>
                    <TextField select size="small" label="Status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
                        <MenuItem value="">Semua status</MenuItem>
                        <MenuItem value="issued">Diterbitkan</MenuItem>
                        <MenuItem value="revoked">Dicabut</MenuItem>
                        <MenuItem value="replaced">Diganti</MenuItem>
                    </TextField>
                    <div className="flex gap-2">
                        <Button variant="contained" onClick={() => loadDocuments(filters)} sx={buttonSx}>Terapkan Filter</Button>
                        <Button variant="outlined" onClick={() => { const empty = { document_type: '', status: '' }; setFilters(empty); loadDocuments(empty); }} sx={buttonSx}>Reset</Button>
                    </div>
                </div>
                <CustomDataTable rows={rows} columns={columns} loading={loading} getRowId={(row) => row.official_document_id} pageSize={25} />
            </div>

            <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md">
                <DialogTitle>{form.replaces_document_id ? 'Ganti Dokumen Akademik Resmi' : 'Terbitkan Dokumen Akademik Resmi'}</DialogTitle>
                <DialogContent className="space-y-4 pt-3">
                    {!form.replaces_document_id && <div className="flex gap-2 pt-2">
                        <TextField fullWidth size="small" label="Cari NIM atau nama mahasiswa" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
                        <Button variant="outlined" disabled={searching} onClick={searchStudents} sx={buttonSx}>{searching ? 'Mencari...' : 'Cari'}</Button>
                    </div>}
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
                    {form.student && <Alert severity="info">Mahasiswa: {form.student.identifier} — {form.student.name}. Data SIMAK: {snapshot?.records?.length ?? 0} mata kuliah, semester {[...new Set((snapshot?.records || []).map((record) => record.semester))].filter(Boolean).sort((a, b) => a - b).join(', ') || '-'}.</Alert>}
                    <TextField select fullWidth size="small" label="Jenis dokumen" value={form.document_type} disabled={Boolean(form.replaces_document_id)} onChange={(event) => changeDocumentType(event.target.value)} helperText="Jenis lain dapat ditambahkan ketika template dan aturan penerbitannya tersedia.">
                        <MenuItem value="transcript">Transkrip Nilai</MenuItem>
                    </TextField>
                    {signers.length === 0 && <Alert severity="warning">Belum ada akun dengan role prodi. Tetapkan role prodi sebelum menerbitkan dokumen resmi.</Alert>}
                    <TextField select fullWidth size="small" label="Pejabat penandatangan" value={form.signer_user_id} onChange={(event) => setForm((current) => ({ ...current, signer_user_id: event.target.value }))} helperText="Hanya akun yang memiliki role prodi.">
                        {signers.map((signer) => <MenuItem key={signer.user_id} value={signer.user_id}>{signer.name} — {signer.identifier}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Jabatan penandatangan" value={form.signer_title} onChange={(event) => setForm((current) => ({ ...current, signer_title: event.target.value }))} />
                    <TextField fullWidth size="small" label="Nomor dokumen resmi" value={form.document_number} onChange={(event) => setForm((current) => ({ ...current, document_number: event.target.value }))} helperText="Terisi otomatis dari nomor terakhir; admin tetap dapat mengubah." />
                    {form.replaces_document_id && <TextField fullWidth multiline minRows={3} size="small" label="Alasan penggantian" value={form.replacement_reason} onChange={(event) => setForm((current) => ({ ...current, replacement_reason: event.target.value }))} helperText="Minimal 5 karakter; alasan tampil pada verifikasi dokumen lama." />}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={buttonSx}>Batal</Button>
                    <Button variant="outlined" startIcon={<VisibilityOutlined />} onClick={previewDraft} disabled={saving || !snapshot || !form.student || !form.document_number || !form.signer_user_id || !form.signer_title.trim()} sx={buttonSx}>Pratinjau PDF</Button>
                    <Button variant="contained" onClick={issue} disabled={saving || !snapshot || !form.student || !form.document_number || !form.signer_user_id || !form.signer_title.trim() || (form.replaces_document_id && form.replacement_reason.trim().length < 5)} sx={buttonSx}>{saving ? 'Menerbitkan...' : form.replaces_document_id ? 'Terbitkan Pengganti' : 'Terbitkan Resmi'}</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
