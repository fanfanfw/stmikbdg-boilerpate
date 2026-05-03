<template>
    <div v-if="message" :class="['notice-box', type]">
        <strong>{{ title }}</strong>
        <p>{{ message }}</p>
    </div>
</template>

<script setup>
defineProps({
    type: { type: String, default: 'info' },
    title: { type: String, default: 'Informasi' },
    message: { type: String, default: '' },
});
</script>
