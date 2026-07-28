import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Pagination, Paper, Switch, TextField } from '@mui/material';
import { AddOutlined, DownloadOutlined, DrawOutlined } from '@mui/icons-material';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { useUser } from '../../../contexts/UserContext';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { customSwal } from '../../../components/CustomSwal';

const studentLabels = { requested: 'Request', draft: 'Pending', completed: 'Completed', rejected: 'Rejected', expired: 'Expired', cancelled: 'Cancelled' };
const lecturerLabels = { requested: 'Menunggu Persetujuan', draft: 'Draft', completed: 'Completed', rejected: 'Rejected', expired: 'Expired', cancelled: 'Cancelled' };
const colors = { requested: 'info', draft: 'warning', completed: 'success', rejected: 'error', expired: 'default', cancelled: 'default' };
const payloadOf = (response) => response?.data ?? response ?? {};
const idOf = (item) => item?.signature_request_id ?? item?.request_id ?? item?.id;
const fileIdOf = (item) => item?.signature_request_file_id ?? item?.request_file_id ?? item?.file_id ?? item?.id;
const nameOf = (item) => item?.source_filename || item?.display_filename || item?.original_filename || item?.filename || item?.file?.display_filename || 'dokumen.pdf';
const Status = ({ value, role }) => <Chip size="small" label={(role === 'dosen' ? lecturerLabels : studentLabels)[value] || value || '-'} color={colors[value] || 'default'} />;

function StudentRequests() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [lecturers, setLecturers] = useState([]);
    const [archives, setArchives] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ lecturer_user_id: '', title: '', description: '', file_ids: [] });
    const [limits, setLimits] = useState({ maxFiles: 10, maxFileMb: 10, maxTotalMb: 50 });
    const [error, setError] = useState('');
    const [loadErrors, setLoadErrors] = useState({ list: '', config: '', directory: '', files: '' });
    const load = async () => {
        const results = await Promise.allSettled([arsipApi.signatureRequests(), arsipApi.signatureRequestLecturers(), arsipApi.files({ per_page: 100 }), arsipApi.signatureRequestConfig()]);
        const errors = { list: '', directory: '', files: '', config: '' };
        if (results[0].status === 'fulfilled') setItems(payloadOf(results[0].value).data ?? []); else errors.list = (await formatArsipError(results[0].reason)).message;
        if (results[1].status === 'fulfilled') setLecturers(payloadOf(results[1].value)); else errors.directory = (await formatArsipError(results[1].reason)).message;
        if (results[2].status === 'fulfilled') {
            const fileData = payloadOf(results[2].value);
            setArchives((fileData.files ?? fileData.data ?? []).filter((file) => nameOf(file).toLowerCase().endsWith('.pdf') && file.storage_available !== false));
        } else errors.files = (await formatArsipError(results[2].reason)).message;
        if (results[3].status === 'fulfilled') {
            const settingData = payloadOf(results[3].value);
            setLimits({ maxFiles: settingData.signature_request_max_files ?? 10, maxFileMb: settingData.signature_request_max_file_size_mb ?? 10, maxTotalMb: settingData.signature_request_max_total_size_mb ?? 50 });
        } else errors.config = (await formatArsipError(results[3].reason)).message;
        setLoadErrors(errors);
    };
    useEffect(() => { load(); }, []);
    const showForm = (item = null) => {
        setEditing(item);
        setForm(item ? { lecturer_user_id: item.lecturer_user_id, title: item.title ?? '', description: item.description ?? '', file_ids: (item.files ?? []).map((file) => file.source_file_id) } : { lecturer_user_id: '', title: '', description: '', file_ids: [] });
        setOpen(true);
    };
    const save = async () => {
        setError('');
        if (form.file_ids.length > limits.maxFiles) { setError(`Jumlah file melebihi batas ${limits.maxFiles} file.`); return; }
        const selectedFiles = form.file_ids.map((id) => archives.find((file) => String(fileIdOf(file)) === String(id))).filter(Boolean);
        const oversized = selectedFiles.find((file) => Number(file.file_size_bytes) > limits.maxFileMb * 1024 * 1024);
        if (oversized) { setError(`File "${nameOf(oversized)}" melebihi batas ${limits.maxFileMb} MB per file.`); return; }
        const totalBytes = selectedFiles.reduce((total, file) => total + Number(file.file_size_bytes || 0), 0);
        if (totalBytes > limits.maxTotalMb * 1024 * 1024) { setError(`Total ukuran ${selectedFiles.length} file melebihi batas ${limits.maxTotalMb} MB.`); return; }
        try {
            editing ? await arsipApi.updateSignatureRequest(idOf(editing), form) : await arsipApi.createSignatureRequest(form);
            setOpen(false); await load(); customSwal.toast.success({ message: editing ? 'Request diperbarui.' : 'Request dibuat.' });
        } catch (err) { setError((await formatArsipError(err)).message); }
    };
    const remove = async (item) => {
        if (!(await customSwal.confirm.delete({ title: 'Hapus request?', text: 'Request yang dihapus tidak dapat dipulihkan.' })).isConfirmed) return;
        try { await arsipApi.deleteSignatureRequest(idOf(item)); await load(); } catch (err) { setError((await formatArsipError(err)).message); }
    };
    return <div><PageHeader title="Request Tanda Tangan" subtitle="Kirim PDF dari Arsip Saya kepada dosen untuk ditandatangani." actions={<Button variant="contained" startIcon={<AddOutlined />} onClick={() => showForm()}>Buat Request</Button>} />
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {Object.entries(loadErrors).filter(([, message]) => message).map(([source, message]) => <Alert key={source} severity="warning" sx={{ mb: 2 }}>{message}</Alert>)}
        <div className="space-y-3">{items.map((item) => <Paper variant="outlined" key={idOf(item)} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><button className="font-semibold text-left text-blue-700 hover:underline" onClick={() => navigate(`/home/request-tanda-tangan/${idOf(item)}`)}>{item.title}</button><p className="text-xs text-zinc-500 mt-1">{item.lecturer_name || '-'} · {(item.files || []).length} file</p></div><div className="flex items-center gap-2"><Status value={item.status} role="mahasiswa" />{item.status === 'requested' && <><Button size="small" onClick={() => showForm(item)}>Edit</Button><Button size="small" color="error" onClick={() => remove(item)}>Hapus</Button></>}</div></Paper>)}{!items.length && <Paper variant="outlined" className="p-10 text-center text-zinc-500">Belum ada request tanda tangan.</Paper>}</div>
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>{editing ? 'Edit Request' : 'Buat Request'}</DialogTitle><DialogContent className="space-y-4 !pt-2">{!editing && !lecturers.length && <Alert severity="warning">Tidak ada dosen tersedia untuk menerima request.</Alert>}{!editing && !archives.length && <Alert severity="warning">Tidak ada file PDF tersedia di Arsip Saya.</Alert>}<TextField select fullWidth label="Dosen" value={form.lecturer_user_id} disabled={!!editing} onChange={(e) => setForm({ ...form, lecturer_user_id: e.target.value })}>{lecturers.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField><TextField fullWidth label="Judul" value={form.title} inputProps={{ maxLength: 150 }} onChange={(e) => setForm({ ...form, title: e.target.value })} /><TextField fullWidth multiline minRows={3} label="Deskripsi" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><TextField select fullWidth SelectProps={{ multiple: true }} label="PDF dari Arsip Saya" value={form.file_ids} helperText={`Maks ${limits.maxFiles} file, ${limits.maxFileMb} MB/file, ${limits.maxTotalMb} MB total`} onChange={(e) => setForm({ ...form, file_ids: e.target.value.slice(0, limits.maxFiles) })}>{archives.map((file) => <MenuItem key={fileIdOf(file)} value={fileIdOf(file)}><Checkbox checked={form.file_ids.includes(fileIdOf(file))} />{nameOf(file)}</MenuItem>)}</TextField></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Batal</Button><Button variant="contained" disabled={!form.lecturer_user_id || !form.title.trim() || !form.file_ids.length} onClick={save}>Simpan</Button></DialogActions></Dialog>
    </div>;
}

