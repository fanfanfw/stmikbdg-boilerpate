export const adminNavigation = [
    { label: 'Dashboard', name: 'admin.dashboard' },
    { label: 'Arsip Pengguna', name: 'admin.archive' },
    { label: 'Permintaan Berkas', name: 'admin.requests' },
    { label: 'Distribusi Berkas', name: 'admin.distributions' },
    { label: 'Audit Log', name: 'admin.audit' },
    { label: 'Pengaturan', name: 'admin.settings' },
];

export const userNavigation = [
    { label: 'Dashboard', name: 'user.dashboard' },
    { label: 'Arsip Saya', name: 'user.archive' },
    { label: 'Permintaan Berkas', name: 'user.requests' },
    { label: 'Berkas Dari Kampus', name: 'user.distributions' },
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
