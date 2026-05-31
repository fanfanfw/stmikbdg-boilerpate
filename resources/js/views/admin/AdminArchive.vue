<template>
    <section class="page-stack">
        <PageHeader
            eyebrow="Arsip pengguna"
            title="File explorer mahasiswa dan dosen"
            description="Pilih pengguna, buka folder/kategori, lalu kelola file arsip seperti explorer."
        >
            <template #actions><button type="button" class="secondary-btn" :disabled="peopleLoading || archiveLoading || jobLoading" @click="refreshAll">Refresh</button></template>
        </PageHeader>

        <section class="archive-explorer-grid">
            <aside class="panel-block explorer-sidebar">
                <div class="section-heading compact-heading">
                    <div><h2>Pengguna</h2><p>Cari mahasiswa atau dosen.</p></div>
                </div>
                <form class="stack-form" @submit.prevent="loadPeople(1)">
                    <div class="segmented-control" aria-label="Role pengguna">
                        <button type="button" :class="peopleFilters.role === 'mahasiswa' ? 'active' : ''" @click="setRole('mahasiswa')">Mahasiswa</button>
                        <button type="button" :class="peopleFilters.role === 'dosen' ? 'active' : ''" @click="setRole('dosen')">Dosen</button>
                    </div>
                    <input v-model="peopleFilters.search" placeholder="Cari nama / NIM / kode dosen" aria-label="Cari pengguna" />
                    <div class="mini-stack two-inputs">
                        <input v-if="peopleFilters.role === 'mahasiswa'" v-model="peopleFilters.angkatan" inputmode="numeric" placeholder="Angkatan" />
                        <input v-model="peopleFilters.status" placeholder="Status" />
                    </div>
                    <button type="submit" :disabled="peopleLoading">{{ peopleLoading ? 'Mencari...' : 'Cari pengguna' }}</button>
                </form>

                <AsyncState :loading="peopleLoading" :error="peopleError" :empty="people.length === 0" empty-title="Belum ada pengguna" empty-text="Ubah filter untuk mencari target arsip." @retry="loadPeople(peopleMeta.current_page || 1)">
                    <div class="data-list explorer-person-list">
                        <button v-for="person in people" :key="`${person.role}-${person.identifier}`" type="button" :class="['select-row person-card', selectedPerson?.identifier === person.identifier && selectedPerson?.role === person.role ? 'active' : '']" @click="selectPerson(person)">
                            <strong>{{ person.identifier }}</strong>
                            <span>{{ person.name || '-' }}</span>
                            <small>{{ person.role }} · {{ person.angkatan || person.status || '-' }}</small>
                        </button>
                    </div>
                    <div class="pagination-row">
                        <button type="button" class="secondary-btn" :disabled="peopleLoading || peopleMeta.current_page <= 1" @click="loadPeople(peopleMeta.current_page - 1)">Sebelumnya</button>
                        <span>{{ peopleMeta.current_page || 1 }} / {{ peopleMeta.last_page || 1 }}</span>
                        <button type="button" class="secondary-btn" :disabled="peopleLoading || peopleMeta.current_page >= peopleMeta.last_page" @click="loadPeople(peopleMeta.current_page + 1)">Berikutnya</button>
                    </div>
                </AsyncState>
            </aside>

            <section class="panel-block explorer-main">
                <div v-if="selectedPerson" class="section-heading">
                    <div>
                        <p class="eyebrow">{{ selectedPerson.role }}</p>
                        <h2>{{ selectedPerson.name || selectedPerson.identifier }}</h2>
                        <p>{{ selectedPerson.identifier }} · {{ selectedPerson.angkatan || selectedPerson.status || '-' }}</p>
                    </div>
                    <div class="page-actions">
                        <button type="button" class="secondary-btn" :disabled="exportLoading || selectedFileIds.length === 0" @click="exportSelected">{{ exportLoading ? 'Membuat export...' : 'Export selected' }}</button>
                        <button type="button" :disabled="exportLoading || visibleFiles.length === 0" @click="exportCurrentFolder">{{ exportLoading ? 'Membuat export...' : 'Export folder' }}</button>
                    </div>
                </div>
                <div v-else class="state-card muted-card explorer-empty-state">
                    <strong>Pilih pengguna</strong>
                    <p>File dan folder akan tampil setelah admin memilih mahasiswa atau dosen di panel kiri.</p>
                </div>

                <template v-if="selectedPerson">
                    <nav class="breadcrumb-row" aria-label="Breadcrumb arsip">
                        <button type="button" class="text-link" @click="selectCategory(null)">{{ selectedPerson.identifier }}</button>
                        <span>/</span>
                        <button v-if="selectedFolder?.groupKey && selectedFolder.groupKey !== selectedFolder.key" type="button" class="text-link" @click="selectFolder({ key: selectedFolder.groupKey, label: selectedFolder.groupLabel, type: 'group' })">{{ selectedFolder.groupLabel }}</button>
                        <span v-if="selectedFolder?.groupKey && selectedFolder.groupKey !== selectedFolder.key">/</span>
                        <span>{{ currentFolderName }}</span>
                    </nav>

                    <form class="filter-bar explorer-filter" @submit.prevent="loadArchive">
                        <input v-model="archiveFilters.search" placeholder="Cari nama file" />
                        <input v-model="archiveFilters.extension" placeholder="Ekstensi" />
                        <select v-model="archiveFilters.status">
                            <option value="current">Current aktif</option>
                            <option value="all">Semua termasuk terhapus</option>
                            <option value="deleted">Hanya terhapus</option>
                        </select>
                        <button type="submit" class="secondary-btn" :disabled="archiveLoading">{{ archiveLoading ? 'Memfilter...' : 'Filter file' }}</button>
                    </form>

                    <AsyncState :loading="archiveLoading" :error="archiveError" :empty="folders.length === 0 && visibleFiles.length === 0" empty-title="Folder kosong" empty-text="Belum ada kategori atau file pada folder ini." @retry="loadArchive">
                        <section class="explorer-section">
                            <div class="section-heading compact-heading"><h2>Folder</h2></div>
                            <div v-if="folders.length" class="folder-grid">
                                <button v-for="folder in folders" :key="folder.key" type="button" class="folder-card" @click="selectFolder(folder)">
                                    <span class="folder-icon">📁</span>
                                    <strong>{{ folder.label }}</strong>
                                    <small>{{ folder.groupLabel && folder.groupLabel !== folder.label ? `${folder.groupLabel} · ` : '' }}{{ folder.file_count || 0 }} file</small>
                                </button>
                            </div>
                            <p v-else class="muted-card inline-empty">Belum ada folder pada level ini.</p>
                        </section>

                        <section class="explorer-section">
                            <div class="section-heading compact-heading">
                                <div><h2>File</h2><p>{{ visibleFiles.length }} file dalam folder ini.</p></div>
                                <div class="page-actions">
                                    <button type="button" class="secondary-btn" :disabled="archiveLoading || visibleFiles.length === 0" @click="selectAllVisibleFiles">Pilih semua</button>
                                    <button type="button" class="ghost-btn" :disabled="selectedFileIds.length === 0" @click="selectedFileIds = []">Kosongkan</button>
                                </div>
                            </div>
                            <div v-if="visibleFiles.length" class="file-grid">
                                <article v-for="file in visibleFiles" :key="file.file_id" :class="['file-card', selectedFileIds.includes(file.file_id) ? 'selected-row' : '']">
                                    <label class="check file-select"><input v-model="selectedFileIds" type="checkbox" :value="file.file_id" :aria-label="`Pilih ${file.display_filename}`" /> Pilih</label>
                                    <div class="file-icon">{{ fileIcon(file.extension) }}</div>
                                    <strong>{{ file.display_filename }}</strong>
                                    <small>.{{ file.extension || '-' }} · {{ bytes(file.file_size_bytes) }}</small>
                                    <small>v{{ file.version_number }} · {{ file.is_current ? 'current' : 'replaced' }} · {{ dateTime(file.created_at) }}</small>
                                    <StatusPill :status="file.status" />
                                    <div class="action-cell">
                                        <button type="button" class="secondary-btn" :disabled="file.deleted_at || file.status === 'deleted'" @click="preview(file)">Preview</button>
                                        <button type="button" class="secondary-btn" :disabled="file.deleted_at || file.status === 'deleted'" @click="download(file)">Download</button>
                                        <button v-if="file.deleted_at || file.status === 'deleted'" type="button" class="ghost-btn" :disabled="actionLoading" @click="restore(file)">{{ actionLoading ? 'Memproses...' : 'Restore' }}</button>
                                    </div>
                                </article>
                            </div>
                            <p v-else class="muted-card inline-empty">Tidak ada file pada folder ini.</p>
                        </section>
                    </AsyncState>
                </template>
            </section>
        </section>

        <section class="panel-block">
            <div class="section-heading"><h2>Export ZIP</h2><p>Job export dari explorer. Jalankan worker queue agar status berubah dari queued ke completed.</p></div>
            <AsyncState :loading="jobLoading" :error="jobError" :empty="jobs.length === 0" empty-title="Belum ada job export" empty-text="Export folder atau file terpilih akan tampil di sini." @retry="loadJobs">
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Job</th><th>Status</th><th>Ukuran</th><th>Aksi</th></tr></thead>
                        <tbody>
                            <tr v-for="job in jobs" :key="job.export_job_id">
                                <td>#{{ job.export_job_id }}<small>{{ dateTime(job.created_at) }}</small></td>
                                <td><StatusPill :status="job.status" /><small v-if="job.error_message">{{ job.error_message }}</small></td>
                                <td>{{ bytes(job.file_size_bytes) }}</td>
                                <td><button type="button" class="secondary-btn" :disabled="job.status !== 'completed'" @click="downloadJob(job)">Download ZIP</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </AsyncState>
        </section>
    </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { confirmAction } from '../../services/dialogs';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { bytes, dateTime } from '../../utils/format';

