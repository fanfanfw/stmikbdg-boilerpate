<template>
    <section class="state-card muted-card">
        <strong>{{ title }}</strong>
        <p>{{ message }}</p>
    </section>
</template>

<script setup>
defineProps({
    title: { type: String, default: 'Endpoint belum tersedia' },
    message: {
        type: String,
        default: 'UI disiapkan, tetapi backend Phase 1-7 belum menyediakan endpoint untuk data ini. Tidak ada backend baru yang dibuat.',
    },
});
</script>
