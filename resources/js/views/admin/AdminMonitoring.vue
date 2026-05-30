<template>
    <section class="page-stack">
        <PageHeader eyebrow="Monitoring assignment" title="Progress dan verifikasi" description="Approve, reject, download, atau upload file atas nama target request.">
            <template #actions><button type="button" class="secondary-btn" @click="loadRequests">Refresh</button></template>
        </PageHeader>

        <section class="panel-block">
            <form class="filter-bar" @submit.prevent="loadAssignments">
                <select v-model="selectedRequestId" required>
                    <option value="">Pilih request</option>
                    <option v-for="request in requests" :key="request.request_id" :value="request.request_id">{{ request.title }}</option>
                </select>
                <select v-model="filters.status"><option value="">Semua status</option><option v-for="status in assignmentStatuses" :key="status" :value="status">{{ statusLabel(status) }}</option></select>
                <input v-model="filters.search" placeholder="Cari NIM/nama" />
                <button type="submit">Muat assignment</button>
            </form>
        </section>

        <AsyncState :loading="loading" :error="error" :empty="assignments.length === 0" empty-title="Pilih request" empty-text="Assignment akan tampil setelah request dipilih." @retry="loadAssignments">
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Target</th><th>Status</th><th>Submitted</th><th>File</th><th>Aksi</th></tr></thead>
                    <tbody>
                        <tr v-for="assignment in assignments" :key="assignment.assignment_id">
                            <td><strong>{{ assignment.identifier }}</strong><small>{{ assignment.name_snapshot || '-' }} · {{ assignment.angkatan_snapshot || assignment.prodi_snapshot || '-' }}</small></td>
                            <td><StatusPill :status="assignment.status" /><small v-if="assignment.is_late">Terlambat</small></td>
                            <td>{{ dateTime(assignment.submitted_at) }}</td>
                            <td>
                                <div class="mini-stack">
                                    <button v-for="file in currentFiles(assignment)" :key="file.request_file_id" type="button" class="ghost-btn" @click="downloadRequestFile(file)">Download {{ file.file?.display_filename || file.request_file_id }}</button>
                                    <small v-if="currentFiles(assignment).length === 0">Belum ada file</small>
                                </div>
                            </td>
                            <td class="action-cell">
                                <button type="button" class="secondary-btn" :disabled="assignment.status !== 'waiting_verification'" @click="approve(assignment)">Approve</button>
                                <button type="button" class="ghost-btn" :disabled="assignment.status !== 'waiting_verification'" @click="reject(assignment)">Reject</button>
                                <label class="file-action">Upload admin<input type="file" @change="uploadForUser($event, assignment)" /></label>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </AsyncState>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { assignmentStatuses, statusLabel } from '../../constants/navigation';
import { arsipApi } from '../../services/arsipApi';
import { confirmAction, promptText } from '../../services/dialogs';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';
import { dateTime } from '../../utils/format';

const route = useRoute();
const app = useAppStore();
const loading = ref(false);
const error = ref('');
const requests = ref([]);
const assignments = ref([]);
const selectedRequestId = ref(route.query.request_id || '');
const filters = reactive({ status: '', search: '' });

function currentFiles(assignment) {
    return (assignment.request_files || []).filter((item) => item.is_current !== false);
}

async function loadRequests() {
    const data = await arsipApi.adminRequests();
    requests.value = data.requests || [];
}

async function loadAssignments() {
    if (!selectedRequestId.value) return;
    loading.value = true;
    error.value = '';
    try {
        const data = await arsipApi.requestAssignments(selectedRequestId.value, filters);
        assignments.value = data.assignments || [];
    } catch (err) {
        error.value = toErrorMessage(err);
    } finally {
        loading.value = false;
    }
}

async function approve(assignment) {
    const confirmed = await confirmAction({
        title: 'Approve assignment?',
        text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`,
        confirmText: 'Approve',
    });
    if (!confirmed) return;

    await arsipApi.approveAssignment(assignment.assignment_id);
    app.notify('success', 'Assignment disetujui.');
    await loadAssignments();
}

async function reject(assignment) {
    const reason = await promptText({
        title: 'Reject assignment?',
        text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`,
        inputLabel: 'Catatan reject',
        placeholder: 'Tulis alasan agar penerima tahu apa yang perlu diperbaiki.',
        confirmText: 'Reject',
    });
    if (!reason) return;

    await arsipApi.rejectAssignment(assignment.assignment_id, reason);
    app.notify('success', 'Assignment ditolak dengan catatan.');
    await loadAssignments();
}

async function downloadRequestFile(requestFile) {
    await arsipApi.downloadRequestFile(requestFile);
}

async function uploadForUser(event, assignment) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const confirmed = await confirmAction({
        title: 'Upload file untuk target?',
        text: `${assignment.identifier} - ${assignment.name_snapshot || 'tanpa nama'}`,
        confirmText: 'Upload',
    });
    if (!confirmed) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('owner_role', assignment.target_role);
    formData.append('owner_identifier', assignment.identifier);
    formData.append('request_assignment_id', assignment.assignment_id);
    await arsipApi.uploadForUser(formData);
    app.notify('success', 'File admin berhasil diupload untuk target.');
    await loadAssignments();
}

watch(selectedRequestId, loadAssignments);
onMounted(async () => { await loadRequests(); await loadAssignments(); });
</script>
