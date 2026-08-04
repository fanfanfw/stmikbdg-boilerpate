import { recipientPreviewEndpoint } from '../features/arsip-digital/admin/institutionalArchiveUi';
import {
    getJson,
    postJson,
    putJson,
    deleteJson,
    uploadFormData,
    getBlob,
    postBlob,
    downloadBlob,
} from './arsip_http';

// --------------------------------------------------------------------------
// Arsip Digital API - Ported from services/arsipApi.js using new HTTP helpers
// --------------------------------------------------------------------------

function missingFileId() {
    throw { response: { data: { message: 'ID file tidak tersedia.' } } };
}

export const arsipApi = {
    // Summary & Settings
    summary: () => getJson('/me/archive-summary'),
    settings: () => getJson('/admin/settings'),
    updateSettings: (payload) => putJson('/admin/settings', payload),
    institutionalUnits: (params) => getJson('/admin/institutional-units', params),
    createInstitutionalUnit: (payload) => postJson('/admin/institutional-units', payload),
    updateInstitutionalUnit: (id, payload) => putJson(`/admin/institutional-units/${id}`, payload),
    deleteInstitutionalUnit: (id) => deleteJson(`/admin/institutional-units/${id}`),
    restoreInstitutionalUnit: (id) => postJson(`/admin/institutional-units/${id}/restore`),
    institutionalCategories: (params) => getJson('/admin/institutional-categories', params),
    createInstitutionalCategory: (payload) => postJson('/admin/institutional-categories', payload),
    updateInstitutionalCategory: (id, payload) => putJson(`/admin/institutional-categories/${id}`, payload),
    deleteInstitutionalCategory: (id) => deleteJson(`/admin/institutional-categories/${id}`),
    restoreInstitutionalCategory: (id) => postJson(`/admin/institutional-categories/${id}/restore`),
    institutionalArchives: (params) => getJson('/admin/institutional-archives', params),
    institutionalArchiveTrash: (params) => getJson('/admin/institutional-archives/trash', params),
    institutionalArchive: (id) => getJson(`/admin/institutional-archives/${id}`),
    deleteInstitutionalArchive: (id, reason) => deleteJson(`/admin/institutional-archives/${id}`, { reason }),
    restoreInstitutionalArchive: (id) => postJson(`/admin/institutional-archives/${id}/restore`),
    institutionalArchiveTimeline: (id, params) => getJson(`/admin/institutional-archives/${id}/timeline`, params),
    previewInstitutionalDistributionTargets: (id, payload) => postJson(`/admin/institutional-archives/${id}/distributions/preview-targets`, payload),
    createInstitutionalDistribution: (id, payload) => postJson(`/admin/institutional-archives/${id}/distributions`, payload),
    institutionalDistributions: (id, params) => getJson(`/admin/institutional-archives/${id}/distributions`, params),
    institutionalDistribution: id => getJson(`/admin/institutional-distributions/${id}`),
    institutionalDistributionTargets: id => getJson(`/admin/institutional-distributions/${id}/targets`),
    updateInstitutionalDistribution: (id, payload) => putJson(`/admin/institutional-distributions/${id}`, payload),
    cancelInstitutionalDistribution: (id, payload) => deleteJson(`/admin/institutional-distributions/${id}`, payload),
    publishInstitutionalDistribution: (id, payload) => postJson(`/admin/institutional-distributions/${id}/publish`, payload),
    withdrawInstitutionalDistribution: (id, reason) => postJson(`/admin/institutional-distributions/${id}/withdraw`, { reason }),
    institutionalDistributionRecipients: (id, params) => getJson(`/admin/institutional-distributions/${id}/recipients`, params),
    uploadInstitutionalArchive: (formData, onUploadProgress) => uploadFormData('/admin/institutional-archives', formData, { onUploadProgress }),
    updateInstitutionalArchive: (id, payload) => putJson(`/admin/institutional-archives/${id}`, payload),
    moveInstitutionalArchive: (id, categoryId) => postJson(`/admin/institutional-archives/${id}/move`, { category_id: categoryId || null }),
    previewInstitutionalArchive: (id) => getBlob(`/admin/institutional-archives/${id}/preview`),
    downloadInstitutionalArchive: (archive) => downloadBlob(`/admin/institutional-archives/${archive.institutional_archive_id}/download`, archive.current_file?.display_filename || `arsip-${archive.institutional_archive_id}`),
    uploadInstitutionalArchiveVersion: (id, formData, onUploadProgress) => uploadFormData(`/admin/institutional-archives/${id}/versions`, formData, { onUploadProgress }),
    institutionalArchiveVersions: (id, params) => getJson(`/admin/institutional-archives/${id}/versions`, params),
    downloadInstitutionalArchiveVersion: (archiveId, file) => downloadBlob(`/admin/institutional-archives/${archiveId}/versions/${file.file_id}/download`, file.display_filename || `arsip-version-${file.file_id}`),
    institutionalStorageSummary: () => getJson('/admin/institutional-storage/summary'),
    institutionalStorageFiles: params => getJson('/admin/institutional-storage/files', params),
    triggerInstitutionalStorageReconciliation: () => postJson('/admin/institutional-storage/reconciliation-jobs'),
    institutionalStorageReconciliationJob: jobId => getJson(`/admin/institutional-storage/reconciliation-jobs/${jobId}`),
    academicDocuments: (params) => getJson('/admin/academic-documents', params),
    academicDocument: (id) => getJson(`/admin/academic-documents/${id}`),
    academicDocumentSigners: (params) => getJson('/admin/academic-documents/signers', params),
    nextAcademicDocumentNumber: (documentType) => getJson('/admin/academic-documents/next-number', { document_type: documentType }),
    previewAcademicDocumentDraft: (payload) => postBlob('/admin/academic-documents/preview', payload),
    previewAcademicDocument: (id) => getBlob(`/admin/academic-documents/${id}/preview`),
    downloadAcademicDocument: (id, filename) => downloadBlob(`/admin/academic-documents/${id}/download`, filename),
    academicTranscript: (mhsId) => getJson(`/admin/academic-documents/students/${mhsId}/transcript`),
    issueAcademicDocument: (payload) => postJson('/admin/academic-documents', payload),
    distributeAcademicDocument: (id) => postJson(`/admin/academic-documents/${id}/distribute`),
    revokeAcademicDocument: (id, reason) => postJson(`/admin/academic-documents/${id}/revoke`, { reason }),

    // Categories
    categories: (params) => getJson('/categories', params),
    createCategory: (payload) => postJson('/categories', payload),
    updateCategory: (id, payload) => putJson(`/categories/${id}`, payload),
    deleteCategory: (id) => deleteJson(`/categories/${id}`),
    restoreCategory: (id) => postJson(`/categories/${id}/restore`),

    // Files
    files: (params) => getJson('/files', params),
    uploadFile: (formData) => uploadFormData('/files', formData),
    moveFiles: (fileIds, categoryId) => postJson('/files/move', { file_ids: fileIds, category_id: categoryId || null }),
    fileVersions: (id) => getJson(`/files/${id}/versions`),
    adminUploadForUser: (formData) => uploadFormData('/admin/files/upload-for-user', formData),
    downloadFile: (file) => {
        const fileId = file?.file_id ?? file?.id;
        if (fileId == null) {
            missingFileId();
        }

        return downloadBlob(
            `/files/${fileId}/download`,
            file?.display_filename || file?.original_filename || file?.filename || `arsip-file-${fileId}`,
        );
    },
    deleteFile: (id, reason) => deleteJson(`/files/${id}`, { reason }),
    restoreFile: (id) => postJson(`/files/${id}/restore`),

    // Admin Requests
    adminRequests: (params) => getJson('/admin/requests', params),
    adminTargets: (params) => getJson('/admin/targets', params),
    createRequest: (payload) => postJson('/admin/requests', payload),
    updateRequest: (id, payload) => putJson(`/admin/requests/${id}`, payload),
    deleteRequest: (id) => deleteJson(`/admin/requests/${id}`),
    requestDetail: (id) => getJson(`/admin/requests/${id}`),
    previewRequestTargets: (payload) => postJson('/admin/requests/preview-targets', payload),
    appendRequestTargets: (id, payload) => postJson(`/admin/requests/${id}/targets`, payload),
    publishRequest: (id) => postJson(`/admin/requests/${id}/publish`),
    closeRequest: (id) => postJson(`/admin/requests/${id}/close`),
    reopenRequest: (id) => postJson(`/admin/requests/${id}/reopen`),
    archiveRequest: (id) => postJson(`/admin/requests/${id}/archive`),
    requestAssignments: (id, params) => getJson(`/admin/requests/${id}/assignments`, params),
    requestProgress: (id) => getJson(`/admin/requests/${id}/progress`),
    approveAssignment: (id) => postJson(`/admin/request-assignments/${id}/approve`),
    rejectAssignment: (id, reason) =>
        postJson(`/admin/request-assignments/${id}/reject`, { reason }),
    bulkApproveAssignments: (assignmentIds) =>
        postJson('/admin/request-assignments/bulk-approve', { assignment_ids: assignmentIds }),
    bulkRejectAssignments: (assignmentIds, reason) =>
        postJson('/admin/request-assignments/bulk-reject', { assignment_ids: assignmentIds, reason }),
    downloadRequestFile: (requestFile) => {
        const requestFileId = requestFile?.request_file_id ?? requestFile?.id ?? requestFile?.file_id;
        if (requestFileId == null) {
            missingFileId();
        }

        return downloadBlob(
            `/admin/request-files/${requestFileId}/download`,
            requestFile?.file?.display_filename || requestFile?.display_filename || requestFile?.original_filename || requestFile?.filename || `request-file-${requestFileId}`,
        );
    },

    // User Requests
    userRequests: () => getJson('/requests'),
    userRequestDetail: (id) => getJson(`/requests/${id}`),
    uploadAssignmentFile: (assignmentId, formData) =>
        uploadFormData(`/request-assignments/${assignmentId}/files/upload`, formData),
    reuseAssignmentFile: (assignmentId, fileId, replaceRequestFileId = null) =>
        postJson(`/request-assignments/${assignmentId}/files/reuse`, {
            file_id: fileId,
            ...(replaceRequestFileId ? { replace_request_file_id: replaceRequestFileId } : {}),
        }),

    // Scholarship Types
    scholarshipTypes: () => getJson('/admin/scholarship-types'),
    createScholarshipType: (payload) => postJson('/admin/scholarship-types', payload),
    updateScholarshipType: (id, payload) => putJson(`/admin/scholarship-types/${id}`, payload),
    deleteScholarshipType: (id) => deleteJson(`/admin/scholarship-types/${id}`),
    studentScholarships: (params) => getJson('/admin/student-scholarships', params),
    createStudentScholarship: (payload) => postJson('/admin/student-scholarships', payload),
    importStudentScholarships: (items) =>
        postJson('/admin/student-scholarships/import', { items }),
    updateStudentScholarship: (id, payload) => putJson(`/admin/student-scholarships/${id}`, payload),

    // Distributions
    distributions: (params) => getJson('/admin/distributions', params),
    createDistribution: (payload) => postJson('/admin/distributions', payload),
    updateDistribution: (id, payload) => putJson(`/admin/distributions/${id}`, payload),
    deleteDistribution: (id) => deleteJson(`/admin/distributions/${id}`),
    distributionDetail: (id) => getJson(`/admin/distributions/${id}`),
    previewDistributionTargets: (payload) =>
        postJson('/admin/distributions/preview-targets', payload),
    publishDistribution: (id) => postJson(`/admin/distributions/${id}/publish`),
    withdrawDistribution: (id, reason) => postJson(`/admin/distributions/${id}/withdraw`, { reason }),
    createDistributionCorrection: (id) => postJson(`/admin/distributions/${id}/corrections`),
    distributionRecipients: (id, params) =>
        getJson(`/admin/distributions/${id}/recipients`, params),
    uploadRecipientFile: (recipientId, formData) =>
        uploadFormData(`/admin/distribution-recipients/${recipientId}/file`, formData),
    distributionBulkUploadJobs: (distributionId, params) =>
        getJson(`/admin/distributions/${distributionId}/bulk-upload-jobs`, params),
    createDistributionBulkUploadJob: (distributionId, formData) =>
        uploadFormData(`/admin/distributions/${distributionId}/bulk-upload-jobs`, formData),
    distributionBulkUploadJob: (jobId) =>
        getJson(`/admin/distribution-bulk-upload-jobs/${jobId}`),
    confirmDistributionBulkUploadJob: (jobId) =>
        postJson(`/admin/distribution-bulk-upload-jobs/${jobId}/confirm`),
    cancelDistributionBulkUploadJob: (jobId) =>
        postJson(`/admin/distribution-bulk-upload-jobs/${jobId}/cancel`),

    // User Distributions
    userDistributions: (params) => getJson('/distributions', params),
    previewDistributionRecipient: recipientId => getBlob(recipientPreviewEndpoint(recipientId)),
    downloadDistributionFile: (file) => {
        const recipientId = file?.recipient_id;
        if (recipientId == null) {
            missingFileId();
        }

        return downloadBlob(
            `/distribution-recipients/${recipientId}/download`,
            file?.display_filename || file?.original_filename || file?.filename || `distribution-file-${recipientId}`,
        );
    },

    // Notifications
    notifications: (params) => getJson('/notifications', params),
    notificationUnreadCount: () => getJson('/notifications/unread-count'),
    markNotificationRead: (id) => postJson(`/notifications/${id}/read`),
    markAllNotificationsRead: () => postJson('/notifications/read-all'),

    // Export Jobs
    exportJobs: (params) => getJson('/admin/export-jobs', params),
    createExportJob: (payload) => postJson('/admin/export-jobs', payload),
    exportJob: (id) => getJson(`/admin/export-jobs/${id}`),
    downloadExportJob: (job) => {
        const jobId = job?.export_job_id ?? job?.id;
        if (jobId == null) {
            missingFileId();
        }

        return downloadBlob(
            `/admin/export-jobs/${jobId}/download`,
            job?.filename || job?.original_filename || `arsip-digital-export-${jobId}.zip`,
        );
    },

    // Audit Logs
    auditLogs: (params) => getJson('/admin/audit-logs', params),
};
