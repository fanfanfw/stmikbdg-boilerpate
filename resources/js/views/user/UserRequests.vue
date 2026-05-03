<template>
    <section class="page-stack">
        <PageHeader eyebrow="Permintaan berkas" title="Request resmi kampus" description="Penuhi request dengan upload file baru atau reuse file dari arsip personal." >
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh</button></template>
        </PageHeader>
        <AsyncState :loading="loading" :error="error" :empty="requests.length === 0" empty-title="Belum ada request" empty-text="Request resmi yang ditargetkan kepada Anda akan tampil di sini." @retry="load">
            <div class="data-list request-cards">
                <article v-for="request in requests" :key="request.request_id" class="panel-block">
                    <div class="section-heading"><div><h2>{{ request.title }}</h2><p>{{ request.description || 'Tanpa deskripsi' }}</p></div><StatusPill :status="assignment(request)?.status || request.status" /></div>
                    <dl class="detail-grid"><div><dt>Deadline</dt><dd>{{ dateTime(request.deadline_at) }}</dd></div><div><dt>File rule</dt><dd>{{ request.max_files }} file · {{ (request.allowed_extensions || []).join(', ') || 'default' }}</dd></div><div><dt>Catatan reject</dt><dd>{{ assignment(request)?.reject_reason || '-' }}</dd></div></dl>
                    <div class="two-column">
                        <form class="stack-form" @submit.prevent="uploadForRequest(request)">
                            <label>Upload file baru<input type="file" required @change="setRequestFile($event, request.request_id)" /></label>
                            <button type="submit" :disabled="!requestFiles[request.request_id]">Upload untuk request</button>
                        </form>
                        <form class="stack-form" @submit.prevent="reuseFile(request)">
                            <label>Pakai file lama<select v-model="reuseFiles[request.request_id]"><option value="">Pilih file</option><option v-for="file in files" :key="file.file_id" :value="file.file_id">{{ file.display_filename }}</option></select></label>
                            <button type="submit" class="secondary-btn" :disabled="!reuseFiles[request.request_id]">Reuse file</button>
                        </form>
                    </div>
                    <div class="data-list"><article v-for="requestFile in assignment(request)?.request_files || []" :key="requestFile.request_file_id" class="list-row"><div><strong>{{ requestFile.file?.display_filename || requestFile.file_id }}</strong><small>{{ requestFile.submission_type }}</small></div><StatusPill :status="requestFile.status" /></article></div>
                </article>
            </div>
        </AsyncState>
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
import { dateTime } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const error = ref('');
const requests = ref([]);
const files = ref([]);
const requestFiles = reactive({});
const reuseFiles = reactive({});

function assignment(request) { return request.assignments?.[0] || request.assignment || null; }
function setRequestFile(event, requestId) { requestFiles[requestId] = event.target.files?.[0] || null; }

async function load() {
    loading.value = true; error.value = '';
    try {
        const [requestData, fileData] = await Promise.all([arsipApi.userRequests(), arsipApi.files()]);
        requests.value = requestData.requests || [];
        files.value = fileData.files || [];
    } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; }
}

async function uploadForRequest(request) {
    const activeAssignment = assignment(request);
    if (!activeAssignment || !requestFiles[request.request_id]) return;
    const formData = new FormData();
    formData.append('file', requestFiles[request.request_id]);
    await arsipApi.uploadAssignmentFile(activeAssignment.assignment_id, formData);
    app.notify('success', 'File request berhasil diupload.');
    requestFiles[request.request_id] = null;
    await Promise.all([load(), app.loadSummary()]);
}

async function reuseFile(request) {
    const activeAssignment = assignment(request);
    if (!activeAssignment || !reuseFiles[request.request_id]) return;
    await arsipApi.reuseAssignmentFile(activeAssignment.assignment_id, reuseFiles[request.request_id]);
    app.notify('success', 'File lama dipakai untuk request.');
    reuseFiles[request.request_id] = '';
    await Promise.all([load(), app.loadSummary()]);
}

onMounted(load);
</script>