const app = useAppStore();
const peopleLoading = ref(false);
const archiveLoading = ref(false);
const jobLoading = ref(false);
const exportLoading = ref(false);
const actionLoading = ref(false);
const peopleError = ref('');
const archiveError = ref('');
const jobError = ref('');
const people = ref([]);
const categories = ref([]);
const files = ref([]);
const jobs = ref([]);
const selectedPerson = ref(null);
const selectedFolder = ref(null);
const selectedFileIds = ref([]);
const peopleMeta = ref({ current_page: 1, last_page: 1, total: 0 });
const peopleFilters = reactive({ role: 'mahasiswa', search: '', angkatan: '', status: '', has_account: '1', per_page: 20 });
const archiveFilters = reactive({ search: '', extension: '', status: 'current' });

const currentFolderName = computed(() => selectedFolder.value?.label || 'Root');
const requestFolders = computed(() => {
    const map = new Map();
    files.value
        .filter((file) => file.archive_folder?.type === 'request')
        .forEach((file) => {
            const folder = file.archive_folder;
            if (!map.has(folder.key)) {
                map.set(folder.key, {
                    key: folder.key,
                    type: 'request',
                    label: folder.label || `Request #${folder.request_id}`,
                    groupKey: 'group:requests',
                    groupLabel: 'Permintaan Berkas',
                    file_count: 0,
                });
            }
            map.get(folder.key).file_count += 1;
        });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
});
const personalFolders = computed(() => categories.value.map((category) => ({
    key: `category:${category.category_id}`,
    type: 'category',
    label: category.name,
    groupKey: 'group:personal',
    groupLabel: 'Arsip Pribadi',
    category_id: category.category_id,
    parent_category_id: category.parent_category_id,
    file_count: files.value.filter((file) => Number(file.category_id) === Number(category.category_id)).length,
})));
const folders = computed(() => {
    const folder = selectedFolder.value;
    if (!folder) {
        return [
            { key: 'group:personal', type: 'group', label: 'Arsip Pribadi', groupKey: 'group:personal', groupLabel: 'Arsip Pribadi', file_count: personalRootFiles.value.length + personalFolders.value.reduce((total, item) => total + item.file_count, 0) },
            { key: 'group:requests', type: 'group', label: 'Permintaan Berkas', groupKey: 'group:requests', groupLabel: 'Permintaan Berkas', file_count: requestFolders.value.reduce((total, item) => total + item.file_count, 0) },
        ].filter((item) => item.file_count > 0 || item.key === 'group:personal');
    }
    if (folder.key === 'group:requests') return requestFolders.value;
    if (folder.key === 'group:personal') return personalFolders.value.filter((category) => !category.parent_category_id);
    if (folder.type === 'category') return personalFolders.value.filter((category) => Number(category.parent_category_id) === Number(folder.category_id));
    return [];
});
const personalRootFiles = computed(() => files.value.filter((file) => !file.category_id && file.archive_folder?.type !== 'request'));
const folderFiles = computed(() => files.value.filter((file) => {
    const folder = selectedFolder.value;
    if (!folder) return false;
    if (folder.key === 'group:personal') return !file.category_id && file.archive_folder?.type !== 'request';
    if (folder.key === 'group:requests') return false;
    if (folder.type === 'request') return file.archive_folder?.key === folder.key;
    if (folder.type === 'category') return Number(file.category_id) === Number(folder.category_id);
    return false;
}));
const visibleFiles = computed(() => folderFiles.value.filter((file) => {
    if (archiveFilters.search && !String(file.display_filename || '').toLowerCase().includes(archiveFilters.search.toLowerCase())) return false;
    if (archiveFilters.extension && String(file.extension || '').toLowerCase() !== archiveFilters.extension.toLowerCase().replace(/^\./, '')) return false;
    if (archiveFilters.status === 'current' && !file.is_current) return false;
    if (archiveFilters.status === 'deleted' && !(file.deleted_at || file.status === 'deleted')) return false;
    return true;
}));

