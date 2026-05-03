<template>
    <section class="page-stack">
        <PageHeader eyebrow="Segment" title="Kelola segment manual" description="Segment dapat dipakai untuk targeting request dan distribution." />
        <div class="two-column">
            <section class="panel-block">
                <div class="section-heading"><h2>Segment baru</h2></div>
                <form class="form-grid" @submit.prevent="saveSegment">
                    <label>Nama<input v-model="form.name" required /></label>
                    <label>Role<select v-model="form.target_role"><option value="mahasiswa">Mahasiswa</option><option value="dosen">Dosen</option></select></label>
                    <label class="wide">Deskripsi<textarea v-model="form.description" rows="3" /></label>
                    <button type="submit">Buat segment</button>
                </form>
            </section>
            <section class="panel-block">
                <div class="section-heading"><h2>Tambah member</h2></div>
                <form class="form-grid" @submit.prevent="addMember">
                    <label>Segment<select v-model="selectedId" required><option value="">Pilih</option><option v-for="segment in segments" :key="segment.segment_id" :value="segment.segment_id">{{ segment.name }}</option></select></label>
                    <label>Identifier<input v-model="member.identifier" required /></label>
                    <label>Nama snapshot<input v-model="member.name_snapshot" /></label>
                    <label>Angkatan<input v-model="member.angkatan_snapshot" /></label>
                    <button type="submit">Tambah member</button>
                </form>
            </section>
        </div>
        <AsyncState :loading="loading" :error="error" :empty="segments.length === 0" empty-title="Belum ada segment" empty-text="Buat segment untuk targeting manual." @retry="load">
            <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Role</th><th>Member</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
                <tr v-for="segment in segments" :key="segment.segment_id"><td><strong>{{ segment.name }}</strong><small>{{ segment.description || '-' }}</small></td><td>{{ segment.target_role }}</td><td>{{ segment.members_count ?? 0 }}</td><td><StatusPill :status="segment.is_active ? 'active' : 'inactive'" /></td><td><button type="button" class="ghost-btn" @click="openSegment(segment)">Detail</button></td></tr>
            </tbody></table></div>
        </AsyncState>
        <section v-if="detail" class="panel-block"><div class="section-heading"><h2>Member {{ detail.name }}</h2></div><div class="data-list"><article v-for="item in detail.members || []" :key="item.segment_member_id" class="list-row"><div><strong>{{ item.identifier }}</strong><small>{{ item.name_snapshot || '-' }}</small></div><button type="button" class="ghost-btn" @click="deleteMember(item)">Hapus</button></article></div></section>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import AsyncState from '../../components/AsyncState.vue';
import PageHeader from '../../components/PageHeader.vue';
import StatusPill from '../../components/StatusPill.vue';
import { arsipApi } from '../../services/arsipApi';
import { toErrorMessage } from '../../services/http';
import { useAppStore } from '../../stores/appStore';

const app = useAppStore();
const loading = ref(false);
const error = ref('');
const segments = ref([]);
const selectedId = ref('');
const detail = ref(null);
const form = reactive({ name: '', description: '', target_role: 'mahasiswa' });
const member = reactive({ identifier: '', name_snapshot: '', angkatan_snapshot: '' });

async function load() { loading.value = true; error.value = ''; try { segments.value = (await arsipApi.segments()).segments || []; } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; } }
async function saveSegment() { await arsipApi.createSegment(form); app.notify('success', 'Segment dibuat.'); form.name = ''; form.description = ''; await load(); }
async function addMember() { await arsipApi.addSegmentMember(selectedId.value, member); app.notify('success', 'Member ditambahkan.'); member.identifier = ''; member.name_snapshot = ''; member.angkatan_snapshot = ''; if (detail.value?.segment_id === selectedId.value) await openSegment(detail.value); await load(); }
async function openSegment(segment) { detail.value = (await arsipApi.segment(segment.segment_id)).segment; selectedId.value = segment.segment_id; }
async function deleteMember(item) { await arsipApi.deleteSegmentMember(detail.value.segment_id, item.segment_member_id); app.notify('success', 'Member dihapus.'); await openSegment(detail.value); await load(); }
onMounted(load);
</script>
