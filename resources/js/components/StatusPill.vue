<template>
    <span :class="['status-pill', tone]">{{ statusLabel(status) }}</span>
</template>

<script setup>
import { computed } from 'vue';
import { statusLabel } from '../constants/navigation';

const props = defineProps({
    status: { type: String, default: '' },
});

const tone = computed(() => {
    if (['approved', 'completed', 'available', 'downloaded', 'active', 'published'].includes(props.status)) return 'ok';
    if (['rejected', 'failed', 'expired'].includes(props.status)) return 'danger';
    if (['waiting_verification', 'queued', 'processing', 'file_uploaded'].includes(props.status)) return 'warn';
    return 'neutral';
});
</script>