function targetQuery(page = 1) {
    return {
        role: peopleFilters.role,
        search: peopleFilters.search,
        angkatan: peopleFilters.role === 'mahasiswa' ? peopleFilters.angkatan : '',
        status: peopleFilters.status,
        has_account: peopleFilters.has_account,
        per_page: peopleFilters.per_page,
        page,
    };
}

function setRole(role) {
    peopleFilters.role = role;
    peopleFilters.angkatan = '';
    selectedPerson.value = null;
    selectedFolder.value = null;
    categories.value = [];
    files.value = [];
    selectedFileIds.value = [];
    loadPeople(1);
}

async function loadPeople(page = 1) {
    peopleLoading.value = true;
    peopleError.value = '';
    try {
        const data = await arsipApi.adminTargets(targetQuery(page));
        people.value = data.targets || [];
        peopleMeta.value = data.meta || { current_page: 1, last_page: 1, total: 0 };
    } catch (err) {
        peopleError.value = toErrorMessage(err);
    } finally {
        peopleLoading.value = false;
    }
}

async function selectPerson(person) {
    selectedPerson.value = person;
    selectedFolder.value = null;
    selectedFileIds.value = [];
    await loadArchive();
}

function selectFolder(folder) {
    selectedFolder.value = folder;
    selectedFileIds.value = [];
}

