import { useEffect, useState } from 'react';
import { Alert, Button, TextField } from '@mui/material';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';

const buttonSx = {
    borderRadius: '0.5rem',
    textTransform: 'none',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
};

const defaultForm = {
    mahasiswa_quota_mb: 50,
    dosen_quota_mb: 50,
    default_max_file_size_mb: 10,
    default_allowed_extensions: 'pdf, jpg, jpeg, png, doc, docx, xls, xlsx',
};

function normalizeExtensions(value) {
    return String(value || '')
        .split(/[,\n]/)
        .map((extension) => extension.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean);
}

export default function AdminSettings() {
    const [form, setForm] = useState(defaultForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadSettings = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await arsipApi.settings();
            const settings = response.data || response;
            setForm({
                mahasiswa_quota_mb: settings?.personal_quota_mb_by_role?.mahasiswa ?? 50,
                dosen_quota_mb: settings?.personal_quota_mb_by_role?.dosen ?? 50,
                default_max_file_size_mb: settings?.default_max_file_size_mb ?? 10,
                default_allowed_extensions: Array.isArray(settings?.default_allowed_extensions)
                    ? settings.default_allowed_extensions.join(', ')
                    : defaultForm.default_allowed_extensions,
            });
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const updateField = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const saveSettings = async () => {
        setSaving(true);
        setError('');
        try {
            await arsipApi.updateSettings({
                default_max_file_size_mb: Number(form.default_max_file_size_mb),
                default_allowed_extensions: normalizeExtensions(form.default_allowed_extensions),
                personal_quota_mb_by_role: {
                    mahasiswa: Number(form.mahasiswa_quota_mb),
                    dosen: Number(form.dosen_quota_mb),
                },
            });
            customSwal.toast.success({ message: 'Pengaturan berhasil disimpan.' });
            await loadSettings();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="font-jakarta">
            <PageHeader
                title="Pengaturan"
                subtitle="Atur kuota arsip pribadi dan batas upload default. Kuota ini hanya berlaku untuk Arsip Saya, bukan Permintaan Berkas atau Distribusi."
                actions={
                    <Button
                        variant="outlined"
                        startIcon={<RefreshOutlined />}
                        onClick={loadSettings}
                        disabled={loading || saving}
                        sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}
                    >
                        Refresh
                    </Button>
                }
            />

            {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>
                    {error}
                </Alert>
            )}

            <section className="bg-white rounded-lg border border-zinc-200 p-4 space-y-5">
                <div>
                    <p className="text-sm font-semibold text-zinc-800">Kuota Arsip Pribadi</p>
                    <p className="text-xs text-zinc-500 mt-1">
                        Jika total arsip pribadi pengguna melebihi kuota, upload baru di Arsip Saya akan ditolak.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField
                        type="number"
                        size="small"
                        label="Kuota Mahasiswa (MB)"
                        value={form.mahasiswa_quota_mb}
                        onChange={(event) => updateField('mahasiswa_quota_mb', event.target.value)}
                        inputProps={{ min: 1 }}
                        fullWidth
                    />
                    <TextField
                        type="number"
                        size="small"
                        label="Kuota Dosen (MB)"
                        value={form.dosen_quota_mb}
                        onChange={(event) => updateField('dosen_quota_mb', event.target.value)}
                        inputProps={{ min: 1 }}
                        fullWidth
                    />
                </div>

                <div className="border-t border-zinc-200 pt-5">
                    <p className="text-sm font-semibold text-zinc-800">Batas Upload Default</p>
                    <p className="text-xs text-zinc-500 mt-1">
                        Dipakai sebagai batas file default untuk arsip pribadi dan fallback request jika request tidak punya aturan khusus.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField
                        type="number"
                        size="small"
                        label="Maks ukuran per file (MB)"
                        value={form.default_max_file_size_mb}
                        onChange={(event) => updateField('default_max_file_size_mb', event.target.value)}
                        inputProps={{ min: 1 }}
                        fullWidth
                    />
                    <TextField
                        size="small"
                        label="Ekstensi diizinkan"
                        value={form.default_allowed_extensions}
                        onChange={(event) => updateField('default_allowed_extensions', event.target.value)}
                        helperText="Pisahkan dengan koma atau baris baru. Contoh: pdf, jpg, png"
                        fullWidth
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        variant="contained"
                        startIcon={<SaveOutlined />}
                        onClick={saveSettings}
                        disabled={loading || saving}
                        sx={{ ...buttonSx, backgroundColor: '#2563eb' }}
                    >
                        {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </Button>
                </div>
            </section>
        </div>
    );
}
