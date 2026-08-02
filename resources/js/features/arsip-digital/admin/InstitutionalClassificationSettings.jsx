import { useEffect, useRef, useState } from 'react';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';

const emptyUnit = { name: '', code: '', description: '' };
const emptyFolder = { name: '', description: '', parent_category_id: '' };
const pageSize = 100;
const maxPages = 100;
const maxItems = pageSize * maxPages;

async function fetchAllPages(request, key) {
    const items = [];
    for (let page = 1; page <= maxPages; page += 1) {
        const response = await request({ with_deleted: true, per_page: pageSize, page });
        const data = response.data || {};
        const pageItems = data[key] || [];
        const pagination = data.pagination;
        if (!pagination || !Number.isInteger(Number(pagination.current_page)) || !Number.isInteger(Number(pagination.last_page))) {
            throw { response: { data: { message: 'Respons pagination struktur klasifikasi tidak valid.' } } };
        }
        items.push(...pageItems);
        if (items.length > maxItems) throw { response: { data: { message: `Struktur klasifikasi melebihi batas aman ${maxItems} item.` } } };
        if (Number(pagination.current_page) >= Number(pagination.last_page)) return items;
        if (Number(pagination.last_page) > maxPages) throw { response: { data: { message: `Struktur klasifikasi melebihi batas aman ${maxPages} halaman.` } } };
    }
    throw { response: { data: { message: `Struktur klasifikasi melebihi batas aman ${maxPages} halaman.` } } };
}

