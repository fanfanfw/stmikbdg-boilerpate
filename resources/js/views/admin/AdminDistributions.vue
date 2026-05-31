<template>
    <section class="page-stack">
        <PageHeader eyebrow="Distribusi berkas" title="Kirim file ke penerima" description="Buat distribusi, pilih target penerima, publish, lalu upload file untuk masing-masing penerima.">
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh daftar</button></template>
        </PageHeader>

        <section class="panel-block">
            <div class="section-heading">
                <div>
                    <h2>Detail distribusi</h2>
                    <p>Judul dan catatan yang membantu admin mengenali batch pengiriman file.</p>
                </div>
            </div>
            <form class="form-grid" @submit.prevent="saveDistribution">
                <label>Judul<input v-model="form.title" required placeholder="Sertifikat Seminar AI 2026" /></label>
                <label class="wide">Deskripsi<textarea v-model="form.description" rows="3" placeholder="Catatan internal atau instruksi singkat" /></label>
            </form>
        </section>

        <TargetPicker @change="targeting = $event" />

        <section class="panel-block publish-panel">
            <div class="section-heading">
                <div>
                    <h2>Simpan distribusi</h2>
                    <p>{{ targeting?.summary || 'Pilih target penerima terlebih dahulu.' }}</p>
                </div>
                <div class="page-actions">
                    <button type="button" class="secondary-btn" :disabled="!targeting?.canSubmit" @click="previewTargets">Preview target</button>
                    <button type="button" :disabled="!targeting?.canSubmit" @click="saveDistribution">Simpan draft</button>
                </div>
            </div>
            <div class="target-preview-result">
                <AsyncState :loading="previewLoading" :error="previewError" :empty="!preview" empty-title="Belum ada preview" empty-text="Klik Preview target untuk memastikan penerima valid sebelum draft disimpan.">
                    <div class="metric-grid compact">
                        <article class="metric-card"><span>Total</span><strong>{{ preview.total_targets ?? 0 }}</strong></article>
                        <article class="metric-card"><span>Valid</span><strong>{{ preview.total_valid ?? 0 }}</strong></article>
                        <article class="metric-card"><span>Invalid</span><strong>{{ preview.total_invalid ?? 0 }}</strong></article>
                    </div>
                    <div class="data-list preview-list">
                        <article v-for="target in preview.valid_targets || []" :key="target.identifier" class="list-row"><div><strong>{{ target.identifier }}</strong><small>{{ target.name_snapshot || '-' }}</small></div><StatusPill status="approved" /></article>
                        <article v-for="target in preview.invalid_targets || []" :key="`invalid-${target.identifier}`" class="list-row"><div><strong>{{ target.identifier }}</strong><small>{{ target.reason || 'Tidak valid' }}</small></div><StatusPill status="rejected" /></article>
                    </div>
                </AsyncState>
            </div>
        </section>

        <section class="panel-block">
            <div class="section-heading"><h2>Daftar distribusi</h2></div>
            <AsyncState :loading="loading" :error="error" :empty="distributions.length === 0" empty-title="Belum ada distribusi" empty-text="Distribusi draft/published akan tampil di sini." @retry="load">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Distribusi</th><th>Target</th><th>Status</th><th>Penerima</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="item in distributions" :key="item.distribution_id" :class="selectedId === item.distribution_id ? 'selected-row' : ''">
                                <td><strong>{{ item.title }}</strong><small>{{ item.description || '-' }}</small></td>
                                <td>{{ item.target_role }}<small>{{ item.scope_type }}</small></td>
                                <td><StatusPill :status="item.status" /></td>
                                <td>{{ item.recipients_count ?? 0 }}</td>
                                <td class="action-cell">
                                    <button v-if="item.status === 'draft'" type="button" class="secondary-btn" @click="publish(item)">Publish</button>
                                    <button type="button" class="ghost-btn" @click="selectDistribution(item)">Penerima</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AsyncState>
        </section>

        <section v-if="selectedId" class="panel-block">
            <div class="section-heading">
                <div>
                    <h2>Penerima distribusi #{{ selectedId }}</h2>
                    <p v-if="selectedDistribution">{{ selectedDistribution.title }} · {{ statusLabel(selectedDistribution.status) }}</p>
                </div>
                <button type="button" class="secondary-btn" @click="refreshSelectedDistribution">Refresh</button>
            </div>

            <div v-if="isSelectedDistributionPublished" class="page-stack">
                <section class="notice-box info">
                    <div>
                        <strong>Bulk upload ZIP</strong>
                        <p>Upload satu ZIP berisi file personal. Sistem mencocokkan file ke penerima dari identifier pada nama file, lalu menampilkan preview sebelum file disimpan.</p>
                        <ul class="bulk-upload-guide">
                            <li>Mahasiswa: nama file harus memuat NIM, contoh <code>22123456.pdf</code> atau <code>22123456 - Nama Mahasiswa.pdf</code>.</li>
                            <li>Dosen: nama file harus memuat kode dosen atau <code>kd_dosen</code>, contoh <code>RP.pdf</code>, <code>LA - SK Mengajar.pdf</code>, atau <code>dokumen_DV_2024.pdf</code>. Jangan pakai NIDN, email, atau nama dosen kecuali identifier sistem sudah diubah.</li>
                            <li>File boleh langsung di root ZIP atau di dalam subfolder. Hanya file dengan status <strong>File cocok</strong> yang akan disimpan saat dikonfirmasi.</li>
                        </ul>
                    </div>
                </section>

                <form class="form-grid" @submit.prevent="uploadBulkZip">
                    <label class="wide">File ZIP
                        <input ref="bulkFileInput" type="file" accept=".zip,application/zip,application/x-zip-compressed" :disabled="bulkUploading" @change="selectBulkZip" />
                    </label>
                    <div class="wide page-actions">
                        <button type="submit" :disabled="bulkUploading || !bulkZipFile">{{ bulkUploading ? 'Mengunggah...' : 'Upload ZIP & preview' }}</button>
                        <button type="button" class="secondary-btn" :disabled="bulkLoading || !bulkJob" @click="loadBulkJob(bulkJob.bulk_upload_job_id)">Refresh status</button>
                    </div>
                </form>

                <div v-if="bulkZipFile" class="notice-box info">
                    <div>
                        <strong>ZIP dipilih</strong>
                        <p>{{ bulkZipFile.name }} · {{ formatBytes(bulkZipFile.size) }}</p>
                    </div>
                </div>

                <div v-if="bulkError" class="notice-box error">
                    <div>
                        <strong>Bulk upload ZIP belum bisa diproses</strong>
                        <p>{{ bulkError }}</p>
                    </div>
                </div>

                <div v-if="bulkLoading && !bulkJob" class="state-card muted-card">
                    <span class="loader" aria-hidden="true"></span>
                    <strong>Memuat status bulk upload ZIP</strong>
                    <p>Mohon tunggu sebentar.</p>
                </div>

                <section v-if="bulkJob" class="panel-block">
                    <div class="section-heading">
                        <div>
                            <h2>Preview job terbaru #{{ bulkJob.bulk_upload_job_id }}</h2>
                            <p>{{ bulkJob.original_filename || 'ZIP bulk upload' }} · {{ bulkJob.created_at ? dateTime(bulkJob.created_at) : '-' }}</p>
                        </div>
                        <div class="page-actions">
                            <span :class="['status-pill', bulkJobTone(bulkJob.status)]">{{ bulkJobStatusLabel(bulkJob.status) }}</span>
                            <button type="button" class="secondary-btn" :disabled="bulkLoading" @click="loadBulkJob(bulkJob.bulk_upload_job_id)">{{ bulkLoading ? 'Memuat...' : 'Refresh status' }}</button>
                            <button type="button" :disabled="!canConfirmBulkJob" @click="confirmBulkJob(bulkJob)">{{ bulkConfirming ? 'Menyimpan...' : 'Konfirmasi simpan file' }}</button>
                        </div>
                    </div>

                    <div v-if="bulkJob.error_message" class="notice-box error">
                        <div>
                            <strong>Preview gagal</strong>
                            <p>{{ bulkJob.error_message }}</p>
                        </div>
                    </div>

                    <div class="metric-grid">
                        <article class="metric-card"><span>File cocok</span><strong>{{ matchedCount }}</strong></article>
                        <article class="metric-card"><span>Penerima belum punya file</span><strong>{{ summaryCount('missing_recipients') }}</strong></article>
                        <article class="metric-card"><span>Tidak cocok</span><strong>{{ summaryCount('unmatched_entries', 'unmatched') }}</strong></article>
                        <article class="metric-card"><span>Duplikat</span><strong>{{ summaryCount('duplicate_entries', 'duplicate') }}</strong></article>
                        <article class="metric-card"><span>Ambigu</span><strong>{{ summaryCount('ambiguous_entries', 'ambiguous') }}</strong></article>
                        <article class="metric-card"><span>File invalid</span><strong>{{ summaryCount('invalid_entries', 'invalid') }}</strong></article>
                        <article class="metric-card"><span>File existing akan diganti</span><strong>{{ summaryCount('will_replace_entries', 'will_replace') }}</strong></article>
                    </div>

                    <div v-if="hasSkippedBulkItems" class="notice-box info">
                        <div>
                            <strong>Perhatian sebelum konfirmasi</strong>
                            <p>{{ skippedBulkWarningText }} Hanya file dengan status File cocok yang akan disimpan.</p>
                        </div>
                    </div>

                    <div v-if="bulkJobEntries.length" class="table-wrap">
                        <table>
                            <thead><tr><th>File</th><th>Match</th><th>Penerima</th><th>Status</th><th>Catatan</th></tr></thead>
                            <tbody>
                                <tr v-for="entry in bulkJobEntries" :key="entry.bulk_upload_entry_id">
                                    <td><strong>{{ entry.original_filename || entry.display_filename || entry.entry_path }}</strong><small>{{ entry.entry_path }} · {{ formatBytes(entry.file_size_bytes) }}</small></td>
                                    <td><span :class="['status-pill', bulkEntryTone(entry.match_status)]">{{ bulkEntryStatusLabel(entry.match_status) }}</span></td>
                                    <td><strong>{{ entry.recipient?.identifier || entry.identifier || '-' }}</strong><small>{{ entry.recipient?.name_snapshot || '-' }}</small></td>
                                    <td>{{ entry.extension ? `.${entry.extension}` : '-' }}<small>{{ entry.mime_type || '-' }}</small></td>
                                    <td>{{ entry.match_reason || '-' }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div v-else class="state-card muted-card">
                        <strong>Belum ada tabel hasil matching</strong>
                        <p>Hasil matching akan muncul setelah preview ZIP selesai diproses.</p>
                    </div>
                </section>
            </div>

            <AsyncState :loading="recipientLoading" :error="recipientError" :empty="recipients.length === 0" empty-title="Belum ada penerima" empty-text="Publish distribusi untuk membuat daftar penerima." @retry="loadRecipients">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Penerima</th><th>Status</th><th>File</th><th>Upload</th></tr></thead>
                        <tbody>
                            <tr v-for="recipient in recipients" :key="recipient.recipient_id">
                                <td><strong>{{ recipient.identifier }}</strong><small>{{ recipient.name_snapshot || '-' }}</small></td>
                                <td><StatusPill :status="recipient.delivery_status" /></td>
                                <td>{{ recipient.file?.display_filename || '-' }}</td>
                                <td><label class="file-action">Pilih file<input type="file" @change="uploadRecipient($event, recipient)" /></label></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AsyncState>
        </section>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import TargetPicker from '../../components/TargetPicker.vue';
import { statusLabel } from '../../constants/navigation';
import { arsipApi } from '../../services/arsipApi';
import { confirmAction } from '../../services/dialogs';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { bytes as formatBytes, dateTime } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const previewLoading = ref(false);
const recipientLoading = ref(false);
const bulkLoading = ref(false);
const bulkUploading = ref(false);
const bulkConfirming = ref(false);
const error = ref('');
const previewError = ref('');
const recipientError = ref('');
const bulkError = ref('');
const distributions = ref([]);
const recipients = ref([]);
const bulkJobs = ref([]);
const bulkJob = ref(null);
const bulkZipFile = ref(null);
const bulkFileInput = ref(null);
const preview = ref(null);
const selectedId = ref('');
const selectedDistribution = ref(null);
const targeting = ref(null);
const form = reactive({ title: '', description: '' });
let bulkPollingTimer = null;

const bulkUploadTerminalStatuses = ['preview_ready', 'failed', 'expired', 'cancelled'];
const bulkTerminalStatuses = [...bulkUploadTerminalStatuses, 'confirmed'];

const isSelectedDistributionPublished = computed(() => selectedDistribution.value?.status === 'published');
const bulkJobEntries = computed(() => bulkJob.value?.entries || []);
const matchedCount = computed(() => summaryCount('matched_entries', 'matched'));
const skippedEntriesCount = computed(() => (
    summaryCount('skipped')
    || summaryCount('unmatched_entries', 'unmatched')
        + summaryCount('duplicate_entries', 'duplicate')
        + summaryCount('ambiguous_entries', 'ambiguous')
        + summaryCount('invalid_entries', 'invalid')
));
const hasSkippedBulkItems = computed(() => skippedEntriesCount.value > 0 || summaryCount('missing_recipients') > 0 || summaryCount('will_replace_entries', 'will_replace') > 0);
const canConfirmBulkJob = computed(() => bulkJob.value?.status === 'preview_ready' && matchedCount.value > 0 && !bulkConfirming.value);
const skippedBulkWarningText = computed(() => bulkSkipText());

function payload() {
    return {
        ...form,
        ...targeting.value.payload,
    };
}

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.distributions();
        distributions.value = data.distributions || [];
        if (selectedId.value) {
            selectedDistribution.value = distributions.value.find((item) => item.distribution_id === selectedId.value) || selectedDistribution.value;
            if (!isSelectedDistributionPublished.value) clearBulkState();
        }
    } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; }
}

