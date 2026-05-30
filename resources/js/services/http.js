import axios from 'axios';

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

const client = axios.create({
    baseURL: '/arsip-digital/proxy',
    headers: {
        Accept: 'application/json',
        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
    },
});

function unwrap(response) {
    return response.data?.data ?? response.data ?? {};
}

function cleanParams(params = {}) {
    return Object.fromEntries(
        Object.entries(params)
            .filter(([, value]) => value !== '' && value !== null && value !== undefined)
            .map(([key, value]) => [key, typeof value === 'boolean' ? Number(value) : value]),
    );
}

function messageFrom(error) {
    const data = error.response?.data;

    if (data?.message) return data.message;
    if (data?.errors) return Object.values(data.errors).flat().join(' ');

    return error.message || 'Request gagal diproses.';
}

export async function get(path, params = {}) {
    return unwrap(await client.get(path, { params: cleanParams(params) }));
}

export async function post(path, payload = {}) {
    return unwrap(await client.post(path, payload));
}

export async function put(path, payload = {}) {
    return unwrap(await client.put(path, payload));
}

export async function destroy(path, payload = {}) {
    return unwrap(await client.delete(path, { data: payload }));
}

export async function upload(path, formData) {
    return unwrap(await client.post(path, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }));
}

export async function download(path, filename) {
    const response = await client.get(path, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename || 'arsip-digital-download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function toErrorMessage(error) {
    return messageFrom(error);
}

export default client;
