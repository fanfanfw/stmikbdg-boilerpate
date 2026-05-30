<template>
    <section class="page-stack">
        <PageHeader eyebrow="Distribusi berkas" title="Kirim file ke penerima" description="Buat distribusi, pilih target penerima, publish, lalu upload file untuk masing-masing penerima.">
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh daftar</button></template>
        </PageHeader>

        <div class="two-column wide-first request-builder-grid">
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

            <section class="panel-block preview-panel">
                <div class="section-heading">
                    <div>
                        <h2>Preview target</h2>
                        <p>{{ targeting?.summary || 'Target belum dihitung' }}</p>
                    </div>
                    <button type="button" class="secondary-btn" :disabled="previewLoading || !targeting?.canSubmit" @click="previewTargets">Preview</button>
                </div>
                <AsyncState :loading="previewLoading" :error="previewError" :empty="!preview" empty-title="Belum ada preview" empty-text="Pilih target lalu klik Preview untuk memastikan penerima valid.">
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
            </section>
        </div>

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
            <div class="section-heading"><h2>Penerima distribusi #{{ selectedId }}</h2><button type="button" class="secondary-btn" @click="loadRecipients">Refresh</button></div>
            <AsyncState :loading="recipientLoading" :error="recipientError" :empty="recipients.length === 0" empty-title="Belum ada penerima" empty-text="Publish distribusi untuk membuat daftar penerima.">
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
import { onMounted, reactive, ref } from 'vue';
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
const previewLoading = ref(false);
const recipientLoading = ref(false);
const error = ref('');
const previewError = ref('');
const recipientError = ref('');
const distributions = ref([]);
const recipients = ref([]);
const preview = ref(null);
const selectedId = ref('');
const targeting = ref(null);
const form = reactive({ title: '', description: '' });

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
    await loadRecipients();
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

onMounted(load);
</script>