function selectCategory(category) {
    selectFolder(category ? {
        key: `category:${category.category_id}`,
        type: 'category',
        label: category.name,
        groupKey: 'group:personal',
        groupLabel: 'Arsip Pribadi',
        category_id: category.category_id,
        parent_category_id: category.parent_category_id,
    } : null);
}

async function loadArchive() {
    if (!selectedPerson.value) return;
    archiveLoading.value = true;
    archiveError.value = '';
    try {
        const baseFilters = {
            owner_role: selectedPerson.value.role,
            owner_identifier: selectedPerson.value.identifier,
            with_deleted: archiveFilters.status !== 'current',
        };
        const [categoryData, fileData] = await Promise.all([
            selectedPerson.value.user_id
                ? arsipApi.categories({ category_type: 'personal', owner_role: selectedPerson.value.role, owner_user_id: selectedPerson.value.user_id, with_deleted: true })
                : Promise.resolve({ categories: [] }),
            arsipApi.files(baseFilters),
        ]);
        categories.value = categoryData.categories || [];
        files.value = fileData.files || [];
        if (!selectedFolder.value) {
            selectedFolder.value = { key: 'group:personal', type: 'group', label: 'Arsip Pribadi', groupKey: 'group:personal', groupLabel: 'Arsip Pribadi' };
        }
    } catch (err) {
        archiveError.value = toErrorMessage(err);
    } finally {
        archiveLoading.value = false;
    }
}

