<template>
    <section class="panel-block target-picker">
        <div class="section-heading target-heading">
            <div>
                <h2>Target penerima</h2>
                <p>Pilih kelompok besar dari filter, atau centang penerima tertentu jika hanya sebagian yang perlu diproses.</p>
            </div>
            <div class="segmented-control" aria-label="Role target">
                <button type="button" :class="role === 'mahasiswa' ? 'active' : ''" @click="setRole('mahasiswa')">Mahasiswa</button>
                <button type="button" :class="role === 'dosen' ? 'active' : ''" @click="setRole('dosen')">Dosen</button>
            </div>
        </div>

        <div class="target-mode-grid">
            <button type="button" :class="['choice-card', mode === 'filter' ? 'active' : '']" @click="setMode('filter')">
                <span>Semua hasil filter</span>
                <strong>{{ filterSummary }}</strong>
                <small>Cocok untuk semua mahasiswa angkatan tertentu atau semua dosen aktif.</small>
            </button>
            <button type="button" :class="['choice-card', mode === 'specific' ? 'active' : '']" @click="setMode('specific')">
                <span>Pilih manual</span>
                <strong>{{ selectedIdentifiers.length }} dipilih</strong>
                <small>Cocok ketika admin hanya ingin mengirim ke sebagian penerima.</small>
            </button>
        </div>

        <form class="target-filter-bar" @submit.prevent="loadTargets(1)">
            <label class="wide-search">Cari target
                <input v-model="filters.search" :placeholder="role === 'mahasiswa' ? 'Nama atau NIM' : 'Nama atau kode dosen'" />
            </label>
            <label v-if="role === 'mahasiswa'">Angkatan
                <input v-model="filters.angkatan" inputmode="numeric" placeholder="2022 atau 2021,2022" />
            </label>
            <label>Status
                <input v-model="filters.status" placeholder="A" />
            </label>
            <label>Akun login
                <select v-model="filters.has_account">
                    <option value="1">Punya akun</option>
                    <option value="">Semua data</option>
                    <option value="0">Belum punya akun</option>
                </select>
            </label>
            <button type="submit">Terapkan filter</button>
        </form>

        <div class="target-summary-strip">
            <div>
                <span>Mode aktif</span>
                <strong>{{ mode === 'filter' ? 'Semua hasil filter' : 'Pilih manual' }}</strong>
            </div>
            <div>
                <span>Data ditemukan</span>
                <strong>{{ targetMeta.total || 0 }}</strong>
            </div>
            <div>
                <span>Target tersimpan</span>
                <strong>{{ mode === 'filter' ? filterSummary : `${selectedIdentifiers.length} penerima` }}</strong>
            </div>
        </div>

        <AsyncState :loading="targetLoading" :error="targetError" :empty="targets.length === 0" empty-title="Belum ada target" empty-text="Ubah filter untuk mencari mahasiswa atau dosen." @retry="loadTargets(filters.page)">
            <div class="bulk-actions">
                <strong>{{ mode === 'filter' ? 'Filter ini akan disimpan sebagai target' : `${selectedIdentifiers.length} target dipilih` }}</strong>
                <button type="button" class="secondary-btn" @click="selectPageTargets">Pilih semua halaman ini</button>
                <button type="button" class="ghost-btn" @click="clearTargets">Kosongkan pilihan</button>
            </div>

            <div class="table-wrap target-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Pilih</th>
                            <th>Identifier</th>
                            <th>Nama</th>
                            <th v-if="role === 'mahasiswa'">Angkatan</th>
                            <th>Status</th>
                            <th>Akun</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="target in targets" :key="target.identifier" :class="selectedIdentifiers.includes(target.identifier) ? 'selected-row' : ''">
                            <td><input type="checkbox" :value="target.identifier" :disabled="!target.has_account" v-model="selectedIdentifiers" @change="setMode('specific')" /></td>
                            <td><strong>{{ target.identifier }}</strong></td>
                            <td>{{ target.name || '-' }}</td>
                            <td v-if="role === 'mahasiswa'">{{ target.angkatan || '-' }}</td>
                            <td>{{ target.status || '-' }}</td>
                            <td><StatusPill :status="target.has_account ? 'approved' : 'rejected'" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="pagination-row">
                <button type="button" class="secondary-btn" :disabled="targetMeta.current_page <= 1" @click="changeTargetPage(targetMeta.current_page - 1)">Sebelumnya</button>
                <span>Halaman {{ targetMeta.current_page || 1 }} dari {{ targetMeta.last_page || 1 }} · {{ targetMeta.total || 0 }} data</span>
                <button type="button" class="secondary-btn" :disabled="targetMeta.current_page >= targetMeta.last_page" @click="changeTargetPage(targetMeta.current_page + 1)">Berikutnya</button>
            </div>
        </AsyncState>
    </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AsyncState from './AsyncState.vue';
