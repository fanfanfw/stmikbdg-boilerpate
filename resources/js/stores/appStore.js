import { defineStore } from 'pinia';
import axios from 'axios';
import { computed, ref } from 'vue';
import { arsipApi } from '../services/arsipApi';
import { toErrorMessage } from '../services/http';

export const useAppStore = defineStore('arsip-app', () => {
    const session = ref(null);
    const summary = ref(null);
    const loading = ref(false);
    const error = ref('');
    const toast = ref(null);

    const role = computed(() => summary.value?.role || normalizedSessionRole(session.value?.role));
    const isAdmin = computed(() => role.value === 'admin');
    const isUser = computed(() => role.value === 'mahasiswa' || role.value === 'dosen');
    const profile = computed(() => session.value?.profile || null);
    const account = computed(() => session.value?.account || null);

    function normalizedSessionRole(value) {
        return {
            is_admin: 'admin',
            is_mhs: 'mahasiswa',
            is_dosen: 'dosen',
        }[value] || value || null;
    }

    let toastTimer = null;

    function clearToast() {
        toast.value = null;
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }
    }

    function notify(type, text, timeout = 4200) {
        clearToast();
        toast.value = { type, text, at: Date.now() };
        toastTimer = setTimeout(() => {
            toast.value = null;
            toastTimer = null;
        }, timeout);
    }

    async function loadSummary() {
        loading.value = true;
        error.value = '';
        try {
            session.value = (await axios.get('/session/me')).data;
            summary.value = await arsipApi.summary();
        } catch (err) {
            error.value = toErrorMessage(err);
        } finally {
            loading.value = false;
        }
    }

    return { session, summary, loading, error, toast, role, isAdmin, isUser, profile, account, notify, clearToast, loadSummary };
});
