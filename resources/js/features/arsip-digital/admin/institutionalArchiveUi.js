export const uploadPercent = event => event?.total > 0 ? Math.min(100, Math.round((event.loaded * 100) / event.total)) : null;
export const validationErrors = formatted => formatted?.errors || {};

export async function runDownload(download, onError, formatError) {
    try {
        await download();
    } catch (error) {
        onError((await formatError(error)).message);
        return false;
    }
    return true;
}
