<template>
    <section class="page-stack">
        <PageHeader :eyebrow="`Dashboard ${roleLabel}`" title="Ruang arsip pribadi" description="Ringkasan file, request resmi, dan berkas dari kampus untuk akun aktif." />
        <div class="metric-grid">
            <article class="metric-card"><span>Total file</span><strong>{{ app.summary?.total_files ?? 0 }}</strong></article>
            <article class="metric-card"><span>Request pending</span><strong>{{ app.summary?.pending_requests ?? 0 }}</strong></article>
            <article class="metric-card"><span>Request ditolak</span><strong>{{ app.summary?.rejected_requests ?? 0 }}</strong></article>
            <article class="metric-card"><span>Berkas kampus</span><strong>{{ app.summary?.distribution_files ?? 0 }}</strong></article>
        </div>
        <div class="two-column">
            <RouterLink class="shortcut-panel" :to="{ name: 'user.archive' }"><strong>Upload arsip pribadi</strong><span>Buat kategori dan simpan dokumen yang bisa dipakai ulang.</span></RouterLink>
            <RouterLink class="shortcut-panel" :to="{ name: 'user.requests' }"><strong>Penuhi permintaan berkas</strong><span>Upload baru atau gunakan file lama untuk request resmi.</span></RouterLink>
            <RouterLink class="shortcut-panel" :to="{ name: 'user.distributions' }"><strong>Download berkas kampus</strong><span>Ambil dokumen yang didistribusikan admin untuk Anda.</span></RouterLink>
        </div>
    </section>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import PageHeader from '../../components/PageHeader.vue';
import { useAppStore } from '../../stores/appStore';

const app = useAppStore();
const roleLabel = computed(() => ({ mahasiswa: 'Mahasiswa', dosen: 'Dosen' }[app.role] || 'User'));
</script>
