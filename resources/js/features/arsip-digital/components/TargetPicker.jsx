import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { useTargetPicker } from '../hooks/useTargetPicker';
import {
    Alert,
    Button,
    Checkbox,
    MenuItem,
    TextField,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';

const buttonSx = {
    borderRadius: '0.5rem',
    textTransform: 'none',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
};

const defaultFilters = {
    search: '',
    angkatan: '',
    status: '',
    has_account: '',
    page: 1,
    per_page: 25,
};

function csv(value) {
    return [...new Set(String(value || '')
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean))];
}

function statuses(value) {
    return [...new Set(csv(value).map((item) => {
        const normalized = item.toLowerCase();
        return ['active', 'inactive'].includes(normalized) ? normalized : item.toUpperCase();
    }))];
}

function normalizeIdentifier(target) {
    return String(target?.identifier ?? target?.id ?? '').trim();
}

function unwrapTargets(response) {
    const data = response?.data ?? response ?? {};
    const direct = Array.isArray(data) ? data : null;
    const targets = direct ?? data.targets ?? data.data ?? [];
    return {
        data: Array.isArray(targets) ? targets : [],
        meta: data.meta ?? data.pagination ?? response?.meta ?? null,
    };
}

function metaTotal(meta) {
    return Number(meta?.total ?? meta?.count ?? meta?.total_targets ?? 0);
}

function normalizeInitialFilters(value, role) {
    const targetFilters = value?.target_filters || {};
    const studentStatus = statuses(targetFilters.student_status || targetFilters.status);
    return {
        ...defaultFilters,
        angkatan: role === 'mahasiswa' ? csv(targetFilters.angkatan).join(', ') : '',
        status: studentStatus.join(', '),
        has_account: targetFilters.has_account === true ? '1' : '',
    };
}

function targetQueryKey(filters) {
    return JSON.stringify(filters);
}

function controlledValueFingerprint(value, initialRole) {
    return JSON.stringify({
        target_role: ['mahasiswa', 'dosen'].includes(value?.target_role) ? value.target_role : initialRole,
        scope_type: value?.scope_type === 'specific' ? 'specific' : 'filter',
        target_identifiers: Array.isArray(value?.target_identifiers) ? value.target_identifiers.map(String) : [],
    });
}

const TargetRow = memo(function TargetRow({ target, role, selected, invalid, invalidReason, disabled, onToggle }) {
    const identifier = normalizeIdentifier(target);

    return (
        <tr className={invalid ? 'bg-red-50' : selected ? 'bg-blue-50' : 'bg-white'}>
            <td className="px-3 py-2"><Checkbox size="small" checked={selected} disabled={disabled} onChange={() => onToggle(identifier)} /></td>
            <td className="px-3 py-2 font-semibold text-zinc-800">{identifier || '-'}</td>
            <td className="px-3 py-2 text-zinc-700">{target.name || target.name_snapshot || '-'}</td>
            {role === 'mahasiswa' && <td className="px-3 py-2 text-zinc-700">{target.angkatan || target.angkatan_snapshot || '-'}</td>}
            <td className="px-3 py-2 text-zinc-700">{invalid ? invalidReason : target.status || target.status_snapshot || '-'}</td>
            <td className="px-3 py-2 text-zinc-700">{target.has_account === false ? 'Tidak' : 'Ya'}</td>
        </tr>
    );
});

function buildPayload(role, mode, filters, selectedIdentifiers) {
    const targetFilters = {};

    if (mode === 'filter') {
        const angkatan = csv(filters.angkatan);
        const status = statuses(filters.status);

        if (role === 'mahasiswa' && angkatan.length) targetFilters.angkatan = angkatan;
        if (status.length) targetFilters.student_status = status;
        if (filters.has_account === '1') targetFilters.has_account = true;
    }

    return {
        target_role: role,
        scope_type: mode === 'specific' ? 'specific' : 'filter',
        target_filters: mode === 'filter' ? targetFilters : {},
        target_identifiers: mode === 'specific' ? selectedIdentifiers : [],
    };
}

