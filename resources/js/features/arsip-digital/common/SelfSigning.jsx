import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Alert, Box, Button, CircularProgress, FormControlLabel, IconButton, MenuItem, Paper, Radio, RadioGroup, TextField } from '@mui/material';
import { AddOutlined, DeleteOutline, DownloadOutlined, UploadFileOutlined } from '@mui/icons-material';
import PageHeader from '../../../components/PageHeader';
import { useUser } from '../../../contexts/UserContext';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PLACEMENTS = 20;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 180000;
const idOf = (file) => file?.file_id ?? file?.id;
const nameOf = (file) => file?.display_filename || file?.original_filename || file?.filename || 'dokumen.pdf';
const unwrapFiles = (response) => {
    const payload = response?.data ?? response;
    const files = payload?.files ?? payload?.data ?? payload;
    return Array.isArray(files) ? files : [];
};
const isPdf = (file) => file?.mime_type === 'application/pdf' || file?.extension === 'pdf' || nameOf(file).toLowerCase().endsWith('.pdf');
const sessionIdOf = (response) => {
    const payload = response?.data ?? response;
    return payload?.sign_session_id ?? payload?.session?.sign_session_id ?? payload?.id ?? payload?.session_id ?? payload?.session?.id ?? payload?.session?.session_id;
};
const pngFileFromDataUrl = (value) => {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]*={0,2})$/.exec(value || '');
    if (!match || match[1].length % 4) throw new Error('Data tanda tangan PNG tidak valid.');
    let binary;
    try { binary = atob(match[1]); } catch { throw new Error('Data tanda tangan PNG tidak valid.'); }
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw new Error('Data tanda tangan PNG tidak valid.');
    return new File([bytes], 'signature.png', { type: 'image/png' });
};

function DrawSignature({ onChange }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const point = (event) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return [(event.clientX - rect.left) * canvasRef.current.width / rect.width, (event.clientY - rect.top) * canvasRef.current.height / rect.height];
    };
    const start = (event) => {
        drawing.current = true;
        const [x, y] = point(event);
        const context = canvasRef.current.getContext('2d');
        context.beginPath();
        context.moveTo(x, y);
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const move = (event) => {
        if (!drawing.current) return;
        const [x, y] = point(event);
        const context = canvasRef.current.getContext('2d');
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.strokeStyle = '#172554';
        context.lineTo(x, y);
        context.stroke();
    };
    const stop = () => {
        if (!drawing.current) return;
        drawing.current = false;
        onChange(canvasRef.current.toDataURL('image/png'));
    };
    return <canvas ref={canvasRef} width="480" height="160" aria-label="Area gambar tanda tangan" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} className="w-full h-28 border border-zinc-300 rounded touch-none bg-white" />;
}

