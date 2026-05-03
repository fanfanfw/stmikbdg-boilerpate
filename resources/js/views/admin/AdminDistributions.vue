<template>
    <section class="page-stack">
        <PageHeader eyebrow="Distribusi berkas" title="Kirim file berbeda ke penerima" description="Buat distribusi, preview target, publish, lalu upload file per penerima." />

        <div class="two-column wide-first">
            <section class="panel-block">
                <div class="section-heading"><h2>Buat distribution</h2></div>
                <form class="form-grid" @submit.prevent="saveDistribution">
                    <label>Judul<input v-model="form.title" required placeholder="Sertifikat Seminar AI 2026" /></label>
                    <label>Target role<select v-model="form.target_role"><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option></select></label>
                    <label>Scope<select v-model="form.scope_type"><option value="specific">Manual</option><option value="segment">Segment</option><option value="filter">Filter</option></select></label>
                    <label class="wide">Deskripsi<textarea v-model="form.description" rows="3" /></label>
                    <label>Manual identifier<textarea v-model="identifiersInput" rows="4" placeholder="Satu NIM/kode dosen per baris" /></label>
                    <label>Segment IDs<textarea v-model="segmentIdsInput" rows="4" placeholder="1,2" /></label>
                    <label>Angkatan filter<textarea v-model="angkatanInput" rows="4" placeholder="2022,2023" /></label>
                    <div class="form-actions wide">
                        <button type="submit">Simpan draft</button>
                        <button type="button" class="secondary-btn" @click="previewTargets">Preview target</button>
                    </div>
                </form>
            </section>

            <section class="panel-block">
                <div class="section-heading"><h2>Preview</h2></div>
                <AsyncState :loading="previewLoading" :error="previewError" :empty="!preview" empty-title="Belum ada preview" empty-text="Preview memastikan target bisa di-resolve sebelum publish.">
                    <article class="metric-card"><span>Total target</span><strong>{{ preview.total ?? preview.targets?.length ?? 0 }}</strong></article>
                    <div class="data-list preview-list">
                        <article v-for="target in preview.targets || []" :key="target.identifier" class="list-row"><div><strong>{{ target.identifier }}</strong><small>{{ target.name || '-' }}</small></div></article>
                    </div>
                </AsyncState>
            </section>
        </div>

        <section class="panel-block">
            <div class="section-heading"><h2>Daftar distribution</h2><button type="button" class="secondary-btn" @click="load">Refresh</button></div>
            <AsyncState :loading="loading" :error="error" :empty="distributions.length === 0" empty-title="Belum ada distribution" empty-text="Distribution draft/published akan tampil di sini." @retry="load">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Distribution</th><th>Target</th><th>Status</th><th>Penerima</th><th>Aksi</th></tr></thead>
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
            <div class="section-heading"><h2>Penerima distribution #{{ selectedId }}</h2><button type="button" class="secondary-btn" @click="loadRecipients">Refresh</button></div>
            <AsyncState :loading="recipientLoading" :error="recipientError" :empty="recipients.length === 0" empty-title="Belum ada penerima" empty-text="Publish distribution untuk membuat recipients.">
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
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { lines } from '../../utils/format';

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
const identifiersInput = ref('');
const segmentIdsInput = ref('');
const angkatanInput = ref('');
const form = reactive({ title: '', description: '', target_role: 'mahasiswa', scope_type: 'specific' });

function payload() {
    const target_filters = {};
    if (lines(angkatanInput.value).length) target_filters.angkatan = lines(angkatanInput.value);
    return {
        ...form,
        target_filters,
        target_identifiers: lines(identifiersInput.value),
        target_segment_ids: lines(segmentIdsInput.value).map(Number),
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
    await arsipApi.createDistribution(payload());
    app.notify('success', 'Distribution berhasil dibuat.');
    form.title = '';
    await load();
}

async function previewTargets() {
    previewLoading.value = true;
    previewError.value = '';
    try { preview.value = (await arsipApi.previewDistributionTargets(payload())).preview; }
    catch (err) { previewError.value = toErrorMessage(err); }
    finally { previewLoading.value = false; }
}

async function publish(item) {
    await arsipApi.publishDistribution(item.distribution_id);
    app.notify('success', 'Distribution berhasil dipublish.');
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
    const formData = new FormData();
    formData.append('file', file);
    await arsipApi.uploadRecipientFile(recipient.recipient_id, formData);
    app.notify('success', 'File penerima berhasil diupload.');
    await loadRecipients();
}

onMounted(load);
</script>
