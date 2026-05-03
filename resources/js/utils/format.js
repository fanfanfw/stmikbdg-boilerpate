export function dateTime(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
}

export function bytes(value) {
    if (!value) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = Number(value);
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function lines(value) {
    return String(value || '')
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function jsonLines(value, mapper) {
    return lines(value).map(mapper);
}

export function firstArray(data, keys) {
    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
}
