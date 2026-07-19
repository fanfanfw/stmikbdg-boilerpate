import { useEffect, useMemo, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { archiveSourceLabel, bytes, dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = { borderRadius: '0.5rem', textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif' };

function unwrapList(response, keys) {
    const payload = response?.data ?? response ?? {};
    const list = Array.isArray(payload) ? payload : keys.map((key) => payload[key]).find(Array.isArray) ?? payload.data ?? [];
    return { data: Array.isArray(list) ? list : [], meta: payload.meta ?? payload.pagination ?? response?.meta ?? null };
}

function userId(user) {
    return user?.user_id ?? user?.id ?? user?.identifier ?? user?.nim ?? user?.kd_dosen;
}

function identifierOf(user) {
    return user?.identifier ?? user?.nim ?? user?.kd_dosen ?? user?.username ?? user?.user_identifier;
}

function nameOf(user) {
    return user?.name ?? user?.nama ?? user?.full_name ?? user?.name_snapshot ?? '-';
}

function fileId(file) {
    return file?.file_id ?? file?.id;
}

function categoryId(category) {
    return category?.category_id ?? category?.id;
}

function ownerTargetPayload(user) {
    const ownerRole = user?.role ?? user?.owner_role;
    const ownerUserId = user?.user_id ?? user?.id;
    const ownerIdentifier = identifierOf(user);
    return {
        owner_role: ownerRole,
        ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
        ...(ownerIdentifier ? { owner_identifier: ownerIdentifier } : {}),
    };
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
    const [categories, setCategories] = useState([]);
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [categoryError, setCategoryError] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({ file: null, category_id: '', display_filename: '' });
    const [uploadError, setUploadError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [activeCategoryId, setActiveCategoryId] = useState('');
    const [selectedFileIds, setSelectedFileIds] = useState([]);

    const loadUsers = async () => {
        setUsersLoading(true);
        setUsersError('');
        setEndpointGap('');
        try {
            const roles = filters.role ? [filters.role] : ['mahasiswa', 'dosen'];
            const responses = await Promise.all(roles.map((role) => arsipApi.adminTargets({
                role,
                search: filters.search,
                status: filters.status,
                has_account: true,
                per_page: 50,
            })));
            const targetUsers = responses.flatMap((response, index) => {
                const unwrapped = unwrapList(response, ['targets', 'users']);
                return unwrapped.data.map((user) => ({ ...user, role: user.role || user.owner_role || roles[index] }));
            });
            const firstMeta = responses.length === 1 ? unwrapList(responses[0], ['targets', 'users']).meta : null;
            setUsers(targetUsers);
            setUsersMeta(firstMeta);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setUsersError(formatted.message);
            customSwal.toast.error({ message: formatted.message });
            setUsers([]);
            setUsersMeta(null);
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
            setSelectedFileIds([]);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setFilesGap(`Endpoint /files belum mendukung filter arsip pengguna ini: ${formatted.message}`);
            setFiles([]);
            setFilesMeta(null);
        } finally {
            setFilesLoading(false);
        }
    };

    const loadCategories = async (user = selectedUser) => {
        if (!user) return [];
        try {
            const response = await arsipApi.categories({
                category_type: 'personal',
                owner_role: user.role ?? user.owner_role,
                owner_user_id: user.user_id ?? user.id,
            });
            const nextCategories = unwrapList(response, ['categories']).data;
            setCategories(nextCategories);
            return nextCategories;
        } catch (err) {
            const formatted = await formatArsipError(err);
            customSwal.toast.error({ message: formatted.message });
            setCategories([]);
            return [];
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const selectUser = async (user) => {
        setSelectedUser(user);
        setFiles([]);
        setCategories([]);
        setActiveCategoryId('');
        setSelectedFileIds([]);
        await Promise.all([loadFiles(user), loadCategories(user)]);
    };

    const activeCategory = categories.find((category) => String(categoryId(category)) === String(activeCategoryId));
    const visibleFiles = useMemo(() => files.filter((file) => {
        const currentCategoryId = file.category_id ?? file.category?.category_id ?? file.category?.id ?? '';
        return activeCategoryId ? String(currentCategoryId) === String(activeCategoryId) : !currentCategoryId;
    }), [files, activeCategoryId]);
    const tableRows = useMemo(() => {
        const counts = new Map();
        files.forEach((file) => {
            const id = String(file.category_id ?? file.category?.category_id ?? file.category?.id ?? '');
            counts.set(id, (counts.get(id) || 0) + 1);
        });
        const fileRows = visibleFiles.map((file) => ({ ...file, row_type: 'file' }));
        if (activeCategoryId) return fileRows;
        return [
            ...categories.map((category) => ({
                ...category,
                row_type: 'folder',
                row_id: `folder-${categoryId(category)}`,
                files_count: category.files_count ?? counts.get(String(categoryId(category))) ?? 0,
            })),
            ...fileRows,
        ];
    }, [activeCategoryId, categories, files, visibleFiles]);
    const selectedFileIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);
    const selectedFiles = useMemo(
        () => visibleFiles.filter((file) => selectedFileIdSet.has(fileId(file))),
        [visibleFiles, selectedFileIdSet],
    );

    const openCategoryModal = () => {
        setCategoryForm({ name: '', description: '' });
        setCategoryError('');
        setCategoryOpen(true);
    };

    const closeCategoryModal = () => {
        setCategoryOpen(false);
        setCategoryError('');
    };

    const submitCategory = async () => {
        if (!selectedUser) return;
        const name = categoryForm.name.trim();
        const description = categoryForm.description.trim();
        if (!name) {
            setCategoryError('Nama kategori tidak boleh kosong');
            return;
        }

        setCreatingCategory(true);
        try {
            const response = await arsipApi.createCategory({
                category_type: 'personal',
                ...ownerTargetPayload(selectedUser),
                name,
                ...(description ? { description } : {}),
            });
            const created = response?.data?.category ?? response?.category ?? response?.data ?? response;
            const nextCategories = await loadCategories(selectedUser);
            const newCategory = nextCategories.find((category) => String(categoryId(category)) === String(categoryId(created)))
                ?? nextCategories.find((category) => category.name === name);
            const newCategoryId = categoryId(newCategory) ?? categoryId(created);
            if (uploadOpen && newCategoryId) {
                setUploadForm((prev) => ({ ...prev, category_id: newCategoryId }));
            }
            await loadFiles(selectedUser);
            customSwal.toast.success({ message: 'Kategori berhasil ditambahkan' });
            closeCategoryModal();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setCategoryError(formatted.message);
        } finally {
            setCreatingCategory(false);
        }
    };

    const openUploadModal = () => {
        setUploadForm({ file: null, category_id: activeCategoryId || '', display_filename: '' });
        setUploadError('');
        setUploadOpen(true);
        loadCategories();
    };

    const closeUploadModal = () => {
        setUploadOpen(false);
        setUploadError('');
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setUploadForm((prev) => ({ ...prev, file, display_filename: file ? file.name : prev.display_filename }));
        setUploadError('');
    };

    const submitUpload = async () => {
        if (!selectedUser) return;
        if (!uploadForm.file) {
            setUploadError('Pilih file terlebih dahulu');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadForm.file);
            formData.append('display_filename', uploadForm.display_filename.trim() || uploadForm.file.name);
            Object.entries(ownerTargetPayload(selectedUser)).forEach(([key, value]) => formData.append(key, value));
            if (uploadForm.category_id) {
                formData.append('category_id', uploadForm.category_id);
            }
            await arsipApi.adminUploadForUser(formData);
            customSwal.toast.success({ message: 'File berhasil diunggah' });
            closeUploadModal();
            await Promise.all([loadFiles(selectedUser), loadCategories(selectedUser)]);
        } catch (err) {
            const formatted = await formatArsipError(err);
            setUploadError(formatted.message);
        } finally {
            setUploading(false);
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

    const deleteFile = (file) => {
        customSwal.question({
            title: 'Hapus file pengguna?',
            message: `Apakah Anda yakin ingin menghapus "${file.display_filename || file.original_filename || file.filename || 'file ini'}"?`,
            callback: async () => {
                try {
                    await arsipApi.deleteFile(fileId(file), 'Dihapus oleh admin');
                    customSwal.toast.success({ message: 'File pengguna berhasil dihapus' });
                    await loadFiles(selectedUser);
                } catch (err) {
                    const formatted = await formatArsipError(err);
                    customSwal.toast.error({ message: formatted.message });
                }
            },
        });
    };

    const openFolder = (category) => {
        setActiveCategoryId(categoryId(category));
        setSelectedFileIds([]);
    };

    const closeFolder = () => {
        setActiveCategoryId('');
        setSelectedFileIds([]);
    };

    const deleteCategory = (category) => {
        if (category.files_count > 0) return;
        customSwal.question({
            title: 'Hapus kategori pengguna?',
            message: `Kategori "${category.name}" akan dihapus.`,
            callback: async () => {
                try {
                    await arsipApi.deleteCategory(categoryId(category));
                    customSwal.toast.success({ message: 'Kategori berhasil dihapus' });
                    await loadCategories(selectedUser);
                } catch (err) {
                    const formatted = await formatArsipError(err);
                    customSwal.toast.error({ message: formatted.message });
                }
            },
        });
    };

    const toggleFileSelection = (file) => {
        const id = fileId(file);
        setSelectedFileIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
    };

    const toggleAllVisibleFiles = (checked) => {
        setSelectedFileIds(checked ? visibleFiles.map(fileId).filter(Boolean) : []);
    };

    const bulkDownload = async () => {
        for (const file of selectedFiles) {
            await download(file);
        }
    };

    const bulkDelete = () => {
        if (!selectedFiles.length) return;
        customSwal.question({
            title: 'Hapus file pengguna terpilih?',
            message: `${selectedFiles.length} file akan dihapus.`,
            callback: async () => {
                for (const file of selectedFiles) {
                    await arsipApi.deleteFile(fileId(file), 'Dihapus bulk oleh admin');
                }
                customSwal.toast.success({ message: 'File terpilih berhasil dihapus' });
                setSelectedFileIds([]);
                await loadFiles(selectedUser);
            },
        });
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
        { field: 'select', headerName: '', width: 56, sortable: false, filterable: false, renderHeader: () => <Checkbox size="small" disabled={!visibleFiles.length} checked={visibleFiles.length > 0 && selectedFileIds.length === visibleFiles.length} indeterminate={selectedFileIds.length > 0 && selectedFileIds.length < visibleFiles.length} onChange={(event) => toggleAllVisibleFiles(event.target.checked)} />, renderCell: (params) => params.row.row_type === 'file' ? <Checkbox size="small" checked={selectedFileIdSet.has(fileId(params.row))} onChange={() => toggleFileSelection(params.row)} /> : null },
        { field: 'display_filename', headerName: activeCategory ? `Isi ${activeCategory.name}` : 'File', flex: 1, minWidth: 220, renderCell: (params) => params.row.row_type === 'folder' ? <button type="button" className="flex items-center gap-2 font-semibold text-blue-700 hover:underline" onClick={() => openFolder(params.row)}><FolderOutlined fontSize="small" />{params.row.name}<span className="text-xs font-normal text-zinc-500">({params.row.files_count || 0})</span></button> : <span className="flex items-center gap-2"><InsertDriveFileOutlined fontSize="small" />{params.row.display_filename || params.row.original_filename || params.row.filename || '-'}</span> },
        { field: 'source_type', headerName: 'Jenis Arsip', width: 300, sortable: false, renderCell: (params) => params.row.row_type === 'file' ? <div className="flex items-center gap-1 whitespace-nowrap"><Chip label={archiveSourceLabel(params.row.source_type)} size="small" variant="outlined" />{['personal', 'admin_upload'].includes(params.row.source_type) && (params.row.request_file || params.row.requestFile) && <Chip label="Dipakai di Permintaan" size="small" color="warning" variant="outlined" />}</div> : '-' },
        { field: 'extension', headerName: 'Ext', width: 80, renderCell: (params) => params.row.row_type === 'file' ? (params.row.extension || '-') : '-' },
        { field: 'file_size_bytes', headerName: 'Ukuran', width: 120, renderCell: (params) => params.row.row_type === 'file' ? bytes(params.row.file_size_bytes ?? params.row.size) : '-' },
        { field: 'status', headerName: 'Status', width: 130, renderCell: (params) => params.row.row_type === 'file' ? <StatusChip status={params.row.status || (params.row.is_current === false ? 'archived' : 'available')} /> : '-' },
        { field: 'created_at', headerName: 'Upload', width: 170, renderCell: (params) => params.row.row_type === 'file' ? dateTime(params.row.created_at ?? params.row.uploaded_at) : '-' },
        { field: 'actions', headerName: 'Aksi', width: 150, sortable: false, renderCell: (params) => params.row.row_type === 'file' ? (
            <div className="flex gap-1">
                <Button size="small" aria-label="Download file pengguna" disabled={!fileId(params.row)} onClick={() => download(params.row)} sx={buttonSx}><DownloadOutlined sx={{ fontSize: 16 }} /></Button>
                <Button size="small" color="error" aria-label="Hapus file pengguna" disabled={!fileId(params.row)} onClick={() => deleteFile(params.row)} sx={buttonSx}><DeleteOutlined sx={{ fontSize: 16 }} /></Button>
            </div>
        ) : <Button size="small" color="error" disabled={params.row.files_count > 0} onClick={() => deleteCategory(params.row)} sx={buttonSx}><DeleteOutlined sx={{ fontSize: 16 }} /></Button> },
    ];

    return (
        <div className="font-jakarta">
            <PageHeader title="Arsip Pengguna" subtitle="Kelola arsip dokumen seluruh pengguna." actions={<Button variant="outlined" startIcon={<RefreshOutlined />} onClick={loadUsers} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Refresh</Button>} />
            {endpointGap && <Alert severity="warning" sx={{ mb: 2, borderRadius: '0.5rem' }}>{endpointGap}</Alert>}
            {usersError && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{usersError}</Alert>}
            <section className="bg-white rounded-lg border border-zinc-200 p-4 mb-4 flex flex-wrap gap-3">
                <TextField
                    size="small"
                    label="Cari NIM/NIDN/Nama"
                    value={filters.search}
                    onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') loadUsers();
                    }}
                    sx={{ minWidth: 260 }}
                />
                <TextField size="small" select label="Role" value={filters.role} onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value }))} sx={{ minWidth: 150 }}>
                    <MenuItem value="">Semua</MenuItem><MenuItem value="mahasiswa">Mahasiswa</MenuItem><MenuItem value="dosen">Dosen</MenuItem>
                </TextField>
                <TextField size="small" select label="Status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} sx={{ minWidth: 150 }}>
                    <MenuItem value="">Semua</MenuItem><MenuItem value="active">Aktif</MenuItem><MenuItem value="inactive">Nonaktif</MenuItem>
                </TextField>
                <Button variant="contained" startIcon={<SearchOutlined />} onClick={loadUsers} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Terapkan Filter</Button>
            </section>
            <section className="bg-white rounded-lg border border-zinc-200 mb-4">
                <CustomDataTable
                    rows={users}
                    columns={userColumns}
                    loading={usersLoading}
                    getRowId={(row) => userId(row)}
                    pageSize={25}
                    pageSizeOptions={[25, 50]}
                    toolbar={{ search: false, column: true, density: true }}
                />
            </section>
            <section className="bg-white rounded-lg border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div><h2 className="text-sm font-semibold text-zinc-800">File Pengguna</h2><p className="text-xs text-zinc-500">{selectedUser ? `${identifierOf(selectedUser) || '-'} · ${nameOf(selectedUser)}` : 'Pilih pengguna untuk melihat file.'}</p></div>
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outlined" disabled={!selectedUser} onClick={openCategoryModal} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Tambah Kategori</Button>
                        <Button variant="contained" startIcon={<CloudUploadOutlined />} disabled={!selectedUser} onClick={openUploadModal} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>Upload File</Button>
                        <Button variant="outlined" disabled={!selectedUser || filesLoading} onClick={() => loadFiles()} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Muat File</Button>
                    </div>
                </div>
                {filesGap && <Alert severity="warning" sx={{ mb: 2, borderRadius: '0.5rem' }}>{filesGap}</Alert>}
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                        {activeCategory && <Button size="small" startIcon={<ArrowBackOutlined />} onClick={closeFolder} sx={{ textTransform: 'none' }}>File Pengguna</Button>}
                        <span className="font-semibold text-zinc-800">{activeCategory ? activeCategory.name : 'File Pengguna'}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <Button size="small" variant="outlined" disabled={!selectedFiles.length} startIcon={<DownloadOutlined />} onClick={bulkDownload} sx={buttonSx}>Download ({selectedFiles.length})</Button>
                        <Button size="small" variant="outlined" color="error" disabled={!selectedFiles.length} startIcon={<DeleteOutlined />} onClick={bulkDelete} sx={buttonSx}>Hapus ({selectedFiles.length})</Button>
                    </div>
                </div>
                <CustomDataTable rows={tableRows} columns={fileColumns} loading={filesLoading} getRowId={(row) => row.row_type === 'folder' ? row.row_id : fileId(row)} pageSize={25} pageSizeOptions={[25, 50]} />
            </section>

            <Dialog open={categoryOpen} onClose={closeCategoryModal} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Tambah Kategori</DialogTitle>
                <DialogContent>
                    <div className="flex flex-col gap-4 mt-2">
                        {categoryError && <Alert severity="error">{categoryError}</Alert>}
                        <TextField size="small" label="Nama Kategori" value={categoryForm.name} onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} fullWidth autoFocus />
                        <TextField size="small" label="Deskripsi (opsional)" value={categoryForm.description} onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))} fullWidth multiline minRows={2} />
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeCategoryModal} size="small" sx={buttonSx}>Batal</Button>
                    <Button variant="contained" onClick={submitCategory} disabled={creatingCategory} size="small" sx={buttonSx}>{creatingCategory ? 'Menyimpan...' : 'Simpan'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={uploadOpen} onClose={closeUploadModal} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Upload File</DialogTitle>
                <DialogContent>
                    <div className="flex flex-col gap-4 mt-2">
                        {uploadError && <Alert severity="error">{uploadError}</Alert>}
                        <Button variant="outlined" component="label" startIcon={<CloudUploadOutlined />} sx={buttonSx}>
                            {uploadForm.file ? uploadForm.file.name : 'Pilih File'}
                            <input type="file" hidden onChange={handleFileChange} />
                        </Button>
                        {uploadForm.file && <p className="text-xs text-zinc-500">File dipilih: {uploadForm.file.name}</p>}
                        <TextField select size="small" label="Kategori (opsional)" value={uploadForm.category_id} onChange={(event) => setUploadForm((prev) => ({ ...prev, category_id: event.target.value }))} fullWidth>
                            <MenuItem value="">Tanpa kategori</MenuItem>
                            {categories.map((category) => <MenuItem key={categoryId(category)} value={categoryId(category)}>{category.name}</MenuItem>)}
                        </TextField>
                        <TextField size="small" label="Nama File Tampilan" value={uploadForm.display_filename} onChange={(event) => setUploadForm((prev) => ({ ...prev, display_filename: event.target.value }))} fullWidth />
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={closeUploadModal} size="small" sx={buttonSx}>Batal</Button>
                    <Button variant="contained" onClick={submitUpload} disabled={uploading} size="small" sx={buttonSx}>{uploading ? 'Mengunggah...' : 'Upload'}</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
