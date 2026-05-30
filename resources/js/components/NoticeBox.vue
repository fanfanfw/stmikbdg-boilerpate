<template>
    <div v-if="message" :class="['notice-box', type]" role="status">
        <div>
            <strong>{{ title }}</strong>
            <p>{{ message }}</p>
        </div>
        <button v-if="dismissible" type="button" class="notice-close" aria-label="Tutup notifikasi" @click="$emit('dismiss')">Tutup</button>
    </div>
</template>

<script setup>
defineEmits(['dismiss']);
defineProps({
    type: { type: String, default: 'info' },
    title: { type: String, default: 'Informasi' },
    message: { type: String, default: '' },
    dismissible: { type: Boolean, default: false },
});
</script>
