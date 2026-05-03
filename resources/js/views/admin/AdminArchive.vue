<template>
    <section class="page-stack">
        <PageHeader
            eyebrow="Arsip pengguna"
            title="Browser file mahasiswa dan dosen"
            description="Gunakan endpoint file yang tersedia untuk memantau arsip. Endpoint user browser PRD belum tersedia di backend branch ini."
        />

        <form class="filter-bar" @submit.prevent="load">
            <select v-model="filters.owner_role">
                <option value="">Semua role</option>
                <option value="mahasiswa">Mahasiswa</option>
                <option value="dosen">Dosen</option>
            </select>
            <input v-model="filters.owner_identifier" placeholder="NIM / kode dosen" />
            <input v-model="filters.extension" placeholder="Ekstensi, contoh pdf" />
            <button type="submit">Terapkan</button>
        </form>

        <NotAvailable
            title="Endpoint daftar pengguna belum tersedia"
            message="PRD mencantumkan /admin/archive/users, tetapi route backend saat ini belum menyediakannya. Tabel di bawah memakai /files sebagai fallback admin."
        />

        <AsyncState :loading="loading" :error="error" :empty="files.length === 0" empty-title="Belum ada file" empty-text="Tidak ada file sesuai filter." @retry="load">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>File</th><th>Pemilik</th><th>Versi</th><th>Ukuran</th><th>Aksi</th></tr></thead>
                    <tbody>
                        <tr v-for="file in files" :key="file.file_id">
                            <td><strong>{{ file.display_filename }}</strong><small>{{ file.extension }}</small></td>
                            <td>{{ file.owner_identifier }}<small>{{ file.owner_role }} · {{ file.owner_name_snapshot || '-' }}</small></td>
                            <td>v{{ file.version_number }}<small>{{ file.is_current ? 'current' : 'replaced' }}</small></td>
                            <td>{{ bytes(file.file_size_bytes) }}</td>
                            <td class="action-cell">
                                <button type="button" class="secondary-btn" @click="download(file)">Download</button>
                                <button v-if="file.status === 'deleted'" type="button" class="ghost-btn" @click="restore(file)">Restore</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </AsyncState>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import NotAvailable from '../../components/NotAvailable.vue';
import PageHeader from '../../components/PageHeader.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { bytes } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const error = ref('');
const files = ref([]);
const filters = reactive({ owner_role: '', owner_identifier: '', extension: '', with_deleted: true });

async function load() {
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.files(filters);
        files.value = data.files || [];
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

async function download(file) {
    await arsipApi.downloadFile(file);
}

async function restore(file) {
    await arsipApi.restoreFile(file.file_id);
    app.notify('success', 'File berhasil direstore.');
    await load();
}

onMounted(load);
</script>