function PdfPage({ pdf, pageNumber, placements, signature, canAdd, onAdd, onUpdate, onDelete }) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const [ratio, setRatio] = useState(1.414);
    useEffect(() => {
        let cancelled = false;
        let page;
        let renderTask;
        const render = async () => {
            page = await pdf.getPage(pageNumber);
            if (cancelled || !canvasRef.current) return;
            const base = page.getViewport({ scale: 1 });
            const width = Math.min(900, wrapRef.current?.clientWidth || 700);
            const viewport = page.getViewport({ scale: width / base.width });
            const canvas = canvasRef.current;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;
            setRatio(viewport.height / viewport.width);
            renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
            try { await renderTask.promise; } catch (error) { if (error?.name !== 'RenderingCancelledException') throw error; }
        };
        render().catch(() => {});
        return () => {
            cancelled = true;
            renderTask?.cancel();
            renderTask?.promise.catch(() => {}).finally(() => page?.cleanup());
            if (!renderTask) page?.cleanup();
        };
    }, [pdf, pageNumber]);
    const beginMove = (event, placement, resize = false) => {
        event.stopPropagation();
        const startX = event.clientX;
        const startY = event.clientY;
        const rect = wrapRef.current.getBoundingClientRect();
        const initial = { ...placement };
        const move = (next) => {
            const dx = (next.clientX - startX) / rect.width;
            const dy = (next.clientY - startY) / rect.height;
            if (resize) onUpdate(placement.id, { width: Math.max(.06, Math.min(1 - initial.x, initial.width + dx)), height: Math.max(.025, Math.min(1 - initial.y, initial.height + dy)) });
            else onUpdate(placement.id, { x: Math.max(0, Math.min(1 - initial.width, initial.x + dx)), y: Math.max(0, Math.min(1 - initial.height, initial.y + dy)) });
        };
        const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
    };
    return (
        <Paper ref={wrapRef} variant="outlined" onDoubleClick={(event) => {
            if (!signature || !canAdd) return;
            const rect = wrapRef.current.getBoundingClientRect();
            onAdd(pageNumber, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
        }} sx={{ position: 'relative', width: '100%', maxWidth: 900, aspectRatio: `1 / ${ratio}`, mx: 'auto', overflow: 'hidden', cursor: signature ? 'crosshair' : 'default' }}>
            <canvas ref={canvasRef} className="block max-w-full" />
            {placements.map((item) => <Box key={item.id} onPointerDown={(event) => beginMove(event, item)} sx={{ position: 'absolute', left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%`, border: '2px solid', borderColor: 'primary.main', bgcolor: 'rgba(255,255,255,.8)', cursor: 'move', userSelect: 'none' }}>
                {item.kind === 'text' ? <span className="flex h-full items-center justify-center font-serif italic text-blue-950 overflow-hidden">{item.payload}</span> : <img src={item.payload} alt="Tanda tangan" className="w-full h-full object-contain pointer-events-none" />}
                <button type="button" aria-label="Ubah ukuran tanda tangan" onPointerDown={(event) => beginMove(event, item, true)} className="absolute right-0 bottom-0 w-5 h-5 bg-blue-700 cursor-se-resize" />
                <IconButton aria-label="Hapus tanda tangan" size="small" onClick={(event) => { event.stopPropagation(); onDelete(item.id); }} sx={{ position: 'absolute', right: -12, top: -14, bgcolor: 'white' }}><DeleteOutline fontSize="small" /></IconButton>
            </Box>)}
            <span className="absolute left-2 bottom-2 bg-zinc-900/70 text-white px-2 py-1 rounded text-xs">Halaman {pageNumber}</span>
        </Paper>
    );
}

export default function SelfSigning({ requestMode = false }) {
    const { role } = useUser();
    const { requestId, fileId } = useParams();
    const navigate = useNavigate();
    const isAdmin = role === 'admin';
    const [files, setFiles] = useState([]);
    const [sourceId, setSourceId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [sourceName, setSourceName] = useState('dokumen-ditandatangani.pdf');
    const [pdf, setPdf] = useState(null);
    const [method, setMethod] = useState('draw');
    const [signature, setSignature] = useState(null);
    const [text, setText] = useState('');
    const [placements, setPlacements] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [configWarning, setConfigWarning] = useState('');
    const [result, setResult] = useState(null);
    const [maxFileSizeMb, setMaxFileSizeMb] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [finalizeFailed, setFinalizeFailed] = useState(false);
    const pollTimer = useRef(null);
    const pollCancel = useRef(null);
    const mounted = useRef(true);

    useEffect(() => {
        const loadLimit = requestMode ? arsipApi.signatureRequestConfig() : isAdmin ? arsipApi.settings().catch(() => arsipApi.signatureRequestConfig()) : Promise.resolve(null);
        loadLimit.then((response) => {
            const settings = response?.data ?? response;
            const value = requestMode ? settings?.signature_request_max_file_size_mb : settings?.default_max_file_size_mb;
            if (value != null) setMaxFileSizeMb(Number(value));
        }).catch(async (err) => setConfigWarning((await formatArsipError(err)).message));
        if (requestMode) {
            setBusy(true);
            arsipApi.createRequestSigningSession(fileId).then(async (response) => {
                const session = response?.data ?? response;
                setSessionId(session?.sign_session_id);
                await loadPdf(await arsipApi.requestSigningSource(fileId), fileId, session?.source_filename || session?.filename || 'dokumen.pdf');
            }).catch(async (err) => setError((await formatArsipError(err)).message)).finally(() => setBusy(false));
            return;
        }
        if (isAdmin) return;
        arsipApi.files({ per_page: 100 }).then((response) => setFiles(unwrapFiles(response).filter((file) => isPdf(file) && file.storage_available !== false))).catch(async (err) => setError((await formatArsipError(err)).message));
    }, [isAdmin, requestMode, requestId, fileId]);
    useEffect(() => () => pdf?.destroy(), [pdf]);
    useEffect(() => () => { mounted.current = false; clearTimeout(pollTimer.current); pollCancel.current?.(); }, []);

    const loadPdf = async (blob, id, filename) => {
        const document = await getDocument({ data: await blob.arrayBuffer() }).promise;
        setPdf(document);
        setSourceId(id);
        setSourceName(filename.replace(/\.pdf$/i, '') + '-ditandatangani.pdf');
        setPlacements([]);
        setResult(null);
    };
    const sessionOf = (response) => response?.data?.session ?? response?.session ?? response?.data ?? response;
    const selectArchive = async (id) => {
        setBusy(true); setError('');
        try {
            const file = files.find((item) => String(idOf(item)) === String(id));
            const response = await arsipApi.createSigningSession({ file_id: id });
            setSessionId(sessionIdOf(response));
            await loadPdf(await arsipApi.signingSource(id), id, nameOf(file));
        } catch (err) { setError((await formatArsipError(err)).message); } finally { setBusy(false); }
    };
    const upload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (file.type && file.type !== 'application/pdf') { setError('File harus berformat PDF.'); return; }
        if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Ekstensi file harus .pdf.'); return; }
        if (maxFileSizeMb != null && file.size > maxFileSizeMb * 1024 * 1024) { setError(`Ukuran file melebihi batas ${maxFileSizeMb} MB.`); return; }
        setBusy(true); setError('');
        try {
            const form = new FormData(); form.append('file', file);
            const response = await arsipApi.createSigningSession(form, true);
            setSessionId(sessionIdOf(response));
            await loadPdf(file, '', file.name);
        } catch (err) { setError((await formatArsipError(err)).message); } finally { setBusy(false); }
    };
    const chooseImage = (event) => {
        const file = event.target.files?.[0];
        if (!file || file.type !== 'image/png') { setError('Tanda tangan upload harus berformat PNG.'); return; }
        const reader = new FileReader(); reader.onload = () => setSignature({ kind: 'png', payload: reader.result }); reader.readAsDataURL(file);
    };
    const activeSignature = method === 'text' ? (text.trim() ? { kind: 'text', payload: text.trim(), method } : null) : (signature ? { ...signature, method } : null);
    const addPlacement = (page, x, y) => setPlacements((items) => items.length >= MAX_PLACEMENTS ? items : [...items, { id: crypto.randomUUID(), page, x, y, width: .25, height: .08, ...activeSignature }]);
    const requestFileSynced = (session) => !requestMode || session?.request_file_synced || session?.request_file?.signed_at || session?.request_file?.result_sha256;
    const safeError = (message) => String(message || 'Pemrosesan PDF gagal.').replace(/[<>\u0000-\u001f]/g, '').slice(0, 300);
    const waitForFinalized = (id) => new Promise((resolve, reject) => {
        const started = Date.now();
        let retries = 0;
        let settled = false;
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(pollTimer.current);
            pollCancel.current = null;
            callback(value);
        };
        pollCancel.current = () => finish(resolve, null);
        const poll = async () => {
            if (!mounted.current) { finish(resolve, null); return; }
            if (Date.now() - started >= POLL_TIMEOUT_MS) { finish(reject, new Error('Pemrosesan PDF melewati batas waktu 180 detik. Silakan coba lagi.')); return; }
            try {
                const session = sessionOf(await arsipApi.signingSession(id));
                retries = 0;
                if (session?.status === 'failed') { finish(reject, new Error(safeError(session?.error_message || session?.message))); return; }
                if (session?.status === 'finalized' && requestFileSynced(session)) { finish(resolve, session); return; }
                pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
            } catch (err) {
                const status = err?.response?.status;
                if ([401, 403, 404, 410].includes(status) || status && status < 500) { finish(reject, err); return; }
                retries += 1;
                pollTimer.current = setTimeout(poll, Math.min(POLL_INTERVAL_MS * 2 ** retries, 10000));
            }
        };
        poll();
    });
    const finalize = async () => {
        if (processing) return;
        setBusy(true); setProcessing(true); setFinalizeFailed(false); setResult(null); setError('');
        try {
            const form = new FormData();
            form.append('placements', JSON.stringify(placements.map((placement) => ({
                method: placement.kind === 'text' ? 'text' : placement.method,
                page: placement.page,
                x: placement.x,
                y: placement.y,
                width: placement.width,
                height: placement.height,
                ...(placement.kind === 'text' ? { text: placement.payload } : {}),
            }))));
            placements.forEach((placement, index) => {
                if (placement.kind === 'png') form.append(`signatures[${index}]`, pngFileFromDataUrl(placement.payload));
            });
            const response = requestMode
                ? await arsipApi.finalizeRequestSigning(sessionId, form)
                : await arsipApi.finalizeSigning(sessionId, form);
            const initial = sessionOf(response);
            const completed = initial?.status === 'finalized' && requestFileSynced(initial) ? initial : await waitForFinalized(sessionId);
            if (!mounted.current || !completed) return;
            setResult(completed);
            if (requestMode) navigate(`/home/request-tanda-tangan/${requestId}`);
        } catch (err) {
            if (mounted.current) { setFinalizeFailed(true); setError(err instanceof Error ? err.message : (await formatArsipError(err)).message); }
        } finally {
            if (mounted.current) { setBusy(false); setProcessing(false); }
        }
    };
    const download = async () => {
        setBusy(true); setError('');
        try { await arsipApi.downloadSignedFile(sessionId, sourceName); }
        catch (err) { setError((await formatArsipError(err)).message); }
        finally { setBusy(false); }
    };
    const save = async () => {
        setBusy(true); setError('');
        try {
            await arsipApi.saveSignedFile(sessionId, { display_filename: sourceName });
            setSessionId('');
            setPdf(null);
            setPlacements([]);
            setResult({ saved: true });
        } catch (err) { setError((await formatArsipError(err)).message); } finally { setBusy(false); }
    };

    return <div>
        <PageHeader title="Tanda Tangan PDF" subtitle="Buat tanda tangan, tempatkan pada halaman, lalu finalisasi dokumen." />
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {configWarning && <Alert severity="warning" onClose={() => setConfigWarning('')} sx={{ mb: 2 }}>Batas ukuran PDF tidak dapat dimuat: {configWarning}</Alert>}
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
            <Paper variant="outlined" className="p-4 space-y-4 xl:sticky xl:top-4">
                <h2 className="font-semibold text-zinc-800">1. Pilih PDF</h2>
                {requestMode ? <Alert severity="info">Sumber PDF ditetapkan oleh request.</Alert> : isAdmin ? <Button component="label" variant="outlined" startIcon={<UploadFileOutlined />} fullWidth>Upload PDF<input hidden type="file" accept="application/pdf,.pdf" onChange={upload} /></Button> : <TextField select fullWidth size="small" label="File Arsip Saya" value={sourceId} onChange={(event) => selectArchive(event.target.value)}><MenuItem value="">Pilih PDF</MenuItem>{files.map((file) => <MenuItem key={idOf(file)} value={idOf(file)}>{nameOf(file)}</MenuItem>)}</TextField>}
                <p className="text-xs text-zinc-500">{isAdmin ? (maxFileSizeMb == null ? 'Memuat batas ukuran PDF...' : `PDF maksimal ${maxFileSizeMb} MB.`) : `${files.length} PDF tersedia.`}</p>
                <hr />
                <h2 className="font-semibold text-zinc-800">2. Buat tanda tangan</h2>
                <RadioGroup row value={method} onChange={(event) => { setMethod(event.target.value); setSignature(null); }}><FormControlLabel value="draw" control={<Radio size="small" />} label="Draw" /><FormControlLabel value="text" control={<Radio size="small" />} label="Text" /><FormControlLabel value="upload" control={<Radio size="small" />} label="PNG" /></RadioGroup>
                {method === 'draw' && <DrawSignature onChange={(payload) => setSignature({ kind: 'png', payload })} />}
                {method === 'text' && <TextField fullWidth size="small" label="Nama tanda tangan" value={text} onChange={(event) => setText(event.target.value)} inputProps={{ maxLength: 80 }} />}
                {method === 'upload' && <Button component="label" variant="outlined" fullWidth>Upload PNG<input hidden type="file" accept="image/png,.png" onChange={chooseImage} /></Button>}
                <Button startIcon={<AddOutlined />} variant="contained" fullWidth disabled={!pdf || !activeSignature || placements.length >= MAX_PLACEMENTS} onClick={() => addPlacement(1, .65, .75)}>Tambahkan</Button>
                <p className="text-xs text-zinc-500">{placements.length}/{MAX_PLACEMENTS} penempatan. Tombol Tambahkan menempatkan tanda tangan ke halaman 1. Untuk halaman lain, scroll ke halaman tujuan lalu klik dua kali pada posisi yang diinginkan. Tarik untuk memindahkan; gunakan kotak biru untuk mengubah ukuran.</p>
                <Button variant="contained" disabled={!placements.length || busy || processing || !!result} onClick={finalize}>{finalizeFailed ? 'Coba Finalisasi Lagi' : 'Finalisasi'}</Button>
                {processing && <Alert severity="info">PDF sedang diproses. Status diperiksa otomatis hingga 180 detik. Mohon tunggu...</Alert>}
                {result && !result.saved && <Alert severity="success">PDF selesai diproses.{!requestMode && <><div className="mt-2 flex gap-2 flex-wrap"><Button size="small" disabled={busy} startIcon={<DownloadOutlined />} onClick={download}>Download</Button>{!isAdmin && <Button size="small" disabled={busy} onClick={save}>Simpan ke Arsip Saya</Button>}</div>{!isAdmin && <p className="mt-2 text-xs">Simpan mengakhiri sesi tanda tangan. Download hasil terlebih dahulu bila diperlukan.</p>}</>}</Alert>}
                {result?.saved && <Alert severity="success">PDF tersimpan di Arsip Saya. Sesi tanda tangan telah berakhir.</Alert>}
            </Paper>
            <Box sx={{ bgcolor: 'grey.100', borderRadius: 2, p: { xs: 1, sm: 2 }, minHeight: 400 }}>
                {busy && <div className="flex justify-center p-8"><CircularProgress aria-label="Memproses PDF" /></div>}
                {!busy && !pdf && <div className="text-center text-zinc-500 p-16">Pilih PDF untuk membuka editor.</div>}
                {!busy && pdf && <div className="space-y-5">{Array.from({ length: pdf.numPages }, (_, index) => <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} placements={placements.filter((item) => item.page === index + 1)} signature={activeSignature} canAdd={placements.length < MAX_PLACEMENTS} onAdd={(page, x, y) => addPlacement(page, Math.min(.75, x), Math.min(.9, y))} onUpdate={(id, patch) => setPlacements((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))} onDelete={(id) => setPlacements((items) => items.filter((item) => item.id !== id))} />)}</div>}
            </Box>
        </div>
    </div>;
}
