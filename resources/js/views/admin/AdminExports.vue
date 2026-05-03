<template>
    <section class="page-stack">
        <PageHeader eyebrow="Export ZIP" title="Bulk download async" description="Buat job export, pantau status queue, dan download ZIP ketika completed." />
        <section class="panel-block">
            <form class="form-grid" @submit.prevent="createJob">
                <label>Tipe export<select v-model="form.export_type" disabled><option value="request">Request</option></select></label>
                <label>Request ID<input v-model.number="form.request_id" type="number" placeholder="Wajib untuk tipe request" /></label>
                <label>Status file<textarea v-model="statusesInput" rows="2" placeholder="approved,waiting_verification" /></label>
                <p class="wide lede">Phase 7 backend hanya mengaktifkan export ZIP untuk satu request.</p>
                <button type="submit">Buat export job</button>
            </form>
        </section>
        <AsyncState :loading="loading" :error="error" :empty="jobs.length === 0" empty-title="Belum ada job" empty-text="Job akan tampil sebagai queued jika worker belum berjalan." @retry="load">
            <div class="table-wrap"><table><thead><tr><th>Job</th><th>Tipe</th><th>Status</th><th>Dibuat</th><th>Aksi</th></tr></thead><tbody>
                <tr v-for="job in jobs" :key="job.export_job_id"><td>#{{ job.export_job_id }}</td><td>{{ job.export_type }}</td><td><StatusPill :status="job.status" /></td><td>{{ dateTime(job.created_at) }}</td><td><button type="button" class="secondary-btn" :disabled="job.status !== 'completed'" @click="download(job)">Download ZIP</button></td></tr>
            </tbody></table></div>
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
import { dateTime, lines } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const error = ref('');
const jobs = ref([]);
const statusesInput = ref('approved,waiting_verification');
const form = reactive({ export_type: 'request', request_id: '' });

async function load() { loading.value = true; error.value = ''; try { jobs.value = (await arsipApi.exportJobs()).export_jobs || []; } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; } }
async function createJob() {
    await arsipApi.createExportJob({ export_type: form.export_type, filters: { request_id: form.request_id, statuses: lines(statusesInput.value) } });
    app.notify('success', 'Export job dibuat.');
    await load();
}
async function download(job) { await arsipApi.downloadExportJob(job); }
onMounted(load);
</script>
