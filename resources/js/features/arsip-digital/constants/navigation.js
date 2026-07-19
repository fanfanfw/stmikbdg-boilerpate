export const adminNavigation = [
    { label: 'Dashboard', name: 'admin.dashboard', path: '/' },
    { label: 'Arsip Pengguna', name: 'admin.archive', path: '/arsip-pengguna' },
    { label: 'Permintaan Berkas', name: 'admin.requests', path: '/home/permintaan' },
    { label: 'Distribusi Berkas', name: 'admin.distributions', path: '/distribusi' },
    { label: 'Beasiswa', name: 'admin.scholarships', path: '/beasiswa' },
    { label: 'Export ZIP', name: 'admin.exports', path: '/export' },
    { label: 'Audit Log', name: 'admin.audit', path: '/audit' },
    { label: 'Pengaturan', name: 'admin.settings', path: '/pengaturan' },
];

export const userNavigation = [
    { label: 'Dashboard', name: 'user.dashboard', path: '/' },
    { label: 'Arsip Saya', name: 'user.archive', path: '/arsip-saya' },
    { label: 'Permintaan Berkas', name: 'user.requests', path: '/home/permintaan' },
    { label: 'Berkas Dari Kampus', name: 'user.distributions', path: '/distribusi' },
];

export const assignmentStatuses = [
    'not_submitted',
    'waiting_verification',
    'approved',
    'rejected',
    'closed',
];

export const requestStatuses = ['draft', 'published', 'closed', 'archived'];
export const deliveryStatuses = ['pending', 'file_uploaded', 'available', 'downloaded'];
export const exportStatuses = ['queued', 'processing', 'completed', 'failed', 'expired'];

export function statusLabel(status) {
    return {
        not_submitted: 'Belum submit',
        waiting_verification: 'Menunggu verifikasi',
        approved: 'Disetujui',
        rejected: 'Ditolak',
        closed: 'Ditutup',
        draft: 'Draft',
        published: 'Diterbitkan',
        archived: 'Diarsipkan',
        pending: 'Belum ada file',
        file_uploaded: 'File diunggah',
        available: 'Tersedia',
        downloaded: 'Sudah diunduh',
        queued: 'Dalam antrean',
        processing: 'Diproses',
        completed: 'Selesai',
        failed: 'Gagal',
        expired: 'Kedaluwarsa',
        active: 'Aktif',
        inactive: 'Nonaktif',
        expired_scholarship: 'Berakhir',
        unknown: 'Tidak diketahui',
    }[status] || status || '-';
}