async function saveDistribution() {
    if (!targeting.value?.canSubmit) {
        app.notify('error', 'Pilih target penerima terlebih dahulu.');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Simpan draft distribusi?',
        text: `Target: ${targeting.value.summary}. Draft bisa dipublish setelah dicek.`,
        confirmText: 'Simpan draft',
    });
    if (!confirmed) return;

    await arsipApi.createDistribution(payload());
    app.notify('success', 'Distribusi berhasil dibuat.');
    form.title = '';
    form.description = '';
    preview.value = null;
    await load();
}

async function previewTargets() {
    if (!targeting.value?.canSubmit) {
        previewError.value = 'Pilih target penerima terlebih dahulu.';
        return;
    }

    previewLoading.value = true;
    previewError.value = '';
    try { preview.value = (await arsipApi.previewDistributionTargets(payload())).preview; }
    catch (err) { previewError.value = toErrorMessage(err); }
    finally { previewLoading.value = false; }
}

async function publish(item) {
    const confirmed = await confirmAction({
        title: 'Publish distribusi?',
        text: 'Daftar penerima akan dibuat dan file bisa mulai diupload per penerima.',
        confirmText: 'Publish',
        icon: 'warning',
    });
    if (!confirmed) return;

    await arsipApi.publishDistribution(item.distribution_id);
    app.notify('success', 'Distribusi berhasil dipublish.');
    await load();
}

