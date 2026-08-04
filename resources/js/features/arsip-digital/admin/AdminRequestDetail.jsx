import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { bytes, dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import { confirmAction, promptText } from '../../../services/dialogs';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import CustomLoading from '../../../components/CustomLoading';
import TargetPicker from '../components/TargetPicker';
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
} from '@mui/material';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';

const buttonSx = {
    borderRadius: '0.5rem',
    textTransform: 'none',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
};

const panelClass = 'bg-white rounded-lg border border-zinc-200 p-4';

function unwrapRequest(response) {
    const data = response?.data ?? response ?? {};
    return {
        request: data.request ?? data,
        progress: data.progress ?? {},
        assignments: data.assignments ?? data.request?.assignments ?? [],
    };
}

function unwrapProgress(response) {
    const data = response?.data ?? response ?? {};
    return data.progress ?? data;
}

function unwrapAssignments(response) {
    const data = response?.data ?? response ?? {};
    const list = Array.isArray(data) ? data : data.assignments ?? data.data ?? [];
    return {
        data: Array.isArray(list) ? list : [],
        meta: data.meta ?? data.pagination ?? response?.meta ?? null,
    };
}

function unwrapPreview(response) {
    const data = response?.data ?? response ?? {};
    return data.preview ?? data;
}

function requestId(request) {
    return request?.request_id ?? request?.id;
}

function assignmentId(assignment) {
    return assignment.assignment_id ?? assignment.id;
}

function currentFiles(assignment) {
    return (assignment?.request_files || assignment?.files || []).filter((item) => item.is_current !== false);
}

function isVerifiable(assignment) {
    return assignment?.status === 'waiting_verification';
}

function fileName(requestFile) {
    const file = requestFile?.file || requestFile;
    return file?.display_filename || file?.original_filename || file?.filename || `File #${requestFile?.request_file_id || file?.file_id || '-'}`;
}

function fileSize(requestFile) {
    const file = requestFile?.file || requestFile;
    return file?.file_size_bytes ?? file?.file_size ?? file?.size;
}

function progressValue(progress, keys) {
    for (const key of keys) {
        if (progress?.[key] !== undefined && progress?.[key] !== null) return progress[key];
    }
    return 0;
}

const promptReason = (title, text) => promptText({ title, text, inputLabel: 'Alasan penolakan', placeholder: 'Tulis alasan agar pengguna tahu yang perlu diperbaiki.', confirmText: 'Reject' });

