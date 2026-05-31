<template>
    <section class="page-stack">
        <PageHeader eyebrow="Permintaan berkas" title="Buat permintaan berkas" description="Atur detail request, pilih target penerima, preview target valid, lalu publish ketika sudah siap.">
            <template #actions><button type="button" class="secondary-btn" :disabled="loading" @click="loadAll">Refresh daftar</button></template>
        </PageHeader>

        <section class="panel-block">
            <div class="section-heading">
                <div>
                    <h2>Detail request</h2>
                    <p>Instruksi dan batas unggahan yang akan dilihat penerima.</p>
                </div>
            </div>
            <form id="request-create-form" class="form-grid" @submit.prevent="saveRequest">
                <label>Judul<input v-model="form.title" required placeholder="Contoh: Akta Kelahiran Angkatan 2022" /></label>
                <label>Maks file<input v-model.number="form.max_files" type="number" min="1" /></label>
                <label>Maks ukuran MB<input v-model.number="form.max_file_size_mb" type="number" min="1" placeholder="Default setting" /></label>
                <label>Deadline<input v-model="form.deadline_at" type="datetime-local" /></label>
                <fieldset class="wide extension-picker">
                    <legend>Ekstensi yang diizinkan</legend>
                    <p>Mahasiswa/dosen hanya bisa mengunggah file dengan format yang dipilih.</p>
                    <div class="extension-grid">
                        <label v-for="extension in extensionOptions" :key="extension" class="extension-check">
                            <input v-model="selectedExtensions" type="checkbox" :value="extension" />
                            <span>.{{ extension }}</span>
                        </label>
                    </div>
                </fieldset>
                <label class="wide">Deskripsi<textarea v-model="form.description" rows="3" placeholder="Instruksi untuk mahasiswa/dosen" /></label>
                <label class="check"><input v-model="form.requires_verification" type="checkbox" /> Perlu verifikasi admin</label>
                <label class="check"><input v-model="form.allow_file_reuse" type="checkbox" /> Izinkan reuse file lama</label>
                <label class="check"><input v-model="form.close_after_deadline" type="checkbox" /> Tutup setelah deadline</label>
            </form>
        </section>

        <TargetPicker @change="targeting = $event" />

        <section class="panel-block preview-panel">
            <div class="section-heading">
                <div>
                    <h2>Daftar target final</h2>
                    <p>{{ targeting?.summary || 'Target belum dihitung' }}</p>
                </div>
                <button type="button" class="secondary-btn" :disabled="previewLoading || !targeting?.canSubmit" @click="previewTargets">{{ previewLoading ? 'Memvalidasi...' : 'Validasi target' }}</button>
            </div>
            <AsyncState :loading="previewLoading" :error="previewError" :empty="!preview" empty-title="Belum ada daftar target" empty-text="Pilih target penerima, lalu klik Validasi target untuk melihat daftar final yang akan menerima request.">
                <div class="metric-grid compact">
                    <article class="metric-card"><span>Total</span><strong>{{ preview.total_targets ?? 0 }}</strong></article>
                    <article class="metric-card"><span>Valid</span><strong>{{ preview.total_valid ?? 0 }}</strong></article>
                    <article class="metric-card"><span>Invalid</span><strong>{{ preview.total_invalid ?? 0 }}</strong></article>
                </div>
                <div class="data-list preview-list">
                    <article v-for="target in preview.valid_targets || []" :key="target.identifier" class="list-row">
                        <div><strong>{{ target.identifier }}</strong><small>{{ target.name_snapshot || '-' }}</small></div>
                        <span class="status-pill ok">Valid</span>
                    </article>
                    <article v-for="target in preview.invalid_targets || []" :key="`invalid-${target.identifier}`" class="list-row">
                        <div><strong>{{ target.identifier }}</strong><small>{{ target.reason || 'Tidak valid' }}</small></div>
                        <span class="status-pill danger">Invalid</span>
                    </article>
                </div>
            </AsyncState>
        </section>

        <section class="panel-block publish-panel">
            <div class="section-heading">
                <div>
                    <h2>Simpan request</h2>
                    <p>{{ targeting?.summary || 'Pilih target penerima terlebih dahulu.' }}</p>
                </div>
                <div class="page-actions">
                    <button type="button" class="secondary-btn" :disabled="saving || previewLoading || !targeting?.canSubmit" @click="previewTargets">{{ previewLoading ? 'Memvalidasi...' : 'Validasi target' }}</button>
                    <button type="submit" form="request-create-form" :disabled="saving || previewLoading || !targeting?.canSubmit">{{ saving ? 'Menyimpan...' : 'Simpan draft' }}</button>
                </div>
            </div>
        </section>

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
                                    <button v-if="request.status === 'draft'" type="button" class="secondary-btn" :disabled="publishingId === request.request_id" @click="publish(request)">{{ publishingId === request.request_id ? 'Publishing...' : 'Publish' }}</button>
                                    <RouterLink class="text-link" :to="{ name: 'admin.requests.show', params: { request_id: request.request_id } }">Detail</RouterLink>
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
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import TargetPicker from '../../components/TargetPicker.vue';
import { arsipApi } from '../../services/arsipApi';
import { confirmAction } from '../../services/dialogs';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';

const app = useAppStore();
const loading = ref(false);
const saving = ref(false);
const previewLoading = ref(false);
const publishingId = ref(null);
const error = ref('');
const previewError = ref('');
const requests = ref([]);
const preview = ref(null);
const targeting = ref(null);
const extensionOptions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx'];
const selectedExtensions = ref(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx']);

const form = reactive({
    title: '', description: '', max_files: 1, max_file_size_mb: null, deadline_at: '',
    requires_verification: true, allow_file_reuse: true, allow_inactive_upload: false, close_after_deadline: false,
});

function payload() {
    return {
        ...form,
        ...targeting.value.payload,
        deadline_at: form.deadline_at || null,
        max_file_size_mb: form.max_file_size_mb || null,
        allowed_extensions: selectedExtensions.value,
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
    if (!form.title?.trim()) {
        app.notify('error', 'Judul request wajib diisi.');
        return;
    }
    if (!targeting.value?.canSubmit) {
        app.notify('error', 'Pilih target penerima terlebih dahulu.');
        return;
    }
    if (selectedExtensions.value.length === 0) {
        app.notify('error', 'Pilih minimal satu ekstensi yang diizinkan.');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Simpan draft request?',
        text: `Target: ${targeting.value.summary}. Draft masih bisa dicek sebelum dipublish.`,
        confirmText: 'Simpan draft',
    });
    if (!confirmed) return;

    saving.value = true;
    try {
        await arsipApi.createRequest(payload());
        app.notify('success', 'Request berhasil disimpan sebagai draft.');
        form.title = '';
        form.description = '';
        preview.value = null;
        await loadAll();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        saving.value = false;
    }
}

async function previewTargets() {
    if (!targeting.value?.canSubmit) {
        previewError.value = 'Pilih target penerima terlebih dahulu.';
        return;
    }

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
    const confirmed = await confirmAction({
        title: 'Publish request?',
        text: 'Assignment akan dibuat untuk target request ini dan mulai terlihat oleh penerima.',
        confirmText: 'Publish',
        icon: 'warning',
    });
    if (!confirmed) return;

    publishingId.value = request.request_id;
    try {
        await arsipApi.publishRequest(request.request_id);
        app.notify('success', 'Request berhasil dipublish.');
        await loadAll();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        publishingId.value = null;
    }
}

onMounted(loadAll);
</script>
