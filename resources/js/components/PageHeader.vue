<template>
    <header class="page-header">
        <div>
            <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
            <h1>{{ title }}</h1>
            <p v-if="description" class="lede">{{ description }}</p>
        </div>
        <div v-if="$slots.actions" class="page-actions">
            <slot name="actions" />
        </div>
    </header>
</template>

<script setup>
defineProps({
    eyebrow: { type: String, default: '' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
});
</script>