async function selectDistribution(item) {
    selectedId.value = item.distribution_id;
    selectedDistribution.value = item;
    await Promise.all([loadRecipients(), loadBulkJobs()]);
}

async function refreshSelectedDistribution() {
    await Promise.all([loadRecipients(), loadBulkJobs()]);
}

async function loadRecipients() {
    if (!selectedId.value) return;
    recipientLoading.value = true;
    recipientError.value = '';
    try { recipients.value = (await arsipApi.distributionRecipients(selectedId.value)).recipients || []; }
    catch (err) { recipientError.value = toErrorMessage(err); }
    finally { recipientLoading.value = false; }
}

async function uploadRecipient(event, recipient) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const confirmed = await confirmAction({
        title: 'Upload file penerima?',
        text: `${recipient.identifier} - ${recipient.name_snapshot || 'tanpa nama'}`,
        confirmText: 'Upload',
    });
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('file', file);
    await arsipApi.uploadRecipientFile(recipient.recipient_id, formData);
    app.notify('success', 'File penerima berhasil diupload.');
    await loadRecipients();
}

function selectBulkZip(event) {
    bulkZipFile.value = event.target.files?.[0] || null;
}

async function loadBulkJobs() {
    stopBulkPolling();
    if (!selectedId.value || !isSelectedDistributionPublished.value) {
        clearBulkState();
        return;
    }

    bulkLoading.value = true;
    bulkError.value = '';
    try {
        const data = await arsipApi.distributionBulkUploadJobs(selectedId.value);
        bulkJobs.value = data.bulk_upload_jobs || [];
        const latestJob = bulkJobs.value[0] || null;
        bulkJob.value = latestJob;
        if (latestJob?.bulk_upload_job_id) {
            await loadBulkJob(latestJob.bulk_upload_job_id, { silent: true });
            if (bulkJob.value?.bulk_upload_job_id && !bulkTerminalStatuses.includes(bulkJob.value.status)) {
                startBulkPolling(bulkJob.value.bulk_upload_job_id);
            }
        }
    } catch (err) {
        bulkError.value = toErrorMessage(err);
    } finally {
        bulkLoading.value = false;
    }
}

