import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import CustomDataTable from '../../../components/CustomDataTable';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };
const emptyNoteData = { note: null, revisions: [] };

function unwrapList(response) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : payload.audit_logs ?? payload.logs ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function unwrapNote(response) {
    const payload = response?.data ?? response ?? {};
    const revisions = Array.isArray(payload.revisions) ? [...payload.revisions] : [];
    revisions.sort((left, right) => Number(right.version || 0) - Number(left.version || 0) || String(right.created_at || '').localeCompare(String(left.created_at || '')));
    return { note: payload.note ?? null, revisions };
}

function logId(row) {
    return row.audit_log_id ?? row.id ?? `${row.action}-${row.entity_type}-${row.entity_id}-${row.created_at}`;
}

function metadataOf(row) {
    return row.metadata ?? row.payload ?? row.data ?? row.changes ?? null;
}

function noteActor(id, name) {
    const value = typeof name === 'string' ? name.trim() : '';
    const displayName = /^Admin\s+#\d+$/i.test(value) ? 'Admin' : value || 'Admin';
    return `Admin #${id ?? '-'} - ${displayName}`;
}

function notePreview(note) {
    const value = String(note?.note || '').trim();
    return value.length > 70 ? `${value.slice(0, 70)}…` : value;
}

function fieldError(errors, field) {
    const value = errors?.[field];
    return Array.isArray(value) ? value.join(' ') : value || '';
}