function LecturerRequests() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]); const [selected, setSelected] = useState([]); const [available, setAvailable] = useState(false); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [status, setStatus] = useState(''); const [reason, setReason] = useState(''); const [action, setAction] = useState(''); const [error, setError] = useState(''); const [listError, setListError] = useState(''); const [availabilityError, setAvailabilityError] = useState('');
    const load = async () => { try { const response = payloadOf(await arsipApi.signatureRequests({ page, ...(status ? { status } : {}) })); setItems(response.data ?? []); setPages(response.last_page ?? 1); setSelected([]); setListError(''); } catch (err) { setListError((await formatArsipError(err)).message); } };
    useEffect(() => { load(); }, [page, status]);
    useEffect(() => { arsipApi.signatureRequestAvailability().then((response) => { setAvailable(Boolean(payloadOf(response).is_available)); setAvailabilityError(''); }).catch(async (err) => setAvailabilityError((await formatArsipError(err)).message)); }, []);
    const eligible = items.filter((item) => item.status === 'requested').map((item) => String(idOf(item))); const all = eligible.length > 0 && eligible.every((id) => selected.includes(id));
    const bulk = async () => { try { await arsipApi.bulkSignatureRequests(selected, action, reason); setAction(''); setReason(''); await load(); } catch (err) { setError((await formatArsipError(err)).message); } };
    return <div><PageHeader title="Request Tanda Tangan" subtitle="Tinjau dan proses dokumen mahasiswa." actions={<FormControlLabel control={<Switch checked={available} onChange={async (e) => { const value = e.target.checked; setAvailable(value); try { await arsipApi.updateSignatureRequestAvailability(value); } catch (err) { setAvailable(!value); setError((await formatArsipError(err)).message); } }} />} label={available ? 'Tersedia' : 'Tidak tersedia'} />} />
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}{listError && <Alert severity="warning" sx={{ mb: 2 }}>{listError}</Alert>}{availabilityError && <Alert severity="warning" sx={{ mb: 2 }}>{availabilityError}</Alert>}<div className="flex flex-wrap gap-2 mb-3"><TextField select size="small" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} sx={{ minWidth: 160 }}><MenuItem value="">Semua</MenuItem>{Object.entries(lecturerLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><Button disabled={!selected.length} onClick={() => setAction('accept')}>Terima</Button><Button color="error" disabled={!selected.length} onClick={() => setAction('reject')}>Tolak</Button></div>
        <Paper variant="outlined" className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="bg-zinc-50"><tr><th className="p-3"><Checkbox inputProps={{ 'aria-label': 'Pilih semua request halaman ini' }} checked={all} indeterminate={selected.length > 0 && !all} disabled={!eligible.length} onChange={(e) => setSelected(e.target.checked ? eligible : [])} /></th><th>Mahasiswa</th><th>Judul</th><th>File</th><th>Status</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={idOf(item)} className="border-t border-zinc-200"><td className="p-3"><Checkbox disabled={item.status !== 'requested'} checked={selected.includes(String(idOf(item)))} onChange={(e) => { e.stopPropagation(); const itemId = String(idOf(item)); setSelected(e.target.checked ? [...selected, itemId] : selected.filter((id) => id !== itemId)); }} /></td><td>{item.student_name || '-'}</td><td>{item.title}</td><td>{(item.files || []).length}</td><td><Status value={item.status} role="dosen" /></td><td><Button onClick={() => navigate(`/home/request-tanda-tangan/${idOf(item)}`)}>Detail</Button></td></tr>)}</tbody></table></Paper><Pagination count={pages} page={page} onChange={(_, value) => setPage(value)} sx={{ mt: 2 }} />
        <Dialog open={!!action} onClose={() => setAction('')} fullWidth maxWidth="xs"><DialogTitle>{action === 'accept' ? 'Terima request' : 'Tolak request'}</DialogTitle><DialogContent>{action === 'reject' && <TextField autoFocus fullWidth multiline minRows={3} label="Alasan penolakan" value={reason} onChange={(e) => setReason(e.target.value)} />}</DialogContent><DialogActions><Button onClick={() => setAction('')}>Batal</Button><Button variant="contained" color={action === 'reject' ? 'error' : 'primary'} disabled={action === 'reject' && !reason.trim()} onClick={bulk}>Konfirmasi</Button></DialogActions></Dialog>
    </div>;
}

