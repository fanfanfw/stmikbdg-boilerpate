export const storageBytes = value => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format((Number(value) || 0) / 1024 / 1024)} MB`;
export const storageAvailability = value => ['available', 'missing', 'unknown'].includes(value) ? value : 'unknown';
export const storageSummaryState = summary => ({
    total: Number(summary?.total_bytes) || 0,
    current: Number(summary?.current_bytes) || 0,
    versions: Number(summary?.total_files) || 0,
    deleted: Number(summary?.soft_deleted_bytes) || 0,
    limit: Number(summary?.soft_limit_bytes) > 0 ? Number(summary.soft_limit_bytes) : null,
});
export const storageFilesRequest = (page, perPage, filters = {}) => compactQuery({ page: Math.max(1, Number(page) || 1), per_page: Math.min(100, Math.max(10, Number(perPage) || 20)), storage_availability: filters.storage_availability, unit_id: filters.unit_id, category_id: filters.category_id, version: filters.version, deleted: filters.deleted, sort: filters.sort || 'file_size_bytes', direction: filters.direction || 'desc' });
export const storageFileSort = model => ({ sort: ['file_size_bytes', 'created_at', 'storage_availability'].includes(model?.[0]?.field) ? model[0].field : 'file_size_bytes', direction: model?.[0]?.sort || 'desc' });
export const storageDashboardView = ({ loading, error, summary }) => loading ? 'loading' : error ? 'error' : summary ? 'ready' : 'empty';
export const reconciliationProgress = job => ({ status: ['queued', 'running', 'completed', 'failed'].includes(job?.status) ? job.status : 'unknown', percent: job?.total_files > 0 ? Math.min(100, Math.round((Number(job.checked_files) || 0) * 100 / job.total_files)) : 0 });
export const storageDashboardController = () => {
    let mounted = true; let generation = 0; let owner = null; const requests = new Map(); let jobId = null;
    const valid = capture => mounted && capture.generation === generation && requests.get(capture.kind) === capture.token && (capture.kind !== 'job' || String(capture.jobId) === String(jobId));
    return {
        capture(kind) { const capture = { kind, generation, jobId, token: Symbol(kind) }; requests.set(kind, capture.token); return { ...capture, valid: () => valid(capture) }; },
        beginSync() { if (!mounted || owner) return null; owner = Symbol('storage-sync'); const actionOwner = owner; const capture = this.capture('action'); return { ...capture, owner: actionOwner, valid: () => owner === actionOwner && valid(capture) }; },
        release(capture) { if (!capture || capture.owner !== owner) return false; const active = capture.valid(); owner = null; return active; },
        resume(id) { jobId = id; requests.delete('job'); return this.capture('job'); },
        currentJob() { return jobId; }, busy() { return owner !== null; },
        change() { generation++; owner = null; requests.clear(); jobId = null; },
        close() { mounted = false; this.change(); },
    };
};
export async function runStorageSync({ capture, trigger, onJob, onError, formatError }) { try { const response = await trigger(); if (!capture.valid()) return false; onJob(response?.data?.job || response?.job); return true; } catch (error) { if (!capture.valid()) return false; if (error?.response?.status === 409 && error.response.data?.data?.job) { onJob(error.response.data.data.job); return true; } const formatted = await formatError(error); if (capture.valid()) onError(formatted.message); return false; } }

export const uploadPercent = event => event?.total > 0 ? Math.min(100, Math.round((event.loaded * 100) / event.total)) : null;
export const validationErrors = formatted => formatted?.errors || {};
export const classificationPayload = (type, form) => type === 'unit'
    ? { name: form.name.trim(), code: form.code.trim() || null, description: form.description.trim() || null }
    : { name: form.name.trim(), parent_category_id: form.parent_category_id || null, description: form.description.trim() || null };
export async function runClassificationLoad({ requests, load, formatError, onSuccess, onError }) {
    const sequence = requests.next();
    try {
        const result = await load();
        if (!requests.valid(sequence)) return false;
        onSuccess(result);
        return true;
    } catch (error) {
        if (!requests.valid(sequence)) return false;
        const formatted = await formatError(error);
        if (requests.valid(sequence)) onError(formatted.message);
        return false;
    }
}
export async function runClassificationCreate({ type, form, lock, capture = { valid: () => true }, create, refresh, formatError, onBusy = () => {}, onCreated, onRefreshed, onWarning, onError }) {
    if (!capture.valid() || lock.current || !form.name.trim()) return false;
    const owner = Symbol('classification-create');
    lock.current = owner;
    onBusy(true);
    try {
        const response = await create(classificationPayload(type, form));
        if (!capture.valid() || lock.current !== owner) return false;
        const key = type === 'unit' ? 'unit' : 'category';
        const idKey = type === 'unit' ? 'unit_id' : 'category_id';
        const formKey = type === 'unit' ? 'unit_id' : 'category_id';
        const created = response.data?.[key] ?? response.data;
        const updateForm = current => ({ ...current, [formKey]: created[idKey] });
        onCreated(created, updateForm);
        try {
            const refreshed = await refresh();
            if (!capture.valid() || lock.current !== owner) return false;
            onRefreshed(refreshed, created);
        } catch {
            if (!capture.valid() || lock.current !== owner) return false;
            onWarning('Data berhasil dibuat, tetapi daftar terbaru belum dapat dimuat. Pilihan baru tetap tersimpan.');
        }
        return true;
    } catch (error) {
        if (!capture.valid() || lock.current !== owner) return false;
        const formatted = await formatError(error);
        if (capture.valid() && lock.current === owner) onError(formatted.message, validationErrors(formatted));
        return false;
    } finally {
        if (lock.current === owner) {
            lock.current = false;
            if (capture.valid()) onBusy(false);
        }
    }
}
export const classificationDialogState = (uploadOpen, createType, uploadForm) => ({ uploadOpen: Boolean(uploadOpen && !createType), createOpen: Boolean(createType), uploadForm });
export const clearNativeFileInput = ref => { if (ref?.current) ref.current.value = ''; };
export const versionHistoryRequest = page => ({ page, per_page: 10 });
export const versionHistoryState = versions => versions.map(version => ({ ...version, current_label: version.is_current ? 'Saat ini' : '' }));
export const exactVersionDownload = (download, archiveId, version) => download(archiveId, { file_id: version.file_id, display_filename: version.display_filename });
export const distributionExpiry = value => value ? new Date(value).toISOString() : null;
export const distributionPayload = (form, targets) => ({ ...targets, title: form.title.trim(), description: form.description || null, expires_at: distributionExpiry(form.expires_at) });
const canonicalTargetValue = value => {
    if (Array.isArray(value)) return value.map(canonicalTargetValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonicalTargetValue(value[key])]));
    return typeof value === 'string' ? value.trim() : value;
};
export const distributionTargetFingerprint = targets => JSON.stringify(canonicalTargetValue({
    target_role: targets?.target_role || null,
    scope_type: targets?.scope_type || null,
    target_identifiers: targets?.target_identifiers || [],
    target_filters: targets?.target_filters || {},
    target_segment_ids: targets?.target_segment_ids || [],
    target_criteria: targets?.target_criteria || {},
}));
export const distributionPreviewConfirmed = (preview, targets, previewFingerprint = preview?.target_fingerprint) => Boolean(preview && preview.total_valid > 0 && preview.total_invalid === 0 && previewFingerprint === distributionTargetFingerprint(targets));
export const distributionTargetChange = (currentTargets, nextTargets, preview, previewFingerprint) => distributionTargetFingerprint(currentTargets) === distributionTargetFingerprint(nextTargets)
    ? { targets: nextTargets, preview, previewFingerprint }
    : { targets: nextTargets, preview: null, previewFingerprint: null };
export const distributionPreviewSamples = preview => {
    const targets = [...(preview?.valid_targets || []), ...(preview?.invalid_targets || [])];
    const rows = targets.slice(0, 10);
    return { rows, remaining: Math.max(0, (Number(preview?.total_valid) || 0) + (Number(preview?.total_invalid) || 0) - rows.length) };
};
export const recipientPageRequest = (page, perPage = 25) => ({ page: Math.max(1, Number(page) || 1), per_page: Math.min(100, Math.max(10, Number(perPage) || 25)) });
export const recipientStatus = recipient => {
    if (recipient.deleted_at || recipient.availability_status === 'unavailable') return 'deleted';
    if (recipient.withdrawn_at || recipient.status === 'closed' || recipient.status === 'withdrawn' || recipient.availability_status === 'withdrawn' || recipient.delivery_status === 'revoked') return 'withdrawn';
    if (recipient.availability_status === 'expired' || (recipient.expires_at && new Date(recipient.expires_at) <= new Date())) return 'expired';
    return recipient.download_count > 0 ? 'downloaded' : (recipient.delivery_status || recipient.availability_status || 'available');
};
export const distributionListRequest = (page, perPage = 10) => ({ page: Math.max(1, Number(page) || 1), per_page: Math.min(100, Math.max(10, Number(perPage) || 10)) });
export const distributionCountLabel = distribution => distribution?.status === 'draft'
    ? (Number.isInteger(distribution.target_count) ? `Target draft: ${distribution.target_count}` : 'Target draft tersimpan')
    : `Penerima: ${Number(distribution?.recipients_count) || 0}`;
export const distributionEffectiveStatus = distribution => distribution?.effective_status || (distribution?.status === 'published' && distribution?.expires_at && new Date(distribution.expires_at) <= new Date() ? 'expired' : distribution?.status);
export const distributionActionPolicy = active => ({ create: Boolean(active), previewTargets: Boolean(active), publish: Boolean(active), list: true, recipients: true, withdraw: true });
export const recipientPreviewEndpoint = recipientId => `/distribution-recipients/${recipientId}/preview`;
export async function loadControlledPage({ capture, request, page, perPage, requestParams, rowsKey }) { const response = await fetchDistributionPanelData(capture, () => request(requestParams(page, perPage))); if (response === null) return null; return { rows: response[rowsKey] || [], meta: response.meta || response.pagination || { current_page: page, last_page: 1, total: 0 } }; }
export const recipientStatusView = recipient => { const status = recipientStatus(recipient); return { status, color: status === 'available' || status === 'downloaded' ? 'success' : 'default' }; };
export const userDistributionController = () => {
    let mounted = true; let requestGeneration = 0; let owner = null;
    return {
        capture() { const token = ++requestGeneration; return { valid: () => mounted && token === requestGeneration }; },
        begin() { if (!mounted || owner) return null; owner = Symbol('recipient-action'); const actionOwner = owner; return { valid: () => mounted && owner === actionOwner, owner: actionOwner }; },
        release(capture) { if (capture?.owner !== owner) return false; const valid = capture.valid(); owner = null; return valid; },
        close() { mounted = false; requestGeneration++; owner = null; },
    };
};
export async function runRecipientAction({ capture, action, refresh, onSuccess, onError, formatError }) {
    try {
        const result = await action(); if (!capture.valid()) return false;
        if (refresh) await refresh(); if (!capture.valid()) return false;
        if (onSuccess) onSuccess(result); return true;
    } catch (error) {
        if (!capture.valid()) return false;
        const formatted = await formatError(error); if (capture.valid()) await onError(error, formatted); return false;
    }
}
export const distributionRecipientStatus = (recipient, distribution) => recipientStatus({ ...recipient, availability_status: distribution?.status === 'closed' || distribution?.status === 'withdrawn' ? 'withdrawn' : recipient.availability_status, expires_at: distribution?.expires_at ?? recipient.expires_at });
export async function runControlledPageRefresh({ capture, refresh, onError, formatError }) { try { return await refresh(); } catch (error) { if (capture.valid()) { const formatted = await formatError(error); if (capture.valid()) onError(formatted.message); } return null; } }
export const exactDistributionSource = distribution => {
    const source = distribution?.source_file;
    return distribution?.source_file_id && source?.file_id === distribution.source_file_id && source?.version_number && source?.display_filename ? { source_file_id: source.file_id, version_number: source.version_number, filename: source.display_filename } : null;
};
export async function runDistributionMutation({ capture, mutate, refresh, onSuccess, onPartial, onError, formatError }) {
    try {
        const result = await mutate();
        if (result === false || result == null || !capture.valid()) return false;
        onSuccess();
        try { await refresh(); } catch { if (capture.valid()) onPartial(); }
        return capture.valid();
    } catch (error) {
        if (!capture.valid()) return false;
        const formatted = await formatError(error);
        if (capture.valid()) onError(error, formatted);
        return false;
    }
}

export async function runAuthoritativePublish({ capture, distributionId, fetchDistribution, fetchTargets, confirm, publish, refresh, onStale, onError, formatError }) {
    try {
        const [distribution, targets] = await Promise.all([fetchDistribution(distributionId), fetchTargets(distributionId)]); if (!capture.valid()) return false;
        const source = exactDistributionSource(distribution); if (!source || !targets?.updated_at || !targets?.target_fingerprint || !confirm(source)) return false;
        const result = await publish(distributionId, { source_file_id: source.source_file_id, expected_updated_at: targets.updated_at, target_fingerprint: targets.target_fingerprint }); if (!capture.valid()) return false;
        await refresh(); return result || true;
    } catch (error) {
        if (!capture.valid()) return false;
        if (error?.response?.status === 409) {
            await refresh();
            if (capture.valid()) onStale();
        }
        throw error;
    }
}

export const distributionPanelController = (isCurrent = () => true) => {
    let archiveId = null; let generation = 0; let mounted = true; let owner = null; const requests = new Map();
    const valid = capture => mounted && capture.generation === generation && capture.archiveId === archiveId && isCurrent(capture.archiveId) && requests.get(capture.kind) === capture.token;
    return {
        select(id) { archiveId = String(id); generation++; owner = null; requests.clear(); return generation; },
        capture(kind) { const capture = { archiveId, generation, kind, token: Symbol(kind) }; requests.set(kind, capture.token); return Object.freeze({ ...capture, valid: () => valid(capture) }); },
        beginAction() { if (owner || !mounted || !isCurrent(archiveId)) return null; owner = Symbol('distribution-action'); const capture = this.capture('action'); const actionOwner = owner; return Object.freeze({ ...capture, owner: actionOwner, valid: () => owner === actionOwner && valid(capture) }); },
        release(capture) { if (capture?.owner !== owner) return false; const wasValid = capture.valid(); owner = null; return wasValid; },
        current(id) { return mounted && archiveId === String(id) && isCurrent(archiveId); },
        close() { mounted = false; generation++; owner = null; requests.clear(); },
        busy() { return owner !== null; },
    };
};

export const fetchDistributionPanelData = async (capture, request) => {
    const data = await request();
    return capture.valid() ? data : null;
};

export const versionUploadPayload = (file, reason) => {
    if (!file || !reason?.trim()) return null;
    const data = new FormData();
    data.append('file', file);
    data.append('reason', reason.trim());
    return data;
};

export async function runVersionUpload({ busy, lock, lifecycle, file, reason, upload, refreshDetail, refreshHistory, fileInput, onBusy, onProgress, onSuccess, onPartialSuccess, onError, formatError }) {
    const active = () => !lifecycle || lifecycle.valid();
    if (busy || lock?.current || !active()) return false;
    const payload = versionUploadPayload(file, reason);
    if (!payload) { if (active()) onError('File dan alasan perubahan wajib diisi.'); return false; }
    if (lock) lock.current = true;
    if (active()) { onBusy(true); onProgress(0); onError(''); }
    let uploaded = false;
    try {
        await upload(payload, event => { const percent = uploadPercent(event); if (active() && percent !== null) onProgress(percent); });
        uploaded = true;
        if (!active()) return false;
        clearNativeFileInput(fileInput);
        await Promise.all([refreshDetail(), refreshHistory(1)]);
        if (active()) onSuccess();
        return active();
    } catch (error) {
        if (!active()) return false;
        const formatted = formatError ? await formatError(error) : error;
        if (!active()) return false;
        if (uploaded && onPartialSuccess) onPartialSuccess(formatted);
        else onError(formatted);
        return false;
    } finally {
        if (lock) lock.current = false;
        if (active()) { onProgress(null); onBusy(false); }
    }
}

export const compactQuery = query => Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined));
export const trashRequest = (page, perPage, filters = {}) => compactQuery({
    page,
    per_page: perPage,
    search: filters.search,
    unit_id: filters.unit_id,
    document_year: filters.document_year,
    sort: filters.sort && filters.sort !== 'deleted_at' ? filters.sort : undefined,
    direction: filters.direction && filters.direction !== 'desc' ? filters.direction : undefined,
});
export const timelineView = ({ initialLoading, pageLoading, error, rows }) => initialLoading ? 'loading' : error ? 'error' : rows.length ? (pageLoading ? 'page-loading' : 'rows') : 'empty';
export const timelineRequest = (page, perPage = 10) => ({ page, per_page: perPage });
export const timelineRequestController = () => {
    let selectedArchiveId = null;
    let sequence = requestSequence();
    return {
        select(archiveId) { sequence.invalidate(); selectedArchiveId = String(archiveId); sequence = requestSequence(); return sequence; },
        capture(archiveId) { const captured = sequence; const token = captured.next(); const selected = String(archiveId); return { valid: () => selectedArchiveId === selected && captured.valid(token) }; },
        close() { sequence.invalidate(); selectedArchiveId = null; },
    };
};
export const safeTimelineItem = item => ({
    audit_log_id: item?.audit_log_id,
    label: typeof item?.label === 'string' ? item.label : 'Aktivitas arsip',
    actor_display_name: typeof item?.actor_display_name === 'string' && item.actor_display_name.trim() ? item.actor_display_name.trim() : null,
    occurred_at: typeof item?.occurred_at === 'string' ? item.occurred_at : null,
    reason: typeof item?.reason === 'string' ? item.reason : null,
    changed_fields: Array.isArray(item?.changed_fields) ? item.changed_fields.filter(value => typeof value === 'string') : [],
});
export async function runLifecycleAction({ lock, lifecycle, action, refresh, navigate, onError, formatError }) {
    if (lock.current || (lifecycle && !lifecycle.valid())) return false;
    const owner = Symbol('lifecycle-action');
    lock.current = true;
    lock.owner = owner;
    const active = () => lock.current && lock.owner === owner && (!lifecycle || lifecycle.valid());
    try {
        await action();
        if (!active()) return false;
        if (refresh) await refresh();
        if (!active()) return false;
        if (navigate) navigate();
        return true;
    } catch (error) {
        if (!active()) return false;
        const formatted = await formatError(error);
        if (active()) onError(formatted.message);
        return false;
    } finally {
        if (lock.owner === owner) { lock.current = false; delete lock.owner; }
    }
}

export async function runArchiveDelete({ lock, lifecycle, reason, archiveId, currentArchiveId, displayedArchiveId, action, navigate, onError, formatError }) {
    const trimmedReason = reason?.trim();
    if (!trimmedReason || !routeActionAllowed(lifecycle, currentArchiveId, displayedArchiveId)) return false;
    return runLifecycleAction({ lock, lifecycle, action: () => action(archiveId, trimmedReason), navigate, onError, formatError });
}

export const restoreDialogController = lifecycle => {
    let generation = 0; let selectedId = null;
    return {
        select(id) { selectedId = String(id); generation++; return generation; },
        close() { selectedId = null; generation++; },
        capture(id) { const capturedGeneration = generation; const capturedId = String(id); return { valid: () => lifecycle.valid() && generation === capturedGeneration && selectedId === capturedId }; },
    };
};

export const requestSequence = () => {
    let current = 0; let mounted = true;
    return { next: () => ++current, valid: sequence => mounted && sequence === current, invalidate: () => { mounted = false; current++; } };
};

export const routeLifecycle = (archiveId, isCurrent = () => true) => {
    let active = true;
    return Object.freeze({ archiveId, valid: () => active && isCurrent(archiveId), invalidate: () => { active = false; } });
};

export const routeActionAllowed = (lifecycle, currentArchiveId, displayedArchiveId) => lifecycle?.valid() && String(lifecycle.archiveId) === String(currentArchiveId) && String(displayedArchiveId) === String(currentArchiveId);

export const institutionalArchiveRouteReset = () => ({ saving: false, downloading: false, versionProgress: null, versions: [], versionPage: 1, versionPages: 1, historyInitialLoading: true, historyPageLoading: false, historyError: '', archive: null, form: {}, success: '', error: '', refreshWarning: '', versionFile: null, reason: '' });

export async function runExactVersionDownload({ lifecycle, currentArchiveId, displayedArchiveId, download, archiveId, version, onError, formatError }) {
    if (!routeActionAllowed(lifecycle, currentArchiveId(), displayedArchiveId())) return false;
    try { await exactVersionDownload(download, archiveId, version); return true; }
    catch (error) { if (routeActionAllowed(lifecycle, currentArchiveId(), displayedArchiveId())) onError((await formatError(error)).message); return false; }
}

export const versionHistoryView = ({ initialLoading, pageLoading, error, rows }) => initialLoading ? 'loading' : error ? 'error' : rows.length ? (pageLoading ? 'page-loading' : 'rows') : 'empty';

export async function retryVersionRefresh({ lock, lifecycle, refreshDetail, refreshHistory, onSuccess, onError }) {
    if (lock?.current || (lifecycle && !lifecycle.valid())) return false;
    if (lock) lock.current = true;
    try { await Promise.all([refreshDetail(), refreshHistory(1)]); if (!lifecycle || lifecycle.valid()) onSuccess(); return !lifecycle || lifecycle.valid(); }
    catch (error) { if (!lifecycle || lifecycle.valid()) onError(error); return false; }
    finally { if (lock) lock.current = false; }
}

export const archivePaginationTransition = (model, currentPageSize) => {
    const pageSizeChanged = model.pageSize !== currentPageSize;
    return { page: pageSizeChanged ? 1 : model.page + 1, pageSize: model.pageSize };
};

export const archiveFilterTransition = (filters, pageSize, appliedFilters) => ({
    page: 1,
    pageSize,
    filters: { ...filters, sort: appliedFilters.sort, direction: appliedFilters.direction },
});

const archiveSortFields = { title: 'title', document_date: 'document_date', size: 'file_size' };
export const archiveSortTransition = sortModel => {
    const item = sortModel[0];
    return { page: 1, sortModel: item ? [item] : [], filters: { sort: archiveSortFields[item?.field] || 'created_at', direction: item?.sort || 'desc' } };
};

export const archiveTableView = ({ loading, error, rows }) => loading ? 'loading' : error ? 'error' : rows.length ? 'rows' : 'empty';

export const institutionalArchiveTableController = {
    pagination(model, currentPageSize, filters) {
        const state = archivePaginationTransition(model, currentPageSize);
        return { state, request: { page: state.page, per_page: state.pageSize, ...filters } };
    },
    filter(filters, pageSize, appliedFilters) {
        const state = archiveFilterTransition(filters, pageSize, appliedFilters);
        return { state, request: { page: state.page, per_page: state.pageSize, ...state.filters } };
    },
    sort(sortModel, pageSize, appliedFilters) {
        const transition = archiveSortTransition(sortModel);
        const filters = { ...appliedFilters, ...transition.filters };
        const state = { ...transition, pageSize, filters };
        return { state, request: { page: state.page, per_page: pageSize, ...filters } };
    },
    upload(pageSize, filters) {
        return { state: { page: 1, pageSize }, request: { page: 1, per_page: pageSize, ...filters } };
    },
    view(input) {
        return { state: archiveTableView(input), props: { loading: input.loading, rows: input.rows, paginationMode: 'server', sortingMode: 'server', toolbar: false } };
    },
};

export async function runDownload(download, onError, formatError) {
    try {
        await download();
    } catch (error) {
        onError((await formatError(error)).message);
        return false;
    }
    return true;
}

export async function runPreview(openWindow, fetchBlob, urlApi, onError, formatError, schedule = setTimeout, lifecycle) {
    const previewWindow = openWindow('', '_blank');
    if (!previewWindow) {
        onError('Popup preview diblokir. Izinkan popup lalu coba lagi.');
        return false;
    }

    let url;
    try {
        previewWindow.opener = null;
        previewWindow.document.write('<!doctype html><title>Memuat preview</title><p>Memuat preview arsip...</p>');
        previewWindow.document.close();
        const blob = await fetchBlob();
        if (lifecycle && !lifecycle.valid()) { previewWindow.close(); return false; }
        url = urlApi.createObjectURL(blob);
        previewWindow.location.replace(url);
        let revoked = false; const revoke = () => { if (!revoked) { revoked = true; urlApi.revokeObjectURL(url); } };
        schedule(revoke, 60000);
    } catch (error) {
        if (url) urlApi.revokeObjectURL(url);
        previewWindow.close();
        if (lifecycle && !lifecycle.valid()) return false;
        onError((await formatError(error)).message);
        return false;
    }
    return true;
}
