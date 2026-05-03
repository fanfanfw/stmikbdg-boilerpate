import './bootstrap';
import { createApp } from 'vue';
import ArsipDigitalSmoke from './arsip-digital/ArsipDigitalSmoke.vue';

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (csrfToken) {
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
}

const smokeRoot = document.getElementById('arsip-digital-smoke');

if (smokeRoot) {
    createApp(ArsipDigitalSmoke).mount(smokeRoot);
}
