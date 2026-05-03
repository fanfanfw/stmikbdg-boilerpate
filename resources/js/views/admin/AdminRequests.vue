<template>
    <section class="page-stack">
        <PageHeader eyebrow="Permintaan berkas" title="Request builder" description="Buat request, preview target, lalu publish ketika target valid.">
            <template #actions><button type="button" class="secondary-btn" @click="loadAll">Refresh</button></template>
        </PageHeader>

        <NoticeBox type="info" title="Alur wajib" message="Preview target dijalankan dari payload form. Publish hanya tersedia setelah request tersimpan sebagai draft." />

        <div class="two-column wide-first">
            <section class="panel-block">
                <div class="section-heading"><h2>Detail request</h2></div>
                <form class="form-grid" @submit.prevent="saveRequest">
                    <label>Judul<input v-model="form.title" required placeholder="Contoh: Akta Kelahiran Angkatan 2022" /></label>
                    <label>Role target<select v-model="form.target_role"><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option></select></label>
                    <label>Scope<select v-model="form.scope_type"><option value="all">Semua</option><option value="filter">Filter</option><option value="specific">Manual</option><option value="segment">Segment</option></select></label>
                    <label>Maks file<input v-model.number="form.max_files" type="number" min="1" /></label>
                    <label>Maks ukuran MB<input v-model.number="form.max_file_size_mb" type="number" min="1" placeholder="Default setting" /></label>
                    <label>Ekstensi<textarea v-model="allowedExtensions" rows="2" placeholder="pdf,jpg,png,docx" /></label>
                    <label class="wide">Deskripsi<textarea v-model="form.description" rows="3" placeholder="Instruksi untuk mahasiswa/dosen" /></label>
                    <label>Deadline<input v-model="form.deadline_at" type="datetime-local" /></label>
                    <label>Angkatan / filter<textarea v-model="angkatanInput" rows="2" placeholder="2022,2023" /></label>
                    <label>Scholarship type IDs<textarea v-model="scholarshipIdsInput" rows="2" placeholder="1,2" /></label>
                    <label>Manual identifier<textarea v-model="identifiersInput" rows="4" placeholder="Satu NIM/kode dosen per baris" /></label>
                    <label>Segment IDs<textarea v-model="segmentIdsInput" rows="4" placeholder="1,2" /></label>
                    <label class="check"><input v-model="form.requires_verification" type="checkbox" /> Perlu verifikasi admin</label>
                    <label class="check"><input v-model="form.allow_file_reuse" type="checkbox" /> Izinkan reuse file lama</label>
                    <label class="check"><input v-model="form.close_after_deadline" type="checkbox" /> Tutup setelah deadline</label>
                    <div class="form-actions wide">
                        <button type="submit" :disabled="saving">Simpan draft</button>
                        <button type="button" class="secondary-btn" :disabled="saving" @click="previewTargets">Preview target</button>
                    </div>
                </form>
            </section>

            <section class="panel-block">
                <div class="section-heading"><h2>Preview target</h2></div>
                <AsyncState :loading="previewLoading" :error="previewError" :empty="!preview" empty-title="Belum ada preview" empty-text="Isi targeting lalu klik Preview target.">
                    <div class="metric-grid compact">
                        <article class="metric-card"><span>Total</span><strong>{{ preview.total ?? preview.targets?.length ?? 0 }}</strong></article>
                        <article class="metric-card"><span>Invalid</span><strong>{{ preview.invalid_targets?.length ?? 0 }}</strong></article>
                    </div>
                    <div class="data-list preview-list">
                        <article v-for="target in preview.targets || []" :key="target.identifier" class="list-row">
                            <div><strong>{{ target.identifier }}</strong><small>{{ target.name || target.name_snapshot || '-' }}</small></div>
                            <StatusPill :status="target.is_valid === false ? 'rejected' : 'approved'" />
                        </article>
                    </div>
                </AsyncState>
            </section>
        </div>

        <section class="panel-block">
            <div class="section-heading"><h2>Daftar request</h2></div>
            <AsyncState :loading="loading" :error="error" :empty="requests.length === 0" empty-title="Belum ada request" empty-text="Draft request yang dibuat akan tampil di sini." @retry="loadAll">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Request</th><th>Target</th><th>Status</th><th>Assignment</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="request in requests" :key="request.request_id">
                                <td><strong>{{ request.title }}</strong><small>{{ request.description || '-' }}</small></td>
                                <td>{{ request.target_role }}<small>{{ request.scope_type }}</small></td>
                                <td><StatusPill :status="request.status" /></td>
                                <td>{{ request.assignments_count ?? 0 }}</td>
                                <td class="action-cell">
                                    <button v-if="request.status === 'draft'" type="button" class="secondary-btn" @click="publish(request)">Publish</button>
                                    <RouterLink class="text-link" :to="{ name: 'admin.monitoring', query: { request_id: request.request_id } }">Monitoring</RouterLink>
                                </td>
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
import { RouterLink } from 'vue-router';
import AsyncState from '../../components/AsyncState.vue';
import NoticeBox from '../../components/NoticeBox.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { lines } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const saving = ref(false);
const previewLoading = ref(false);
const error = ref('');
const previewError = ref('');
const requests = ref([]);
const preview = ref(null);
const allowedExtensions = ref('pdf,jpg,jpeg,png,doc,docx,xls,xlsx');
const angkatanInput = ref('');
const scholarshipIdsInput = ref('');
const identifiersInput = ref('');
const segmentIdsInput = ref('');

const form = reactive({
    title: '', description: '', target_role: 'mahasiswa', scope_type: 'filter', max_files: 1,
    max_file_size_mb: null, deadline_at: '', requires_verification: true, allow_file_reuse: true,
    allow_inactive_upload: false, close_after_deadline: false,
});

function payload() {
    const target_filters = {};
    if (lines(angkatanInput.value).length) target_filters.angkatan = lines(angkatanInput.value);
    if (lines(scholarshipIdsInput.value).length) target_filters.scholarship_type_ids = lines(scholarshipIdsInput.value).map(Number);

    return {
        ...form,
        deadline_at: form.deadline_at || null,
        max_file_size_mb: form.max_file_size_mb || null,
        allowed_extensions: lines(allowedExtensions.value),
        target_filters,
        target_identifiers: lines(identifiersInput.value),
        target_segment_ids: lines(segmentIdsInput.value).map(Number),
    };
}

async function loadAll() {
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.adminRequests();
        requests.value = data.requests || [];
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

async function saveRequest() {
    saving.value = true;
    try {
        await arsipApi.createRequest(payload());
        app.notify('success', 'Request berhasil disimpan sebagai draft.');
        form.title = '';
        await loadAll();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        saving.value = false;
    }
}

async function previewTargets() {
    previewLoading.value = true;
    previewError.value = '';
    try {
        const data = await arsipApi.previewRequestTargets(payload());
        preview.value = data.preview;
    } catch (err) {
        previewError.value = toErrorMessage(err);
    } finally {
        previewLoading.value = false;
    }
}

async function publish(request) {
    await arsipApi.publishRequest(request.request_id);
    app.notify('success', 'Request berhasil dipublish.');
    await loadAll();
}

onMounted(loadAll);
</script>
