import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        vue(),
        react(),
        tailwindcss(),
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'resources/css/app-react.css',
                'resources/js/app.jsx',
            ],
            refresh: true,
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (id.includes('/@mui/icons-material/')) return 'vendor-mui-icons';
                    if (id.includes('/@mui/x-data-grid/') || id.includes('/@mui/x-date-pickers/')) return 'vendor-mui-x';
                    if (id.includes('/@mui/material/')) return 'vendor-mui-material';
                    if (id.includes('/@emotion/')) return 'vendor-emotion';
                    if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/')) return 'vendor-react';
                    if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/pinia/')) return 'vendor-vue';
                    return undefined;
                },
            },
        },
    },
});
