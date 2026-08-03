import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import TargetPicker from '../components/TargetPicker';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { distributionPanelController, distributionPreviewConfirmed, distributionTargetFingerprint, fetchDistributionPanelData } from './institutionalArchiveUi';

export default function InstitutionalDistributionPanel({ archiveId, active }) {
    const currentArchiveId = useRef(String(archiveId)); currentArchiveId.current = String(archiveId);
    const controller = useRef(null); if (!controller.current) controller.current = distributionPanelController(id => currentArchiveId.current === String(id));
    const [rows, setRows] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [preview, setPreview] = useState(null); const [previewFingerprint, setPreviewFingerprint] = useState(null); const [recipients, setRecipients] = useState(null); const [withdraw, setWithdraw] = useState(null);
    const [form, setForm] = useState({ title: '', description: '', expires_at: '' }); const [targets, setTargets] = useState({ target_role: 'mahasiswa', scope_type: 'specific', target_filters: {}, target_identifiers: [], target_segment_ids: [] }); const targetsRef = useRef(targets); targetsRef.current = targets;
    const load = async capture => fetchDistributionPanelData(capture, async () => (await arsipApi.institutionalDistributions(capture.archiveId)).data.distributions || []);
    const refresh = async capture => { const data = await load(capture); if (data !== null && capture.valid()) setRows(data); return data; };
    useEffect(() => {
        const owner = controller.current; owner.select(archiveId); setRows([]); setPreview(null); setPreviewFingerprint(null); setRecipients(null); setWithdraw(null); setError(''); setMessage(''); setBusy(false);
        if (active) { const capture = owner.capture('list'); refresh(capture).catch(async e => { const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); }); }
        return () => { if (currentArchiveId.current === String(archiveId)) owner.select(`invalid:${archiveId}`); };
    }, [archiveId, active]);
    useEffect(() => () => controller.current.close(), []);
    const action = async request => {
        const capture = controller.current.beginAction(); if (!capture) return false;
        if (capture.valid()) { setBusy(true); setError(''); setMessage(''); }
        try {
            await request(capture); if (!capture.valid()) return false;
            const listCapture = controller.current.capture('list'); const data = await load(listCapture); if (!capture.valid() || !listCapture.valid() || data === null) return false;
            setRows(data); setMessage('Distribusi berhasil diperbarui.'); return true;
        } catch (e) {
            if (!capture.valid()) return false; const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); return false;
        } finally {
            const validOwner = controller.current.release(capture); if (validOwner) setBusy(false);
        }
    };
    const previewTargets = async () => {
        const payload = structuredClone(targets); const fingerprint = distributionTargetFingerprint(payload); const capture = controller.current.capture('preview'); if (capture.valid()) { setError(''); setMessage(''); }
        try { const data = await fetchDistributionPanelData(capture, async () => (await arsipApi.previewInstitutionalDistributionTargets(capture.archiveId, payload)).data.preview); if (data !== null && capture.valid() && fingerprint === distributionTargetFingerprint(targetsRef.current)) { setPreview(data); setPreviewFingerprint(fingerprint); setMessage('Preview target diperbarui.'); } }
        catch (e) { if (!capture.valid()) return; const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); }
    };
    const loadRecipients = async (row, page = 1) => {
        const capture = controller.current.capture('recipients'); if (capture.valid()) { setError(''); setMessage(''); }
        try { const data = await fetchDistributionPanelData(capture, async () => (await arsipApi.institutionalDistributionRecipients(row.distribution_id, { page, per_page: 25 })).data); if (data !== null && capture.valid()) setRecipients({ row, rows: data.recipients || [], meta: data.meta }); }
        catch (e) { if (!capture.valid()) return; const formatted = await formatArsipError(e); if (capture.valid()) setError(formatted.message); }
    };
    if (!active) return <Alert severity="warning">Arsip terhapus. Distribusi baru dinonaktifkan.</Alert>;
    return <div className="space-y-3 p-4 border rounded"><h2 className="font-bold">Distribusi mahasiswa/dosen</h2>{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
        <div className="grid md:grid-cols-2 gap-2"><TextField label="Judul distribusi" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /><TextField label="Pesan" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><TextField type="datetime-local" label="Kedaluwarsa (zona waktu perangkat)" InputLabelProps={{ shrink: true }} value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} /></div>
        <TargetPicker value={targets} onChange={value => { controller.current.capture('preview'); targetsRef.current = value; setTargets(value); setPreview(null); setPreviewFingerprint(null); }} disabled={busy} />
        <div className="flex gap-2"><Button disabled={busy} onClick={previewTargets}>Preview target</Button><Button variant="contained" disabled={busy || !form.title.trim() || !distributionPreviewConfirmed(preview, targets, previewFingerprint)} onClick={() => { const payloadTargets = structuredClone(targetsRef.current); if (!distributionPreviewConfirmed(preview, payloadTargets, previewFingerprint)) return false; const payload = { ...payloadTargets, title: form.title, description: form.description || null, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null }; return action(capture => arsipApi.createInstitutionalDistribution(capture.archiveId, payload)); }}>Simpan draft</Button></div>
        {preview && <div><strong>{preview.total_valid} valid · {preview.total_invalid} invalid</strong>{[...(preview.valid_targets || []), ...(preview.invalid_targets || [])].slice(0, 100).map(x => <div key={`${x.target_role}-${x.identifier}`}>{x.identifier} · {x.name_snapshot || x.reason}</div>)}</div>}
        {rows.length === 0 ? <div>Belum ada distribusi.</div> : rows.map(row => <div key={row.distribution_id} className="flex flex-wrap gap-2 items-center p-2 border rounded"><strong>{row.title}</strong><span>Status: {row.status}</span><span>Penerima: {row.recipients_count}</span><span>Versi file terkunci: #{row.source_file_id || 'saat publish'}</span><span>Expiry: {row.expires_at ? new Date(row.expires_at).toLocaleString('id-ID') : 'Tanpa batas'}</span>{row.status === 'draft' && <Button disabled={busy} onClick={() => window.confirm('Publish dan kunci versi file serta target hasil resolver saat ini?') && action(() => arsipApi.publishInstitutionalDistribution(row.distribution_id))}>Publish</Button>}{row.status === 'published' && <Button color="error" disabled={busy} onClick={() => setWithdraw({ row, reason: '' })}>Tarik</Button>}<Button disabled={busy} onClick={() => loadRecipients(row)}>Penerima</Button></div>)}
        {recipients && <div className="overflow-auto"><h3 className="font-bold">Penerima: {recipients.row.title}</h3><table className="w-full text-sm"><thead><tr><th>Identifier</th><th>Nama</th><th>Status</th><th>Pertama</th><th>Terakhir</th><th>Jumlah</th></tr></thead><tbody>{recipients.rows.map(x => <tr key={x.recipient_id}><td>{x.identifier}</td><td>{x.name_snapshot}</td><td>{x.delivery_status}</td><td>{x.first_downloaded_at ? new Date(x.first_downloaded_at).toLocaleString('id-ID') : '-'}</td><td>{x.last_downloaded_at ? new Date(x.last_downloaded_at).toLocaleString('id-ID') : '-'}</td><td>{x.download_count || 0}</td></tr>)}</tbody></table><div className="flex gap-2"><Button disabled={recipients.meta.current_page <= 1} onClick={() => loadRecipients(recipients.row, recipients.meta.current_page - 1)}>Sebelumnya</Button><Button disabled={recipients.meta.current_page >= recipients.meta.last_page} onClick={() => loadRecipients(recipients.row, recipients.meta.current_page + 1)}>Berikutnya</Button></div></div>}
        <Dialog open={Boolean(withdraw)} onClose={() => !busy && setWithdraw(null)}><DialogTitle>Tarik distribusi?</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline label="Alasan wajib" value={withdraw?.reason || ''} onChange={e => setWithdraw({ ...withdraw, reason: e.target.value })} /></DialogContent><DialogActions><Button onClick={() => setWithdraw(null)}>Batal</Button><Button color="error" disabled={busy || !withdraw?.reason.trim()} onClick={() => action(() => arsipApi.withdrawInstitutionalDistribution(withdraw.row.distribution_id, withdraw.reason)).then(ok => { if (ok && controller.current.current(archiveId)) setWithdraw(null); })}>Tarik</Button></DialogActions></Dialog>
    </div>;
}