async function loadJobs() {
    jobLoading.value = true;
    jobError.value = '';
    try {
        const data = await arsipApi.exportJobs({ export_type: 'archive_browser' });
        jobs.value = data.export_jobs || [];
    } catch (err) {
        jobError.value = toErrorMessage(err);
    } finally {
        jobLoading.value = false;
    }
}

async function refreshAll() {
    await Promise.all([loadPeople(peopleMeta.value.current_page || 1), selectedPerson.value ? loadArchive() : Promise.resolve(), loadJobs()]);
}

function childFileCount(categoryId) {
    return files.value.filter((file) => Number(file.category_id) === Number(categoryId)).length;
}

function selectAllVisibleFiles() {
    const merged = new Set(selectedFileIds.value);
    visibleFiles.value.forEach((file) => merged.add(file.file_id));
    selectedFileIds.value = Array.from(merged);
}

function exportFilters(extra = {}) {
    return {
        ...extra,
        owner_role: selectedPerson.value?.role || null,
        owner_identifier: selectedPerson.value?.identifier || null,
        extension: archiveFilters.extension || null,
        with_deleted: archiveFilters.status !== 'current',
    };
}

async function createArchiveExport(filterPayload) {
    if (!selectedPerson.value || exportLoading.value) return;
    exportLoading.value = true;
    try {
        await arsipApi.createExportJob({ export_type: 'archive_browser', filters: filterPayload });
        app.notify('success', 'Export ZIP dibuat. Tunggu worker memproses job.');
        selectedFileIds.value = [];
        await loadJobs();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        exportLoading.value = false;
    }
}

async function exportSelected() {
    if (selectedFileIds.value.length === 0) return;
    await createArchiveExport(exportFilters({ file_ids: selectedFileIds.value }));
}

async function exportCurrentFolder() {
    const ids = visibleFiles.value.map((file) => file.file_id);
    if (ids.length === 0) {
        app.notify('error', 'Folder ini belum memiliki file untuk diexport.');
        return;
    }
    await createArchiveExport(exportFilters({ file_ids: ids }));
}

async function downloadJob(job) {
    await arsipApi.downloadExportJob(job);
}

async function download(file) {
    await arsipApi.downloadFile(file);
}

async function preview(file) {
    await download(file);
}

async function restore(file) {
    const confirmed = await confirmAction({
        title: 'Restore file?',
        text: file.display_filename,
        confirmText: 'Restore',
    });
    if (!confirmed) return;

    actionLoading.value = true;
    try {
        await arsipApi.restoreFile(file.file_id);
        app.notify('success', 'File berhasil direstore.');
        await loadArchive();
    } catch (err) {
        app.notify('error', toErrorMessage(err));
    } finally {
        actionLoading.value = false;
    }
}

function fileIcon(extension) {
    const ext = String(extension || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📕';
    if (['doc', 'docx'].includes(ext)) return '📄';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    return '📎';
}

watch(() => archiveFilters.status, () => {
    selectedFileIds.value = [];
    if (selectedPerson.value) loadArchive();
});

onMounted(refreshAll);
</script>
