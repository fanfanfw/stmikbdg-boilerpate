<template>
    <section class="page-stack">
        <PageHeader eyebrow="Arsip saya" title="Kategori dan file personal" description="Upload dokumen personal, download kembali, atau hapus soft delete melalui proxy." >
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh</button></template>
        </PageHeader>
        <div class="two-column">
            <section class="panel-block">
                <div class="section-heading"><h2>Kategori</h2></div>
                <form class="stack-form" @submit.prevent="createCategory">
                    <label>Nama kategori<input v-model="categoryForm.name" required placeholder="Dokumen Pribadi" /></label>
                    <label>Deskripsi<textarea v-model="categoryForm.description" rows="3" /></label>
                    <button type="submit">Buat kategori</button>
                </form>
                <div class="data-list">
                    <button v-for="category in personalCategories" :key="category.category_id" type="button" :class="['select-row', selectedCategoryId === category.category_id ? 'active' : '']" @click="selectedCategoryId = category.category_id">
                        <strong>{{ category.name }}</strong><small>{{ category.description || 'Tanpa deskripsi' }}</small>
                    </button>
                </div>
            </section>
            <section class="panel-block">
                <div class="section-heading"><h2>Upload file</h2></div>
                <form class="stack-form" @submit.prevent="uploadPersonalFile">
                    <label>Kategori<select v-model="selectedCategoryId"><option value="">Tanpa kategori</option><option v-for="category in personalCategories" :key="category.category_id" :value="category.category_id">{{ category.name }}</option></select></label>
                    <label>Nama tampil<input v-model="uploadForm.display_filename" placeholder="Opsional" /></label>
                    <label>File<input ref="fileInput" type="file" required @change="onFileChange" /></label>
                    <button type="submit" :disabled="!uploadForm.file">Upload</button>
                </form>
            </section>
        </div>
        <AsyncState :loading="loading" :error="error" :empty="files.length === 0" empty-title="Belum ada file" empty-text="Upload file pertama Anda dari panel di atas." @retry="load">
            <div class="table-wrap"><table><thead><tr><th>File</th><th>Kategori</th><th>Versi</th><th>Ukuran</th><th>Aksi</th></tr></thead><tbody>
                <tr v-for="file in files" :key="file.file_id"><td><strong>{{ file.display_filename }}</strong><small>{{ file.extension }} · {{ dateTime(file.created_at) }}</small></td><td>{{ categoryName(file.category_id) }}</td><td>v{{ file.version_number }}<small>{{ file.is_current ? 'current' : 'replaced' }}</small></td><td>{{ bytes(file.file_size_bytes) }}</td><td class="action-cell"><button type="button" class="secondary-btn" @click="download(file)">Download</button><button type="button" class="ghost-btn" @click="deleteFile(file)">Hapus</button></td></tr>
            </tbody></table></div>
        </AsyncState>
    </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { bytes, dateTime } from '../../utils/format';

const app = useAppStore();
const loading = ref(false);
const error = ref('');
const categories = ref([]);
const files = ref([]);
const selectedCategoryId = ref('');
const fileInput = ref(null);
const categoryForm = reactive({ name: '', description: '' });
const uploadForm = reactive({ file: null, display_filename: '' });

const personalCategories = computed(() => categories.value.filter((item) => item.category_type === 'personal'));
function categoryName(id) { return categories.value.find((item) => item.category_id === id)?.name || '-'; }
function onFileChange(event) { uploadForm.file = event.target.files?.[0] || null; }

async function load() {
    loading.value = true; error.value = '';
    try {
        const [categoryData, fileData] = await Promise.all([arsipApi.categories(), arsipApi.files()]);
        categories.value = categoryData.categories || [];
        files.value = fileData.files || [];
    } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; }
}

async function createCategory() { await arsipApi.createCategory({ category_type: 'personal', ...categoryForm }); app.notify('success', 'Kategori dibuat.'); categoryForm.name = ''; categoryForm.description = ''; await load(); }
async function uploadPersonalFile() {
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    if (selectedCategoryId.value) formData.append('category_id', selectedCategoryId.value);
    if (uploadForm.display_filename) formData.append('display_filename', uploadForm.display_filename);
    await arsipApi.uploadFile(formData);
    app.notify('success', 'File berhasil diupload.');
    uploadForm.file = null; uploadForm.display_filename = ''; if (fileInput.value) fileInput.value.value = '';
    await Promise.all([load(), app.loadSummary()]);
}
async function download(file) { await arsipApi.downloadFile(file); }
async function deleteFile(file) { const reason = window.prompt('Alasan hapus file', 'Dihapus dari UI'); if (reason === null) return; await arsipApi.deleteFile(file.file_id, reason); app.notify('success', 'File dihapus secara soft delete.'); await load(); }
onMounted(load);
</script>
