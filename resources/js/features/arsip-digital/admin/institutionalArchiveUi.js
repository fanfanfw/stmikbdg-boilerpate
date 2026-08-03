export const uploadPercent = event => event?.total > 0 ? Math.min(100, Math.round((event.loaded * 100) / event.total)) : null;
export const validationErrors = formatted => formatted?.errors || {};
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
export const recipientPageRequest = page => ({ page, per_page: 25 });
export const recipientStatus = recipient => recipient.download_count > 0 ? 'downloaded' : recipient.delivery_status;

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
    actor_user_id: Number.isInteger(item?.actor_user_id) ? item.actor_user_id : null,
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

export async function runPreview(openWindow, fetchBlob, urlApi, onError, formatError, schedule = setTimeout) {
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
        url = urlApi.createObjectURL(blob);
        previewWindow.location.replace(url);
        schedule(() => urlApi.revokeObjectURL(url), 60000);
    } catch (error) {
        if (url) urlApi.revokeObjectURL(url);
        previewWindow.close();
        onError((await formatError(error)).message);
        return false;
    }
    return true;
}
