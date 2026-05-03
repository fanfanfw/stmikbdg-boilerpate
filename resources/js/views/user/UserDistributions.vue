<template>
    <section class="page-stack">
        <PageHeader eyebrow="Berkas dari kampus" title="Distribution file" description="Download file yang sudah tersedia untuk akun Anda." >
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh</button></template>
        </PageHeader>
        <AsyncState :loading="loading" :error="error" :empty="distributions.length === 0" empty-title="Belum ada berkas" empty-text="File dari admin akan tampil setelah delivery_status tersedia." @retry="load">
            <div class="data-list">
                <article v-for="item in distributions" :key="item.recipient_id || item.distribution_id" class="list-row">
                    <div><strong>{{ item.distribution?.title || item.title || item.file?.display_filename || 'Berkas kampus' }}</strong><small>{{ item.distribution?.description || item.description || item.file?.display_filename || '-' }}</small></div>
                    <StatusPill :status="item.delivery_status || item.status" />
                    <button type="button" class="secondary-btn" :disabled="!item.file" @click="download(item)">Download</button>
                </article>
            </div>
        </AsyncState>
    </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';

const loading = ref(false);
const error = ref('');
const distributions = ref([]);

async function load() { loading.value = true; error.value = ''; try { distributions.value = (await arsipApi.userDistributions()).distributions || []; } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; } }
async function download(item) { if (item.file) await arsipApi.downloadDistributionFile(item.file); }
onMounted(load);
</script>