async function uploadBulkZip() {
    if (!selectedId.value || !isSelectedDistributionPublished.value) {
        bulkError.value = 'Bulk upload ZIP hanya tersedia untuk distribusi yang sudah dipublish.';
        return;
    }
    if (!bulkZipFile.value) {
        bulkError.value = 'Pilih file ZIP terlebih dahulu.';
        return;
    }

    stopBulkPolling();
    bulkUploading.value = true;
    bulkError.value = '';
    try {
        const formData = new FormData();
        formData.append('zip_file', bulkZipFile.value);
        const data = await arsipApi.createDistributionBulkUploadJob(selectedId.value, formData);
        bulkJob.value = data.bulk_upload_job;
        mergeBulkJob(data.bulk_upload_job);
        bulkZipFile.value = null;
        if (bulkFileInput.value) bulkFileInput.value.value = '';
        app.notify('success', 'Bulk upload ZIP dibuat. Menunggu preview matching.');
        startBulkPolling(data.bulk_upload_job.bulk_upload_job_id);
    } catch (err) {
        bulkError.value = toErrorMessage(err);
        app.notify('error', bulkError.value);
    } finally {
        bulkUploading.value = false;
    }
}

async function loadBulkJob(jobId, options = {}) {
    if (!jobId) return;
    if (!options.silent) {
        bulkLoading.value = true;
        bulkError.value = '';
    }

    try {
        const data = await arsipApi.distributionBulkUploadJob(jobId);
        bulkJob.value = data.bulk_upload_job;
        mergeBulkJob(data.bulk_upload_job);
        if (bulkTerminalStatuses.includes(data.bulk_upload_job?.status)) stopBulkPolling();
    } catch (err) {
        bulkError.value = toErrorMessage(err);
        stopBulkPolling();
    } finally {
        if (!options.silent) bulkLoading.value = false;
    }
}

