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
    userDistributions: () => getJson('/distributions'),
    downloadDistributionFile: (file) => {
        const fileId = file?.file_id ?? file?.id ?? file?.distribution_file_id;
        if (fileId == null) {
            missingFileId();
        }

        return downloadBlob(
            `/distribution-files/${fileId}/download`,
            file?.display_filename || file?.original_filename || file?.filename || `distribution-file-${fileId}`,
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
