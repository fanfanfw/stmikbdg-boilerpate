<template>
    <div class="app-shell">
        <aside :class="['sidebar', sidebarOpen ? 'open' : '']">
            <div class="brand-lockup">
                <span class="brand-mark">AD</span>
                <div>
                    <strong>Arsip Digital</strong>
                    <small>STMIK Bandung</small>
                </div>
            </div>

            <nav v-if="app.role" class="nav-list" aria-label="Navigasi arsip digital">
                <RouterLink
                    v-for="item in navigation"
                    :key="item.name"
                    :to="{ name: item.name }"
                    @click="sidebarOpen = false"
                >
                    {{ item.label }}
                </RouterLink>
            </nav>

            <div class="sidebar-note">
                <span>Role aktif</span>
                <strong>{{ roleLabel }}</strong>
                <small v-if="userLabel">{{ userLabel }}</small>
                <a class="logout-link" href="/logout">Logout</a>
            </div>
        </aside>

        <div class="main-shell">
            <header class="topbar">
                <button type="button" class="icon-btn" @click="sidebarOpen = !sidebarOpen">Menu</button>
                <div>
                    <strong>{{ roleLabel }}</strong>
                    <span>{{ userLabel || `${app.summary?.total_files ?? 0} file tercatat` }}</span>
                </div>
                <a class="logout-link topbar-logout" href="/logout">Logout</a>
            </header>

            <NoticeBox
                v-if="app.toast"
                :type="app.toast.type"
                :title="app.toast.type === 'success' ? 'Berhasil' : 'Perhatian'"
                :message="app.toast.text"
            />

            <AsyncState
                :loading="app.loading && !app.role"
                :error="app.error"
                :empty="false"
                @retry="bootstrap"
            >
                <RouterView v-if="routeAllowed" />
                <section v-else class="state-card error-card">
                    <strong>Menu tidak sesuai role</strong>
                    <p>Role aktif Anda tidak memiliki akses ke halaman ini.</p>
                    <button type="button" @click="goHome">Kembali ke dashboard</button>
                </section>
            </AsyncState>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AsyncState from './components/AsyncState.vue';
import NoticeBox from './components/NoticeBox.vue';
import { adminNavigation, userNavigation } from './constants/navigation';
import { useAppStore } from './stores/appStore';

const app = useAppStore();
const route = useRoute();
const router = useRouter();
const sidebarOpen = ref(false);

const navigation = computed(() => (app.isAdmin ? adminNavigation : userNavigation));
const roleLabel = computed(() => ({ admin: 'Admin', mahasiswa: 'Mahasiswa', dosen: 'Dosen' }[app.role] || 'Memuat role'));
const userLabel = computed(() => app.profile?.nama || app.profile?.name || app.account?.email || app.session?.user_email || '');
const routeAllowed = computed(() => {
    const roles = route.meta?.roles;
    return !roles || !app.role || roles.includes(app.role);
});

function defaultRouteName() {
    return app.isAdmin ? 'admin.dashboard' : 'user.dashboard';
}

async function bootstrap() {
    await app.loadSummary();
    goHomeIfNeeded();
}

function goHomeIfNeeded() {
    if (!app.role) return;

    const roles = route.meta?.roles;
    if (route.name === 'home' || (roles && !roles.includes(app.role))) {
        router.replace({ name: defaultRouteName() });
    }
}

function goHome() {
    router.replace({ name: defaultRouteName() });
}

watch(() => app.role, goHomeIfNeeded);
watch(() => route.name, goHomeIfNeeded);
onMounted(bootstrap);
</script>