async function confirmBulkJob(job) {
    if (!job || !canConfirmBulkJob.value) return;

    const confirmed = await confirmAction({
        title: `Simpan ${matchedCount.value} file yang cocok?`,
        text: `${bulkSkipText()} File cocok akan disimpan ke penerima dan file existing akan diganti jika ada.`,
        confirmText: 'Konfirmasi simpan file',
        icon: hasSkippedBulkItems.value ? 'warning' : 'question',
    });
    if (!confirmed) return;

    bulkConfirming.value = true;
    bulkError.value = '';
    stopBulkPolling();
    try {
        const data = await arsipApi.confirmDistributionBulkUploadJob(job.bulk_upload_job_id);
        bulkJob.value = data.bulk_upload_job;
        mergeBulkJob(data.bulk_upload_job);
        app.notify('success', 'File cocok berhasil disimpan ke penerima.');
        await loadRecipients();
    } catch (err) {
        bulkError.value = toErrorMessage(err);
        app.notify('error', bulkError.value);
    } finally {
        bulkConfirming.value = false;
    }
}

async function cancelBulkJob(job) {
    if (!job) return;

    const confirmed = await confirmAction({
        title: 'Batalkan bulk upload ZIP?',
        text: 'Preview ZIP yang dibatalkan tidak dapat dikonfirmasi.',
        confirmText: 'Batalkan preview',
        icon: 'warning',
    });
    if (!confirmed) return;

    bulkLoading.value = true;
    bulkError.value = '';
    try {
        const data = await arsipApi.cancelDistributionBulkUploadJob(job.bulk_upload_job_id);
        bulkJob.value = data.bulk_upload_job;
        mergeBulkJob(data.bulk_upload_job);
        stopBulkPolling();
        app.notify('success', 'Bulk upload ZIP dibatalkan.');
    } catch (err) {
        bulkError.value = toErrorMessage(err);
        app.notify('error', bulkError.value);
    } finally {
        bulkLoading.value = false;
    }
}

