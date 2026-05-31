<template>
    <section class="page-stack">
        <input ref="adminUploadInput" class="sr-only-file" type="file" @change="handleAdminUpload" />
        <PageHeader eyebrow="Detail request" :title="requestData?.title || 'Memuat request'" :description="requestData?.description || 'Kelola status, target, dan file yang terkumpul untuk request ini.'">
            <template #actions>
                <RouterLink class="secondary-btn" :to="{ name: 'admin.requests' }">Kembali</RouterLink>
                <button v-if="requestData" type="button" class="secondary-btn" :disabled="loading || actionLoading || bulkLoading" @click="loadDetail">Refresh</button>
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
                            <button type="button" class="secondary-btn" :disabled="appendLoading || appendPreviewLoading || !appendTargeting?.canSubmit" @click="previewAppendTargets">{{ appendPreviewLoading ? 'Memvalidasi...' : 'Validasi target' }}</button>
                            <button type="button" :disabled="appendLoading || appendPreviewLoading || !canAppendTargets" @click="appendTargets">{{ appendLoading ? 'Menambahkan...' : 'Tambahkan' }}</button>
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
                    <div><h2>Target</h2><p>Monitoring assignment, verifikasi, upload admin, dan file target request ini.</p></div>
                    <button type="button" class="secondary-btn" :disabled="loading || bulkLoading || actionLoading" @click="loadDetail">Refresh</button>
                </div>
                <form class="filter-bar request-monitor-filter" @submit.prevent>
                    <select v-model="targetFilters.status"><option value="">Semua status target</option><option v-for="status in assignmentStatuses" :key="status" :value="status">{{ statusLabel(status) }}</option></select>
                    <select v-model="targetFilters.verification"><option value="">Semua verifikasi</option><option value="waiting_verification">Menunggu verifikasi</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option><option value="no_files">Belum ada file</option></select>
                    <select v-model="targetFilters.late"><option value="">Semua deadline</option><option value="late">Terlambat</option><option value="on_time">Tidak terlambat</option></select>
                    <input v-model="targetFilters.search" placeholder="Cari NIM/kode/nama" />
                </form>
                <div class="bulk-actions request-bulk-actions">
                    <strong>{{ selectedAssignments.length }} target dipilih</strong>
                    <div class="page-actions">
                        <button type="button" class="secondary-btn" :disabled="bulkLoading || selectedVerifiableAssignmentIds.length === 0" @click="bulkApproveSelected">{{ bulkLoading ? 'Memproses...' : 'Bulk approve' }}</button>
                        <button type="button" class="ghost-btn" :disabled="bulkLoading || selectedVerifiableAssignmentIds.length === 0" @click="bulkRejectSelected">{{ bulkLoading ? 'Memproses...' : 'Bulk reject' }}</button>
                    </div>
                </div>
                <div v-if="filteredAssignments.length" class="table-wrap">
                    <table>
                        <thead><tr><th><input type="checkbox" :checked="allFilteredAssignmentsSelected" :disabled="bulkLoading || filteredAssignments.length === 0" aria-label="Pilih semua target hasil filter" @change="toggleAllFilteredAssignments($event)" /></th><th>Target</th><th>Status Target</th><th>Verifikasi</th><th>Submitted</th><th>File</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="assignment in filteredAssignments" :key="assignment.assignment_id">
                                <td><input v-model="selectedAssignmentIds" type="checkbox" :value="assignment.assignment_id" :disabled="bulkLoading" :aria-label="`Pilih target ${assignment.identifier}`" /></td>
                                <td><strong>{{ assignment.identifier }}</strong><small>{{ assignment.name_snapshot || '-' }} · {{ assignment.angkatan_snapshot || assignment.prodi_snapshot || '-' }}</small></td>
                                <td><StatusPill :status="assignment.status" /><small v-if="assignment.is_late">Terlambat</small><small v-if="assignment.reject_reason">Catatan: {{ assignment.reject_reason }}</small></td>
                                <td><StatusPill :status="verificationStatus(assignment)" /><small>{{ verificationText(assignment) }}</small></td>
                                <td>{{ dateTime(assignment.submitted_at) }}</td>
                                <td>
                                    <div class="mini-stack">
                                        <button v-for="file in currentFiles(assignment)" :key="file.request_file_id" type="button" class="ghost-btn" @click="downloadRequestFile(file)">Download {{ file.file?.display_filename || file.request_file_id }}</button>
                                        <small v-if="currentFiles(assignment).length === 0">Belum ada file</small>
                                    </div>
                                </td>
                                <td class="action-cell">
                                    <button type="button" class="secondary-btn" :disabled="actionLoading || assignment.status !== 'waiting_verification'" @click="approve(assignment)">Approve</button>
                                    <button type="button" class="ghost-btn" :disabled="actionLoading || assignment.status !== 'waiting_verification'" @click="reject(assignment)">Reject</button>
                                    <button type="button" class="secondary-btn" :disabled="actionLoading || requestData.status !== 'published'" @click="chooseAdminUpload(assignment)">Upload admin</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="muted-card inline-empty">Belum ada target sesuai filter. Publish draft untuk membuat assignment.</p>
            </section>

            <section v-if="activeTab === 'files'" class="panel-block">
                <div class="section-heading">
                    <div><h2>File terkumpul</h2><p>Filter, verifikasi, dan download file current dari semua target request.</p></div>
                    <button type="button" class="secondary-btn" :disabled="loading || bulkLoading || actionLoading" @click="loadDetail">Refresh</button>
                </div>
                <form class="filter-bar request-monitor-filter" @submit.prevent>
                    <select v-model="fileFilters.status"><option value="all">Semua file</option><option value="waiting_verification">Menunggu verifikasi</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option><option value="late">Terlambat</option></select>
                    <input v-model="fileFilters.search" placeholder="Cari file/target/nama" />
                    <button type="button" class="secondary-btn" :disabled="downloadLoading || selectedRequestFiles.length === 0" @click="downloadSelectedFiles">{{ downloadLoading ? 'Mengunduh...' : 'Download selected' }}</button>
                    <button type="button" class="ghost-btn" :disabled="downloadLoading || selectedRequestFileIds.length === 0" @click="selectedRequestFileIds = []">Kosongkan pilihan</button>
                </form>
                <div class="bulk-actions request-bulk-actions">
                    <strong>{{ selectedRequestFiles.length }} file dipilih</strong>
                    <div class="page-actions">
                        <button type="button" class="secondary-btn" :disabled="bulkLoading || selectedFileAssignmentIds.length === 0" @click="bulkApproveFileAssignments">{{ bulkLoading ? 'Memproses...' : 'Bulk approve file' }}</button>
                        <button type="button" class="ghost-btn" :disabled="bulkLoading || selectedFileAssignmentIds.length === 0" @click="bulkRejectFileAssignments">{{ bulkLoading ? 'Memproses...' : 'Bulk reject file' }}</button>
                    </div>
                </div>
                <div v-if="filteredCollectedFiles.length" class="table-wrap">
                    <table>
                        <thead><tr><th><input type="checkbox" :checked="allFilteredFilesSelected" :disabled="bulkLoading || filteredCollectedFiles.length === 0" aria-label="Pilih semua file hasil filter" @change="toggleAllFilteredFiles($event)" /></th><th>File</th><th>Target</th><th>Status</th><th>Waktu</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="item in filteredCollectedFiles" :key="item.file.request_file_id">
                                <td><input v-model="selectedRequestFileIds" type="checkbox" :value="item.file.request_file_id" :disabled="bulkLoading" :aria-label="`Pilih file ${item.file.file?.display_filename || item.file.file_id}`" /></td>
                                <td><strong>{{ item.file.file?.display_filename || item.file.file_id }}</strong><small>{{ item.file.submission_type }} · {{ item.file.file?.extension || '-' }} · {{ fileSize(item.file.file?.file_size_bytes) }}</small></td>
                                <td>{{ item.assignment.identifier }}<small>{{ item.assignment.name_snapshot || '-' }}</small></td>
                                <td><StatusPill :status="item.file.status" /><small v-if="item.file.is_late">Terlambat</small><small v-if="item.file.reject_reason">Catatan: {{ item.file.reject_reason }}</small></td>
                                <td>{{ dateTime(item.file.created_at) }}</td>
                                <td class="action-cell">
                                    <button type="button" class="secondary-btn" @click="downloadRequestFile(item.file)">Download</button>
                                    <button type="button" class="secondary-btn" :disabled="actionLoading || item.assignment.status !== 'waiting_verification'" @click="approve(item.assignment)">Approve</button>
                                    <button type="button" class="ghost-btn" :disabled="actionLoading || item.assignment.status !== 'waiting_verification'" @click="reject(item.assignment)">Reject</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="muted-card inline-empty">Belum ada file yang terkumpul sesuai filter.</p>
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
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import TargetPicker from '../../components/TargetPicker.vue';
import { assignmentStatuses, statusLabel } from '../../constants/navigation';
import { arsipApi } from '../../services/arsipApi';
import { confirmAction, promptText } from '../../services/dialogs';
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
const bulkLoading = ref(false);
const downloadLoading = ref(false);
const adminUploadInput = ref(null);
const pendingUploadAssignment = ref(null);
const selectedAssignmentIds = ref([]);
const selectedRequestFileIds = ref([]);
const targetFilters = reactive({ status: '', verification: '', late: '', search: '' });
const fileFilters = reactive({ status: 'all', search: '' });