export default function AdminAudit() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [draftFilters, setDraftFilters] = useState({ search: '', action: '', entity_type: '', date_from: '', date_to: '' });
    const [filters, setFilters] = useState(draftFilters);
    const [detail, setDetail] = useState(null);
    const [noteDialog, setNoteDialog] = useState(null);
    const [noteData, setNoteData] = useState(emptyNoteData);
    const [noteText, setNoteText] = useState('');
    const [noteLoaded, setNoteLoaded] = useState(false);
    const [noteLoading, setNoteLoading] = useState(false);
    const [noteSubmitting, setNoteSubmitting] = useState(false);
    const [noteError, setNoteError] = useState('');
    const [noteValidation, setNoteValidation] = useState({});
    const requestRef = useRef(0);
    const noteRequestRef = useRef(0);
    const noteActionRef = useRef(0);
    const noteDialogIdRef = useRef(null);

    const loadLogs = useCallback(async (nextFilters = filters) => {
        const requestId = ++requestRef.current;
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.auditLogs({ ...nextFilters, per_page: 50 });
            const unwrapped = unwrapList(response);
            if (requestId !== requestRef.current) return;
            setRows(unwrapped.data);
            setMeta(unwrapped.meta);
        } catch (err) {
            if (requestId !== requestRef.current) return;
            const formatted = await formatArsipError(err);
            if (requestId !== requestRef.current) return;
            setError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [filters]);

    const loadNote = useCallback(async (row, message = '') => {
        const id = logId(row);
        const requestId = ++noteRequestRef.current;
        setNoteLoaded(false);
        setNoteLoading(true);
        setNoteError(message);
        setNoteValidation({});
        try {
            const response = await arsipApi.auditLogNote(id);
            if (requestId !== noteRequestRef.current || noteDialogIdRef.current !== id) return false;
            const data = unwrapNote(response);
            setNoteData(data);
            setNoteText(data.note?.note || '');
            setNoteLoaded(true);
            return true;
        } catch (err) {
            if (requestId !== noteRequestRef.current || noteDialogIdRef.current !== id) return false;
            const formatted = await formatArsipError(err);
            if (requestId !== noteRequestRef.current || noteDialogIdRef.current !== id) return false;
            setNoteError(formatted.message);
            setNoteValidation(formatted.errors || {});
            return false;
        } finally {
            if (requestId === noteRequestRef.current && noteDialogIdRef.current === id) setNoteLoading(false);
        }
    }, []);

    const openNotes = useCallback((row) => {
        const id = logId(row);
        noteDialogIdRef.current = id;
        noteActionRef.current += 1;
        setNoteDialog(row);
        setNoteData(emptyNoteData);
        setNoteText('');
        setNoteLoaded(false);
        setNoteSubmitting(false);
        setNoteError('');
        setNoteValidation({});
        loadNote(row);
    }, [loadNote]);

    const closeNotes = () => {
        if (noteSubmitting) return;
        noteDialogIdRef.current = null;
        noteRequestRef.current += 1;
        noteActionRef.current += 1;
        setNoteDialog(null);
        setNoteData(emptyNoteData);
        setNoteText('');
        setNoteLoaded(false);
        setNoteError('');
        setNoteValidation({});
    };

    const saveNote = async () => {
        const value = noteText.trim();
        if (!value) {
            setNoteValidation({ note: ['Catatan wajib diisi.'] });
            return;
        }

        const row = noteDialog;
        const id = logId(row);
        const currentNote = noteData.note;
        const actionId = ++noteActionRef.current;
        const active = () => actionId === noteActionRef.current && noteDialogIdRef.current === id;
        setNoteSubmitting(true);
        setNoteError('');
        setNoteValidation({});
        try {
            if (currentNote) {
                await arsipApi.updateAuditLogNote(id, { note: value, expected_updated_at: currentNote.updated_at });
            } else {
                await arsipApi.createAuditLogNote(id, { note: value });
            }
            if (!active()) return;
            await Promise.all([loadNote(row), loadLogs()]);
            if (active()) customSwal.toast.success({ message: 'Catatan audit berhasil disimpan.' });
        } catch (err) {
            if (!active()) return;
            const formatted = await formatArsipError(err);
            if (!active()) return;
            if (formatted.status === 409) {
                const message = 'Catatan sudah diubah admin lain. Data terbaru telah dimuat ulang; tinjau sebelum menyimpan kembali.';
                await loadNote(row, message);
                if (active()) setNoteError(message);
            } else {
                setNoteError(formatted.message);
                setNoteValidation(formatted.errors || {});
            }
        } finally {
            if (active()) setNoteSubmitting(false);
        }
    };

    useEffect(() => {
        loadLogs();
        return () => {
            requestRef.current += 1;
            noteRequestRef.current += 1;
            noteActionRef.current += 1;
            noteDialogIdRef.current = null;
        };
    }, []);

    const applyFilters = () => {
        setFilters(draftFilters);
        loadLogs(draftFilters);
    };

    const columns = useMemo(() => [
        { field: 'created_at', headerName: 'Waktu', width: 170, renderCell: (params) => dateTime(params.row.created_at) },
        { field: 'actor', headerName: 'Actor', width: 180, renderCell: ({ row }) => `${row.actor_role || '-'} #${row.actor_user_id || '-'}` },
        { field: 'action', headerName: 'Action', width: 160, valueGetter: (value, row) => row.action || '-' },
        { field: 'entity', headerName: 'Entity', width: 190, renderCell: (params) => `${params.row.entity_type || '-'} #${params.row.entity_id || '-'}` },
        { field: 'description', headerName: 'Deskripsi', flex: 1, minWidth: 240, valueGetter: (value, row) => row.description || row.message || '-' },
        {
            field: 'note',
            headerName: 'Notes',
            width: 250,
            sortable: false,
            renderCell: ({ row }) => row.note ? (
                <Button size="small" onClick={() => openNotes(row)} title={row.note.note || ''} sx={{ ...buttonSx, minWidth: 0, maxWidth: '100%', justifyContent: 'flex-start', textAlign: 'left', py: 0.5 }}>
                    <span className="min-w-0 block">
                        <span className="block text-xs truncate text-zinc-800">{notePreview(row.note)}</span>
                        <span className="block text-[11px] truncate text-zinc-500">Oleh {noteActor(row.note.creator_user_id, row.note.creator_name_snapshot)}</span>
                    </span>
                </Button>
            ) : <Button size="small" onClick={() => openNotes(row)} sx={buttonSx}>Tambah note</Button>,
        },
        { field: 'metadata', headerName: 'Detail', width: 120, sortable: false, renderCell: (params) => <Button size="small" onClick={() => setDetail(params.row)} sx={buttonSx}>JSON</Button> },
    ], [openNotes]);

    const currentNote = noteData.note;
    const noteUnchanged = currentNote && noteText.trim() === String(currentNote.note || '').trim();
    const hasLastEditor = currentNote && (currentNote.last_editor_user_id != null || currentNote.last_editor_name_snapshot);

    return (
        <div className="font-jakarta">
            <PageHeader title="Audit Log" subtitle="Lacak aktivitas penting arsip digital." actions={<Button variant="outlined" startIcon={<RefreshOutlined />} onClick={() => loadLogs()} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>} />
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3"><TextField size="small" label="Cari" value={draftFilters.search} onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))} sx={{ minWidth: 220 }} /><TextField size="small" label="Action" value={draftFilters.action} onChange={(event) => setDraftFilters((prev) => ({ ...prev, action: event.target.value }))} sx={{ minWidth: 160 }} /><TextField size="small" label="Entity" value={draftFilters.entity_type} onChange={(event) => setDraftFilters((prev) => ({ ...prev, entity_type: event.target.value }))} sx={{ minWidth: 160 }} /><TextField size="small" type="date" label="Dari" value={draftFilters.date_from} onChange={(event) => setDraftFilters((prev) => ({ ...prev, date_from: event.target.value }))} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label="Sampai" value={draftFilters.date_to} onChange={(event) => setDraftFilters((prev) => ({ ...prev, date_to: event.target.value }))} InputLabelProps={{ shrink: true }} /><Button variant="contained" startIcon={<SearchOutlined />} onClick={applyFilters} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button></section>
            <section className="bg-white rounded-lg border border-zinc-200"><CustomDataTable rows={rows} columns={columns} loading={loading} getRowId={(row) => logId(row)} pageSize={50} pageSizeOptions={[50, 100]} /></section>

            <Dialog open={Boolean(noteDialog)} onClose={closeNotes} fullWidth maxWidth="md">
                <DialogTitle className="!font-jakarta">Notes Audit</DialogTitle>
                <DialogContent dividers>
                    {noteLoading ? (
                        <div className="min-h-48 flex items-center justify-center"><CircularProgress size={28} /></div>
                    ) : !noteLoaded ? (
                        <div className="space-y-3">
                            {noteError && <Alert severity="error" sx={{ borderRadius: '0.5rem' }}>{noteError}</Alert>}
                            <Button variant="outlined" onClick={() => loadNote(noteDialog)} sx={buttonSx}>Coba lagi</Button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {noteError && <Alert severity="error" sx={{ borderRadius: '0.5rem' }}>{noteError}</Alert>}
                            <TextField
                                autoFocus
                                fullWidth
                                multiline
                                minRows={4}
                                label={currentNote ? 'Edit catatan' : 'Tambah catatan'}
                                value={noteText}
                                disabled={noteSubmitting}
                                error={Boolean(fieldError(noteValidation, 'note'))}
                                helperText={fieldError(noteValidation, 'note')}
                                onChange={(event) => { setNoteText(event.target.value); setNoteValidation({}); }}
                            />
                            {currentNote && (
                                <section className="rounded-lg border border-zinc-200 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                        <h3 className="text-sm font-semibold text-zinc-800">Catatan saat ini</h3>
                                        <span className="text-xs font-medium text-zinc-500">Versi {currentNote.current_version || '-'}</span>
                                    </div>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs">
                                        <div><dt className="text-zinc-500">Dibuat oleh</dt><dd className="font-medium text-zinc-800">{noteActor(currentNote.creator_user_id, currentNote.creator_name_snapshot)}</dd></div>
                                        <div><dt className="text-zinc-500">Dibuat</dt><dd className="font-medium text-zinc-800">{dateTime(currentNote.created_at)}</dd></div>
                                        {hasLastEditor && <div><dt className="text-zinc-500">Editor terakhir</dt><dd className="font-medium text-zinc-800">{noteActor(currentNote.last_editor_user_id, currentNote.last_editor_name_snapshot)}</dd></div>}
                                        <div><dt className="text-zinc-500">Diperbarui</dt><dd className="font-medium text-zinc-800">{dateTime(currentNote.updated_at)}</dd></div>
                                    </dl>
                                </section>
                            )}
                            <section>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <h3 className="text-sm font-semibold text-zinc-800">Riwayat revisi</h3>
                                    <span className="text-xs text-zinc-500">{noteData.revisions.length} versi</span>
                                </div>
                                {noteData.revisions.length ? (
                                    <div className="divide-y divide-zinc-200 border-y border-zinc-200">
                                        {noteData.revisions.map((revision) => (
                                            <article key={revision.audit_log_note_revision_id ?? revision.version} className="py-3">
                                                <div className="flex flex-wrap justify-between gap-2 text-xs mb-2">
                                                    <span className="font-semibold text-zinc-800">Versi {revision.version}</span>
                                                    <span className="text-zinc-500">{noteActor(revision.actor_user_id, revision.actor_name_snapshot)} · {dateTime(revision.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-zinc-700 whitespace-pre-wrap break-words">{revision.note || '-'}</p>
                                            </article>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-zinc-500 py-4">Belum ada riwayat revisi.</p>}
                            </section>
                        </div>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeNotes} disabled={noteSubmitting} sx={buttonSx}>Tutup</Button>
                    <Button variant="contained" onClick={saveNote} disabled={!noteLoaded || noteLoading || noteSubmitting || !noteText.trim() || Boolean(noteUnchanged)} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>
                        {noteSubmitting ? 'Menyimpan...' : currentNote ? 'Simpan perubahan' : 'Simpan catatan'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md"><DialogTitle className="!font-jakarta">Metadata Audit</DialogTitle><DialogContent dividers><pre className="text-xs bg-zinc-950 text-zinc-50 rounded-lg p-4 overflow-auto">{detail ? JSON.stringify(metadataOf(detail), null, 2) : ''}</pre></DialogContent></Dialog>
        </div>
    );
}
