import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { bytes, dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import TargetPicker from '../components/TargetPicker';
import { BULK_ZIP_TERMINAL, usePollingJob } from '../hooks/usePollingJob';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyForm = { title: '', description: '' };

function unwrapList(response, keys) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : keys.map((key) => payload[key]).find(Array.isArray) ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function unwrapOne(response, keys) {
    const payload = response?.data ?? response ?? {};
    for (const key of keys) if (payload[key]) return payload[key];
    return payload;
}

function distributionId(row) {
    return row.distribution_id ?? row.id;
}

function recipientId(row) {
    return row.recipient_id ?? row.distribution_recipient_id ?? row.id;
}

function jobId(row) {
    return row.bulk_upload_job_id ?? row.id;
}

function fileOf(row) {
    return row.file ?? row.distribution_file ?? row.current_file ?? null;
}

function distributionFileId(file) {
    return file?.file_id ?? file?.id ?? file?.distribution_file_id;
}

function canSubmitTarget(payload) {
    if (!payload?.target_role || !payload?.scope_type) return false;
    if (payload.scope_type === 'specific') return (payload.target_identifiers || []).length > 0;
    return true;
}

async function confirmAction(title, text, confirmButtonText = 'Ya') {
    const result = await Swal.fire({ title, text, icon: 'question', showCancelButton: true, confirmButtonText, cancelButtonText: 'Batal' });
    return result.isConfirmed;
}

function normalizeTarget(row) {
    if (!row) return null;
    return { target_role: row.target_role || 'mahasiswa', scope_type: row.scope_type || 'filter', target_filters: row.target_filters || {}, target_identifiers: row.target_identifiers || [] };
}

function entryStatus(entry) {
    return entry.match_status ?? entry.status ?? '-';
}

function summaryCount(job, ...keys) {
    const summary = job?.summary || job?.preview_summary || {};
    for (const key of keys) {
        const value = Number(summary[key] ?? job?.[key] ?? 0);
        if (value > 0) return value;
    }
    return 0;
}

export default function AdminDistributions() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [draftFilters, setDraftFilters] = useState({ search: '', status: '', target_role: '' });
    const [appliedFilters, setAppliedFilters] = useState({ search: '', status: '', target_role: '', page: 1, per_page: 25 });
    const distributionRequestRef = useRef(0);
    const appliedFiltersRef = useRef(appliedFilters);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const targetPayloadRef = useRef(null);
    const [targetPickerSession, setTargetPickerSession] = useState(0);
    const [targetInitialValue, setTargetInitialValue] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selected, setSelected] = useState(null);
    const [recipients, setRecipients] = useState([]);
    const [recipientsMeta, setRecipientsMeta] = useState(null);
    const [recipientsPagination, setRecipientsPagination] = useState({ page: 0, pageSize: 50 });
    const [recipientsLoading, setRecipientsLoading] = useState(false);
    const [jobs, setJobs] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkJob, setBulkJob] = useState(null);
    const [bulkError, setBulkError] = useState('');
    const [bulkUploading, setBulkUploading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const selectedId = selected ? distributionId(selected) : null;
    const activeJobId = bulkJob ? jobId(bulkJob) : null;

    const loadDistributions = async (nextFilters = appliedFiltersRef.current) => {
        const requestSequence = ++distributionRequestRef.current;
        appliedFiltersRef.current = nextFilters;
        setAppliedFilters(nextFilters);
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.distributions(nextFilters);
            if (requestSequence !== distributionRequestRef.current) return;
            const unwrapped = unwrapList(response, ['distributions']);
            setRows(unwrapped.data);
            setMeta(unwrapped.meta);
            if (selectedId) setSelected(unwrapped.data.find((item) => distributionId(item) === selectedId) || selected);
        } catch (err) {
            if (requestSequence !== distributionRequestRef.current) return;
            const formatted = await formatArsipError(err);
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            if (requestSequence === distributionRequestRef.current) setLoading(false);
        }
    };

    const loadRecipients = async (distribution = selected, pagination = recipientsPagination) => {
        if (!distribution) return;
        setRecipientsLoading(true);
        try {
            const response = await arsipApi.distributionRecipients(distributionId(distribution), { page: pagination.page + 1, per_page: pagination.pageSize });
            const unwrapped = unwrapList(response, ['recipients']);
            setRecipients(unwrapped.data);
            setRecipientsMeta(unwrapped.meta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setRecipientsLoading(false);
        }
    };

    const loadJobs = async (distribution = selected) => {
        if (!distribution) return;
        setJobsLoading(true);
        setBulkError('');
        try {
            const response = await arsipApi.distributionBulkUploadJobs(distributionId(distribution), { per_page: 10 });
            const unwrapped = unwrapList(response, ['bulk_upload_jobs', 'jobs']);
            setJobs(unwrapped.data);
            const latest = unwrapped.data[0] || null;
            setBulkJob(latest);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setBulkError(formatted.message);
        } finally {
            setJobsLoading(false);
        }
    };

    usePollingJob({
        enabled: Boolean(activeJobId && !BULK_ZIP_TERMINAL.includes(bulkJob?.status)),
        jobId: activeJobId,
        pollFn: arsipApi.distributionBulkUploadJob,
        intervalMs: 4000,
        terminalStatuses: BULK_ZIP_TERMINAL,
        maxDurationMs: 180000,
        onUpdate: (response) => setBulkJob(unwrapOne(response, ['bulk_upload_job', 'job'])),
        onTimeoutWarning: () => {
            setBulkError('Preview ZIP masih diproses lebih lama dari biasanya. Polling tetap berjalan sampai status final.');
        },
        onTerminal: ({ data }) => {
            if (data) setBulkJob(data);
        },
    });

    useEffect(() => {
        loadDistributions();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        targetPayloadRef.current = null;
        setTargetInitialValue(null);
        setTargetPickerSession((session) => session + 1);
        setPreview(null);
        setDialogOpen(true);
    };

    const openEdit = (row) => {
        setEditing(row);
        setForm({ title: row.title || '', description: row.description || '' });
        const target = normalizeTarget(row);
        targetPayloadRef.current = target;
        setTargetInitialValue(target);
        setTargetPickerSession((session) => session + 1);
        setPreview(null);
        setDialogOpen(true);
    };

    const handleTargetChange = useCallback((payload) => {
        targetPayloadRef.current = payload;
    }, []);

    const buildPayload = () => ({ title: form.title, description: form.description || null, ...targetPayloadRef.current });

    const previewTargets = async () => {
        if (!canSubmitTarget(targetPayloadRef.current)) {
            customSwal.toast.error({ message: 'Pilih target penerima terlebih dahulu.' });
            return;
        }
        setPreviewLoading(true);
        try {
            const response = await arsipApi.previewDistributionTargets(buildPayload());
            setPreview(unwrapOne(response, ['preview']));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setPreviewLoading(false);
        }
    };

    const saveDistribution = async () => {
        if (!form.title.trim()) {
            customSwal.toast.error({ message: 'Judul wajib diisi.' });
            return;
        }
        if (!canSubmitTarget(targetPayloadRef.current)) {
            customSwal.toast.error({ message: 'Pilih target penerima terlebih dahulu.' });
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await arsipApi.updateDistribution(distributionId(editing), buildPayload());
                customSwal.toast.success({ message: 'Draft distribusi diperbarui.' });
            } else {
                await arsipApi.createDistribution(buildPayload());
                customSwal.toast.success({ message: 'Draft distribusi dibuat.' });
            }
            setDialogOpen(false);
            await loadDistributions();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const publish = async (row) => {
        if (!(await confirmAction('Publish distribusi?', 'Daftar penerima akan dibuat dan file bisa diupload.', 'Publish'))) return;
        try {
            await arsipApi.publishDistribution(distributionId(row));
            customSwal.toast.success({ message: 'Distribusi dipublish.' });
            await loadDistributions();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const remove = async (row) => {
        if (!(await confirmAction('Hapus distribusi?', 'Distribusi akan dihapus permanen.', 'Hapus'))) return;
        try {
            await arsipApi.deleteDistribution(distributionId(row));
            customSwal.toast.success({ message: 'Distribusi dihapus.' });
            if (distributionId(row) === selectedId) setSelected(null);
            await loadDistributions();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const selectDistribution = async (row) => {
        const firstPage = { page: 0, pageSize: recipientsPagination.pageSize };
        setSelected(row);
        setRecipients([]);
        setRecipientsPagination(firstPage);
        setJobs([]);
        setBulkJob(null);
        setBulkFile(null);
        await Promise.all([loadRecipients(row, firstPage), loadJobs(row)]);
    };

    const handleRecipientsPaginationChange = (model) => {
        setRecipientsPagination(model);
        loadRecipients(selected, model);
    };

    const applyDistributionFilters = () => {
        loadDistributions({ ...draftFilters, page: 1, per_page: appliedFilters.per_page });
    };

    const handleDistributionPaginationChange = (model) => {
        loadDistributions({ ...appliedFiltersRef.current, page: model.page + 1, per_page: model.pageSize });
    };

    const uploadRecipient = async (recipient, file) => {
        if (!file) return;
        setActionLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            await arsipApi.uploadRecipientFile(recipientId(recipient), formData);
            customSwal.toast.success({ message: 'File penerima berhasil diupload.' });
            await loadRecipients();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const downloadRecipientFile = async (recipient) => {
        const file = fileOf(recipient);
        if (!distributionFileId(file)) return;
        try {
            await arsipApi.downloadDistributionFile(file);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const uploadBulkZip = async () => {
        if (!selectedId || !bulkFile) return;
        setBulkUploading(true);
        setBulkError('');
        try {
            const formData = new FormData();
            formData.append('zip_file', bulkFile);
            const response = await arsipApi.createDistributionBulkUploadJob(selectedId, formData);
            const job = unwrapOne(response, ['bulk_upload_job', 'job']);
            setBulkJob(job);
            setBulkFile(null);
            customSwal.toast.success({ message: 'Bulk ZIP dibuat. Menunggu preview matching.' });
            await loadJobs();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setBulkError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setBulkUploading(false);
        }
    };

    const confirmBulk = async () => {
        if (!bulkJob || bulkJob.status !== 'preview_ready' || bulkJob.confirmable === false) return;
        if (!(await confirmAction('Konfirmasi simpan file cocok?', 'Unmatched, duplicate, dan invalid tidak ikut disimpan.', 'Konfirmasi'))) return;
        setActionLoading(true);
        try {
            const response = await arsipApi.confirmDistributionBulkUploadJob(activeJobId);
            setBulkJob(unwrapOne(response, ['bulk_upload_job', 'job']));
            setBulkFile(null);
            customSwal.toast.success({ message: 'Bulk ZIP dikonfirmasi.' });
            await Promise.all([loadRecipients(), loadJobs()]);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setBulkError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const cancelBulk = async () => {
        if (!bulkJob || !(await confirmAction('Batalkan bulk ZIP?', 'Preview tidak dapat dikonfirmasi setelah dibatalkan.', 'Batalkan'))) return;
        setActionLoading(true);
        try {
            const response = await arsipApi.cancelDistributionBulkUploadJob(activeJobId);
            setBulkJob(unwrapOne(response, ['bulk_upload_job', 'job']));
            setBulkFile(null);
            customSwal.toast.success({ message: 'Bulk ZIP dibatalkan.' });
            await loadJobs();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setBulkError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const refreshBulkJob = async () => {
        if (!activeJobId) return;
        try {
            const response = await arsipApi.distributionBulkUploadJob(activeJobId);
            setBulkJob(unwrapOne(response, ['bulk_upload_job', 'job']));
            setBulkError('');
        } catch (err) {
            const formatted = await formatArsipError(err);
            setBulkError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const columns = [
        { field: 'title', headerName: 'Judul', flex: 1, minWidth: 220, renderCell: (params) => <button type="button" className="text-blue-600 font-semibold hover:underline text-left" onClick={() => selectDistribution(params.row)}>{params.row.title || '-'}</button> },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => <StatusChip status={params.row.status} /> },
        { field: 'target_role', headerName: 'Target', width: 150, renderCell: (params) => `${params.row.target_role || '-'} · ${params.row.scope_type || '-'}` },
        { field: 'recipients_count', headerName: 'Penerima', width: 120, valueGetter: (value, row) => row.recipients_count ?? row.total_recipients ?? '-' },
        { field: 'published_at', headerName: 'Published', width: 170, renderCell: (params) => dateTime(params.row.published_at) },
        { field: 'actions', headerName: 'Aksi', width: 330, sortable: false, renderCell: (params) => <div className="flex gap-1 flex-wrap"><Button size="small" onClick={() => selectDistribution(params.row)} sx={buttonSx}>Detail</Button>{params.row.status === 'draft' && <Button size="small" onClick={() => openEdit(params.row)} sx={buttonSx}>Edit</Button>}{params.row.status === 'draft' && <Button size="small" onClick={() => publish(params.row)} sx={buttonSx}>Publish</Button>}<Button size="small" color="error" onClick={() => remove(params.row)} sx={buttonSx}>Hapus</Button></div> },
    ];

    const recipientColumns = [
        { field: 'identifier', headerName: 'Identifier', width: 150, valueGetter: (value, row) => row.identifier || '-' },
        { field: 'name_snapshot', headerName: 'Nama', flex: 1, minWidth: 190, valueGetter: (value, row) => row.name_snapshot || row.name || '-' },
        { field: 'delivery_status', headerName: 'Status', width: 140, renderCell: (params) => <StatusChip status={params.row.delivery_status || params.row.status || 'pending'} /> },
        { field: 'file', headerName: 'File', width: 220, renderCell: (params) => fileOf(params.row)?.display_filename || fileOf(params.row)?.original_filename || '-' },
        { field: 'uploaded_at', headerName: 'Uploaded', width: 170, renderCell: (params) => dateTime(params.row.uploaded_at || fileOf(params.row)?.created_at) },
        { field: 'actions', headerName: 'Aksi', width: 260, sortable: false, renderCell: (params) => <div className="flex gap-1 flex-wrap"><Button component="label" size="small" variant="outlined" disabled={actionLoading} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Upload<input type="file" hidden onChange={(event) => uploadRecipient(params.row, event.target.files?.[0] || null)} /></Button><Button size="small" disabled={!distributionFileId(fileOf(params.row))} onClick={() => downloadRecipientFile(params.row)} sx={buttonSx}><DownloadOutlined sx={{ fontSize: 16 }} /></Button></div> },
    ];

    const jobColumns = [
        { field: 'bulk_upload_job_id', headerName: 'Job', width: 100, valueGetter: (value, row) => jobId(row) },
        { field: 'status', headerName: 'Status', width: 140, renderCell: (params) => <StatusChip status={params.row.status} /> },
        { field: 'original_filename', headerName: 'ZIP', flex: 1, minWidth: 180, valueGetter: (value, row) => row.original_filename || row.filename || '-' },
        { field: 'created_at', headerName: 'Dibuat', width: 170, renderCell: (params) => dateTime(params.row.created_at) },
        { field: 'actions', headerName: 'Aksi', width: 110, renderCell: (params) => <Button size="small" onClick={() => setBulkJob(params.row)} sx={buttonSx}>Lihat</Button> },
    ];

    const entryRows = bulkJob?.entries || bulkJob?.preview_entries || [];
    const canConfirm = bulkJob?.status === 'preview_ready' && bulkJob?.confirmable !== false;

    return (
        <div className="font-jakarta">
            <PageHeader title="Distribusi Berkas" subtitle="Kelola distribusi, penerima, upload file, dan bulk ZIP." actions={<><Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => loadDistributions()} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button><Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Buat Distribusi</Button></>} />
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3"><TextField size="small" label="Cari" value={draftFilters.search} onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))} sx={{ minWidth: 220 }} /><TextField size="small" select label="Status" value={draftFilters.status} onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))} sx={{ minWidth: 150 }}><MenuItem value="">Semua</MenuItem><MenuItem value="draft">Draft</MenuItem><MenuItem value="published">Published</MenuItem><MenuItem value="archived">Archived</MenuItem></TextField><TextField size="small" select label="Target" value={draftFilters.target_role} onChange={(event) => setDraftFilters((prev) => ({ ...prev, target_role: event.target.value }))} sx={{ minWidth: 150 }}><MenuItem value="">Semua</MenuItem><MenuItem value="mahasiswa">Mahasiswa</MenuItem><MenuItem value="dosen">Dosen</MenuItem></TextField><Button variant="contained" startIcon={<SearchOutlined />} onClick={applyDistributionFilters} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button></section>
            <section className="bg-white rounded-lg border border-zinc-200 mb-4"><CustomDataTable rows={rows} columns={columns} loading={loading} getRowId={(row) => distributionId(row)} pageSize={appliedFilters.per_page} pageSizeOptions={[25, 50, 100]} paginationMode="server" rowCount={meta?.total ?? rows.length} paginationModel={{ page: (meta?.current_page ?? 1) - 1, pageSize: meta?.per_page ?? appliedFilters.per_page }} onPaginationModelChange={handleDistributionPaginationChange} /></section>
            {selected && <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4"><div className="flex items-center justify-between gap-3 flex-wrap mb-3"><div><h2 className="text-sm font-semibold text-zinc-800">Penerima Distribusi</h2><p className="text-xs text-zinc-500">{selected.title} · {selected.status}</p></div><Button variant="outlined" onClick={() => Promise.all([loadRecipients(), loadJobs()])} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh Detail</Button></div><CustomDataTable rows={recipients} columns={recipientColumns} loading={recipientsLoading} getRowId={(row) => recipientId(row)} pageSize={50} pageSizeOptions={[25, 50, 100]} paginationMode={recipientsMeta ? 'server' : 'client'} rowCount={recipientsMeta?.total ?? recipients.length} paginationModel={recipientsPagination} onPaginationModelChange={handleRecipientsPaginationChange} /></section>}
            {selected && <section className="bg-white rounded-lg border border-zinc-200 p-4"><div className="mb-3"><h2 className="text-sm font-semibold text-zinc-800">Bulk Upload ZIP</h2><p className="text-xs text-zinc-500 mt-1">Upload ZIP berisi file personal. Backend mencocokkan nama file ke identifier penerima dan menampilkan preview. File unmatched, duplicate, dan invalid tidak ikut disimpan saat konfirmasi.</p></div>{bulkError && <Alert severity="warning" sx={{ mb: 2, borderRadius: '0.5rem' }}>{bulkError}</Alert>}<div className="flex flex-wrap gap-2 mb-3"><Button component="label" variant="outlined" startIcon={<CloudUploadOutlined />} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>{bulkFile ? `${bulkFile.name} · ${bytes(bulkFile.size)}` : 'Pilih ZIP'}<input type="file" hidden accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => setBulkFile(event.target.files?.[0] || null)} /></Button><Button variant="contained" disabled={bulkUploading || !bulkFile} onClick={uploadBulkZip} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>{bulkUploading ? 'Mengunggah...' : 'Upload ZIP & Preview'}</Button><Button variant="outlined" disabled={!bulkJob} onClick={refreshBulkJob} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh Job</Button><Button variant="contained" disabled={!canConfirm || actionLoading} onClick={confirmBulk} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Konfirmasi</Button><Button color="error" disabled={!bulkJob || BULK_ZIP_TERMINAL.includes(bulkJob.status) || actionLoading} onClick={cancelBulk} sx={buttonSx}>Batalkan</Button></div><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">{[['Matched', summaryCount(bulkJob, 'matched_entries', 'matched')], ['Unmatched', summaryCount(bulkJob, 'unmatched_entries', 'unmatched')], ['Duplicate', summaryCount(bulkJob, 'duplicate_entries', 'duplicate')], ['Invalid', summaryCount(bulkJob, 'invalid_entries', 'invalid')], ['Replace', summaryCount(bulkJob, 'will_replace_entries', 'will_replace')]].map(([label, value]) => <div key={label} className="rounded-lg bg-zinc-50 border border-zinc-200 p-3"><span className="text-xs text-zinc-500">{label}</span><strong className="block text-lg text-zinc-800">{value}</strong></div>)}</div>{bulkJob && <Alert severity={bulkJob.status === 'preview_ready' ? 'success' : 'info'} sx={{ mb: 2, borderRadius: '0.5rem' }}>Job #{activeJobId} · {bulkJob.status}. Konfirmasi aktif hanya saat preview_ready dan backend mengizinkan.</Alert>}<CustomDataTable rows={entryRows} columns={[{ field: 'original_filename', headerName: 'File', flex: 1, minWidth: 220, valueGetter: (value, row) => row.original_filename || row.display_filename || row.entry_path || '-' }, { field: 'identifier', headerName: 'Identifier', width: 150, valueGetter: (value, row) => row.identifier || row.parsed_identifier || '-' }, { field: 'recipient', headerName: 'Penerima', width: 200, renderCell: (params) => params.row.recipient?.identifier || params.row.recipient?.name_snapshot || '-' }, { field: 'status', headerName: 'Status', width: 140, renderCell: (params) => <StatusChip status={entryStatus(params.row)} /> }, { field: 'reason', headerName: 'Catatan', flex: 1, minWidth: 220, valueGetter: (value, row) => row.match_reason || row.reason || '-' }]} loading={jobsLoading} getRowId={(row) => row.bulk_upload_entry_id ?? row.id ?? row.entry_path ?? row.original_filename} pageSize={25} pageSizeOptions={[25, 50]} /><div className="mt-4"><h3 className="text-xs font-semibold text-zinc-600 mb-2">Riwayat Job</h3><CustomDataTable rows={jobs} columns={jobColumns} loading={jobsLoading} getRowId={(row) => jobId(row)} pageSize={10} pageSizeOptions={[10]} /></div></section>}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="lg"><DialogTitle className="!font-jakarta">{editing ? 'Edit Draft Distribusi' : 'Buat Distribusi'}</DialogTitle><DialogContent dividers className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><TextField size="small" label="Judul" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} required /><TextField className="md:col-span-2" size="small" multiline minRows={3} label="Deskripsi" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div><TargetPicker key={targetPickerSession} value={targetInitialValue} onChange={handleTargetChange} initialRole={targetInitialValue?.target_role || 'mahasiswa'} /><div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex items-center justify-between gap-3 flex-wrap"><div className="text-xs text-zinc-600"><strong>Preview target</strong><p>{preview ? `${preview.total_valid ?? 0} valid · ${preview.total_invalid ?? 0} invalid · ${preview.total_targets ?? 0} total` : 'Belum divalidasi.'}</p></div><Button variant="outlined" disabled={previewLoading} onClick={previewTargets} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>{previewLoading ? 'Memvalidasi...' : 'Preview Target'}</Button></div></DialogContent><DialogActions><Button onClick={() => setDialogOpen(false)} sx={buttonSx}>Batal</Button><Button variant="contained" disabled={saving} onClick={saveDistribution} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Simpan Draft</Button></DialogActions></Dialog>
        </div>
    );
}