export function SignatureRequestDetail() {
    const { id } = useParams(); const { role } = useUser(); const [item, setItem] = useState(null); const [error, setError] = useState('');
    const load = async () => { try { const response = payloadOf(await arsipApi.signatureRequestDetail(id)); setItem(response.request ?? response); } catch (err) { setError((await formatArsipError(err)).message); } };
    useEffect(() => { load(); }, [id]);
    const files = item?.files ?? []; const allSigned = files.length > 0 && files.every((file) => file.signed_at && file.result_sha256);
    if (!item) return <>{error ? <Alert severity="error">{error}</Alert> : <p>Memuat...</p>}</>;
    return <div><PageHeader title={item.title} subtitle={item.description || 'Detail request tanda tangan'} actions={<Status value={item.status} role={role} />} />{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Paper variant="outlined" className="p-4 mb-4"><p><b>{role === 'dosen' ? 'Mahasiswa' : 'Dosen'}:</b> {role === 'dosen' ? item.student_name || '-' : item.lecturer_name || '-'}</p>{item.rejection_reason && <p className="mt-2 text-red-700"><b>Alasan:</b> {item.rejection_reason}</p>}</Paper><div className="space-y-3">{files.map((file) => <Paper key={fileIdOf(file)} variant="outlined" className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3"><div><p className="font-semibold">{nameOf(file)}</p><p className="text-xs text-zinc-500">{file.size_mb ? `${file.size_mb} MB · ` : ''}{file.signed_at && file.result_sha256 ? 'Sudah ditandatangani' : 'Belum ditandatangani'}</p></div><div className="flex gap-2">{role === 'dosen' && item.status === 'draft' && <Button component={Link} to={`/home/request-tanda-tangan/${id}/tanda-tangan/${fileIdOf(file)}`} startIcon={<DrawOutlined />}>{file.signed_at && file.result_sha256 ? 'Tanda tangani ulang' : 'Tanda tangani'}</Button>}<Button startIcon={<DownloadOutlined />} onClick={() => arsipApi.downloadSignatureRequestSource(file)}>Download Sumber</Button>{(file.signed_result || role === 'mahasiswa' && item.status === 'completed') && <Button startIcon={<DownloadOutlined />} onClick={() => arsipApi.downloadSignatureRequestResult(file)}>Download Hasil</Button>}</div></Paper>)}</div>{role === 'dosen' && item.status === 'draft' && <Button variant="contained" sx={{ mt: 3 }} disabled={!allSigned} onClick={async () => { try { await arsipApi.sendSignatureRequest(id); await load(); } catch (err) { setError((await formatArsipError(err)).message); } }}>Kirim Semua</Button>}</div>;
}

export default function SignatureRequests() { const { role } = useUser(); return role === 'dosen' ? <LecturerRequests /> : <StudentRequests />; }
