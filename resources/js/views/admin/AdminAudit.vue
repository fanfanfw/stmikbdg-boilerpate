<template>
    <section class="page-stack">
        <PageHeader eyebrow="Audit log" title="Jejak aktivitas arsip" description="Lacak aktivitas penting seperti request, upload, verifikasi, download, dan export ZIP." />

        <form class="filter-bar" @submit.prevent="load(1)">
            <input v-model="filters.action" placeholder="Action" />
            <input v-model="filters.entity_type" placeholder="Entity type" />
            <input v-model="filters.actor_role" placeholder="Role actor" />
            <button type="submit">Muat audit</button>
        </form>

        <AsyncState :loading="loading" :error="error" :empty="logs.length === 0" empty-title="Belum ada audit log" empty-text="Aktivitas arsip akan tampil setelah ada aksi yang tercatat." @retry="load(meta.current_page || 1)">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Waktu</th><th>Actor</th><th>Action</th><th>Entity</th><th>Deskripsi</th></tr></thead>
                    <tbody>
                        <tr v-for="log in logs" :key="log.audit_log_id">
                            <td>{{ dateTime(log.created_at) }}</td>
                            <td>{{ log.actor_role || '-' }}<small>#{{ log.actor_user_id || '-' }}</small></td>
                            <td><strong>{{ log.action }}</strong></td>
                            <td>{{ log.entity_type }}<small>#{{ log.entity_id || '-' }}</small></td>
                            <td>{{ log.description || '-' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="pagination-row">
                <button type="button" class="secondary-btn" :disabled="loading || meta.current_page <= 1" @click="load(meta.current_page - 1)">Sebelumnya</button>
                <span>Halaman {{ meta.current_page || 1 }} dari {{ meta.last_page || 1 }} · {{ meta.total || 0 }} log</span>
                <button type="button" class="secondary-btn" :disabled="loading || meta.current_page >= meta.last_page" @click="load(meta.current_page + 1)">Berikutnya</button>
            </div>
        </AsyncState>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { dateTime } from '../../utils/format';

const loading = ref(false);
const error = ref('');
const logs = ref([]);
const meta = ref({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
const filters = reactive({ action: '', entity_type: '', actor_role: '', per_page: 25 });

async function load(page = 1) {
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.auditLogs({ ...filters, page });
        logs.value = data.audit_logs || [];
        meta.value = data.meta || { current_page: 1, last_page: 1, per_page: 25, total: 0 };
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>
