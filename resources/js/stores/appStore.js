import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { arsipApi } from '../services/arsipApi';
import { toErrorMessage } from '../services/http';

export const useAppStore = defineStore('arsip-app', () => {
    const summary = ref(null);
    const loading = ref(false);
    const error = ref('');
    const toast = ref(null);

    const role = computed(() => summary.value?.role || null);
    const isAdmin = computed(() => role.value === 'admin');
    const isUser = computed(() => role.value === 'mahasiswa' || role.value === 'dosen');

    function notify(type, text) {
        toast.value = { type, text, at: Date.now() };
    }

    async function loadSummary() {
        loading.value = true;
        error.value = '';
        try {
            summary.value = await arsipApi.summary();
        } catch (err) {
            error.value = toErrorMessage(err);
        } finally {
            loading.value = false;
        }
    }

    return { summary, loading, error, toast, role, isAdmin, isUser, notify, loadSummary };
});
