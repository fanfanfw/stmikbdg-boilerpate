import { memo, useMemo } from 'react';
import { DataGrid, GridToolbarColumnsButton, GridToolbarContainer, GridToolbarDensitySelector, GridToolbarQuickFilter } from '@mui/x-data-grid';
import { Box, styled } from '@mui/material';

const StyledGridOverlay = styled('div')(() => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    '& .no-rows-primary': {
        fill: '#AEB8C2',
    },
    '& .no-rows-secondary': {
        fill: '#E8EAED',
    },
}));

function CustomToolbar({ search = true, column = true, density = true }) {
    return (
        <GridToolbarContainer className="w-full">
            {search && (
                <GridToolbarQuickFilter
                    variant="outlined"
                    size="small"
                    color="primary"
                    placeholder="Cari disini"
                    debounceMs={300}
                />
            )}
            {column && <GridToolbarColumnsButton />}
            {density && <GridToolbarDensitySelector />}
        </GridToolbarContainer>
    );
}

function CustomNoRowsOverlay() {
    return (
        <StyledGridOverlay>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                width={96}
                viewBox="0 0 452 257"
                aria-hidden
                focusable="false"
            >
                <path
                    className="no-rows-primary"
                    d="M348 69c-46.392 0-84 37.608-84 84s37.608 84 84 84 84-37.608 84-84-37.608-84-84-84Zm-104 84c0-57.438 46.562-104 104-104s104 46.562 104 104-46.562 104-104 104-104-46.562-104-104Z"
                />
                <path
                    className="no-rows-primary"
                    d="M308.929 113.929c3.905-3.905 10.237-3.905 14.142 0l63.64 63.64c3.905 3.905 3.905 10.236 0 14.142-3.906 3.905-10.237 3.905-14.142 0l-63.64-63.64c-3.905-3.905-3.905-10.237 0-14.142Z"
                />
                <path
                    className="no-rows-primary"
                    d="M308.929 191.711c-3.905-3.906-3.905-10.237 0-14.142l63.64-63.64c3.905-3.905 10.236-3.905 14.142 0 3.905 3.905 3.905 10.237 0 14.142l-63.64 63.64c-3.905 3.905-10.237 3.905-14.142 0Z"
                />
                <path
                    className="no-rows-secondary"
                    d="M0 10C0 4.477 4.477 0 10 0h380c5.523 0 10 4.477 10 10s-4.477 10-10 10H10C4.477 20 0 15.523 0 10ZM0 59c0-5.523 4.477-10 10-10h231c5.523 0 10 4.477 10 10s-4.477 10-10 10H10C4.477 69 0 64.523 0 59ZM0 106c0-5.523 4.477-10 10-10h203c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 153c0-5.523 4.477-10 10-10h195.5c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 200c0-5.523 4.477-10 10-10h203c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10ZM0 247c0-5.523 4.477-10 10-10h231c5.523 0 10 4.477 10 10s-4.477 10-10 10H10c-5.523 0-10-4.477-10-10Z"
                />
            </svg>
            <Box sx={{ mt: 2 }}>Tidak Ada Data</Box>
        </StyledGridOverlay>
    );
}

const defaultRows = [];
const defaultColumns = [];
const defaultPageSizeOptions = [5, 10, 25, 50];
const defaultToolbar = { search: true, column: true, density: true };
const defaultIsRowSelectable = () => true;
const defaultRowSelect = { onChange: () => {}, value: [] };

const defaultLocaleText = {
    noRowsLabel: 'Tidak ada data',
    MuiTablePagination: {
        labelRowsPerPage: 'Baris per halaman:',
        labelDisplayedRows: ({ from, to, count }) =>
            `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`,
    },
};

function CustomDataTable({
    rows = defaultRows,
    columns = defaultColumns,
    loading = false,
    pageSize = 5,
    pageSizeOptions = defaultPageSizeOptions,
    paginationMode = 'client',
    rowCount,
    paginationModel,
    onPaginationModelChange,
    getRowId,
    checkbox = false,
    pagination = true,
    toolbar = defaultToolbar,
    isRowSelectable = defaultIsRowSelectable,
    rowSelect = defaultRowSelect,
    ...props
}) {
    const toolbarSlots = useMemo(() => ({
        ...(toolbar !== false && { toolbar: CustomToolbar }),
        noRowsOverlay: CustomNoRowsOverlay,
        noResultsOverlay: CustomNoRowsOverlay,
    }), [toolbar]);
    const toolbarSlotProps = useMemo(() => ({
        toolbar,
        loadingOverlay: {
            variant: 'skeleton',
            noRowsVariant: 'skeleton',
        },
    }), [toolbar]);
    const paginationProps = paginationMode === 'server'
        ? {
            paginationMode: 'server',
            rowCount: rowCount || 0,
            paginationModel,
            onPaginationModelChange,
        }
        : {
            initialState: {
                pagination: { paginationModel: { pageSize } },
            },
        };

    return (
        <DataGrid
            getRowId={getRowId}
            rows={rows}
            columns={columns}
            {...(pagination && {
                pageSizeOptions,
                pagination: true,
                ...paginationProps,
            })}
            hideFooter={!pagination}
            disableColumnMenu
            disableRowSelectionOnClick
            checkboxSelection={checkbox}
            loading={loading}
            isRowSelectable={isRowSelectable}
            localeText={defaultLocaleText}
            slots={toolbarSlots}
            slotProps={toolbarSlotProps}
            onRowSelectionModelChange={rowSelect.onChange}
            rowSelectionModel={rowSelect.value}
            {...props}
        />
    );
}

export default memo(CustomDataTable);
