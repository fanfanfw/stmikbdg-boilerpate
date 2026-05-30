<template>
    <section class="page-stack">
        <PageHeader eyebrow="Detail request" :title="requestData?.title || 'Memuat request'" :description="requestData?.description || 'Kelola status, target, dan file yang terkumpul untuk request ini.'">
            <template #actions>
                <RouterLink class="secondary-btn" :to="{ name: 'admin.requests' }">Kembali</RouterLink>
                <button v-if="requestData" type="button" class="secondary-btn" @click="loadDetail">Refresh</button>
            </template>
        </PageHeader>

        <AsyncState :loading="loading" :error="error" :empty="!requestData" empty-title="Request tidak ditemukan" empty-text="Request belum tersedia atau tidak dapat diakses." @retry="loadDetail">
            <section class="panel-block request-detail-hero">
                <div class="section-heading">
                    <div>
                        <div class="request-title-line">
                            <h2>{{ requestData.title }}</h2>
                            <StatusPill :status="requestData.status" />
                        </div>
                        <p>{{ requestData.description || 'Tanpa deskripsi' }}</p>
                    </div>
                    <div class="page-actions">
                        <RouterLink v-if="requestData.status === 'draft'" class="secondary-btn" :to="{ name: 'admin.requests' }">Edit</RouterLink>
                        <button v-if="requestData.status === 'draft'" type="button" :disabled="actionLoading" @click="publishRequest">Publish</button>
                        <button v-if="requestData.status === 'published'" type="button" class="secondary-btn" :disabled="actionLoading" @click="openAppendPanel">Tambah Target</button>
                        <button v-if="requestData.status === 'published'" type="button" class="secondary-btn" :disabled="actionLoading" @click="closeRequest">Tutup</button>
                        <button v-if="requestData.status === 'closed'" type="button" :disabled="actionLoading" @click="reopenRequest">Buka Lagi</button>
                        <button v-if="['draft', 'closed'].includes(requestData.status)" type="button" class="ghost-btn" :disabled="actionLoading" @click="archiveRequest">Arsipkan</button>
                    </div>
                </div>

                <dl class="detail-grid">
                    <div><dt>Status</dt><dd><StatusPill :status="requestData.status" /></dd></div>
                    <div><dt>Target</dt><dd>{{ requestData.target_role }} · {{ requestData.scope_type }}</dd></div>
                    <div><dt>Deadline</dt><dd>{{ dateTime(requestData.deadline_at) }}</dd></div>
                    <div><dt>Published</dt><dd>{{ dateTime(requestData.published_at) }}</dd></div>
                    <div><dt>Closed</dt><dd>{{ dateTime(requestData.closed_at) }}</dd></div>
                    <div><dt>Aturan file</dt><dd>{{ requestData.max_files }} file · {{ (requestData.allowed_extensions || []).join(', ') || 'default' }}</dd></div>
                </dl>
            </section>

            <section v-if="showAppendPanel" class="panel-block append-target-panel">
                <div class="section-heading">
                    <div>
                        <h2>Tambah Target</h2>
                        <p>Pilih target tambahan untuk request published. Role dikunci mengikuti request ini: {{ requestData.target_role }}.</p>
                    </div>
                    <button type="button" class="ghost-btn" :disabled="appendLoading" @click="closeAppendPanel">Tutup Panel</button>
                </div>

                <TargetPicker :key="appendPickerKey" :initial-role="requestData.target_role" lock-role @change="onAppendTargetChange" />

                <section class="append-preview-block">
                    <div class="section-heading">
                        <div>
                            <h2>Preview Tambah Target</h2>
                            <p>{{ appendTargeting?.summary || 'Pilih target tambahan, lalu validasi sebelum menambahkan.' }}</p>
                        </div>
                        <div class="page-actions">
                            <button type="button" class="secondary-btn" :disabled="appendLoading || appendPreviewLoading || !appendTargeting?.canSubmit" @click="previewAppendTargets">Validasi target</button>
                            <button type="button" :disabled="appendLoading || appendPreviewLoading || !canAppendTargets" @click="appendTargets">Tambahkan</button>
                        </div>
                    </div>

                    <AsyncState :loading="appendPreviewLoading" :error="appendError" :empty="!appendPreview" empty-title="Belum ada preview" empty-text="Klik Validasi target untuk melihat target baru, duplicate, dan invalid.">
                        <div class="metric-grid compact append-metric-grid">
                            <article class="metric-card"><span>Target baru</span><strong>{{ appendPreviewSummary.created }}</strong></article>
                            <article class="metric-card"><span>Sudah ada / duplicate</span><strong>{{ appendPreviewSummary.duplicate }}</strong></article>
                            <article class="metric-card"><span>Invalid</span><strong>{{ appendPreviewSummary.invalid }}</strong></article>
                        </div>
                        <div class="data-list preview-list">
                            <article v-for="target in appendPreview.newTargets" :key="`new-${target.identifier}`" class="list-row">
                                <div><strong>{{ target.identifier }}</strong><small>{{ target.name_snapshot || '-' }}</small></div>
                                <StatusPill status="approved" />
                            </article>
                            <article v-for="target in appendPreview.duplicateTargets" :key="`duplicate-${target.identifier}`" class="list-row">
                                <div><strong>{{ target.identifier }}</strong><small>Target sudah ada di request ini.</small></div>
                                <StatusPill status="closed" />
                            </article>
                            <article v-for="target in appendPreview.invalidTargets" :key="`invalid-${target.identifier}`" class="list-row">
                                <div><strong>{{ target.identifier }}</strong><small>{{ target.reason || 'Tidak valid' }}</small></div>
                                <StatusPill status="rejected" />
                            </article>
                        </div>
                    </AsyncState>
                </section>
            </section>

            <nav class="tabs" aria-label="Tab detail request">
                <button v-for="tab in tabs" :key="tab.key" type="button" :class="['tab-button', { active: activeTab === tab.key }]" @click="activeTab = tab.key">{{ tab.label }}</button>
            </nav>

            <section v-if="activeTab === 'summary'" class="panel-block">
                <div class="section-heading"><h2>Ringkasan</h2></div>
                <div class="metric-grid">
                    <article class="metric-card"><span>Total target</span><strong>{{ progress.total_assignments || 0 }}</strong></article>
                    <article class="metric-card"><span>Sudah submit</span><strong>{{ progress.submitted || 0 }}</strong></article>
                    <article class="metric-card"><span>Menunggu verifikasi</span><strong>{{ progress.waiting_verification || 0 }}</strong></article>
                    <article class="metric-card"><span>Disetujui</span><strong>{{ progress.approved || 0 }}</strong></article>
                    <article class="metric-card"><span>File terkumpul</span><strong>{{ fileSummary.total_current_files || 0 }}</strong></article>
                    <article class="metric-card"><span>File terlambat</span><strong>{{ fileSummary.late_files || 0 }}</strong></article>
                </div>
            </section>

            <section v-if="activeTab === 'targets'" class="panel-block">
                <div class="section-heading">
                    <div><h2>Target</h2><p>Assignment yang dibuat untuk request ini.</p></div>
                </div>
                <div v-if="assignments.length" class="table-wrap">
                    <table>
                        <thead><tr><th>Target</th><th>Status</th><th>Submitted</th><th>File</th></tr></thead>
                        <tbody>
                            <tr v-for="assignment in assignments" :key="assignment.assignment_id">
                                <td><strong>{{ assignment.identifier }}</strong><small>{{ assignment.name_snapshot || '-' }} · {{ assignment.angkatan_snapshot || assignment.prodi_snapshot || '-' }}</small></td>
                                <td><StatusPill :status="assignment.status" /><small v-if="assignment.is_late">Terlambat</small></td>
                                <td>{{ dateTime(assignment.submitted_at) }}</td>
                                <td>{{ currentFiles(assignment).length }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="muted-card inline-empty">Belum ada target. Publish draft untuk membuat assignment.</p>
            </section>

            <section v-if="activeTab === 'files'" class="panel-block">
                <div class="section-heading">
                    <div><h2>File terkumpul</h2><p>File current dari semua target request.</p></div>
                </div>
                <div v-if="collectedFiles.length" class="table-wrap">
                    <table>
                        <thead><tr><th>File</th><th>Target</th><th>Status</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="item in collectedFiles" :key="item.file.request_file_id">
                                <td><strong>{{ item.file.file?.display_filename || item.file.file_id }}</strong><small>{{ item.file.submission_type }}</small></td>
                                <td>{{ item.assignment.identifier }}<small>{{ item.assignment.name_snapshot || '-' }}</small></td>
                                <td><StatusPill :status="item.file.status" /><small v-if="item.file.is_late">Terlambat</small></td>
                                <td><button type="button" class="secondary-btn" @click="downloadRequestFile(item.file)">Download</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="muted-card inline-empty">Belum ada file yang terkumpul.</p>
            </section>

            <section v-if="activeTab === 'activity'" class="panel-block">
                <div class="section-heading"><h2>Riwayat / aktivitas</h2></div>
                <div class="data-list">
                    <article class="list-row"><div><strong>Request dibuat</strong><small>{{ dateTime(requestData.created_at) }}</small></div><StatusPill status="draft" /></article>
                    <article v-if="requestData.published_at" class="list-row"><div><strong>Request dipublish</strong><small>{{ dateTime(requestData.published_at) }}</small></div><StatusPill status="published" /></article>
                    <article v-if="requestData.closed_at" class="list-row"><div><strong>Request ditutup</strong><small>{{ dateTime(requestData.closed_at) }}</small></div><StatusPill status="closed" /></article>
                </div>
            </section>
        </AsyncState>
    </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import TargetPicker from '../../components/TargetPicker.vue';
import { arsipApi } from '../../services/arsipApi';
import { confirmAction } from '../../services/dialogs';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { dateTime } from '../../utils/format';

const route = useRoute();
const app = useAppStore();
const loading = ref(false);
const actionLoading = ref(false);
const error = ref('');
const requestData = ref(null);
const progress = ref({});
const fileSummary = ref({});
const activeTab = ref('summary');
const showAppendPanel = ref(false);
const appendLoading = ref(false);
const appendPreviewLoading = ref(false);
const appendError = ref('');
const appendTargeting = ref(null);
const appendPreview = ref(null);
const appendPickerKey = ref(0);

const tabs = [
    { key: 'summary', label: 'Ringkasan' },
    { key: 'targets', label: 'Target' },
    { key: 'files', label: 'File Terkumpul' },
    { key: 'activity', label: 'Riwayat / Aktivitas' },
];

const assignments = computed(() => requestData.value?.assignments || []);
const collectedFiles = computed(() => assignments.value.flatMap((assignment) => currentFiles(assignment).map((file) => ({ assignment, file }))));
const appendPreviewSummary = computed(() => ({
    created: appendPreview.value?.newTargets?.length || 0,
    duplicate: appendPreview.value?.duplicateTargets?.length || 0,
    invalid: appendPreview.value?.invalidTargets?.length || 0,
}));
const canAppendTargets = computed(() => appendTargeting.value?.canSubmit && appendPreviewSummary.value.created > 0);

function currentFiles(assignment) {
    return (assignment.request_files || []).filter((item) => item.is_current !== false);
}

function normalizeTargetList(list) {
    return (list || []).map((target) => ({ ...target, identifier: String(target.identifier || '').trim() }));
}

function buildAppendPreview(summary) {
    return {
        newTargets: normalizeTargetList(summary.created_targets),
        duplicateTargets: normalizeTargetList(summary.duplicate_targets),
        invalidTargets: normalizeTargetList(summary.invalid_targets),
    };
}

function buildAppendPreviewFromTargetPreview(preview) {
    const existingIdentifiers = new Set(assignments.value.map((assignment) => String(assignment.identifier || '').trim()));
    const newTargets = [];
    const duplicateTargets = [];

    normalizeTargetList(preview.valid_targets).forEach((target) => {
        if (existingIdentifiers.has(target.identifier)) {
            duplicateTargets.push(target);
            return;
        }

        newTargets.push(target);
    });

    return {
        newTargets,
        duplicateTargets,
        invalidTargets: normalizeTargetList(preview.invalid_targets),
    };
}

function openAppendPanel() {
    showAppendPanel.value = true;
    appendError.value = '';
}

function closeAppendPanel() {
    showAppendPanel.value = false;
    appendError.value = '';
    appendPreview.value = null;
}

function onAppendTargetChange(event) {
    appendTargeting.value = event;
    appendPreview.value = null;
    appendError.value = '';
}

function applyDetailData(data) {
    requestData.value = data.request;
    progress.value = data.progress || {};
    fileSummary.value = data.file_summary || {};
}

async function refreshDetailSnapshot() {
    const data = await arsipApi.requestDetail(route.params.request_id);
    applyDetailData(data);
}

async function loadDetail() {
    loading.value = true;
    error.value = '';
    try {
        await refreshDetailSnapshot();
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

async function runLifecycle({ confirm, action, success }) {
    if (!requestData.value) return;
    const confirmed = await confirmAction(confirm);
    if (!confirmed) return;

    actionLoading.value = true;
    try {
        await action(requestData.value.request_id);
        app.notify('success', success);
        await loadDetail();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

function publishRequest() {
    return runLifecycle({
        confirm: {
            title: 'Publish request?',
            text: 'Assignment akan dibuat untuk target request ini dan mulai terlihat oleh penerima.',
            confirmText: 'Publish',
            icon: 'warning',
        },
        action: arsipApi.publishRequest,
        success: 'Request berhasil dipublish.',
    });
}

function closeRequest() {
    return runLifecycle({
        confirm: {
            title: 'Tutup request?',
            text: 'Penerima tidak bisa upload file baru sampai request dibuka lagi.',
            confirmText: 'Tutup request',
            icon: 'warning',
        },
        action: arsipApi.closeRequest,
        success: 'Request berhasil ditutup.',
    });
}

function reopenRequest() {
    return runLifecycle({
        confirm: {
            title: 'Buka lagi request?',
            text: 'Penerima akan kembali bisa upload selama aturan deadline mengizinkan.',
            confirmText: 'Buka lagi',
        },
        action: arsipApi.reopenRequest,
        success: 'Request berhasil dibuka lagi.',
    });
}

function archiveRequest() {
    return runLifecycle({
        confirm: {
            title: 'Arsipkan request?',
            text: 'Request akan menjadi read-only dan tidak muncul sebagai pekerjaan aktif.',
            confirmText: 'Arsipkan',
            icon: 'warning',
        },
        action: arsipApi.archiveRequest,
        success: 'Request berhasil diarsipkan.',
    });
}

async function previewAppendTargets() {
    if (!requestData.value || !appendTargeting.value?.canSubmit) {
        appendError.value = 'Pilih target tambahan terlebih dahulu.';
        return;
    }

    appendPreviewLoading.value = true;
    appendError.value = '';
    try {
        await refreshDetailSnapshot();
        const data = await arsipApi.previewRequestTargets(appendTargeting.value.payload);
        appendPreview.value = buildAppendPreviewFromTargetPreview(data.preview || {});
    } catch (err) {
        appendError.value = toErrorMessage(err);
    } finally {
        appendPreviewLoading.value = false;
    }
}

async function appendTargets() {
    if (!requestData.value || !appendTargeting.value?.canSubmit) {
        app.notify('error', 'Pilih target tambahan terlebih dahulu.');
        return;
    }

    await previewAppendTargets();

    if (appendError.value) {
        return;
    }

    if (appendPreviewSummary.value.created < 1) {
        app.notify('error', 'Tidak ada target baru yang valid untuk ditambahkan.');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Tambahkan target?',
        text: `${appendPreviewSummary.value.created} target baru akan ditambahkan. ${appendPreviewSummary.value.duplicate} duplicate dan ${appendPreviewSummary.value.invalid} invalid akan dilewati.`,
        confirmText: 'Tambahkan',
        icon: 'warning',
    });
    if (!confirmed) return;

    appendLoading.value = true;
    appendError.value = '';
    try {
        const data = await arsipApi.appendRequestTargets(requestData.value.request_id, appendTargeting.value.payload);
        const summary = data.summary || {};
        app.notify('success', `Target diproses: ${summary.created || 0} ditambahkan, ${summary.skipped_duplicate || 0} duplicate, ${summary.invalid || 0} invalid.`);
        appendPreview.value = buildAppendPreview(summary);
        appendTargeting.value = null;
        appendPickerKey.value += 1;
        activeTab.value = 'targets';
        await loadDetail();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        appendLoading.value = false;
    }
}

async function downloadRequestFile(requestFile) {
    await arsipApi.downloadRequestFile(requestFile);
}

onMounted(loadDetail);
</script>
