<template>
    <div class="arsip-shell">
        <header class="arsip-header">
            <div>
                <p class="eyebrow">Arsip Digital</p>
                <h1>Smoke Integrasi</h1>
                <p class="lede">Validasi proxy Laravel, session role, upload multipart, dan download file.</p>
            </div>
            <div class="role-badge">
                <span>Role aktif</span>
                <strong>{{ summary?.role || 'memuat' }}</strong>
            </div>
        </header>

        <section class="status-grid" aria-label="Ringkasan arsip">
            <div class="metric">
                <span>Total file</span>
                <strong>{{ summary?.total_files ?? '-' }}</strong>
            </div>
            <div class="metric">
                <span>Request pending</span>
                <strong>{{ summary?.pending_requests ?? '-' }}</strong>
            </div>
            <div class="metric">
                <span>Request ditolak</span>
                <strong>{{ summary?.rejected_requests ?? '-' }}</strong>
            </div>
            <div class="metric">
                <span>Distribusi</span>
                <strong>{{ summary?.distribution_files ?? '-' }}</strong>
            </div>
        </section>

        <div v-if="message" :class="['notice', message.type]">{{ message.text }}</div>

        <main class="workspace">
            <section class="panel">
                <div class="panel-head">
                    <div>
                        <p class="eyebrow">Kategori</p>
                        <h2>Buat folder personal</h2>
                    </div>
                    <button type="button" class="ghost-btn" @click="loadAll" :disabled="loading">Refresh</button>
                </div>

                <form class="stack-form" @submit.prevent="createCategory">
                    <label>
                        Nama kategori
                        <input v-model="categoryForm.name" type="text" required placeholder="Contoh: Dokumen pribadi" />
                    </label>
                    <label>
                        Deskripsi
                        <textarea v-model="categoryForm.description" rows="3" placeholder="Opsional"></textarea>
                    </label>
                    <button type="submit" :disabled="loading || !categoryForm.name">Buat kategori</button>
                </form>

                <div class="list-block">
                    <h3>Daftar kategori</h3>
                    <p v-if="categories.length === 0" class="empty">Belum ada kategori yang diterima dari API.</p>
                    <button
                        v-for="category in categories"
                        :key="category.category_id"
                        type="button"
                        :class="['row-button', selectedCategoryId === category.category_id ? 'selected' : '']"
                        @click="selectedCategoryId = category.category_id"
                    >
                        <span>{{ category.name }}</span>
                        <small>{{ category.category_type }}</small>
                    </button>
                </div>
            </section>

            <section class="panel">
                <div class="panel-head">
                    <div>
                        <p class="eyebrow">File</p>
                        <h2>Upload dan download</h2>
                    </div>
                </div>

                <form class="stack-form" @submit.prevent="uploadFile">
                    <label>
                        Kategori
                        <select v-model="selectedCategoryId">
                            <option :value="null">Tanpa kategori</option>
                            <option v-for="category in personalCategories" :key="category.category_id" :value="category.category_id">
                                {{ category.name }}
                            </option>
                        </select>
                    </label>
                    <label>
                        File
                        <input ref="fileInput" type="file" required @change="onFileChange" />
                    </label>
                    <label>
                        Nama tampil
                        <input v-model="uploadForm.display_filename" type="text" placeholder="Opsional, default nama file" />
                    </label>
                    <button type="submit" :disabled="loading || !uploadForm.file">Upload file</button>
                </form>

                <div class="list-block">
                    <h3>Daftar file</h3>
                    <p v-if="files.length === 0" class="empty">Belum ada file yang diterima dari API.</p>
                    <div v-for="file in files" :key="file.file_id" class="file-row">
                        <div>
                            <strong>{{ file.display_filename }}</strong>
                            <small>v{{ file.version_number }} · {{ file.extension }} · {{ file.is_current ? 'current' : 'replaced' }}</small>
                        </div>
                        <button type="button" class="ghost-btn" @click="downloadFile(file)">Download</button>
                    </div>
                </div>
            </section>
        </main>
    </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import axios from 'axios';

const proxy = '/arsip-digital/proxy';
const loading = ref(false);
const summary = ref(null);
const categories = ref([]);
const files = ref([]);
const selectedCategoryId = ref(null);
const selectedFile = ref(null);
const fileInput = ref(null);
const message = ref(null);

const categoryForm = reactive({
    name: '',
    description: '',
});

const uploadForm = reactive({
    file: null,
    display_filename: '',
});

const personalCategories = computed(() => categories.value.filter((category) => category.category_type === 'personal'));

function setMessage(type, text) {
    message.value = { type, text };
}

async function request(action) {
    loading.value = true;
    message.value = null;

    try {
        return await action();
    } catch (error) {
        const text = error.response?.data?.message || error.message || 'Request gagal.';
        setMessage('error', text);
        throw error;
    } finally {
        loading.value = false;
    }
}

async function loadSummary() {
    const response = await axios.get(`${proxy}/me/archive-summary`);
    summary.value = response.data.data;
}

async function loadCategories() {
    const response = await axios.get(`${proxy}/categories`);
    categories.value = response.data.data?.categories || [];
}

async function loadFiles() {
    const response = await axios.get(`${proxy}/files`);
    files.value = response.data.data?.files || [];
}

async function loadAll() {
    await request(async () => {
        await Promise.all([loadSummary(), loadCategories(), loadFiles()]);
    });
}

async function createCategory() {
    await request(async () => {
        await axios.post(`${proxy}/categories`, {
            category_type: 'personal',
            name: categoryForm.name,
            description: categoryForm.description || null,
        });
        categoryForm.name = '';
        categoryForm.description = '';
        setMessage('success', 'Kategori berhasil dibuat.');
        await loadCategories();
    });
}

function onFileChange(event) {
    uploadForm.file = event.target.files?.[0] || null;
    selectedFile.value = uploadForm.file;
}

async function uploadFile() {
    if (!uploadForm.file) return;

    const formData = new FormData();
    formData.append('file', uploadForm.file);

    if (selectedCategoryId.value) {
        formData.append('category_id', selectedCategoryId.value);
    }

    if (uploadForm.display_filename) {
        formData.append('display_filename', uploadForm.display_filename);
    }

    await request(async () => {
        await axios.post(`${proxy}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadForm.file = null;
        uploadForm.display_filename = '';
        selectedFile.value = null;
        if (fileInput.value) {
            fileInput.value.value = '';
        }
        setMessage('success', 'File berhasil diupload.');
        await Promise.all([loadSummary(), loadFiles()]);
    });
}

async function downloadFile(file) {
    await request(async () => {
        const response = await axios.get(`${proxy}/files/${file.file_id}/download`, {
            responseType: 'blob',
        });
        const url = URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.display_filename || `arsip-${file.file_id}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setMessage('success', 'Download dimulai.');
    });
}

onMounted(loadAll);
</script>
