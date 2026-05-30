<template>
    <section class="page-stack">
        <PageHeader
            eyebrow="Arsip pengguna"
            title="Browser file mahasiswa dan dosen"
            description="Pantau arsip, pilih file tertentu, atau export ZIP dari hasil filter."
        >
            <template #actions><button type="button" class="secondary-btn" @click="refreshAll">Refresh</button></template>
        </PageHeader>

        <form class="filter-bar" @submit.prevent="load">
            <select v-model="filters.owner_role">
                <option value="">Semua role</option>
                <option value="mahasiswa">Mahasiswa</option>
                <option value="dosen">Dosen</option>
            </select>
            <input v-model="filters.owner_identifier" placeholder="NIM / kode dosen" />
            <input v-model="filters.extension" placeholder="Ekstensi, contoh pdf" />
            <button type="submit">Terapkan</button>
        </form>

        <AsyncState :loading="loading" :error="error" :empty="files.length === 0" empty-title="Belum ada file" empty-text="Tidak ada file sesuai filter." @retry="load">
            <div class="bulk-actions">
                <strong>{{ selectedFileIds.length }} file dipilih</strong>
                <button type="button" class="secondary-btn" @click="selectAllFiles">Pilih semua halaman ini</button>
                <button type="button" class="ghost-btn" @click="selectedFileIds = []">Kosongkan pilihan</button>
                <button type="button" :disabled="selectedFileIds.length === 0" @click="exportSelected">Export file dipilih</button>
                <button type="button" class="secondary-btn" @click="exportFiltered">Export hasil filter</button>
            </div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Pilih</th><th>File</th><th>Pemilik</th><th>Versi</th><th>Ukuran</th><th>Aksi</th></tr></thead>
                    <tbody>
                        <tr v-for="file in files" :key="file.file_id">
                            <td><input type="checkbox" :value="file.file_id" v-model="selectedFileIds" /></td>
                            <td><strong>{{ file.display_filename }}</strong><small>{{ file.extension }}</small></td>
                            <td>{{ file.owner_identifier }}<small>{{ file.owner_role }} · {{ file.owner_name_snapshot || '-' }}</small></td>
                            <td>v{{ file.version_number }}<small>{{ file.is_current ? 'current' : 'replaced' }}</small></td>
                            <td>{{ bytes(file.file_size_bytes) }}</td>
                            <td class="action-cell">
                                <button type="button" class="secondary-btn" @click="download(file)">Download</button>
                                <button v-if="file.status === 'deleted'" type="button" class="ghost-btn" @click="restore(file)">Restore</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </AsyncState>

        <section class="panel-block">
            <div class="section-heading"><h2>Export ZIP</h2><p>Job ZIP dibuat async. Jalankan worker queue agar status berubah dari queued ke completed.</p></div>
            <AsyncState :loading="jobLoading" :error="jobError" :empty="jobs.length === 0" empty-title="Belum ada job export" empty-text="Export yang dibuat dari halaman ini akan tampil di sini." @retry="loadJobs">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Job</th><th>Tipe</th><th>Status</th><th>Ukuran</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="job in jobs" :key="job.export_job_id">
                                <td>#{{ job.export_job_id }}<small>{{ dateTime(job.created_at) }}</small></td>
                                <td>{{ job.export_type }}</td>
                                <td><StatusPill :status="job.status" /></td>
                                <td>{{ bytes(job.file_size_bytes) }}</td>
                                <td><button type="button" class="secondary-btn" :disabled="job.status !== 'completed'" @click="downloadJob(job)">Download ZIP</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AsyncState>
        </section>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { bytes, dateTime } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const jobLoading = ref(false);
const error = ref('');
const jobError = ref('');
const files = ref([]);
const jobs = ref([]);
const selectedFileIds = ref([]);
const filters = reactive({ owner_role: '', owner_identifier: '', extension: '', with_deleted: true });

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.files(filters);
        files.value = data.files || [];
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

async function loadJobs() {
    jobLoading.value = true;
    jobError.value = '';
    try {
        const data = await arsipApi.exportJobs({ export_type: 'archive_browser' });
        jobs.value = data.export_jobs || [];
    } catch (err) {
        jobError.value = toErrorMessage(err);
    } finally {
        jobLoading.value = false;
    }
}

async function refreshAll() {
    await Promise.all([load(), loadJobs()]);
}

function selectAllFiles() {
    const merged = new Set(selectedFileIds.value);
    files.value.forEach((file) => merged.add(file.file_id));
    selectedFileIds.value = Array.from(merged);
}

function exportFilters(extra = {}) {
    return {
        ...extra,
        owner_role: filters.owner_role || null,
        owner_identifier: filters.owner_identifier || null,
        extension: filters.extension || null,
        with_deleted: filters.with_deleted,
    };
}

async function createArchiveExport(filterPayload) {
    await arsipApi.createExportJob({ export_type: 'archive_browser', filters: filterPayload });
    app.notify('success', 'Export ZIP dibuat. Tunggu worker memproses job.');
    selectedFileIds.value = [];
    await loadJobs();
}

async function exportSelected() {
    await createArchiveExport(exportFilters({ file_ids: selectedFileIds.value }));
}

async function exportFiltered() {
    await createArchiveExport(exportFilters());
}

async function downloadJob(job) {
    await arsipApi.downloadExportJob(job);
}

async function download(file) {
    await arsipApi.downloadFile(file);
}

async function restore(file) {
    await arsipApi.restoreFile(file.file_id);
    app.notify('success', 'File berhasil direstore.');
    await load();
}

onMounted(refreshAll);
</script>