const tabs = [
    { key: 'summary', label: 'Ringkasan' },
    { key: 'targets', label: 'Target' },
    { key: 'files', label: 'File Terkumpul' },
    { key: 'activity', label: 'Riwayat / Aktivitas' },
];

const assignments = computed(() => requestData.value?.assignments || []);
const collectedFiles = computed(() => assignments.value.flatMap((assignment) => currentFiles(assignment).map((file) => ({ assignment, file }))));
const filteredAssignments = computed(() => assignments.value.filter(matchesTargetFilters));
const filteredCollectedFiles = computed(() => collectedFiles.value.filter(matchesFileFilters));
const selectedAssignments = computed(() => assignments.value.filter((assignment) => selectedAssignmentIds.value.includes(assignment.assignment_id)));
const selectedVerifiableAssignmentIds = computed(() => selectedAssignments.value.filter((assignment) => assignment.status === 'waiting_verification').map((assignment) => assignment.assignment_id));
const selectedRequestFiles = computed(() => collectedFiles.value.filter((item) => selectedRequestFileIds.value.includes(item.file.request_file_id)));
const selectedFileAssignmentIds = computed(() => Array.from(new Set(selectedRequestFiles.value.filter((item) => item.assignment.status === 'waiting_verification').map((item) => item.assignment.assignment_id))));
const allFilteredAssignmentsSelected = computed(() => filteredAssignments.value.length > 0 && filteredAssignments.value.every((assignment) => selectedAssignmentIds.value.includes(assignment.assignment_id)));
const allFilteredFilesSelected = computed(() => filteredCollectedFiles.value.length > 0 && filteredCollectedFiles.value.every((item) => selectedRequestFileIds.value.includes(item.file.request_file_id)));
const appendPreviewSummary = computed(() => ({
    created: appendPreview.value?.newTargets?.length || 0,
    duplicate: appendPreview.value?.duplicateTargets?.length || 0,
    invalid: appendPreview.value?.invalidTargets?.length || 0,
}));
const canAppendTargets = computed(() => appendTargeting.value?.canSubmit && appendPreviewSummary.value.created > 0);

