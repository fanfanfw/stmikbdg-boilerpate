<template>
    <section class="page-stack">
        <PageHeader eyebrow="Beasiswa" title="Scholarship dinamis" description="Kelola jenis beasiswa dan snapshot penerima manual sebagai fallback V1." />
        <div class="two-column">
            <section class="panel-block">
                <div class="section-heading"><h2>Jenis beasiswa</h2></div>
                <form class="form-grid" @submit.prevent="saveType">
                    <label>Kode<input v-model="typeForm.code" placeholder="KIP" /></label>
                    <label>Nama<input v-model="typeForm.name" required /></label>
                    <label class="wide">Deskripsi<textarea v-model="typeForm.description" rows="3" /></label>
                    <button type="submit">Simpan jenis</button>
                </form>
                <div class="data-list"><article v-for="type in types" :key="type.scholarship_type_id" class="list-row"><div><strong>{{ type.name }}</strong><small>{{ type.code || 'tanpa kode' }}</small></div><StatusPill :status="type.is_active ? 'active' : 'inactive'" /></article></div>
            </section>
            <section class="panel-block">
                <div class="section-heading"><h2>Penerima beasiswa</h2></div>
                <form class="form-grid" @submit.prevent="saveStudent">
                    <label>NIM<input v-model="studentForm.nim" required /></label>
                    <label>Nama<input v-model="studentForm.student_name_snapshot" /></label>
                    <label>Angkatan<input v-model="studentForm.angkatan_snapshot" /></label>
                    <label>Jenis<select v-model.number="studentForm.scholarship_type_id" required><option value="">Pilih</option><option v-for="type in types" :key="type.scholarship_type_id" :value="type.scholarship_type_id">{{ type.name }}</option></select></label>
                    <label>Status<select v-model="studentForm.status"><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="expired">Expired</option><option value="unknown">Unknown</option></select></label>
                    <button type="submit">Simpan penerima</button>
                </form>
            </section>
        </div>
        <AsyncState :loading="loading" :error="error" :empty="students.length === 0" empty-title="Belum ada penerima" empty-text="Tambahkan penerima beasiswa manual atau import lewat endpoint tersedia." @retry="load">
            <div class="table-wrap"><table><thead><tr><th>Mahasiswa</th><th>Beasiswa</th><th>Status</th><th>Periode</th></tr></thead><tbody>
                <tr v-for="item in students" :key="item.student_scholarship_id"><td><strong>{{ item.nim }}</strong><small>{{ item.student_name_snapshot || '-' }} · {{ item.angkatan_snapshot || '-' }}</small></td><td>{{ item.scholarship_type?.name || item.scholarship_type_id }}</td><td><StatusPill :status="item.status" /></td><td>{{ item.period_label || '-' }}</td></tr>
            </tbody></table></div>
        </AsyncState>
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
const types = ref([]);
const students = ref([]);
const typeForm = reactive({ code: '', name: '', description: '' });
const studentForm = reactive({ nim: '', student_name_snapshot: '', angkatan_snapshot: '', scholarship_type_id: '', status: 'active' });

async function load() {
    loading.value = true; error.value = '';
    try {
        const [typeData, studentData] = await Promise.all([arsipApi.scholarshipTypes(), arsipApi.studentScholarships()]);
        types.value = typeData.scholarship_types || [];
        students.value = studentData.student_scholarships || [];
    } catch (err) { error.value = toErrorMessage(err); } finally { loading.value = false; }
}

async function saveType() { await arsipApi.createScholarshipType(typeForm); app.notify('success', 'Jenis beasiswa dibuat.'); typeForm.code = ''; typeForm.name = ''; typeForm.description = ''; await load(); }
async function saveStudent() { await arsipApi.createStudentScholarship(studentForm); app.notify('success', 'Penerima beasiswa disimpan.'); studentForm.nim = ''; studentForm.student_name_snapshot = ''; studentForm.angkatan_snapshot = ''; await load(); }
onMounted(load);
</script>
