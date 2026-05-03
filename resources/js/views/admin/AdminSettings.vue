<template>
    <section class="page-stack">
        <PageHeader eyebrow="Pengaturan" title="Default aturan arsip" description="Kelola batas ukuran, ekstensi, dan disk storage sesuai endpoint settings Phase 1." />
        <AsyncState :loading="loading" :error="error" :empty="false" @retry="load">
            <section class="panel-block">
                <form class="form-grid" @submit.prevent="save">
                    <label>Maks ukuran default MB<input v-model.number="form.default_max_file_size_mb" type="number" min="1" /></label>
                    <label>Storage disk<input v-model="form.storage_disk" /></label>
                    <label class="wide">Ekstensi default<textarea v-model="extensionsInput" rows="3" /></label>
                    <button type="submit">Simpan pengaturan</button>
                </form>
            </section>
        </AsyncState>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { lines } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const error = ref('');
const extensionsInput = ref('');
const form = reactive({ default_max_file_size_mb: 10, storage_disk: 's3' });

async function load() { loading.value = true; error.value = ''; try { const data = await arsipApi.settings(); Object.assign(form, data); extensionsInput.value = (data.default_allowed_extensions || []).join(','); } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; } }
async function save() { await arsipApi.updateSettings({ ...form, default_allowed_extensions: lines(extensionsInput.value) }); app.notify('success', 'Pengaturan disimpan.'); await load(); }
onMounted(load);
</script>