function currentFiles(assignment) {
    return (assignment.request_files || []).filter((item) => item.is_current !== false);
}

function normalized(value) {
    return String(value || '').toLowerCase();
}

function assignmentSearchText(assignment) {
    return normalized(`${assignment.identifier || ''} ${assignment.name_snapshot || ''} ${assignment.angkatan_snapshot || ''} ${assignment.prodi_snapshot || ''}`);
}

function fileSearchText(item) {
    return normalized(`${item.file.file?.display_filename || ''} ${item.assignment.identifier || ''} ${item.assignment.name_snapshot || ''}`);
}

function matchesTargetFilters(assignment) {
    if (targetFilters.status && assignment.status !== targetFilters.status) return false;
    if (targetFilters.late === 'late' && !assignment.is_late) return false;
    if (targetFilters.late === 'on_time' && assignment.is_late) return false;
    if (targetFilters.verification === 'no_files' && currentFiles(assignment).length > 0) return false;
    if (['waiting_verification', 'approved', 'rejected'].includes(targetFilters.verification) && assignment.status !== targetFilters.verification) return false;
    if (targetFilters.search && !assignmentSearchText(assignment).includes(normalized(targetFilters.search))) return false;
    return true;
}

function matchesFileFilters(item) {
    if (fileFilters.status === 'late' && !item.file.is_late) return false;
    if (['waiting_verification', 'approved', 'rejected'].includes(fileFilters.status) && item.file.status !== fileFilters.status) return false;
    if (fileFilters.search && !fileSearchText(item).includes(normalized(fileFilters.search))) return false;
    return true;
}

function verificationStatus(assignment) {
    if (assignment.status === 'waiting_verification') return 'waiting_verification';
    if (assignment.status === 'approved') return 'approved';
    if (assignment.status === 'rejected') return 'rejected';
    return 'not_submitted';
}

function verificationText(assignment) {
    if (assignment.status === 'waiting_verification') return 'Butuh review admin.';
    if (assignment.status === 'approved' && requestData.value?.requires_verification === false) return 'Otomatis diterima; request tidak perlu verifikasi.';
    if (assignment.status === 'approved') return assignment.verified_by_user_id ? 'Sudah diverifikasi admin.' : 'Sudah diterima.';
    if (assignment.status === 'rejected') return assignment.reject_reason || 'Ditolak admin.';
    return 'Belum ada submission.';
}

