import axios from 'axios';

// --------------------------------------------------------------------------
// Arsip Digital HTTP Helper
// Base URL: /arsip-digital/proxy (Laravel proxy pattern, same as existing Vue)
// CSRF token from meta[name="csrf-token"]
// --------------------------------------------------------------------------

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

const client = axios.create({
    baseURL: '/arsip-digital/proxy',
    timeout: 30000,
    headers: {
        Accept: 'application/json',
        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
    },
});

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function cleanParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params)
            .filter(([, value]) => value !== '' && value !== null && value !== undefined)
            .map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value]),
    );
}

// --------------------------------------------------------------------------
// Response normalizer
// --------------------------------------------------------------------------

/**
 * Normalize backend response to consistent shape:
 *   { success: true, data, message }
 * or on error:
 *   { success: false, message, errors, status }
 */
export function normalizeArsipResponse(response) {
    const raw = response.data;

    if (raw?.status === 'success' || raw?.success === true) {
        return {
            success: true,
            data: raw.data ?? raw,
            message: raw.message || null,
        };
    }

    // Some endpoints return data directly without wrapper
    if (raw && raw.status === undefined && raw.success === undefined && !raw.message && !raw.errors) {
        return {
            success: true,
            data: raw.data ?? raw,
            message: null,
        };
    }

    throw {
        response: {
            status: response.status,
            data: {
                message: raw?.message || 'Permintaan gagal.',
                errors: raw?.errors || null,
            },
        },
    };
}

// --------------------------------------------------------------------------
// Error formatter
// --------------------------------------------------------------------------

/**
 * Format axios error into a user-friendly object.
 * Handles 401, 403, 422, 500, ECONNABORTED, network error, blob error.
 */
export async function formatArsipError(error) {
    const status = error.response?.status;
    let data = error.response?.data;

    // Blob error: try to parse blob as JSON
    if (data instanceof Blob) {
        try {
            const text = await data.text();
            data = JSON.parse(text);
        } catch {
            data = null;
        }
    }

    // 401 - Session expired, redirect to logout
    if (status === 401) {
        window.location.href = '/logout';
        return {
            success: false,
            message: 'Sesi berakhir. Mengarahkan ke halaman login...',
            errors: null,
            status: 401,
        };
    }

    // 403 - Access denied
    if (status === 403) {
        return {
            success: false,
            message: data?.message || 'Akses ditolak.',
            errors: null,
            status: 403,
        };
    }

    // 422 - Validation errors
    if (status === 422) {
        const errors = data?.errors || null;
        const message = data?.message
            || (errors ? Object.values(errors).flat().join(' ') : 'Data tidak valid.');
        return {
            success: false,
            message,
            errors,
            status: 422,
        };
    }

    if (status === 429) {
        const retryAfter = Number(error.response?.headers?.['retry-after']);
        return {
            success: false,
            message: Number.isFinite(retryAfter) && retryAfter > 0
                ? `Terlalu banyak permintaan. Silakan coba lagi dalam ${Math.ceil(retryAfter)} detik.`
                : 'Terlalu banyak permintaan. Tunggu beberapa saat, lalu coba lagi.',
            errors: null,
            status: 429,
        };
    }

    // 413 - Upload too large for PHP/web server limits
    if (status === 413) {
        return {
            success: false,
            message: 'Ukuran file melebihi batas server. Naikkan post_max_size/upload_max_filesize di PHP atau kecilkan batas upload aplikasi.',
            errors: null,
            status: 413,
        };
    }

    // 500 - Server error
    if (status === 500) {
        return {
            success: false,
            message: data?.message || 'Terjadi kesalahan pada server.',
            errors: null,
            status: 500,
        };
    }

    // Timeout
    if (error.code === 'ECONNABORTED') {
        return {
            success: false,
            message: 'Permintaan melebihi batas waktu. Silakan coba lagi.',
            errors: null,
            status: null,
        };
    }

    // Network error
    if (error.message === 'Network Error' || !error.response) {
        return {
            success: false,
            message: 'Koneksi gagal. Periksa jaringan Anda.',
            errors: null,
            status: null,
        };
    }

    // Fallback
    return {
        success: false,
        message: data?.message || error.message || 'Permintaan gagal diproses.',
        errors: data?.errors || null,
        status: status || null,
    };
}

// --------------------------------------------------------------------------
// Request methods
// --------------------------------------------------------------------------

async function retryGet(request, attempts = 3) {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await request();
        } catch (error) {
            const status = error.response?.status;
            if (attempt >= attempts - 1 || error.response && ![502, 503, 504].includes(status)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
        }
    }
}

export async function getJson(path, params = {}, options = {}) {
    const response = await retryGet(() => client.get(path, {
        params: cleanParams(params),
        ...options,
    }));
    return normalizeArsipResponse(response);
}

export async function postJson(path, payload = {}, options = {}) {
    const response = await client.post(path, payload, options);
    return normalizeArsipResponse(response);
}

export async function putJson(path, payload = {}, options = {}) {
    const response = await client.put(path, payload, options);
    return normalizeArsipResponse(response);
}

export async function deleteJson(path, payload = {}, options = {}) {
    const response = await client.delete(path, { data: payload, ...options });
    return normalizeArsipResponse(response);
}

export async function uploadFormData(path, formData, options = {}) {
    // Do NOT set Content-Type manually - let axios/browser set boundary
    const response = await client.post(path, formData, {
        timeout: 120_000,
        ...options,
    });
    return normalizeArsipResponse(response);
}

export async function postBlob(path, payload, options = {}) {
    const response = await client.post(path, payload, {
        responseType: 'blob',
        timeout: 120_000,
        ...options,
    });

    return response.data;
}

export async function getBlob(path, options = {}) {
    const response = await retryGet(() => client.get(path, {
        responseType: 'blob',
        timeout: 120_000,
        ...options,
    }));
    return response.data;
}

export async function downloadBlob(path, filename, options = {}) {
    const response = await client.get(path, {
        responseType: 'blob',
        timeout: 120_000,
        ...options,
    });

    const blob = response.data;
    if (!(blob instanceof Blob) || blob.size === 0) {
        throw { response: { status: response.status, data: { message: 'File unduhan kosong atau tidak valid.' } } };
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'arsip-digital-download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, data: null, message: null };
}

export default client;
