<template>
    <div v-if="loading" class="state-card muted-card">
        <span class="loader" aria-hidden="true"></span>
        <strong>Memuat data</strong>
        <p>Mohon tunggu sebentar.</p>
    </div>
    <div v-else-if="error" class="state-card error-card">
        <strong>Data belum bisa ditampilkan</strong>
        <p>{{ error }}</p>
        <button type="button" class="secondary-btn" @click="$emit('retry')">Coba lagi</button>
    </div>
    <div v-else-if="empty" class="state-card muted-card">
        <strong>{{ emptyTitle }}</strong>
        <p>{{ emptyText }}</p>
    </div>
    <slot v-else />
</template>

<script setup>
defineEmits(['retry']);
defineProps({
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    empty: { type: Boolean, default: false },
    emptyTitle: { type: String, default: 'Belum ada data' },
    emptyText: { type: String, default: 'Data akan muncul ketika tersedia dari API.' },
});
</script>