function startBulkPolling(jobId) {
    stopBulkPolling();
    if (!jobId) return;

    bulkPollingTimer = window.setTimeout(async () => {
        await loadBulkJob(jobId, { silent: true });
        if (bulkJob.value?.bulk_upload_job_id === jobId && !bulkTerminalStatuses.includes(bulkJob.value.status)) {
            startBulkPolling(jobId);
        }
    }, 4000);
}

function stopBulkPolling() {
    if (bulkPollingTimer) {
        window.clearTimeout(bulkPollingTimer);
        bulkPollingTimer = null;
    }
}

function clearBulkState() {
    stopBulkPolling();
    bulkJobs.value = [];
    bulkJob.value = null;
    bulkZipFile.value = null;
    bulkError.value = '';
    if (bulkFileInput.value) bulkFileInput.value.value = '';
}

function mergeBulkJob(job) {
    if (!job?.bulk_upload_job_id) return;
    const index = bulkJobs.value.findIndex((item) => item.bulk_upload_job_id === job.bulk_upload_job_id);
    if (index === -1) {
        bulkJobs.value = [job, ...bulkJobs.value];
        return;
    }

    bulkJobs.value = bulkJobs.value.map((item, itemIndex) => (itemIndex === index ? job : item));
}

function summaryCount(...keys) {
    const summary = bulkJob.value?.summary || {};
    for (const key of keys) {
        const value = Number(summary[key] ?? 0);
        if (value > 0) return value;
    }
    return 0;
}

function bulkSkipText() {
    const skippedParts = [];
    const notes = [];
    const missing = summaryCount('missing_recipients');
    const unmatched = summaryCount('unmatched_entries', 'unmatched');
    const duplicate = summaryCount('duplicate_entries', 'duplicate');
    const ambiguous = summaryCount('ambiguous_entries', 'ambiguous');
    const invalid = summaryCount('invalid_entries', 'invalid');
    const willReplace = summaryCount('will_replace_entries', 'will_replace');
    const skipped = summaryCount('skipped');

    if (missing) skippedParts.push(`${missing} penerima belum punya file`);
    if (unmatched) skippedParts.push(`${unmatched} file tidak cocok`);
    if (duplicate) skippedParts.push(`${duplicate} duplikat`);
    if (ambiguous) skippedParts.push(`${ambiguous} ambigu`);
    if (invalid) skippedParts.push(`${invalid} file invalid`);
    if (!skippedParts.length && skipped) skippedParts.push(`${skipped} file`);
    if (skippedParts.length) notes.push(`${skippedParts.join(', ')} akan dilewati.`);
    if (willReplace) notes.push(`File existing akan diganti untuk ${willReplace} penerima.`);

    return notes.length ? notes.join(' ') : 'Tidak ada file yang dilewati.';
}

function bulkJobStatusLabel(status) {
    return {
        uploaded: 'ZIP diterima',
        processing: 'Memproses preview',
        preview_ready: 'Preview siap',
        confirming: 'Menyimpan file',
        confirmed: 'Selesai disimpan',
        failed: 'Gagal',
        expired: 'Kedaluwarsa',
        cancelled: 'Dibatalkan',
    }[status] || statusLabel(status);
}

function bulkJobTone(status) {
    if (['preview_ready', 'confirmed'].includes(status)) return 'ok';
    if (['failed', 'expired', 'cancelled'].includes(status)) return 'danger';
    if (['uploaded', 'processing', 'confirming'].includes(status)) return 'warn';
    return 'neutral';
}

function bulkEntryStatusLabel(status) {
    return {
        matched: 'File cocok',
        unmatched: 'Tidak cocok',
        duplicate: 'Duplikat',
        ambiguous: 'Ambigu',
        invalid: 'File invalid',
        confirmed: 'Tersimpan',
        skipped: 'Dilewati',
        failed: 'Gagal',
    }[status] || statusLabel(status);
}

function bulkEntryTone(status) {
    if (['matched', 'confirmed'].includes(status)) return 'ok';
    if (['duplicate', 'ambiguous'].includes(status)) return 'warn';
    if (['invalid', 'failed'].includes(status)) return 'danger';
    return 'neutral';
}

onMounted(load);
onBeforeUnmount(stopBulkPolling);
</script>