export default function InstitutionalClassificationSettings() {
    const [units, setUnits] = useState([]);
    const [folders, setFolders] = useState([]);
    const [unit, setUnit] = useState(emptyUnit);
    const [folder, setFolder] = useState(emptyFolder);
    const [editingUnitId, setEditingUnitId] = useState(null);
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const loadSequence = useRef(0);

    const load = async () => {
        const sequence = ++loadSequence.current;
        setLoading(true);
        setError('');
        try {
            const [allUnits, allFolders] = await Promise.all([
                fetchAllPages(arsipApi.institutionalUnits, 'units'),
                fetchAllPages(arsipApi.institutionalCategories, 'categories'),
            ]);
            if (sequence !== loadSequence.current) return;
            setUnits(allUnits);
            setFolders(allFolders);
        } catch (err) {
            if (sequence !== loadSequence.current) return;
            setError((await formatArsipError(err)).message);
        } finally {
            if (sequence === loadSequence.current) setLoading(false);
        }
    };

    useEffect(() => {
        load();
        return () => { loadSequence.current += 1; };
    }, []);

    const run = async (action, message) => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await action();
            setSuccess(message);
            await load();
            return true;
        } catch (err) {
            setError((await formatArsipError(err)).message);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const treeRows = () => {
        const rows = [];
        const visited = new Set();
        const visit = (parent, depth) => folders.filter((item) => item.parent_category_id === parent).forEach((item) => {
            if (visited.has(item.category_id)) return;
            visited.add(item.category_id);
            rows.push({ item, depth });
            visit(item.category_id, depth + 1);
        });
        visit(null, 0);
        folders.forEach((item) => {
            if (!visited.has(item.category_id)) {
                visited.add(item.category_id);
                rows.push({ item, depth: 0 });
                visit(item.category_id, 1);
            }
        });
        return rows;
    };

    const unavailableParentIds = new Set();
    if (editingFolderId) {
        const visitDescendants = (id) => {
            if (unavailableParentIds.has(id)) return;
            unavailableParentIds.add(id);
            folders.filter((item) => item.parent_category_id === id).forEach((item) => visitDescendants(item.category_id));
        };
        visitDescendants(editingFolderId);
    }
    const parentOptions = folders.filter((item) => !item.deleted_at && !unavailableParentIds.has(item.category_id));
    const cancelUnitEdit = () => { setEditingUnitId(null); setUnit(emptyUnit); };
    const cancelFolderEdit = () => { setEditingFolderId(null); setFolder(emptyFolder); };

    if (loading) return <div className="space-y-3"><p className="text-sm text-zinc-500">Memuat struktur klasifikasi...</p><Button size="small" disabled onClick={load}>Muat Ulang</Button></div>;

    return <div className="space-y-5">
        {error && <Alert severity="error" action={<Button color="inherit" size="small" disabled={loading} onClick={load}>Coba Lagi</Button>}>{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold text-zinc-800">Unit / Divisi</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
                <TextField size="small" label="Nama unit" value={unit.name} onChange={(e) => setUnit({ ...unit, name: e.target.value })} />
                <TextField size="small" label="Kode" value={unit.code} onChange={(e) => setUnit({ ...unit, code: e.target.value })} />
                <TextField size="small" label="Deskripsi" value={unit.description} onChange={(e) => setUnit({ ...unit, description: e.target.value })} />
            </div>
            <Button sx={{ mt: 2, textTransform: 'none' }} variant="contained" disabled={saving || !unit.name.trim()} onClick={async () => { const ok = await run(() => editingUnitId ? arsipApi.updateInstitutionalUnit(editingUnitId, unit) : arsipApi.createInstitutionalUnit(unit), editingUnitId ? 'Unit berhasil diperbarui.' : 'Unit berhasil dibuat.'); if (ok) cancelUnitEdit(); }}>{editingUnitId ? 'Simpan Unit' : 'Tambah Unit'}</Button>
            {editingUnitId && <Button sx={{ mt: 2, ml: 1, textTransform: 'none' }} disabled={saving} onClick={cancelUnitEdit}>Batal</Button>}
            <div className="mt-4 divide-y divide-zinc-100">
                {!units.length && <p className="py-3 text-sm text-zinc-500">Belum ada unit.</p>}
                {units.map((item) => <div key={item.unit_id} className="flex items-center justify-between py-2 text-sm">
                    <span className={item.deleted_at ? 'text-zinc-400 line-through' : 'text-zinc-700'}>{item.name}{item.code ? ` (${item.code})` : ''}</span>
                    <div><Button size="small" disabled={saving || !!item.deleted_at} onClick={() => { setEditingUnitId(item.unit_id); setUnit({ name: item.name, code: item.code || '', description: item.description || '' }); }}>Edit</Button><Button size="small" color={item.deleted_at ? 'primary' : 'error'} disabled={saving} onClick={() => run(() => item.deleted_at ? arsipApi.restoreInstitutionalUnit(item.unit_id) : arsipApi.deleteInstitutionalUnit(item.unit_id), item.deleted_at ? 'Unit dipulihkan.' : 'Unit dinonaktifkan.')}>{item.deleted_at ? 'Pulihkan' : 'Nonaktifkan'}</Button></div>
                </div>)}
            </div>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold text-zinc-800">Folder Lembaga</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
                <TextField size="small" label="Nama folder" value={folder.name} onChange={(e) => setFolder({ ...folder, name: e.target.value })} />
                <TextField select size="small" label="Parent" value={folder.parent_category_id} onChange={(e) => setFolder({ ...folder, parent_category_id: e.target.value })}><MenuItem value="">Root</MenuItem>{parentOptions.map((item) => <MenuItem key={item.category_id} value={item.category_id}>{item.name}</MenuItem>)}</TextField>
                <TextField size="small" label="Deskripsi" value={folder.description} onChange={(e) => setFolder({ ...folder, description: e.target.value })} />
            </div>
            <Button sx={{ mt: 2, textTransform: 'none' }} variant="contained" disabled={saving || !folder.name.trim()} onClick={async () => { const ok = await run(() => editingFolderId ? arsipApi.updateInstitutionalCategory(editingFolderId, { ...folder, parent_category_id: folder.parent_category_id || null }) : arsipApi.createInstitutionalCategory({ ...folder, parent_category_id: folder.parent_category_id || null }), editingFolderId ? 'Folder berhasil diperbarui.' : 'Folder berhasil dibuat.'); if (ok) cancelFolderEdit(); }}>{editingFolderId ? 'Simpan Folder' : 'Tambah Folder'}</Button>
            {editingFolderId && <Button sx={{ mt: 2, ml: 1, textTransform: 'none' }} disabled={saving} onClick={cancelFolderEdit}>Batal</Button>}
            <div className="mt-4 divide-y divide-zinc-100">
                {!folders.length && <p className="py-3 text-sm text-zinc-500">Belum ada folder.</p>}
                {treeRows().map(({ item, depth }) => <div key={item.category_id} className="flex items-center justify-between py-2 text-sm" style={{ paddingLeft: depth * 20 }}>
                    <span className={item.deleted_at ? 'text-zinc-400 line-through' : 'text-zinc-700'}>{depth ? '└ ' : ''}{item.name}</span>
                    <div><Button size="small" disabled={saving || !!item.deleted_at} onClick={() => { setEditingFolderId(item.category_id); setFolder({ name: item.name, description: item.description || '', parent_category_id: item.parent_category_id || '' }); }}>Edit</Button><Button size="small" color={item.deleted_at ? 'primary' : 'error'} disabled={saving} onClick={() => run(() => item.deleted_at ? arsipApi.restoreInstitutionalCategory(item.category_id) : arsipApi.deleteInstitutionalCategory(item.category_id), item.deleted_at ? 'Folder dipulihkan.' : 'Folder dinonaktifkan.')}>{item.deleted_at ? 'Pulihkan' : 'Nonaktifkan'}</Button></div>
                </div>)}
            </div>
        </section>
    </div>;
}
