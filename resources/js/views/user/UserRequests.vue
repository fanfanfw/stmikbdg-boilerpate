<template>
    <section class="page-stack">
        <PageHeader eyebrow="Permintaan berkas" title="Folder request resmi kampus" description="Setiap request tampil sebagai folder pekerjaan. Buka folder untuk melihat deadline, status, dan file yang sudah Anda kirim." >
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh</button></template>
        </PageHeader>
        <AsyncState :loading="loading" :error="error" :empty="requests.length === 0" empty-title="Belum ada request" empty-text="Request resmi yang ditargetkan kepada Anda akan tampil di sini." @retry="load">
            <div class="folder-grid request-folder-grid">
                <button v-for="request in requests" :key="request.request_id" type="button" :class="['folder-card request-folder-card', selectedRequestId === request.request_id ? 'selected-row' : '']" @click="selectRequest(request)">
                    <span class="folder-icon">📁</span>
                    <strong>{{ request.title }}</strong>
                    <small>{{ request.description || 'Tanpa deskripsi' }}</small>
                    <div class="request-folder-meta">
                        <StatusPill :status="assignment(request)?.status || request.status" />
                        <small>Deadline: {{ dateTime(request.deadline_at) }}</small>
                        <small>{{ currentRequestFiles(request).length }} / {{ request.max_files }} file terkirim</small>
                    </div>
                </button>
            </div>

            <section v-if="selectedRequest" class="panel-block request-folder-detail">
                <div class="section-heading">
                    <div>
                        <p class="eyebrow">Folder request</p>
                        <h2>{{ selectedRequest.title }}</h2>
                        <p>{{ selectedRequest.description || 'Tanpa deskripsi' }}</p>
                    </div>
                    <StatusPill :status="selectedAssignment?.status || selectedRequest.status" />
                </div>
                <dl class="detail-grid">
                    <div><dt>Deadline</dt><dd>{{ dateTime(selectedRequest.deadline_at) }}</dd></div>
                    <div><dt>File rule</dt><dd>{{ selectedRequest.max_files }} file · {{ (selectedRequest.allowed_extensions || []).join(', ') || 'default' }}</dd></div>
                    <div><dt>Verifikasi</dt><dd>{{ selectedRequest.requires_verification ? 'Perlu verifikasi admin' : 'Otomatis diterima' }}</dd></div>
                    <div><dt>Catatan reject</dt><dd>{{ selectedAssignment?.reject_reason || '-' }}</dd></div>
                </dl>
                <div class="two-column">
                    <form class="stack-form" @submit.prevent="uploadForRequest(selectedRequest)">
                        <label>Upload file baru<input type="file" required @change="setRequestFile($event, selectedRequest.request_id)" /></label>
                        <button type="submit" :disabled="actionLoading || !requestFiles[selectedRequest.request_id]">{{ actionLoading ? 'Mengupload...' : 'Upload untuk request' }}</button>
                    </form>
                    <form class="stack-form" @submit.prevent="reuseFile(selectedRequest)">
                        <label>Pakai file lama<select v-model="reuseFiles[selectedRequest.request_id]"><option value="">Pilih file personal</option><option v-for="file in reusableFiles" :key="file.file_id" :value="file.file_id">{{ file.display_filename }}</option></select></label>
                        <button type="submit" class="secondary-btn" :disabled="actionLoading || !reuseFiles[selectedRequest.request_id]">{{ actionLoading ? 'Memproses...' : 'Reuse file' }}</button>
                    </form>
                </div>
                <section class="explorer-section">
                    <div class="section-heading compact-heading"><div><h2>File dalam folder request</h2><p>{{ currentRequestFiles(selectedRequest).length }} file current.</p></div></div>
                    <div v-if="currentRequestFiles(selectedRequest).length" class="file-grid">
                        <article v-for="requestFile in currentRequestFiles(selectedRequest)" :key="requestFile.request_file_id" class="file-card">
                            <div class="file-icon">{{ fileIcon(requestFile.file?.extension) }}</div>
                            <strong>{{ requestFile.file?.display_filename || requestFile.file_id }}</strong>
                            <small>{{ requestFile.submission_type }} · {{ requestFile.file?.extension || '-' }} · {{ bytes(requestFile.file?.file_size_bytes) }}</small>
                            <small>{{ requestFile.is_late ? 'Terlambat' : 'Tepat waktu' }} · {{ dateTime(requestFile.created_at) }}</small>
                            <StatusPill :status="requestFile.status" />
                            <small v-if="requestFile.reject_reason">Catatan: {{ requestFile.reject_reason }}</small>
                        </article>
                    </div>
                    <p v-else class="muted-card inline-empty">Belum ada file di folder request ini.</p>
                </section>
            </section>
        </AsyncState>
    </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { bytes, dateTime } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const actionLoading = ref(false);
const error = ref('');
const requests = ref([]);
const files = ref([]);
const selectedRequestId = ref(null);
const requestFiles = reactive({});
const reuseFiles = reactive({});

const selectedRequest = computed(() => requests.value.find((request) => request.request_id === selectedRequestId.value) || requests.value[0] || null);
const selectedAssignment = computed(() => (selectedRequest.value ? assignment(selectedRequest.value) : null));
const reusableFiles = computed(() => files.value.filter((file) => file.source_type === 'personal' && file.is_current && file.status === 'active'));

function assignment(request) { return request.assignments?.[0] || request.assignment || null; }
function currentRequestFiles(request) { return (assignment(request)?.request_files || []).filter((item) => item.is_current !== false); }
function setRequestFile(event, requestId) { requestFiles[requestId] = event.target.files?.[0] || null; }
function selectRequest(request) { selectedRequestId.value = request.request_id; }

async function load() {
    loading.value = true; error.value = '';
    try {
        const [requestData, fileData] = await Promise.all([arsipApi.userRequests(), arsipApi.files()]);
        requests.value = requestData.requests || [];
        files.value = fileData.files || [];
        if (!selectedRequestId.value && requests.value.length) selectedRequestId.value = requests.value[0].request_id;
        if (selectedRequestId.value && !requests.value.some((request) => request.request_id === selectedRequestId.value)) {
            selectedRequestId.value = requests.value[0]?.request_id || null;
        }
    } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; }
}

async function uploadForRequest(request) {
    const activeAssignment = assignment(request);
    if (!activeAssignment || !requestFiles[request.request_id]) return;
    const formData = new FormData();
    formData.append('file', requestFiles[request.request_id]);

    actionLoading.value = true;
    try {
        await arsipApi.uploadAssignmentFile(activeAssignment.assignment_id, formData);
        app.notify('success', 'File request berhasil diupload.');
        requestFiles[request.request_id] = null;
        await Promise.all([load(), app.loadSummary()]);
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

async function reuseFile(request) {
    const activeAssignment = assignment(request);
    if (!activeAssignment || !reuseFiles[request.request_id]) return;

    actionLoading.value = true;
    try {
        await arsipApi.reuseAssignmentFile(activeAssignment.assignment_id, reuseFiles[request.request_id]);
        app.notify('success', 'File lama dipakai untuk request.');
        reuseFiles[request.request_id] = '';
        await Promise.all([load(), app.loadSummary()]);
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

function fileIcon(extension) {
    const ext = String(extension || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📕';
    if (['doc', 'docx'].includes(ext)) return '📄';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    return '📎';
}

onMounted(load);
</script>
