<template>
    <section class="page-stack">
        <PageHeader
            eyebrow="Dashboard admin"
            title="Kontrol operasional arsip"
            description="Pantau request aktif, assignment yang perlu tindakan, dan export ZIP terbaru."
        >
            <template #actions>
                <button type="button" class="secondary-btn" @click="load">Refresh</button>
            </template>
        </PageHeader>

        <AsyncState :loading="loading" :error="error" @retry="load">
            <div class="metric-grid">
                <article class="metric-card"><span>Request aktif</span><strong>{{ activeRequests }}</strong></article>
                <article class="metric-card"><span>Menunggu verifikasi</span><strong>{{ waitingCount }}</strong></article>
                <article class="metric-card"><span>Belum submit</span><strong>{{ pendingCount }}</strong></article>
                <article class="metric-card"><span>Export terbaru</span><strong>{{ exportJobs.length }}</strong></article>
            </div>

            <div class="two-column">
                <section class="panel-block">
                    <div class="section-heading">
                        <h2>Progress request terbaru</h2>
                        <RouterLink :to="{ name: 'admin.requests' }">Kelola request</RouterLink>
                    </div>
                    <AsyncState :empty="requests.length === 0" empty-title="Belum ada request" empty-text="Buat request dokumen resmi dari menu Permintaan Berkas.">
                        <div class="data-list">
                            <article v-for="request in requests.slice(0, 6)" :key="request.request_id" class="list-row">
                                <div>
                                    <strong>{{ request.title }}</strong>
                                    <small>{{ request.target_role }} · {{ request.assignments_count ?? 0 }} target</small>
                                </div>
                                <StatusPill :status="request.status" />
                            </article>
                        </div>
                    </AsyncState>
                </section>

                <section class="panel-block">
                    <div class="section-heading">
                        <h2>Export ZIP</h2>
                        <RouterLink :to="{ name: 'admin.exports' }">Lihat export</RouterLink>
                    </div>
                    <AsyncState :empty="exportJobs.length === 0" empty-title="Belum ada export" empty-text="Job ZIP akan muncul setelah dibuat.">
                        <div class="data-list">
                            <article v-for="job in exportJobs.slice(0, 6)" :key="job.export_job_id" class="list-row">
                                <div>
                                    <strong>#{{ job.export_job_id }} · {{ job.export_type }}</strong>
                                    <small>{{ dateTime(job.created_at) }}</small>
                                </div>
                                <StatusPill :status="job.status" />
                            </article>
                        </div>
                    </AsyncState>
                </section>
            </div>
        </AsyncState>
    </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { dateTime } from '../../utils/format';

const loading = ref(false);
const error = ref('');
const requests = ref([]);
const exportJobs = ref([]);
const progressRows = ref([]);

const activeRequests = computed(() => requests.value.filter((item) => item.status === 'published').length);
const waitingCount = computed(() => progressRows.value.reduce((sum, row) => sum + Number(row.waiting_verification || 0), 0));
const pendingCount = computed(() => progressRows.value.reduce((sum, row) => sum + Number(row.not_submitted || 0), 0));

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const [requestData, exportData] = await Promise.all([
            arsipApi.adminRequests(),
            arsipApi.exportJobs(),
        ]);
        requests.value = requestData.requests || [];
        exportJobs.value = exportData.export_jobs || [];
        const progress = await Promise.allSettled(requests.value.slice(0, 5).map((item) => arsipApi.requestProgress(item.request_id)));
        progressRows.value = progress
            .filter((item) => item.status === 'fulfilled')
            .map((item) => item.value.progress || {});
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>
