import { useEffect, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { bytes, dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };

function unwrapList(response, keys) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : keys.map((key) => payload[key]).find(Array.isArray) ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function userId(user) {
    return user.user_id ?? user.id ?? user.identifier ?? user.nim ?? user.kd_dosen;
}

function identifierOf(user) {
    return user.identifier ?? user.nim ?? user.kd_dosen ?? user.username ?? user.user_identifier;
}

function nameOf(user) {
    return user.name ?? user.nama ?? user.full_name ?? user.name_snapshot ?? '-';
}

function fileId(file) {
    return file.file_id ?? file.id;
}

export default function AdminArchive() {
    const [users, setUsers] = useState([]);
    const [usersMeta, setUsersMeta] = useState(null);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState('');
    const [endpointGap, setEndpointGap] = useState('');
    const [filters, setFilters] = useState({ search: '', role: '', status: '' });
    const [selectedUser, setSelectedUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [filesMeta, setFilesMeta] = useState(null);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesGap, setFilesGap] = useState('');
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadNote, setUploadNote] = useState('');
    const [saving, setSaving] = useState(false);

    const loadUsers = async () => {
        setUsersLoading(true);
        setUsersError('');
        setEndpointGap('');
        try {
            const response = await arsipApi.adminArchiveUsers({ ...filters, per_page: 50 });
            const unwrapped = unwrapList(response, ['users', 'archive_users', 'targets']);
            setUsers(unwrapped.data);
            setUsersMeta(unwrapped.meta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            if ([403, 404].includes(formatted.status)) {
                try {
                    const roles = filters.role ? [filters.role] : ['mahasiswa', 'dosen'];
                    const responses = await Promise.all(roles.map((role) => arsipApi.adminTargets({ role, search: filters.search, status: filters.status, per_page: 50 })));
                    const fallbackUsers = responses.flatMap((response, index) => unwrapList(response, ['targets', 'users']).data.map((user) => ({ ...user, role: user.role || user.owner_role || roles[index] })));
                    setUsers(fallbackUsers);
                    setUsersMeta(null);
                    setEndpointGap('Endpoint /admin/archive/users tidak tersedia. Fallback memakai /admin/targets untuk memilih pengguna; jumlah file mungkin tidak lengkap.');
                } catch (fallbackErr) {
                    const fallbackFormatted = await formatArsipError(fallbackErr);
                    setEndpointGap(`Endpoint /admin/archive/users unavailable dan fallback /admin/targets gagal: ${fallbackFormatted.message}`);
                    setUsers([]);
                    setUsersMeta(null);
                }
            } else {
                setUsersError(formatted.message);
                customSwal.toast.error({ message: formatted.message });
                setUsers([]);
                setUsersMeta(null);
            }
        } finally {
            setUsersLoading(false);
        }
    };

    const loadFiles = async (user = selectedUser) => {
        if (!user) return;
        setFilesLoading(true);
        setFilesGap('');
        try {
            const identifier = identifierOf(user);
            const response = await arsipApi.files({ owner_identifier: identifier, identifier, user_id: user.user_id ?? user.id, owner_user_id: user.user_id ?? user.id, owner_role: user.role ?? user.owner_role });
            const unwrapped = unwrapList(response, ['files']);
            setFiles(unwrapped.data);
            setFilesMeta(unwrapped.meta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setFilesGap(`Endpoint /files belum mendukung filter arsip pengguna ini: ${formatted.message}`);
            setFiles([]);
            setFilesMeta(null);
        } finally {
            setFilesLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const selectUser = async (user) => {
        setSelectedUser(user);
        setFiles([]);
        await loadFiles(user);
    };

    const closeUpload = () => {
        setUploadOpen(false);
        setUploadFile(null);
        setUploadNote('');
    };

    const uploadForUser = async () => {
        if (!selectedUser || !uploadFile) return;
        setSaving(true);
        try {
            const identifier = identifierOf(selectedUser);
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('display_filename', uploadFile.name);
            if (selectedUser.role || selectedUser.owner_role) formData.append('owner_role', selectedUser.role || selectedUser.owner_role);
            if (identifier) formData.append('owner_identifier', identifier);
            if (selectedUser.user_id ?? selectedUser.id) formData.append('user_id', selectedUser.user_id ?? selectedUser.id);
            if (uploadNote) formData.append('note', uploadNote);
            await arsipApi.uploadForUser(formData);
            customSwal.toast.success({ message: 'File berhasil diupload untuk pengguna.' });
            closeUpload();
            await loadFiles();
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        } finally {
            setSaving(false);
        }
    };

    const download = async (file) => {
        try {
            await arsipApi.downloadFile(file);
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
        }
    };

    const userColumns = [
        { field: 'identifier', headerName: 'Identifier', width: 150, valueGetter: (value, row) => identifierOf(row) || '-' },
        { field: 'name', headerName: 'Nama', flex: 1, minWidth: 190, valueGetter: (value, row) => nameOf(row) },
        { field: 'role', headerName: 'Role', width: 130, valueGetter: (value, row) => row.role ?? row.owner_role ?? '-' },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => <StatusChip status={params.row.status || params.row.user_status || 'active'} /> },
        { field: 'files_count', headerName: 'File', width: 100, valueGetter: (value, row) => row.files_count ?? row.total_files ?? '-' },
        { field: 'total_size', headerName: 'Ukuran', width: 120, renderCell: (params) => bytes(params.row.total_size_bytes ?? params.row.total_file_size_bytes) },
        { field: 'actions', headerName: 'Aksi', width: 120, sortable: false, renderCell: (params) => <Button size="small" onClick={() => selectUser(params.row)} sx={buttonSx}>Pilih</Button> },
    ];

    const fileColumns = [
        { field: 'display_filename', headerName: 'File', flex: 1, minWidth: 220, valueGetter: (value, row) => row.display_filename || row.original_filename || row.filename || '-' },
        { field: 'extension', headerName: 'Ext', width: 80, valueGetter: (value, row) => row.extension || '-' },
        { field: 'file_size_bytes', headerName: 'Ukuran', width: 120, renderCell: (params) => bytes(params.row.file_size_bytes ?? params.row.size) },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => <StatusChip status={params.row.status || (params.row.is_current === false ? 'archived' : 'available')} /> },
        { field: 'created_at', headerName: 'Upload', width: 170, renderCell: (params) => dateTime(params.row.created_at ?? params.row.uploaded_at) },
        { field: 'actions', headerName: 'Aksi', width: 120, sortable: false, renderCell: (params) => <Button size="small" aria-label="Download file pengguna" disabled={!fileId(params.row)} onClick={() => download(params.row)} sx={buttonSx}><DownloadOutlined sx={{ fontSize: 16 }} /></Button> },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader title="Arsip Pengguna" subtitle="Kelola arsip dokumen seluruh pengguna." actions={<Button variant="outlined" startIcon={<RefreshOutlined />} onClick={loadUsers} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>} />
            {endpointGap && <Alert severity="warning" sx={{ mb: 2, borderRadius: '0.5rem' }}>{endpointGap}</Alert>}
            {usersError && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{usersError}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3">
                <TextField size="small" label="Cari" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} sx={{ minWidth: 220 }} />
                <TextField size="small" select label="Role" value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))} sx={{ minWidth: 150 }}>
                    <MenuItem value="">Semua</MenuItem><MenuItem value="mahasiswa">Mahasiswa</MenuItem><MenuItem value="dosen">Dosen</MenuItem>
                </TextField>
                <TextField size="small" select label="Status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} sx={{ minWidth: 150 }}>
                    <MenuItem value="">Semua</MenuItem><MenuItem value="active">Aktif</MenuItem><MenuItem value="inactive">Nonaktif</MenuItem>
                </TextField>
                <Button variant="contained" startIcon={<SearchOutlined />} onClick={loadUsers} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button>
            </section>
            {!usersMeta && users.length > 0 && <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Backend pagination pengguna belum tersedia. Data dipaginasi di browser.</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 mb-4">
                <CustomDataTable rows={users} columns={userColumns} loading={usersLoading} getRowId={(row) => userId(row)} pageSize={25} pageSizeOptions={[25, 50]} />
            </section>
            <section className="bg-white rounded-lg border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div><h2 className="text-sm font-semibold text-zinc-800">File Pengguna</h2><p className="text-xs text-zinc-500">{selectedUser ? `${identifierOf(selectedUser) || '-'} · ${nameOf(selectedUser)}` : 'Pilih pengguna untuk melihat file.'}</p></div>
                    <div className="flex gap-2"><Button variant="outlined" disabled={!selectedUser || filesLoading} onClick={() => loadFiles()} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Muat File</Button><Button variant="contained" startIcon={<CloudUploadOutlined />} disabled={!selectedUser} onClick={() => setUploadOpen(true)} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Upload</Button></div>
                </div>
                {filesGap && <Alert severity="warning" sx={{ mb: 2, borderRadius: '0.5rem' }}>{filesGap}</Alert>}
                {!filesMeta && files.length > 0 && <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Backend pagination file belum tersedia. Data dipaginasi di browser.</Alert>}
                <CustomDataTable rows={files} columns={fileColumns} loading={filesLoading} getRowId={(row) => fileId(row)} pageSize={25} pageSizeOptions={[25, 50]} />
            </section>
            <Dialog open={uploadOpen} onClose={closeUpload} fullWidth maxWidth="sm">
                <DialogTitle className="!font-jakarta">Upload untuk Pengguna</DialogTitle>
                <DialogContent dividers>
                    <Alert severity="info" sx={{ mb: 2, borderRadius: '0.5rem' }}>Target: {identifierOf(selectedUser) || '-'} · {nameOf(selectedUser)}</Alert>
                    <Button component="label" variant="outlined" fullWidth startIcon={<CloudUploadOutlined />} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46', py: 2 }}>{uploadFile ? uploadFile.name : 'Pilih File'}<input type="file" hidden onChange={(event) => setUploadFile(event.target.files?.[0] || null)} /></Button>
                    <TextField fullWidth size="small" multiline minRows={2} label="Catatan" value={uploadNote} onChange={(event) => setUploadNote(event.target.value)} sx={{ mt: 2 }} />
                </DialogContent>
                <DialogActions><Button onClick={closeUpload} sx={buttonSx}>Batal</Button><Button variant="contained" disabled={saving || !uploadFile} onClick={uploadForUser} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Upload</Button></DialogActions>
            </Dialog>
        </div>
    );
}