function TargetPicker({ value, onChange, initialRole = 'mahasiswa', disabled = false, invalidTargets = [] }) {
    const [initialized, setInitialized] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
    const roleRef = useRef(initialRole);
    const requestSequenceRef = useRef(0);
    const controlledValueFingerprintRef = useRef(null);
    const pendingControlledFingerprintRef = useRef(null);

    const fetchTargets = useCallback(async (filters, page = filters?.page || 1) => {
        const role = roleRef.current || initialRole;
        const query = {
            role,
            search: filters.search,
            angkatan: role === 'mahasiswa' ? csv(filters.angkatan) : [],
            status: statuses(filters.status),
            has_account: filters.has_account === '' ? undefined : filters.has_account === '1',
            page,
            per_page: filters.per_page || 25,
        };
        const response = await arsipApi.adminTargets(query);
        return unwrapTargets(response);
    }, [initialRole]);

    const picker = useTargetPicker({ fetchTargets });
    const {
        state,
        dispatch,
        setRole,
        setMode,
        setFilters,
        setTargets,
        setLoading,
        setError,
        toggleIdentifier,
        clearSelection,
    } = picker;

    const role = state.role || initialRole || 'mahasiswa';
    roleRef.current = role;
    const filters = { ...defaultFilters, ...state.filters };
    const selectedIdentifiers = state.selectedIdentifiers;
    const selectedIdentifierSet = useMemo(() => new Set(selectedIdentifiers), [selectedIdentifiers]);
    const invalidIdentifiers = useMemo(
        () => new Set((invalidTargets || []).map((target) => String(target.identifier || '').trim()).filter(Boolean)),
        [invalidTargets],
    );
    const invalidReasonByIdentifier = useMemo(
        () => Object.fromEntries((invalidTargets || []).map((target) => [String(target.identifier || '').trim(), target.reason || 'Target invalid.'])),
        [invalidTargets],
    );
    const currentPage = Number(state.targetMeta?.current_page ?? filters.page ?? 1);
    const lastPage = Number(state.targetMeta?.last_page ?? 1);
    const hasTargetMeta = Boolean(state.targetMeta);
    const total = hasTargetMeta ? metaTotal(state.targetMeta) : state.targets.length;
    const currentQueryKey = targetQueryKey(filters);
    const canSelectAllFiltered = currentQueryKey === state.loadedTargetQueryKey;
    const pageIdentifiers = state.targets.map(normalizeIdentifier).filter(Boolean);
    const selectablePageIdentifiers = pageIdentifiers;
    const allPageSelected = selectablePageIdentifiers.length > 0
        && selectablePageIdentifiers.every((identifier) => selectedIdentifierSet.has(identifier));

    const payload = useMemo(
        () => buildPayload(role, state.mode, appliedFilters, selectedIdentifiers),
        [role, state.mode, appliedFilters, selectedIdentifiers],
    );

    useEffect(() => {
        if (initialized) return;
        const nextRole = ['mahasiswa', 'dosen'].includes(value?.target_role) ? value.target_role : initialRole;
        setRole(nextRole);
        setMode(value?.scope_type === 'specific' ? 'specific' : 'filter');
        const initialFilters = normalizeInitialFilters(value, nextRole);
        setFilters(initialFilters);
        setAppliedFilters(initialFilters);
        if (Array.isArray(value?.target_identifiers)) {
            dispatch({ type: 'SELECT_ALL_FILTERED', payload: value.target_identifiers.map(String) });
        }
        controlledValueFingerprintRef.current = controlledValueFingerprint(value, initialRole);
        setInitialized(true);
    }, [dispatch, initialRole, initialized, setFilters, setMode, setRole, value]);

    useEffect(() => {
        if (!initialized) return;
        const nextFingerprint = controlledValueFingerprint(value, initialRole);
        if (nextFingerprint === controlledValueFingerprintRef.current) return;
        controlledValueFingerprintRef.current = nextFingerprint;
        pendingControlledFingerprintRef.current = nextFingerprint;
        const nextRole = ['mahasiswa', 'dosen'].includes(value?.target_role) ? value.target_role : initialRole;
        setRole(nextRole);
        setMode(value?.scope_type === 'specific' ? 'specific' : 'filter');
        dispatch({
            type: 'SELECT_ALL_FILTERED',
            payload: Array.isArray(value?.target_identifiers) ? value.target_identifiers.map(String) : [],
        });
    }, [dispatch, initialRole, initialized, setMode, setRole, value]);

    useEffect(() => {
        if (!initialized) return;
        const nextFingerprint = controlledValueFingerprint(payload, initialRole);
        if (pendingControlledFingerprintRef.current) {
            if (nextFingerprint !== pendingControlledFingerprintRef.current) return;
            pendingControlledFingerprintRef.current = null;
        }
        controlledValueFingerprintRef.current = nextFingerprint;
        startTransition(() => onChange?.(payload));
    }, [initialRole, initialized, onChange, payload]);

    const loadTargets = async (page = 1) => {
        const requestSequence = ++requestSequenceRef.current;
        setLoading(true);
        setError(null);
        const nextFilters = { ...filters, page };
        const requestedRole = role;
        setFilters(nextFilters);
        try {
            const response = await arsipApi.adminTargets({
                role: requestedRole,
                search: nextFilters.search,
                angkatan: requestedRole === 'mahasiswa' ? csv(nextFilters.angkatan) : [],
                status: statuses(nextFilters.status),
                has_account: nextFilters.has_account === '' ? undefined : nextFilters.has_account === '1',
                page,
                per_page: nextFilters.per_page,
            });
            if (requestSequence !== requestSequenceRef.current || requestedRole !== roleRef.current) return;
            const unwrapped = unwrapTargets(response);
            setTargets(unwrapped.data, unwrapped.meta, targetQueryKey(nextFilters));
            setAppliedFilters(nextFilters);
        } catch (err) {
            if (requestSequence !== requestSequenceRef.current) return;
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        }
    };

    useEffect(() => {
        if (initialized) loadTargets(1);
    }, [initialized, role]);

    const handleRoleChange = (nextRole) => {
        requestSequenceRef.current += 1;
        setLoading(false);
        setRole(nextRole);
        setMode('filter');
        const nextFilters = { ...defaultFilters, angkatan: nextRole === 'mahasiswa' ? filters.angkatan : '' };
        setFilters(nextFilters);
        setAppliedFilters(nextFilters);
    };

    const handleFilterChange = (key, nextValue) => {
        requestSequenceRef.current += 1;
        setLoading(false);
        setFilters({ ...filters, [key]: nextValue, page: 1 });
    };

    const togglePage = (checked) => {
        setMode('specific');
        if (checked) {
            const merged = Array.from(new Set([...selectedIdentifiers, ...selectablePageIdentifiers]));
            dispatch({ type: 'SELECT_ALL_FILTERED', payload: merged });
            return;
        }
        dispatch({ type: 'SELECT_ALL_FILTERED', payload: selectedIdentifiers.filter((identifier) => !pageIdentifiers.includes(identifier)) });
    };

    const handleToggleIdentifier = useCallback((identifier) => {
        setMode('specific');
        toggleIdentifier(identifier);
    }, [setMode, toggleIdentifier]);

    const handleClearSelection = () => {
        setMode('specific');
        clearSelection();
    };

    const handleSelectAllFiltered = () => {
        if (!canSelectAllFiltered) return;
        setMode('filter');
        clearSelection();
    };

    return (
        <section className="bg-white rounded-lg border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Target penerima</p>
                    <h3 className="text-sm font-semibold text-zinc-800 mt-1">Pilih target request</h3>
                    <p className="text-xs text-zinc-500 mt-1">Gunakan filter untuk target massal, atau centang baris untuk target spesifik.</p>
                </div>
                <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
                    {['mahasiswa', 'dosen'].map((item) => (
                        <button
                            key={item}
                            type="button"
                            disabled={disabled}
                            onClick={() => handleRoleChange(item)}
                            className={`px-3 py-2 text-xs font-semibold capitalize ${role === item ? 'bg-blue-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <TextField size="small" label="Cari" value={filters.search} disabled={disabled} onChange={(event) => handleFilterChange('search', event.target.value)} InputProps={{ startAdornment: <SearchOutlined sx={{ color: '#a1a1aa', mr: 1, fontSize: 18 }} /> }} />
                {role === 'mahasiswa' && (
                    <TextField size="small" label="Angkatan" value={filters.angkatan} disabled={disabled} onChange={(event) => handleFilterChange('angkatan', event.target.value)} placeholder="2022, 2023" />
                )}
                <TextField size="small" label="Status" value={filters.status} disabled={disabled} onChange={(event) => handleFilterChange('status', event.target.value)} placeholder="A, C, TA" />
                <TextField size="small" select label="Akun" value={filters.has_account} disabled={disabled} onChange={(event) => handleFilterChange('has_account', event.target.value)}>
                    <MenuItem value="">Semua</MenuItem>
                    <MenuItem value="1">Punya akun</MenuItem>
                </TextField>
                <Button variant="contained" disabled={disabled || state.loading} onClick={() => loadTargets(1)} sx={{ ...buttonSx, backgroundColor: '#2563eb' }}>
                    Terapkan Filter
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3"><span className="text-xs text-zinc-500">Mode</span><strong className="block text-sm text-zinc-800 mt-1">{state.mode === 'specific' ? 'Target spesifik' : 'Filter'}</strong></div>
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3"><span className="text-xs text-zinc-500">Preview ditemukan</span><strong className="block text-sm text-zinc-800 mt-1">{total}</strong></div>
                <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3"><span className="text-xs text-zinc-500">Dipilih spesifik</span><strong className="block text-sm text-zinc-800 mt-1">{selectedIdentifiers.length}</strong></div>
            </div>

            {state.error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{String(state.error)}</Alert>}
            {!canSelectAllFiltered && <p className="text-xs text-amber-600 mb-2">Terapkan filter sebelum pilih semua hasil.</p>}

            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="text-xs text-zinc-500">Payload aktif: <strong className="text-zinc-700">{payload.scope_type}</strong> · {payload.target_role}</div>
                <div className="flex flex-wrap gap-2">
                    <Button size="small" variant="outlined" disabled={disabled || state.loading || total < 1 || !canSelectAllFiltered} onClick={handleSelectAllFiltered} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>
                        {hasTargetMeta ? `Gunakan filter ini (${total})` : `Gunakan hasil dimuat (${state.targets.length})`}
                    </Button>
                    <Button size="small" variant="outlined" disabled={disabled || selectablePageIdentifiers.length < 1} onClick={() => togglePage(true)} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>
                        Pilih halaman ini
                    </Button>
                    <Button size="small" disabled={disabled || selectedIdentifiers.length < 1} onClick={handleClearSelection} sx={buttonSx}>
                        Kosongkan
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                        <tr>
                            <th className="w-10 px-3 py-2 text-left"><Checkbox size="small" checked={allPageSelected} disabled={disabled || selectablePageIdentifiers.length < 1} onChange={(event) => togglePage(event.target.checked)} /></th>
                            <th className="px-3 py-2 text-left">Identifier</th>
                            <th className="px-3 py-2 text-left">Nama</th>
                            {role === 'mahasiswa' && <th className="px-3 py-2 text-left">Angkatan</th>}
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Akun</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {state.targets.map((target, index) => {
                            const identifier = normalizeIdentifier(target);
                            return (
                                <TargetRow
                                    key={`${identifier}-${index}`}
                                    target={target}
                                    role={role}
                                    selected={selectedIdentifierSet.has(identifier)}
                                    invalid={invalidIdentifiers.has(identifier)}
                                    invalidReason={invalidReasonByIdentifier[identifier]}
                                    disabled={disabled}
                                    onToggle={handleToggleIdentifier}
                                />
                            );
                        })}
                        {!state.loading && state.targets.length === 0 && (
                            <tr><td colSpan={role === 'mahasiswa' ? 6 : 5} className="px-3 py-8 text-center text-zinc-500">Belum ada target. Terapkan filter untuk memuat data.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap mt-3 text-xs text-zinc-500">
                <span>{hasTargetMeta ? `Halaman ${currentPage} dari ${lastPage} · ${total} data` : `Data dimuat: ${state.targets.length}`}</span>
                <div className="flex gap-2">
                    <Button size="small" variant="outlined" disabled={disabled || state.loading || currentPage <= 1} onClick={() => loadTargets(currentPage - 1)} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Sebelumnya</Button>
                    <Button size="small" variant="outlined" disabled={disabled || state.loading || currentPage >= lastPage} onClick={() => loadTargets(currentPage + 1)} sx={{ ...buttonSx, borderColor: '#e4e4e7', color: '#3f3f46' }}>Berikutnya</Button>
                </div>
            </div>
        </section>
    );
}

export default memo(TargetPicker);