function fileSize(bytes) {
    const size = Number(bytes || 0);
    if (!size) return '-';
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeIds(current, ids) {
    return Array.from(new Set([...current, ...ids]));
}

function toggleAllFilteredAssignments(event) {
    const ids = filteredAssignments.value.map((assignment) => assignment.assignment_id);
    if (event.target.checked) {
        selectedAssignmentIds.value = mergeIds(selectedAssignmentIds.value, ids);
        return;
    }
    selectedAssignmentIds.value = selectedAssignmentIds.value.filter((id) => !ids.includes(id));
}

function toggleAllFilteredFiles(event) {
    const ids = filteredCollectedFiles.value.map((item) => item.file.request_file_id);
    if (event.target.checked) {
        selectedRequestFileIds.value = mergeIds(selectedRequestFileIds.value, ids);
        return;
    }
    selectedRequestFileIds.value = selectedRequestFileIds.value.filter((id) => !ids.includes(id));
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

async function approve(assignment) {
    const confirmed = await confirmAction({
        title: 'Approve assignment?',
        text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`,
        confirmText: 'Approve',
    });
    if (!confirmed) return;

    actionLoading.value = true;
    try {
        await arsipApi.approveAssignment(assignment.assignment_id);
        app.notify('success', 'Assignment disetujui.');
        await loadDetail();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

async function reject(assignment) {
    const reason = await promptText({
        title: 'Reject assignment?',
        text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`,
        inputLabel: 'Catatan reject',
        placeholder: 'Tulis alasan agar penerima tahu apa yang perlu diperbaiki.',
        confirmText: 'Reject',
    });
    if (!reason) return;

    actionLoading.value = true;
    try {
        await arsipApi.rejectAssignment(assignment.assignment_id, reason);
        app.notify('success', 'Assignment ditolak dengan catatan.');
        await loadDetail();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

async function runBulkAction({ ids, mode }) {
    if (!ids.length) {
        app.notify('error', 'Pilih assignment yang menunggu verifikasi terlebih dahulu.');
        return;
    }

    let reason = '';
    if (mode === 'reject') {
        reason = await promptText({
            title: 'Bulk reject assignment?',
            text: `${ids.length} assignment akan ditolak dengan catatan yang sama.`,
            inputLabel: 'Catatan reject',
            placeholder: 'Tulis alasan reject massal.',
            confirmText: 'Bulk reject',
        });
        if (!reason) return;
    } else {
        const confirmed = await confirmAction({
            title: 'Bulk approve assignment?',
            text: `${ids.length} assignment menunggu verifikasi akan disetujui.`,
            confirmText: 'Bulk approve',
            icon: 'warning',
        });
        if (!confirmed) return;
    }

    bulkLoading.value = true;
    try {
        const data = mode === 'reject'
            ? await arsipApi.bulkRejectAssignments(ids, reason)
            : await arsipApi.bulkApproveAssignments(ids);
        const result = data.result || {};
        app.notify('success', `Bulk ${mode === 'reject' ? 'reject' : 'approve'} selesai: ${result.updated || 0} diproses, ${result.skipped || 0} dilewati.`);
        selectedAssignmentIds.value = [];
        selectedRequestFileIds.value = [];
        await loadDetail();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        bulkLoading.value = false;
    }
}

function bulkApproveSelected() {
    return runBulkAction({ ids: selectedVerifiableAssignmentIds.value, mode: 'approve' });
}

function bulkRejectSelected() {
    return runBulkAction({ ids: selectedVerifiableAssignmentIds.value, mode: 'reject' });
}

function bulkApproveFileAssignments() {
    return runBulkAction({ ids: selectedFileAssignmentIds.value, mode: 'approve' });
}

function bulkRejectFileAssignments() {
    return runBulkAction({ ids: selectedFileAssignmentIds.value, mode: 'reject' });
}

function chooseAdminUpload(assignment) {
    pendingUploadAssignment.value = assignment;
    adminUploadInput.value?.click();
}

async function handleAdminUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    const assignment = pendingUploadAssignment.value;
    pendingUploadAssignment.value = null;
    if (!file || !assignment) return;

    const confirmed = await confirmAction({
        title: 'Upload file untuk target?',
        text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`,
        confirmText: 'Upload',
    });
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner_role', assignment.target_role);
    formData.append('owner_identifier', assignment.identifier);
    formData.append('request_assignment_id', assignment.assignment_id);

    actionLoading.value = true;
    try {
        await arsipApi.uploadForUser(formData);
        app.notify('success', 'File admin berhasil diupload untuk target.');
        await loadDetail();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

async function downloadRequestFile(requestFile) {
    await arsipApi.downloadRequestFile(requestFile);
}

async function downloadSelectedFiles() {
    if (downloadLoading.value || selectedRequestFiles.value.length === 0) return;

    downloadLoading.value = true;
    try {
        for (const item of selectedRequestFiles.value) {
            await downloadRequestFile(item.file);
        }
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        downloadLoading.value = false;
    }
}

onMounted(loadDetail);
</script>
