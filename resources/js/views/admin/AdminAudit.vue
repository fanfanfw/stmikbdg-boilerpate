<template>
    <section class="page-stack">
        <PageHeader eyebrow="Audit log" title="Jejak aktivitas arsip" description="Halaman siap untuk endpoint audit log ketika tersedia di backend." />
        <form class="filter-bar" @submit.prevent="load"><input v-model="filters.action" placeholder="Action" /><input v-model="filters.entity_type" placeholder="Entity type" /><button type="submit">Muat audit</button></form>
        <NotAvailable v-if="notAvailable" title="Endpoint audit log belum tersedia" message="Route /admin/audit-logs belum ada pada backend Phase 1-7 branch ini. UI menampilkan fallback aman tanpa membuat backend baru." />
        <AsyncState v-else :loading="loading" :error="error" :empty="logs.length === 0" empty-title="Belum ada audit log" empty-text="Audit log akan tampil setelah endpoint tersedia." @retry="load">
            <div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Actor</th><th>Action</th><th>Entity</th><th>Deskripsi</th></tr></thead><tbody><tr v-for="log in logs" :key="log.audit_log_id"><td>{{ dateTime(log.created_at) }}</td><td>{{ log.actor_role }} #{{ log.actor_user_id }}</td><td>{{ log.action }}</td><td>{{ log.entity_type }} #{{ log.entity_id }}</td><td>{{ log.description }}</td></tr></tbody></table></div>
        </AsyncState>
    </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import NotAvailable from '../../components/NotAvailable.vue';
import PageHeader from '../../components/PageHeader.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { dateTime } from '../../utils/format';

const loading = ref(false);
const error = ref('');
const notAvailable = ref(true);
const logs = ref([]);
const filters = reactive({ action: '', entity_type: '' });

async function load() {
    loading.value = true; error.value = ''; notAvailable.value = false;
    try { logs.value = (await arsipApi.auditLogs(filters)).audit_logs || []; }
    catch (err) { error.value = toErrorMessage(err); notAvailable.value = true; }
    finally { loading.value = false; }
}
</script>
