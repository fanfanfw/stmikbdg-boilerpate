import { useEffect, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import CustomDataTable from '../../../components/CustomDataTable';
import { Alert, Button, Dialog, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };

function unwrapList(response) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : payload.audit_logs ?? payload.logs ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function logId(row) {
    return row.audit_log_id ?? row.id ?? `${row.action}-${row.entity_type}-${row.entity_id}-${row.created_at}`;
}

function metadataOf(row) {
    return row.metadata ?? row.payload ?? row.data ?? row.changes ?? null;
}

export default function AdminAudit() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({ search: '', action: '', entity_type: '', date_from: '', date_to: '' });
    const [detail, setDetail] = useState(null);

    const loadLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.auditLogs({ ...filters, per_page: 50 });
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

    useEffect(() => {
        loadLogs();
    }, []);

    const columns = [
        { field: 'created_at', headerName: 'Waktu', width: 170, renderCell: (params) => dateTime(params.row.created_at) },
        { field: 'actor', headerName: 'Actor', width: 180, renderCell: (params) => `${params.row.actor_role || '-'} #${params.row.actor_user_id || '-'}` },
        { field: 'action', headerName: 'Action', width: 160, valueGetter: (value, row) => row.action || '-' },
        { field: 'entity', headerName: 'Entity', width: 190, renderCell: (params) => `${params.row.entity_type || '-'} #${params.row.entity_id || '-'}` },
        { field: 'description', headerName: 'Deskripsi', flex: 1, minWidth: 240, valueGetter: (value, row) => row.description || row.message || '-' },
        { field: 'metadata', headerName: 'Detail', width: 120, sortable: false, renderCell: (params) => <Button size="small" disabled={!metadataOf(params.row)} onClick={() => setDetail(params.row)} sx={buttonSx}>JSON</Button> },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader title="Audit Log" subtitle="Lacak aktivitas penting arsip digital." actions={<Button variant="outlined" startIcon={<RefreshOutlined />} onClick={loadLogs} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>} />
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3"><TextField size="small" label="Cari" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} sx={{ minWidth: 220 }} /><TextField size="small" label="Action" value={filters.action} onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))} sx={{ minWidth: 160 }} /><TextField size="small" label="Entity" value={filters.entity_type} onChange={(event) => setFilters((prev) => ({ ...prev, entity_type: event.target.value }))} sx={{ minWidth: 160 }} /><TextField size="small" type="date" label="Dari" value={filters.date_from} onChange={(event) => setFilters((prev) => ({ ...prev, date_from: event.target.value }))} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label="Sampai" value={filters.date_to} onChange={(event) => setFilters((prev) => ({ ...prev, date_to: event.target.value }))} InputLabelProps={{ shrink: true }} /><Button variant="contained" startIcon={<SearchOutlined />} onClick={loadLogs} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button></section>
            <section className="bg-white rounded-lg border border-zinc-200"><CustomDataTable rows={rows} columns={columns} loading={loading} getRowId={(row) => logId(row)} pageSize={50} pageSizeOptions={[50, 100]} /></section>
            <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md"><DialogTitle className="!font-jakarta">Metadata Audit</DialogTitle><DialogContent dividers><pre className="text-xs bg-zinc-950 text-zinc-50 rounded-lg p-4 overflow-auto">{detail ? JSON.stringify(metadataOf(detail), null, 2) : ''}</pre></DialogContent></Dialog>
        </div>
    );
}
