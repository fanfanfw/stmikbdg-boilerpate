export const uploadPercent = event => event?.total > 0 ? Math.min(100, Math.round((event.loaded * 100) / event.total)) : null;
export const validationErrors = formatted => formatted?.errors || {};

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
