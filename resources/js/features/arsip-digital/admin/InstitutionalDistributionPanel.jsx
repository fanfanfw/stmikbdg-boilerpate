import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Pagination, TextField } from '@mui/material';
import TargetPicker from '../components/TargetPicker';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { distributionActionPolicy, distributionListRequest, distributionPanelController, distributionPreviewConfirmed, distributionRecipientStatus, distributionTargetFingerprint, fetchDistributionPanelData, loadControlledPage, recipientPageRequest, runAuthoritativePublish, runControlledPageRefresh } from './institutionalArchiveUi';

export default function InstitutionalDistributionPanel({ archiveId, active }) {
    const currentArchiveId = useRef(String(archiveId)); currentArchiveId.current = String(archiveId);
    const controller = useRef(null); if (!controller.current) controller.current = distributionPanelController(id => currentArchiveId.current === String(id));
    const [rows, setRows] = useState([]); const [listMeta, setListMeta] = useState({ current_page: 1, last_page: 1 }); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [preview, setPreview] = useState(null); const [previewFingerprint, setPreviewFingerprint] = useState(null); const [recipients, setRecipients] = useState(null); const [withdraw, setWithdraw] = useState(null);
    const [form, setForm] = useState({ title: '', description: '', expires_at: '' }); const [targets, setTargets] = useState({ target_role: 'mahasiswa', scope_type: 'specific', target_filters: {}, target_identifiers: [], target_segment_ids: [] }); const targetsRef = useRef(targets); targetsRef.current = targets; const policy = distributionActionPolicy(active);
    const load = async (capture, page = 1) => { const result = await loadControlledPage({ capture, page, perPage: 10, requestParams: distributionListRequest, rowsKey: 'distributions', request: async params => (await arsipApi.institutionalDistributions(capture.archiveId, params)).data }); return result && { distributions: result.rows, meta: result.meta }; };
    const refresh = async (capture, page = 1) => { const data = await load(capture, page); if (data !== null && capture.valid()) { setRows(data.distributions || []); setListMeta(data.meta || data.pagination || { current_page: page, last_page: 1 }); } return data; };
    const refreshPage = page => { const capture = controller.current.capture('list'); setError(''); return runControlledPageRefresh({ capture, refresh: () => refresh(capture, page), onError: setError, formatError: formatArsipError }); };
    useEffect(() => {
        const owner = controller.current; owner.select(archiveId); setRows([]); setPreview(null); setPreviewFingerprint(null); setRecipients(null); setWithdraw(null); setError(''); setMessage(''); setBusy(false);
        const capture = owner.capture('list'); refresh(capture).catch(async e => { const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); });
        return () => { if (currentArchiveId.current === String(archiveId)) owner.select(`invalid:${archiveId}`); };
    }, [archiveId, active]);
    useEffect(() => () => controller.current.close(), []);
    const action = async request => {
        const capture = controller.current.beginAction(); if (!capture) return false;
        if (capture.valid()) { setBusy(true); setError(''); setMessage(''); }
        try {
            await request(capture); if (!capture.valid()) return false;
            const listCapture = controller.current.capture('list'); const data = await load(listCapture, listMeta.current_page); if (!capture.valid() || !listCapture.valid() || data === null) return false;
            setRows(data.distributions || []); setListMeta(data.meta || data.pagination || { current_page: 1, last_page: 1 }); setMessage('Distribusi berhasil diperbarui.'); return true;
        } catch (e) {
            if (!capture.valid()) return false; const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); return false;
        } finally {
            const validOwner = controller.current.release(capture); if (validOwner) setBusy(false);
        }
    };
    const publish = async row => {
        const capture = controller.current.beginAction(); if (!capture) return false;
        if (capture.valid()) { setBusy(true); setError(''); setMessage(''); }
        const result = await runAuthoritativePublish({ capture, distributionId: row.distribution_id, fetchDistribution: async id => (await arsipApi.institutionalDistribution(id)).data.distribution, confirm: source => window.confirm(`Publish exact file ini?\nID: ${source.source_file_id}\nVersi: ${source.version_number}\nNama: ${source.filename}`), publish: arsipApi.publishInstitutionalDistribution, refresh: async () => { const listCapture = controller.current.capture('list'); const data = await load(listCapture, listMeta.current_page); if (capture.valid() && data !== null) { setRows(data.distributions || []); setListMeta(data.meta || data.pagination || listMeta); } }, onStale: () => setError('Versi sumber berubah. Data telah diperbarui; periksa exact file lalu konfirmasi publish kembali.'), onError: setError, formatError: formatArsipError });
        const validOwner = controller.current.release(capture); if (validOwner) { setBusy(false); if (result) setMessage('Distribusi berhasil dipublish.'); }
        return result;
    };
    const previewTargets = async () => {
        const payload = structuredClone(targets); const fingerprint = distributionTargetFingerprint(payload); const capture = controller.current.capture('preview'); if (capture.valid()) { setError(''); setMessage(''); }
        try { const data = await fetchDistributionPanelData(capture, async () => (await arsipApi.previewInstitutionalDistributionTargets(capture.archiveId, payload)).data.preview); if (data !== null && capture.valid() && fingerprint === distributionTargetFingerprint(targetsRef.current)) { setPreview(data); setPreviewFingerprint(fingerprint); setMessage('Preview target diperbarui.'); } }
        catch (e) { if (!capture.valid()) return; const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); }
    };
    const loadRecipients = async (row, page = 1) => {
        const capture = controller.current.capture('recipients'); if (capture.valid()) { setError(''); setMessage(''); }
        try { const data = await fetchDistributionPanelData(capture, async () => (await arsipApi.institutionalDistributionRecipients(row.distribution_id, recipientPageRequest(page))).data); if (data !== null && capture.valid()) setRecipients({ row, rows: data.recipients || [], meta: data.meta || data.pagination || { current_page: page, last_page: 1 } }); }
        catch (e) { if (!capture.valid()) return; const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); }
    };
    return <div className="space-y-3 p-4 border rounded"><h2 className="font-bold">Distribusi mahasiswa/dosen</h2>{!active && <Alert severity="warning">Arsip terhapus. Pembuatan, preview target, dan publish baru dinonaktifkan; distribusi lama tetap tersedia.</Alert>}{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
        <div className="grid md:grid-cols-2 gap-2"><TextField disabled={!policy.create || busy} label="Judul distribusi" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><TextField disabled={!policy.create || busy} label="Pesan" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><TextField disabled={!policy.create || busy} type="datetime-local" label="Kedaluwarsa (zona waktu perangkat)" InputLabelProps={{ shrink: true }} value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div>
        <TargetPicker value={targets} onChange={value => { controller.current.capture('preview'); targetsRef.current = value; setTargets(value); setPreview(null); setPreviewFingerprint(null); }} disabled={!policy.create || busy} />
        <div className="flex gap-2"><Button disabled={!policy.previewTargets || busy} onClick={previewTargets}>Preview target</Button><Button variant="contained" disabled={!active || busy || !form.title.trim() || !distributionPreviewConfirmed(preview, targets, previewFingerprint)} onClick={() => { const payloadTargets = structuredClone(targetsRef.current); if (!distributionPreviewConfirmed(preview, payloadTargets, previewFingerprint)) return false; const payload = { ...payloadTargets, title: form.title, description: form.description || null, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null }; return action(capture => arsipApi.createInstitutionalDistribution(capture.archiveId, payload)); }}>Simpan draft</Button></div>
        {preview && <div><strong>{preview.total_valid} valid · {preview.total_invalid} invalid</strong>{[...(preview.valid_targets || []), ...(preview.invalid_targets || [])].slice(0, 100).map(x => <div key={`${x.target_role}-${x.identifier}`}>{x.identifier} · {x.name_snapshot || x.reason}</div>)}</div>}
        {rows.length === 0 ? <div>Belum ada distribusi.</div> : rows.map(row => <div key={row.distribution_id} className="flex flex-wrap gap-2 items-center p-2 border rounded"><strong>{row.title}</strong><span>Status: {row.status}</span><span>Penerima: {row.recipients_count}</span><span>Versi file terkunci: #{row.source_file_id || 'saat publish'}</span><span>Expiry: {row.expires_at ? new Date(row.expires_at).toLocaleString('id-ID') : 'Tanpa batas'}</span>{row.status === 'draft' && <Button disabled={!policy.publish || busy} onClick={() => publish(row)}>Publish</Button>}{row.status === 'published' && <Button color="error" disabled={busy} onClick={() => setWithdraw({ row, reason: '' })}>Tarik</Button>}<Button disabled={busy} onClick={() => loadRecipients(row)}>Penerima</Button></div>)}
        <Pagination page={listMeta.current_page || 1} count={listMeta.last_page || 1} onChange={(_, page) => refreshPage(page)} />
        {recipients && <div className="overflow-auto"><h3 className="font-bold">Penerima: {recipients.row.title}</h3><table className="w-full text-sm"><thead><tr><th>Identifier</th><th>Nama</th><th>Status</th><th>Pertama</th><th>Terakhir</th><th>Jumlah</th></tr></thead><tbody>{recipients.rows.map(x => <tr key={x.recipient_id}><td>{x.identifier}</td><td>{x.name_snapshot}</td><td>{distributionRecipientStatus(x, recipients.row)}</td><td>{x.first_downloaded_at ? new Date(x.first_downloaded_at).toLocaleString('id-ID') : '-'}</td><td>{x.last_downloaded_at ? new Date(x.last_downloaded_at).toLocaleString('id-ID') : '-'}</td><td>{x.download_count || 0}</td></tr>)}</tbody></table><div className="flex gap-2"><Button disabled={recipients.meta.current_page <= 1} onClick={() => loadRecipients(recipients.row, recipients.meta.current_page - 1)}>Sebelumnya</Button><Button disabled={recipients.meta.current_page >= recipients.meta.last_page} onClick={() => loadRecipients(recipients.row, recipients.meta.current_page + 1)}>Berikutnya</Button></div></div>}
        <Dialog open={Boolean(withdraw)} onClose={() => !busy && setWithdraw(null)}><DialogTitle>Tarik distribusi?</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline label="Alasan wajib" value={withdraw?.reason || ''} onChange={e => setWithdraw({ ...withdraw, reason: e.target.value })} /></DialogContent><DialogActions><Button onClick={() => setWithdraw(null)}>Batal</Button><Button color="error" disabled={busy || !withdraw?.reason.trim()} onClick={() => action(() => arsipApi.withdrawInstitutionalDistribution(withdraw.row.distribution_id, withdraw.reason)).then(ok => { if (ok && controller.current.current(archiveId)) setWithdraw(null); })}>Tarik</Button></DialogActions></Dialog>
    </div>;
}
