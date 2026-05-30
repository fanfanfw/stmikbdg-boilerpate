import { createRouter, createWebHashHistory } from 'vue-router';

const AdminDashboard = () => import('../views/admin/AdminDashboard.vue');
const AdminArchive = () => import('../views/admin/AdminArchive.vue');
const AdminRequests = () => import('../views/admin/AdminRequests.vue');
const AdminRequestDetail = () => import('../views/admin/AdminRequestDetail.vue');
const AdminDistributions = () => import('../views/admin/AdminDistributions.vue');
const AdminScholarships = () => import('../views/admin/AdminScholarships.vue');
const AdminExports = () => import('../views/admin/AdminExports.vue');
const AdminAudit = () => import('../views/admin/AdminAudit.vue');
const AdminSettings = () => import('../views/admin/AdminSettings.vue');
const UserDashboard = () => import('../views/user/UserDashboard.vue');
const PersonalArchive = () => import('../views/user/PersonalArchive.vue');
const UserRequests = () => import('../views/user/UserRequests.vue');
const UserDistributions = () => import('../views/user/UserDistributions.vue');

const routes = [
    { path: '/', name: 'home', redirect: { name: 'user.dashboard' } },
    { path: '/admin', redirect: { name: 'admin.dashboard' }, meta: { roles: ['admin'] } },
    { path: '/admin/dashboard', name: 'admin.dashboard', component: AdminDashboard, meta: { roles: ['admin'] } },
    { path: '/admin/arsip-pengguna', name: 'admin.archive', component: AdminArchive, meta: { roles: ['admin'] } },
    { path: '/admin/permintaan', name: 'admin.requests', component: AdminRequests, meta: { roles: ['admin'] } },
    { path: '/admin/permintaan/:request_id', name: 'admin.requests.show', component: AdminRequestDetail, meta: { roles: ['admin'] } },
    { path: '/admin/monitoring', name: 'admin.monitoring', redirect: { name: 'admin.requests' }, meta: { roles: ['admin'] } },
    { path: '/admin/distribusi', name: 'admin.distributions', component: AdminDistributions, meta: { roles: ['admin'] } },
    { path: '/admin/beasiswa', name: 'admin.scholarships', component: AdminScholarships, meta: { roles: ['admin'] } },
    { path: '/admin/export-zip', name: 'admin.exports', component: AdminExports, meta: { roles: ['admin'] } },
    { path: '/admin/audit-log', name: 'admin.audit', component: AdminAudit, meta: { roles: ['admin'] } },
    { path: '/admin/pengaturan', name: 'admin.settings', component: AdminSettings, meta: { roles: ['admin'] } },
    { path: '/dashboard', name: 'user.dashboard', component: UserDashboard, meta: { roles: ['mahasiswa', 'dosen'] } },
    { path: '/arsip-saya', name: 'user.archive', component: PersonalArchive, meta: { roles: ['mahasiswa', 'dosen'] } },
    { path: '/permintaan', name: 'user.requests', component: UserRequests, meta: { roles: ['mahasiswa', 'dosen'] } },
    { path: '/berkas-kampus', name: 'user.distributions', component: UserDistributions, meta: { roles: ['mahasiswa', 'dosen'] } },
];

export default createRouter({
    history: createWebHashHistory(),
    routes,
});
