<template>
    <section class="page-stack">
        <PageHeader eyebrow="Arsip saya" title="Kategori, request, dan file personal" description="Kelola dokumen personal dan buka kembali file dari request sebagai folder arsip." >
            <template #actions><button type="button" class="secondary-btn" @click="load">Refresh</button></template>
        </PageHeader>
        <div class="two-column">
            <section class="panel-block">
                <div class="section-heading"><h2>Folder arsip</h2></div>
                <form class="stack-form" @submit.prevent="createCategory">
                    <label>Nama kategori<input v-model="categoryForm.name" required placeholder="Dokumen Pribadi" /></label>
                    <label>Deskripsi<textarea v-model="categoryForm.description" rows="3" /></label>
                    <button type="submit">Buat kategori</button>
                </form>
                <div class="data-list">
                    <button type="button" :class="['select-row', selectedFolderKey === 'personal:root' ? 'active' : '']" @click="selectFolder(rootFolder)">
                        <strong>Arsip Pribadi</strong><small>{{ personalRootFiles.length }} file tanpa kategori</small>
                    </button>
                    <button v-for="category in personalCategories" :key="category.category_id" type="button" :class="['select-row', selectedFolderKey === `category:${category.category_id}` ? 'active' : '']" @click="selectFolder(categoryFolder(category))">
                        <strong>{{ category.name }}</strong><small>{{ category.description || 'Tanpa deskripsi' }}</small>
                    </button>
                    <button v-for="folder in requestFolders" :key="folder.key" type="button" :class="['select-row', selectedFolderKey === folder.key ? 'active' : '']" @click="selectFolder(folder)">
                        <strong>{{ folder.label }}</strong><small>Permintaan Berkas · {{ folder.files.length }} file</small>
                    </button>
                </div>
            </section>
            <section class="panel-block">
                <div class="section-heading"><h2>Upload file personal</h2></div>
                <form class="stack-form" @submit.prevent="uploadPersonalFile">
                    <label>Kategori<select v-model="selectedCategoryId"><option value="">Tanpa kategori</option><option v-for="category in personalCategories" :key="category.category_id" :value="category.category_id">{{ category.name }}</option></select></label>
                    <label>Nama tampil<input v-model="uploadForm.display_filename" placeholder="Opsional" /></label>
                    <label>File<input ref="fileInput" type="file" required @change="onFileChange" /></label>
                    <button type="submit" :disabled="!uploadForm.file">Upload</button>
                </form>
            </section>
        </div>

        <section class="panel-block">
            <div class="section-heading">
                <div>
                    <p class="eyebrow">Folder</p>
                    <h2>{{ selectedFolder.label }}</h2>
                    <p>{{ selectedFolder.description }}</p>
                </div>
            </div>
            <AsyncState :loading="loading" :error="error" :empty="visibleFiles.length === 0" empty-title="Folder kosong" empty-text="Belum ada file pada folder ini." @retry="load">
                <div class="file-grid">
                    <article v-for="file in visibleFiles" :key="file.file_id" class="file-card">
                        <div class="file-icon">{{ fileIcon(file.extension) }}</div>
                        <strong>{{ file.display_filename }}</strong>
                        <small>{{ file.extension }} · {{ dateTime(file.created_at) }}</small>
                        <small>v{{ file.version_number }} · {{ file.is_current ? 'current' : 'replaced' }} · {{ bytes(file.file_size_bytes) }}</small>
                        <StatusPill :status="file.status" />
                        <div class="action-cell">
                            <button type="button" class="secondary-btn" @click="download(file)">Download</button>
                            <button v-if="selectedFolder.type !== 'request' && file.source_type === 'personal'" type="button" class="ghost-btn" @click="deleteFile(file)">Hapus</button>
                        </div>
                    </article>
                </div>
            </AsyncState>
        </section>
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
const error = ref('');
const categories = ref([]);
const files = ref([]);
const selectedFolderKey = ref('personal:root');
const selectedCategoryId = ref('');
const fileInput = ref(null);
const categoryForm = reactive({ name: '', description: '' });
const uploadForm = reactive({ file: null, display_filename: '' });
const rootFolder = { key: 'personal:root', type: 'personal_root', label: 'Arsip Pribadi', description: 'File personal tanpa kategori.' };

const personalCategories = computed(() => categories.value.filter((item) => item.category_type === 'personal'));
const personalRootFiles = computed(() => files.value.filter((file) => file.source_type === 'personal' && !file.category_id));
const requestFolders = computed(() => {
    const map = new Map();
    files.value
        .filter((file) => file.archive_folder?.type === 'request')
        .forEach((file) => {
            const folder = file.archive_folder;
            const key = folder.key || `request:${folder.request_id}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    type: 'request',
                    label: folder.label || `Request #${folder.request_id}`,
                    description: 'File yang dikirim untuk request kampus.',
                    files: [],
                });
            }
            map.get(key).files.push(file);
        });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
});
const selectedFolder = computed(() => {
    if (selectedFolderKey.value === rootFolder.key) return rootFolder;
    const category = personalCategories.value.find((item) => `category:${item.category_id}` === selectedFolderKey.value);
    if (category) return categoryFolder(category);
    return requestFolders.value.find((folder) => folder.key === selectedFolderKey.value) || rootFolder;
});
const visibleFiles = computed(() => {
    const folder = selectedFolder.value;
    if (folder.type === 'personal_root') return personalRootFiles.value;
    if (folder.type === 'category') return files.value.filter((file) => Number(file.category_id) === Number(folder.category_id));
    if (folder.type === 'request') return folder.files;
    return [];
});

function categoryFolder(category) {
    return {
        key: `category:${category.category_id}`,
        type: 'category',
        category_id: category.category_id,
        label: category.name,
        description: category.description || 'Kategori personal.',
    };
}
function selectFolder(folder) { selectedFolderKey.value = folder.key; }
function onFileChange(event) { uploadForm.file = event.target.files?.[0] || null; }

async function load() {
    loading.value = true; error.value = '';
    try {
        const [categoryData, fileData] = await Promise.all([arsipApi.categories(), arsipApi.files({ with_deleted: false })]);
        categories.value = categoryData.categories || [];
        files.value = fileData.files || [];
        const keys = new Set([rootFolder.key, ...personalCategories.value.map((category) => `category:${category.category_id}`), ...requestFolders.value.map((folder) => folder.key)]);
        if (!keys.has(selectedFolderKey.value)) selectedFolderKey.value = rootFolder.key;
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
