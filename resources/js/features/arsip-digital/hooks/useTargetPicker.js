import { useReducer, useCallback, useMemo, useRef } from 'react';

// --------------------------------------------------------------------------
// useTargetPicker - Skeleton TargetPicker hook using useReducer
// --------------------------------------------------------------------------

const initialState = {
    role: null,
    mode: 'filter', // 'filter' | 'specific'
    filters: {},
    targets: [],
    selectedIdentifiers: [],
    targetMeta: null,
    loadedTargetQueryKey: null,
    loading: false,
    error: null,
    selectingAllFiltered: false,
};

const SAFETY_MAX_PAGE = 10;

function reducer(state, action) {
    switch (action.type) {
        case 'SET_ROLE':
            return {
                ...state,
                role: action.payload,
                selectedIdentifiers: [],
                filters: {},
                targets: [],
                targetMeta: null,
                loadedTargetQueryKey: null,
                error: null,
                selectingAllFiltered: false,
            };

        case 'SET_MODE':
            return {
                ...state,
                mode: action.payload,
            };

        case 'SET_FILTERS':
            return {
                ...state,
                filters: action.payload,
                loadedTargetQueryKey: null,
                targetMeta: state.targetMeta
                    ? { ...state.targetMeta, current_page: 1 }
                    : null,
            };

        case 'SET_TARGETS':
            return {
                ...state,
                targets: action.payload.data,
                targetMeta: action.payload.meta || null,
                loadedTargetQueryKey: action.payload.queryKey || null,
                loading: false,
            };

        case 'TOGGLE_IDENTIFIER': {
            const id = action.payload;
            const exists = state.selectedIdentifiers.includes(id);
            return {
                ...state,
                selectedIdentifiers: exists
                    ? state.selectedIdentifiers.filter((i) => i !== id)
                    : [...state.selectedIdentifiers, id],
            };
        }

        case 'SELECT_ALL_FILTERED':
            return {
                ...state,
                selectedIdentifiers: action.payload,
                selectingAllFiltered: false,
            };

        case 'CLEAR_SELECTION':
            return {
                ...state,
                selectedIdentifiers: [],
                selectingAllFiltered: false,
            };

        case 'SET_LOADING':
            return {
                ...state,
                loading: action.payload,
            };

        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload,
                loading: false,
            };

        case 'SET_SELECTING_ALL_FILTERED':
            return {
                ...state,
                selectingAllFiltered: action.payload,
            };

        default:
            return state;
    }
}

/**
 * @param {Object} options
 * @param {function} options.fetchTargets - async (filters, page) => { data, meta }
 */
export function useTargetPicker({ fetchTargets } = {}) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const queryKeyRef = useRef(null);

    const setRole = useCallback((role) => {
        dispatch({ type: 'SET_ROLE', payload: role });
    }, []);

    const setMode = useCallback((mode) => {
        dispatch({ type: 'SET_MODE', payload: mode });
    }, []);

    const setFilters = useCallback((filters) => {
        queryKeyRef.current = JSON.stringify(filters);
        dispatch({ type: 'SET_FILTERS', payload: filters });
    }, []);

    const setTargets = useCallback((data, meta, queryKey) => {
        dispatch({ type: 'SET_TARGETS', payload: { data, meta, queryKey } });
    }, []);

    const toggleIdentifier = useCallback((id) => {
        dispatch({ type: 'TOGGLE_IDENTIFIER', payload: id });
    }, []);

    const clearSelection = useCallback(() => {
        dispatch({ type: 'CLEAR_SELECTION' });
    }, []);

    const setLoading = useCallback((loading) => {
        dispatch({ type: 'SET_LOADING', payload: loading });
    }, []);

    const setError = useCallback((error) => {
        dispatch({ type: 'SET_ERROR', payload: error });
    }, []);

    // Select all filtered targets across pages (only those with has_account === true)
    const selectAllFiltered = useCallback(async () => {
        if (!fetchTargets) return;

        dispatch({ type: 'SET_SELECTING_ALL_FILTERED', payload: true });
        const snapshotKey = queryKeyRef.current;
        const allIdentifiers = [];

        try {
            for (let page = 1; page <= SAFETY_MAX_PAGE; page++) {
                // Stop if filters changed during loop
                if (queryKeyRef.current !== snapshotKey) {
                    dispatch({ type: 'SET_SELECTING_ALL_FILTERED', payload: false });
                    return;
                }

                const result = await fetchTargets(state.filters, page);
                const targets = result?.data || [];

                for (const target of targets) {
                    if (target.has_account === true) {
                        const id = target.identifier || target.id;
                        if (id && !allIdentifiers.includes(id)) {
                            allIdentifiers.push(id);
                        }
                    }
                }

                const meta = result?.meta;
                if (!meta || page >= meta.last_page) break;
            }

            // Final check: filters may have changed
            if (queryKeyRef.current !== snapshotKey) {
                dispatch({ type: 'SET_SELECTING_ALL_FILTERED', payload: false });
                return;
            }

            dispatch({ type: 'SELECT_ALL_FILTERED', payload: allIdentifiers });
        } catch (err) {
            dispatch({ type: 'SET_ERROR', payload: err?.message || 'Gagal memuat semua target.' });
        }
    }, [fetchTargets, state.filters]);

    // Build payload for API submission
    const buildPayload = useCallback(() => {
        if (state.mode === 'filter') {
            return { target_filters: state.filters };
        }

        // mode === 'specific'
        return {
            target_filters: {},
            identifiers: state.selectedIdentifiers,
        };
    }, [state.mode, state.filters, state.selectedIdentifiers]);

    const selectionCount = useMemo(
        () => state.selectedIdentifiers.length,
        [state.selectedIdentifiers],
    );

    return {
        state,
        dispatch,
        setRole,
        setMode,
        setFilters,
        setTargets,
        toggleIdentifier,
        selectAllFiltered,
        clearSelection,
        setLoading,
        setError,
        buildPayload,
        selectionCount,
    };
}
