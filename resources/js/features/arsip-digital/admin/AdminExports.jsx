import { useEffect, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { bytes, dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import { EXPORT_JOB_TERMINAL, usePollingJob } from '../hooks/usePollingJob';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyForm = { target_role: '', status: '', date_from: '', date_to: '' };

function unwrapList(response) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : payload.export_jobs ?? payload.jobs ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function unwrapJob(response) {
    const payload = response?.data ?? response ?? {};
    return payload.export_job ?? payload.job ?? payload;
}

function jobId(job) {
    return job.export_job_id ?? job.id;
}

export default function AdminExports() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ search: '', status: '' });
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const activeJobId = selectedJob ? jobId(selectedJob) : null;

    const loadJobs = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.exportJobs({ ...filters, per_page: 50 });
            const unwrapped = unwrapList(response);
            setRows(unwrapped.data);
            setMeta(unwrapped.meta);
            if (activeJobId) setSelectedJob(unwrapped.data.find((item) => jobId(item) === activeJobId) || selectedJob);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setLoading(false);
        }
    };

    usePollingJob({
        enabled: Boolean(activeJobId && !EXPORT_JOB_TERMINAL.includes(selectedJob?.status)),
        jobId: activeJobId,
        pollFn: arsipApi.exportJob,
        intervalMs: 4000,
        terminalStatuses: EXPORT_JOB_TERMINAL,
        maxDurationMs: 180000,
        onUpdate: (response) => setSelectedJob(unwrapJob(response)),
        onTerminal: ({ timeout, data }) => {
            if (timeout) setError('Export job masih diproses lebih lama dari biasanya. Refresh untuk cek status terbaru.');
            if (data) setSelectedJob(data);
            loadJobs();
        },
    });

    useEffect(() => {
        loadJobs();
    }, []);

    const createJob = async () => {
        setSaving(true);
        try {
            const payload = {};
            if (form.target_role) payload.target_role = form.target_role;
            if (form.status) payload.status = form.status;
            const filtersPayload = {};
            if (form.date_from) filtersPayload.date_from = form.date_from;
            if (form.date_to) filtersPayload.date_to = form.date_to;
            if (Object.keys(filtersPayload).length) payload.filters = filtersPayload;
            const response = await arsipApi.createExportJob(payload);
            const job = unwrapJob(response);
            setSelectedJob(job);
            setDialogOpen(false);
            setForm(emptyForm);
            customSwal.toast.success({ message: 'Export job dibuat.' });
            await loadJobs();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const refreshSelected = async (job = selectedJob) => {
        if (!job) return;
        try {
            const response = await arsipApi.exportJob(jobId(job));
            setSelectedJob(unwrapJob(response));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const download = async (job) => {
        try {
            await arsipApi.downloadExportJob(job);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const columns = [
        { field: 'export_job_id', headerName: 'Job', width: 110, valueGetter: (value, row) => jobId(row) },
        { field: 'status', headerName: 'Status', width: 140, renderCell: (params) => <StatusChip status={params.row.status} /> },
        { field: 'target_role', headerName: 'Target', width: 140, valueGetter: (value, row) => row.target_role || row.filters?.target_role || '-' },
        { field: 'file_size_bytes', headerName: 'Ukuran', width: 120, renderCell: (params) => bytes(params.row.file_size_bytes ?? params.row.size) },
        { field: 'created_at', headerName: 'Dibuat', width: 170, renderCell: (params) => dateTime(params.row.created_at) },
        { field: 'completed_at', headerName: 'Selesai', width: 170, renderCell: (params) => dateTime(params.row.completed_at) },
        { field: 'actions', headerName: 'Aksi', width: 260, sortable: false, renderCell: (params) => <div className="flex gap-1 flex-wrap"><Button size="small" onClick={() => setSelectedJob(params.row)} sx={buttonSx}>Pantau</Button><Button size="small" onClick={() => refreshSelected(params.row)} sx={buttonSx}>Refresh</Button><Button size="small" disabled={params.row.status !== 'completed'} onClick={() => download(params.row)} sx={buttonSx}><DownloadOutlined sx={{ fontSize: 16 }} /></Button></div> },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader title="Export ZIP" subtitle="Buat job export, pantau status queue, dan download ZIP saat selesai." actions={<><Button variant="outlined" startIcon={<RefreshOutlined />} onClick={loadJobs} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button><Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialogOpen(true)} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Buat Export</Button></>} />
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3"><TextField size="small" label="Cari" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} sx={{ minWidth: 220 }} /><TextField size="small" select label="Status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} sx={{ minWidth: 160 }}><MenuItem value="">Semua</MenuItem><MenuItem value="queued">Queued</MenuItem><MenuItem value="processing">Processing</MenuItem><MenuItem value="completed">Completed</MenuItem><MenuItem value="failed">Failed</MenuItem><MenuItem value="cancelled">Cancelled</MenuItem></TextField><Button variant="contained" startIcon={<SearchOutlined />} onClick={loadJobs} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button></section>
            {selectedJob && <Alert severity={selectedJob.status === 'completed' ? 'success' : 'info'} sx={{ mb: 2, borderRadius: '0.5rem' }}>Job #{activeJobId} · {selectedJob.status}{selectedJob.error_message ? ` · ${selectedJob.error_message}` : ''}</Alert>}
            {!meta && rows.length > 0 && <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Backend pagination export belum tersedia. Data dipaginasi di browser.</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200"><CustomDataTable rows={rows} columns={columns} loading={loading} getRowId={(row) => jobId(row)} pageSize={25} pageSizeOptions={[25, 50]} /></section>
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm"><DialogTitle className="!font-jakarta">Buat Export Job</DialogTitle><DialogContent dividers className="space-y-3"><Alert severity="info" sx={{ borderRadius: '0.5rem' }}>Payload dibuat minimal agar aman terhadap backend: target role, status, dan range tanggal opsional.</Alert><TextField fullWidth size="small" select label="Target role" value={form.target_role} onChange={(event) => setForm((prev) => ({ ...prev, target_role: event.target.value }))}><MenuItem value="">Tidak dipilih</MenuItem><MenuItem value="mahasiswa">Mahasiswa</MenuItem><MenuItem value="dosen">Dosen</MenuItem></TextField><TextField fullWidth size="small" select label="Status" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}><MenuItem value="">Tidak dipilih</MenuItem><MenuItem value="approved">Approved</MenuItem><MenuItem value="available">Available</MenuItem><MenuItem value="file_uploaded">File uploaded</MenuItem></TextField><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><TextField size="small" type="date" label="Dari" value={form.date_from} onChange={(event) => setForm((prev) => ({ ...prev, date_from: event.target.value }))} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label="Sampai" value={form.date_to} onChange={(event) => setForm((prev) => ({ ...prev, date_to: event.target.value }))} InputLabelProps={{ shrink: true }} /></div></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)} sx={buttonSx}>Batal</Button><Button variant="contained" disabled={saving} onClick={createJob} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Buat Job</Button></DialogActions></Dialog>
        </div>
    );
}
