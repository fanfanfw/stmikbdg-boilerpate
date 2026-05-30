<template>
    <section class="page-stack">
        <PageHeader eyebrow="Distribusi berkas" title="Kirim file berbeda ke penerima" description="Buat distribusi, preview target, publish, lalu upload file per penerima." />

        <div class="two-column wide-first">
            <section class="panel-block">
                <div class="section-heading"><h2>Buat distribution</h2></div>
                <form class="form-grid" @submit.prevent="saveDistribution">
                    <label>Judul<input v-model="form.title" required placeholder="Sertifikat Seminar AI 2026" /></label>
                    <label>Target role<select v-model="form.target_role" @change="resetTargets"><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option></select></label>
                    <label class="wide">Deskripsi<textarea v-model="form.description" rows="3" /></label>
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
            <div class="section-heading"><h2>Pilih target penerima</h2><p>Filter data {{ form.target_role }}, lalu centang penerima distribusi. Hanya target dengan akun login yang bisa dipublish.</p></div>
            <form class="filter-bar" @submit.prevent="loadTargets">
                <input v-model="targetFilters.search" :placeholder="form.target_role === 'mahasiswa' ? 'Cari nama / NIM' : 'Cari nama / kode dosen'" />
                <input v-if="form.target_role === 'mahasiswa'" v-model.number="targetFilters.angkatan" type="number" placeholder="Angkatan" />
                <input v-model="targetFilters.status" placeholder="Status, contoh A" />
                <select v-model="targetFilters.has_account">
                    <option value="1">Punya akun</option>
                    <option value="">Semua data</option>
                    <option value="0">Belum punya akun</option>
                </select>
                <button type="submit">Cari target</button>
            </form>

            <AsyncState :loading="targetLoading" :error="targetError" :empty="targets.length === 0" empty-title="Belum ada target" empty-text="Gunakan filter untuk mencari mahasiswa/dosen." @retry="loadTargets">
                <div class="bulk-actions">
                    <strong>{{ selectedIdentifiers.length }} target dipilih</strong>
                    <button type="button" class="secondary-btn" @click="selectPageTargets">Pilih semua halaman ini</button>
                    <button type="button" class="ghost-btn" @click="clearTargets">Kosongkan pilihan</button>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Pilih</th><th>Identifier</th><th>Nama</th><th>Angkatan</th><th>Status</th><th>Akun</th></tr></thead>
                        <tbody>
                            <tr v-for="target in targets" :key="target.identifier">
                                <td><input type="checkbox" :value="target.identifier" :disabled="!target.has_account" v-model="selectedIdentifiers" /></td>
                                <td><strong>{{ target.identifier }}</strong></td>
                                <td>{{ target.name || '-' }}</td>
                                <td>{{ target.angkatan || '-' }}</td>
                                <td>{{ target.status || '-' }}</td>
                                <td><StatusPill :status="target.has_account ? 'approved' : 'rejected'" /></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="pagination-row">
                    <button type="button" class="secondary-btn" :disabled="targetMeta.current_page <= 1" @click="changeTargetPage(targetMeta.current_page - 1)">Sebelumnya</button>
                    <span>Halaman {{ targetMeta.current_page || 1 }} dari {{ targetMeta.last_page || 1 }} · {{ targetMeta.total || 0 }} data</span>
                    <button type="button" class="secondary-btn" :disabled="targetMeta.current_page >= targetMeta.last_page" @click="changeTargetPage(targetMeta.current_page + 1)">Berikutnya</button>
                </div>
            </AsyncState>
        </section>

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
const targets = ref([]);
const targetMeta = ref({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
const targetLoading = ref(false);
const targetError = ref('');
const selectedIdentifiers = ref([]);
const selectedId = ref('');
const form = reactive({ title: '', description: '', target_role: 'mahasiswa', scope_type: 'specific' });
const targetFilters = reactive({ search: '', angkatan: '', status: 'A', has_account: '1', page: 1 });

function payload() {
    return {
        ...form,
        scope_type: 'specific',
        target_filters: {},
        target_identifiers: selectedIdentifiers.value,
        target_segment_ids: [],
    };
}

function targetQuery(page = targetFilters.page) {
    return {
        role: form.target_role,
        search: targetFilters.search,
        angkatan: form.target_role === 'mahasiswa' ? targetFilters.angkatan : '',
        status: targetFilters.status,
        has_account: targetFilters.has_account,
        per_page: 25,
        page,
    };
}

async function loadTargets(page = 1) {
    targetLoading.value = true;
    targetError.value = '';
    targetFilters.page = page;
    try {
        const data = await arsipApi.adminTargets(targetQuery(page));
        targets.value = data.targets || [];
        targetMeta.value = data.meta || { current_page: 1, last_page: 1, per_page: 25, total: 0 };
    } catch (err) { targetError.value = toErrorMessage(err); }
    finally { targetLoading.value = false; }
}

function selectPageTargets() {
    const merged = new Set(selectedIdentifiers.value);
    targets.value.filter((target) => target.has_account).forEach((target) => merged.add(target.identifier));
    selectedIdentifiers.value = Array.from(merged);
}

function clearTargets() { selectedIdentifiers.value = []; }

function resetTargets() {
    selectedIdentifiers.value = [];
    targetFilters.page = 1;
    targetFilters.angkatan = '';
    preview.value = null;
    loadTargets();
}

function changeTargetPage(page) { loadTargets(page); }

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.distributions();
        distributions.value = data.distributions || [];
    } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; }
}

async function saveDistribution() {
    if (selectedIdentifiers.value.length === 0) {
        app.notify('error', 'Pilih minimal satu target penerima.');
        return;
    }

    await arsipApi.createDistribution(payload());
    app.notify('success', 'Distribution berhasil dibuat.');
    form.title = '';
    await load();
}

async function previewTargets() {
    if (selectedIdentifiers.value.length === 0) {
        previewError.value = 'Pilih minimal satu target penerima.';
        return;
    }

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

onMounted(() => { load(); loadTargets(); });
</script>
