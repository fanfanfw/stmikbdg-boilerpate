import { DataGrid } from '@mui/x-data-grid';
import { Box } from '@mui/material';

const defaultLocaleText = {
    noRowsLabel: 'Tidak ada data',
    MuiTablePagination: {
        labelRowsPerPage: 'Baris per halaman:',
        labelDisplayedRows: ({ from, to, count }) =>
            `${from}-${to} dari ${count !== -1 ? count : `lebih dari ${to}`}`,
    },
};

export default function CustomDataTable({
    rows = [],
    columns = [],
    loading = false,
    pageSize = 10,
    pageSizeOptions = [10, 25, 50],
    paginationMode = 'client',
    rowCount,
    paginationModel,
    onPaginationModelChange,
    getRowId,
    minHeight = 360,
    maxHeight = 720,
    sx,
    ...props
}) {
    const visibleRows = paginationMode === 'server'
        ? paginationModel?.pageSize || pageSize
        : Math.min(rows.length || pageSize, pageSize);
    const tableHeight = rows.length
        ? Math.min(maxHeight, Math.max(minHeight, 120 + visibleRows * 44))
        : minHeight;
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
        <Box sx={{ width: '100%', height: tableHeight, minHeight, overflowX: 'auto', ...sx }}>
            <DataGrid
                rows={rows}
                columns={columns}
                loading={loading}
                pageSizeOptions={pageSizeOptions}
                disableRowSelectionOnClick
                density="compact"
                getRowId={getRowId}
                localeText={defaultLocaleText}
                sx={{
                    minWidth: { xs: 720, md: 'auto' },
                    border: 'none',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '0.75rem',
                    '& .MuiDataGrid-columnHeaders': {
                        backgroundColor: '#f9fafb',
                        borderBottom: '1px solid #e4e4e7',
                    },
                    '& .MuiDataGrid-columnHeaderTitle': {
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        color: '#52525b',
                    },
                    '& .MuiDataGrid-cell': {
                        borderBottom: '1px solid #f4f4f5',
                        py: 1,
                    },
                    '& .MuiDataGrid-footerContainer': {
                        borderTop: '1px solid #e4e4e7',
                    },
                }}
                {...paginationProps}
                {...props}
            />
        </Box>
    );
}