export default function AdminRequestDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [request, setRequest] = useState(null);
    const [progress, setProgress] = useState({});
    const [assignments, setAssignments] = useState([]);
    const [assignmentsMeta, setAssignmentsMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [assignmentsLoading, setAssignmentsLoading] = useState(false);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ search: '', status: '', late: '' });
    const [assignmentPagination, setAssignmentPagination] = useState({ page: 0, pageSize: 50 });
    const [selectedIds, setSelectedIds] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [appendOpen, setAppendOpen] = useState(false);
    const [appendPayload, setAppendPayload] = useState(null);
    const [appendPreview, setAppendPreview] = useState(null);
    const [appendPickerSession, setAppendPickerSession] = useState(0);
    const [appendLoading, setAppendLoading] = useState(false);

    const filteredAssignments = assignments;

    const selectedPageAssignments = useMemo(
        () => filteredAssignments.filter((assignment) => selectedIds.includes(assignmentId(assignment))),
        [filteredAssignments, selectedIds],
    );

    const approvableSelectedIds = useMemo(
        () => selectedPageAssignments.filter((assignment) => isVerifiable(assignment) && currentFiles(assignment).length > 0).map(assignmentId),
        [selectedPageAssignments],
    );

    const rejectableSelectedIds = useMemo(
        () => selectedPageAssignments.filter(isVerifiable).map(assignmentId),
        [selectedPageAssignments],
    );

    const selectableAssignments = filteredAssignments.filter(isVerifiable);
    const allPageSelected = selectableAssignments.length > 0 && selectableAssignments.every((assignment) => selectedIds.includes(assignmentId(assignment)));

    const loadDetail = async () => {
        setLoading(true);
        setError('');
        try {
            const [detailResponse, progressResponse] = await Promise.all([
                arsipApi.requestDetail(id),
                arsipApi.requestProgress(id),
            ]);
            const detail = unwrapRequest(detailResponse);
            setRequest(detail.request);
            setProgress({ ...detail.progress, ...unwrapProgress(progressResponse) });
            if (detail.assignments.length && !assignments.length) setAssignments(detail.assignments);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setLoading(false);
        }
    };

    const loadAssignments = async (pagination = assignmentPagination) => {
        setAssignmentsLoading(true);
        try {
            const response = await arsipApi.requestAssignments(id, {
                search: filters.search,
                status: filters.status,
                is_late: filters.late === '' ? undefined : filters.late === 'late',
                page: pagination.page + 1,
                per_page: pagination.pageSize,
            });
            const unwrapped = unwrapAssignments(response);
            setAssignments(unwrapped.data);
            setAssignmentsMeta(unwrapped.meta);
            setSelectedIds([]);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setAssignmentsLoading(false);
        }
    };

    const refreshAll = async () => {
        await Promise.all([loadDetail(), loadAssignments()]);
    };

    useEffect(() => {
        refreshAll();
    }, [id]);

    const applyAssignmentFilters = () => {
        const firstPage = { ...assignmentPagination, page: 0 };
        setAssignmentPagination(firstPage);
        loadAssignments(firstPage);
    };

    const handleAssignmentPaginationChange = (model) => {
        setAssignmentPagination(model);
        loadAssignments(model);
    };

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const runLifecycle = async (action, title, text, success) => {
        if (!request || !(await confirmAction({ title, text }))) return;
        setActionLoading(true);
        try {
            await action(requestId(request));
            customSwal.toast.success({ message: success });
            await refreshAll();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const approve = async (assignment) => {
        if (!isVerifiable(assignment) || currentFiles(assignment).length < 1) return;
        if (!(await confirmAction({ title: 'Approve assignment?', text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`, confirmText: 'Approve' }))) return;
        setActionLoading(true);
        try {
            await arsipApi.approveAssignment(assignmentId(assignment));
            customSwal.toast.success({ message: 'Assignment disetujui.' });
            await refreshAll();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const reject = async (assignment) => {
        if (!isVerifiable(assignment)) return;
        const reason = await promptReason('Reject assignment?', `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`);
        if (!reason) return;
        setActionLoading(true);
        try {
            await arsipApi.rejectAssignment(assignmentId(assignment), reason);
            customSwal.toast.success({ message: 'Assignment ditolak.' });
            await refreshAll();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const bulkApprove = async () => {
        if (!approvableSelectedIds.length) return;
        if (!(await confirmAction({ title: 'Bulk approve assignment?', text: `${approvableSelectedIds.length} assignment di halaman ini akan disetujui.`, confirmText: 'Bulk approve' }))) return;
        setActionLoading(true);
        try {
            await arsipApi.bulkApproveAssignments(approvableSelectedIds);
            customSwal.toast.success({ message: 'Bulk approve selesai.' });
            await refreshAll();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const bulkReject = async () => {
        if (!rejectableSelectedIds.length) return;
        const reason = await promptReason('Bulk reject assignment?', `${rejectableSelectedIds.length} assignment di halaman ini akan ditolak.`);
        if (!reason) return;
        setActionLoading(true);
        try {
            await arsipApi.bulkRejectAssignments(rejectableSelectedIds, reason);
            customSwal.toast.success({ message: 'Bulk reject selesai.' });
            await refreshAll();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setActionLoading(false);
        }
    };

    const downloadRequestFile = async (requestFile) => {
        try {
            await arsipApi.downloadRequestFile(requestFile);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const openAppendTargets = () => {
        setAppendPayload({
            target_role: request?.target_role || 'mahasiswa',
            scope_type: 'specific',
            target_filters: {},
            target_identifiers: [],
        });
        setAppendPreview(null);
        setAppendPickerSession((session) => session + 1);
        setAppendOpen(true);
    };

    const closeAppendTargets = () => {
        setAppendOpen(false);
        setAppendPayload(null);
        setAppendPreview(null);
    };

    const previewAppendTargets = async () => {
        if (!appendPayload) return;
        setAppendLoading(true);
        try {
            const response = await arsipApi.previewRequestTargets(appendPayload);
            setAppendPreview(unwrapPreview(response));
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setAppendLoading(false);
        }
    };

    const appendTargets = async () => {
        const selectedCount = appendPayload?.target_identifiers?.length ?? 0;
        if (appendPayload?.scope_type !== 'specific' || selectedCount < 1) {
            customSwal.toast.error({ message: 'Pilih minimal satu target spesifik.' });
            return;
        }
        if (!(await confirmAction({ title: 'Tambah target?', text: `${selectedCount} target terpilih akan diproses.`, confirmText: 'Tambahkan' }))) return;
        setAppendLoading(true);
        try {
            await arsipApi.appendRequestTargets(requestId(request), appendPayload);
            customSwal.toast.success({ message: 'Target tambahan berhasil diproses.' });
            closeAppendTargets();
            await refreshAll();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setAppendLoading(false);
        }
    };

    const togglePageSelection = (checked) => {
        const pageIds = selectableAssignments.map(assignmentId);
        if (checked) {
            setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
            return;
        }
        setSelectedIds(selectedIds.filter((item) => !pageIds.includes(item)));
    };

    const toggleAssignment = (targetId) => {
        setSelectedIds((prev) => prev.includes(targetId) ? prev.filter((item) => item !== targetId) : [...prev, targetId]);
    };

    const columns = [
        { field: 'select', headerName: '', width: 55, sortable: false, filterable: false, renderHeader: () => <Checkbox size="small" checked={allPageSelected} onChange={(event) => togglePageSelection(event.target.checked)} />, renderCell: (params) => <Checkbox size="small" disabled={!isVerifiable(params.row)} checked={selectedIds.includes(assignmentId(params.row))} onChange={() => toggleAssignment(assignmentId(params.row))} /> },
        { field: 'identifier', headerName: 'Identifier', width: 130, valueGetter: (value, row) => row.identifier || '-' },
        { field: 'name_snapshot', headerName: 'Nama', flex: 1, minWidth: 180, valueGetter: (value, row) => row.name_snapshot || '-' },
        { field: 'role', headerName: 'Role/Angkatan', width: 150, renderCell: (params) => `${params.row.target_role || request?.target_role || '-'}${params.row.angkatan_snapshot ? ` · ${params.row.angkatan_snapshot}` : ''}` },
        { field: 'status', headerName: 'Status', width: 150, renderCell: (params) => <StatusChip status={params.row.status} /> },
        { field: 'late', headerName: 'Late', width: 90, renderCell: (params) => params.row.is_late ? <StatusChip status="late" /> : '-' },
        { field: 'files', headerName: 'Current Files', width: 240, sortable: false, renderCell: (params) => {
            const files = currentFiles(params.row);
            if (!files.length) return 'Belum ada file';
            return <div className="flex flex-col gap-1">{files.map((file) => <button key={file.request_file_id || file.file_id} type="button" className="text-blue-600 hover:underline text-left" onClick={() => downloadRequestFile(file)}>{fileName(file)} · {bytes(fileSize(file))}</button>)}</div>;
        } },
        { field: 'submitted_at', headerName: 'Submitted', width: 170, renderCell: (params) => dateTime(params.row.submitted_at) },
        { field: 'verified_at', headerName: 'Verified', width: 170, renderCell: (params) => dateTime(params.row.verified_at || params.row.approved_at || params.row.rejected_at) },
        { field: 'actions', headerName: 'Aksi', width: 260, sortable: false, filterable: false, renderCell: (params) => {
            const files = currentFiles(params.row);
            const verifiable = isVerifiable(params.row);
            return (
                <div className="flex gap-1 flex-wrap">
                    <Button size="small" disabled={actionLoading || !verifiable || files.length < 1} onClick={() => approve(params.row)} sx={buttonSx}>Approve</Button>
                    <Button size="small" color="error" disabled={actionLoading || !verifiable} onClick={() => reject(params.row)} sx={buttonSx}>Reject</Button>
                    {files[0] && <Button size="small" onClick={() => downloadRequestFile(files[0])} sx={buttonSx}><DownloadOutlined sx={{ fontSize: 16 }} /></Button>}
                </div>
            );
        } },
    ];

    if (loading && !request) return <CustomLoading />;

    return (
        <div className="font-jakarta">
            <PageHeader
                title={request?.title || 'Detail Permintaan'}
                subtitle="Kelola assignment, progres, verifikasi, upload admin, dan file request."
                breadcrumbs={[{ label: 'Permintaan Berkas', href: '/home/permintaan' }, { label: request?.title || 'Detail' }]}
                actions={
                    <>
                        <Button variant="outlined" startIcon={<ArrowBackOutlined />} onClick={() => navigate('/home/permintaan')} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Kembali</Button>
                        <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={refreshAll} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>
                    </>
                }
            />

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}

            <section className={`${panelClass} mb-4`}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                    <div>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Metadata Request</p>
                        <h2 className="text-base font-semibold text-zinc-800 mt-1">{request?.title || '-'}</h2>
                        <p className="text-sm text-zinc-600 mt-2 whitespace-pre-line">{request?.description || 'Tanpa deskripsi.'}</p>
                    </div>
                    <StatusChip status={request?.status} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm mb-4">
                    <div className="rounded-lg bg-zinc-50 p-3"><span className="text-xs text-zinc-500">Target</span><strong className="block mt-1">{request?.target_role || '-'} · {request?.scope_type || '-'}</strong></div>
                    <div className="rounded-lg bg-zinc-50 p-3"><span className="text-xs text-zinc-500">Deadline</span><strong className="block mt-1">{dateTime(request?.deadline_at)}</strong></div>
                    <div className="rounded-lg bg-zinc-50 p-3"><span className="text-xs text-zinc-500">Dibuat</span><strong className="block mt-1">{dateTime(request?.created_at)}</strong></div>
                    <div className="rounded-lg bg-zinc-50 p-3"><span className="text-xs text-zinc-500">Published</span><strong className="block mt-1">{dateTime(request?.published_at)}</strong></div>
                    <div className="rounded-lg bg-zinc-50 p-3"><span className="text-xs text-zinc-500">Closed</span><strong className="block mt-1">{dateTime(request?.closed_at)}</strong></div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {request?.status === 'draft' && <Button disabled={actionLoading} variant="contained" onClick={() => runLifecycle(arsipApi.publishRequest, 'Publish request?', 'Assignment akan dibuat untuk target request ini.', 'Request berhasil dipublish.')} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Publish</Button>}
                    {request?.status === 'published' && <Button disabled={actionLoading} variant="outlined" onClick={openAppendTargets} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Tambah Target</Button>}
                    {request?.status === 'published' && <Button disabled={actionLoading} variant="outlined" onClick={() => runLifecycle(arsipApi.closeRequest, 'Tutup request?', 'Penerima tidak bisa upload file baru.', 'Request berhasil ditutup.')} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Tutup</Button>}
                    {request?.status === 'closed' && <Button disabled={actionLoading} variant="contained" onClick={() => runLifecycle(arsipApi.reopenRequest, 'Buka lagi request?', 'Request akan aktif kembali.', 'Request berhasil dibuka lagi.')} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Reopen</Button>}
                    {['draft', 'closed'].includes(request?.status) && <Button disabled={actionLoading} color="warning" onClick={() => runLifecycle(arsipApi.archiveRequest, 'Arsipkan request?', 'Request akan menjadi read-only.', 'Request berhasil diarsipkan.')} sx={buttonSx}>Arsipkan</Button>}
                </div>
            </section>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                {[
                    ['Total', progressValue(progress, ['total_assignments', 'total'])],
                    ['Submitted', progressValue(progress, ['submitted', 'submitted_assignments'])],
                    ['Approved', progressValue(progress, ['approved'])],
                    ['Rejected', progressValue(progress, ['rejected'])],
                    ['Pending', progressValue(progress, ['pending', 'not_submitted'])],
                    ['Late', progressValue(progress, ['late', 'late_assignments'])],
                ].map(([label, value]) => <div key={label} className="bg-white rounded-lg border border-zinc-200 p-4"><span className="text-xs text-zinc-500">{label}</span><strong className="block text-xl text-zinc-800 mt-1">{value}</strong></div>)}
            </div>

            <section className={panelClass}>
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-800">Assignment</h3>
                        <p className="text-xs text-zinc-500">Bulk selection mengikuti hasil filter backend yang sedang dimuat.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outlined" disabled={actionLoading || approvableSelectedIds.length < 1} onClick={bulkApprove} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Bulk Approve ({approvableSelectedIds.length})</Button>
                        <Button variant="outlined" color="error" disabled={actionLoading || rejectableSelectedIds.length < 1} onClick={bulkReject} sx={buttonSx}>Bulk Reject ({rejectableSelectedIds.length})</Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-3">
                    <TextField size="small" label="Cari" value={filters.search} onChange={(event) => handleFilterChange('search', event.target.value)} sx={{ minWidth: 220 }} />
                    <TextField size="small" select label="Status" value={filters.status} onChange={(event) => handleFilterChange('status', event.target.value)} sx={{ minWidth: 180 }}>
                        <MenuItem value="">Semua status</MenuItem>
                        <MenuItem value="not_submitted">Belum submit</MenuItem>
                        <MenuItem value="waiting_verification">Menunggu verifikasi</MenuItem>
                        <MenuItem value="approved">Approved</MenuItem>
                        <MenuItem value="rejected">Rejected</MenuItem>
                    </TextField>
                    <TextField size="small" select label="Deadline" value={filters.late} onChange={(event) => handleFilterChange('late', event.target.value)} sx={{ minWidth: 160 }}>
                        <MenuItem value="">Semua</MenuItem>
                        <MenuItem value="late">Terlambat</MenuItem>
                        <MenuItem value="on_time">Tidak terlambat</MenuItem>
                    </TextField>
                    <Button variant="outlined" onClick={applyAssignmentFilters} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Terapkan</Button>
                </div>


                <CustomDataTable
                    rows={filteredAssignments}
                    columns={columns}
                    loading={assignmentsLoading}
                    getRowId={(row) => assignmentId(row)}
                    pageSize={50}
                    pageSizeOptions={[25, 50, 100]}
                    paginationMode={assignmentsMeta ? 'server' : 'client'}
                    rowCount={assignmentsMeta?.total ?? filteredAssignments.length}
                    paginationModel={assignmentPagination}
                    onPaginationModelChange={handleAssignmentPaginationChange}
                />
            </section>

            <Dialog open={appendOpen} onClose={closeAppendTargets} fullWidth maxWidth="lg">
                <DialogTitle className="!font-jakarta">Tambah Target</DialogTitle>
                <DialogContent dividers className="space-y-4">
                    {appendPayload && <TargetPicker key={appendPickerSession} initialRole={request?.target_role || 'mahasiswa'} value={appendPayload} onChange={(payload) => { setAppendPayload(payload); setAppendPreview(null); }} disabled={request?.status !== 'published'} />}
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-zinc-600">
                            <strong>Preview tambah target</strong>
                            <p>{appendPreview ? `${appendPreview.total_valid ?? 0} valid · ${appendPreview.total_invalid ?? 0} invalid` : 'Belum divalidasi.'}</p>
                        </div>
                        <Button variant="outlined" disabled={appendLoading} onClick={previewAppendTargets} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Preview</Button>
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAppendTargets} sx={buttonSx}>Batal</Button>
                    <Button variant="contained" disabled={appendLoading || request?.status !== 'published' || appendPayload?.scope_type !== 'specific' || !appendPayload?.target_identifiers?.length} onClick={appendTargets} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Tambahkan</Button>
                </DialogActions>
            </Dialog>

        </div>
    );
}