import StatusPill from './StatusPill.vue';
import { arsipApi } from '../services/arsipApi';
import { toErrorMessage } from '../services/http';

const emit = defineEmits(['change']);

const role = ref('mahasiswa');
const mode = ref('filter');
const targets = ref([]);
const selectedIdentifiers = ref([]);
const targetLoading = ref(false);
const targetError = ref('');
const targetMeta = ref({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
const filters = reactive({ search: '', angkatan: '', status: 'A', has_account: '1', page: 1 });

const filterSummary = computed(() => {
    const parts = [];
    if (role.value === 'mahasiswa' && csv(filters.angkatan).length) parts.push(`angkatan ${csv(filters.angkatan).join(', ')}`);
    if (csv(filters.status).length) parts.push(`status ${csv(filters.status).join(', ')}`);
    if (filters.has_account === '1') parts.push('punya akun');
    if (filters.has_account === '0') parts.push('belum punya akun');
    return parts.length ? parts.join(' · ') : `semua ${roleLabel.value}`;
});

const roleLabel = computed(() => (role.value === 'mahasiswa' ? 'mahasiswa' : 'dosen'));

const payload = computed(() => ({
    target_role: role.value,
    scope_type: mode.value === 'filter' ? 'filter' : 'specific',
    target_filters: mode.value === 'filter' ? filterPayload() : {},
    target_identifiers: mode.value === 'specific' ? selectedIdentifiers.value : [],
}));

const canSubmit = computed(() => mode.value === 'filter' ? filters.has_account !== '0' : selectedIdentifiers.value.length > 0);

function csv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function filterPayload() {
    const payload = {};
    const angkatan = csv(filters.angkatan);
    const status = csv(filters.status).map((item) => item.toUpperCase());

    if (role.value === 'mahasiswa' && angkatan.length) payload.angkatan = angkatan;
    if (status.length) payload.student_status = status;
    if (filters.has_account !== '') payload.has_account = filters.has_account === '1';

    return payload;
}

function targetQuery(page = filters.page) {
    return {
        role: role.value,
        search: filters.search,
        angkatan: role.value === 'mahasiswa' ? csv(filters.angkatan)[0] || '' : '',
        status: csv(filters.status)[0] || '',
        has_account: filters.has_account,
        per_page: 25,
        page,
    };
}

function notifyChange() {
    emit('change', {
        payload: payload.value,
        role: role.value,
        mode: mode.value,
        selectedCount: selectedIdentifiers.value.length,
        canSubmit: canSubmit.value,
        summary: mode.value === 'filter' ? filterSummary.value : `${selectedIdentifiers.value.length} penerima`,
    });
}

function setRole(nextRole) {
    if (role.value === nextRole) return;
    role.value = nextRole;
    selectedIdentifiers.value = [];
    filters.angkatan = '';
    filters.page = 1;
    loadTargets(1);
}

function setMode(nextMode) {
    mode.value = nextMode;
}

async function loadTargets(page = 1) {
    targetLoading.value = true;
    targetError.value = '';
    filters.page = page;
    try {
        const data = await arsipApi.adminTargets(targetQuery(page));
        targets.value = data.targets || [];
        targetMeta.value = data.meta || { current_page: 1, last_page: 1, per_page: 25, total: 0 };
    } catch (err) {
        targetError.value = toErrorMessage(err);
    } finally {
        targetLoading.value = false;
    }
}

function selectPageTargets() {
    mode.value = 'specific';
    const merged = new Set(selectedIdentifiers.value);
    targets.value.filter((target) => target.has_account).forEach((target) => merged.add(target.identifier));
    selectedIdentifiers.value = Array.from(merged);
}

function clearTargets() {
    selectedIdentifiers.value = [];
}

function changeTargetPage(page) {
    loadTargets(page);
}

watch([role, mode, selectedIdentifiers, () => filters.angkatan, () => filters.status, () => filters.has_account], notifyChange, { deep: true });
onMounted(() => { loadTargets(); notifyChange(); });
</script>
