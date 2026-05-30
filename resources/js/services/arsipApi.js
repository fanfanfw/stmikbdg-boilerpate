import { destroy, download, get, post, put, upload } from './http';

export const arsipApi = {
    summary: () => get('/me/archive-summary'),
    settings: () => get('/admin/settings'),
    updateSettings: (payload) => put('/admin/settings', payload),

    categories: (params) => get('/categories', params),
    createCategory: (payload) => post('/categories', payload),
    updateCategory: (id, payload) => put(`/categories/${id}`, payload),
    deleteCategory: (id) => destroy(`/categories/${id}`),
    restoreCategory: (id) => post(`/categories/${id}/restore`),

    files: (params) => get('/files', params),
    uploadFile: (formData) => upload('/files', formData),
    downloadFile: (file) => download(`/files/${file.file_id}/download`, file.display_filename || file.original_filename),
    deleteFile: (id, reason) => destroy(`/files/${id}`, { reason }),
    restoreFile: (id) => post(`/files/${id}/restore`),
    uploadForUser: (formData) => upload('/admin/files/upload-for-user', formData),

    adminRequests: (params) => get('/admin/requests', params),
    adminTargets: (params) => get('/admin/targets', params),
    createRequest: (payload) => post('/admin/requests', payload),
    updateRequest: (id, payload) => put(`/admin/requests/${id}`, payload),
    requestDetail: (id) => get(`/admin/requests/${id}`),
    previewRequestTargets: (payload) => post('/admin/requests/preview-targets', payload),
    publishRequest: (id) => post(`/admin/requests/${id}/publish`),
    closeRequest: (id) => post(`/admin/requests/${id}/close`),
    reopenRequest: (id) => post(`/admin/requests/${id}/reopen`),
    archiveRequest: (id) => post(`/admin/requests/${id}/archive`),
    requestAssignments: (id, params) => get(`/admin/requests/${id}/assignments`, params),
    requestProgress: (id) => get(`/admin/requests/${id}/progress`),
    approveAssignment: (id) => post(`/admin/request-assignments/${id}/approve`),
    rejectAssignment: (id, reason) => post(`/admin/request-assignments/${id}/reject`, { reason }),
    downloadRequestFile: (requestFile) => download(
        `/admin/request-files/${requestFile.request_file_id}/download`,
        requestFile.file?.display_filename || `request-file-${requestFile.request_file_id}`,
    ),

    userRequests: () => get('/requests'),
    userRequestDetail: (id) => get(`/requests/${id}`),
    uploadAssignmentFile: (assignmentId, formData) => upload(`/request-assignments/${assignmentId}/files/upload`, formData),
    reuseAssignmentFile: (assignmentId, fileId) => post(`/request-assignments/${assignmentId}/files/reuse`, { file_id: fileId }),


    scholarshipTypes: () => get('/admin/scholarship-types'),
    createScholarshipType: (payload) => post('/admin/scholarship-types', payload),
    updateScholarshipType: (id, payload) => put(`/admin/scholarship-types/${id}`, payload),
    deleteScholarshipType: (id) => destroy(`/admin/scholarship-types/${id}`),
    studentScholarships: (params) => get('/admin/student-scholarships', params),
    createStudentScholarship: (payload) => post('/admin/student-scholarships', payload),
    importStudentScholarships: (items) => post('/admin/student-scholarships/import', { items }),
    updateStudentScholarship: (id, payload) => put(`/admin/student-scholarships/${id}`, payload),

    distributions: (params) => get('/admin/distributions', params),
    createDistribution: (payload) => post('/admin/distributions', payload),
    updateDistribution: (id, payload) => put(`/admin/distributions/${id}`, payload),
    distributionDetail: (id) => get(`/admin/distributions/${id}`),
    previewDistributionTargets: (payload) => post('/admin/distributions/preview-targets', payload),
    publishDistribution: (id) => post(`/admin/distributions/${id}/publish`),
    distributionRecipients: (id, params) => get(`/admin/distributions/${id}/recipients`, params),
    uploadRecipientFile: (id, formData) => upload(`/admin/distribution-recipients/${id}/file`, formData),
    userDistributions: () => get('/distributions'),
    downloadDistributionFile: (file) => download(`/distribution-files/${file.file_id}/download`, file.display_filename || file.original_filename),

    exportJobs: (params) => get('/admin/export-jobs', params),
    createExportJob: (payload) => post('/admin/export-jobs', payload),
    exportJob: (id) => get(`/admin/export-jobs/${id}`),
    downloadExportJob: (job) => download(`/admin/export-jobs/${job.export_job_id}/download`, `arsip-digital-export-${job.export_job_id}.zip`),

    auditLogs: (params) => get('/admin/audit-logs', params),
    adminArchiveUsers: (params) => get('/admin/archive/users', params),
};
