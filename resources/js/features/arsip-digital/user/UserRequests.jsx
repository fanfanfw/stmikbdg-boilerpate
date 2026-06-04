import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';
import { customSwal } from '../../../components/CustomSwal';
import PageHeader from '../../../components/PageHeader';
import StatusChip from '../../../components/StatusChip';
import CustomDataTable from '../../../components/CustomDataTable';
import CustomLoading from '../../../components/CustomLoading';
import { Button, TextField, MenuItem, Chip, Alert } from '@mui/material';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';

function unwrapListResponse(response, key) {
    const payload = response?.data ?? response;
    const list = payload?.[key] ?? payload?.data ?? payload;
    return {
        data: Array.isArray(list) ? list : [],
        meta: payload?.meta ?? payload?.pagination ?? response?.meta ?? null,
    };
}

export default function UserRequests() {
    const navigate = useNavigate();

    const [listData, setListData] = useState({
        data: [],
        meta: null,
        loading: true,
        error: null,
    });

    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        page: 0,
        per_page: 10,
    });

    const fetchRequests = async () => {
        setListData((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const response = await arsipApi.userRequests();
            const unwrapped = unwrapListResponse(response, 'requests');
            setListData({ data: unwrapped.data, meta: unwrapped.meta, loading: false, error: null });
        } catch (err) {
            const formatted = await formatArsipError(err);
            setListData((prev) => ({ ...prev, loading: false, error: formatted.message }));
            customSwal.fire({
                icon: 'error',
                title: 'Gagal memuat data',
                text: formatted.message,
            });
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const isPastDeadline = (deadline, assignmentStatus) => {
        if (!deadline) return false;
        if (assignmentStatus === 'approved') return false;
        return new Date(deadline) < new Date();
    };

    const pendingAssignments = listData.data.filter(
        (row) =>
            row.assignment &&
            (row.assignment.status === 'pending' || row.assignment.status === 'not_submitted')
    );

    const filteredData = listData.data.filter((row) => {
        const matchesSearch =
            !filters.search ||
            row.title.toLowerCase().includes(filters.search.toLowerCase());

        const matchesStatus =
            filters.status === 'all' ||
            (row.assignment && row.assignment.status === filters.status);

        return matchesSearch && matchesStatus;
    });

    const paginatedData = filteredData.slice(
        filters.page * filters.per_page,
        filters.page * filters.per_page + filters.per_page,
    );

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value, page: 0 }));
    };

    const handlePaginationChange = (model) => {
        setFilters((prev) => ({ ...prev, page: model.page, per_page: model.pageSize }));
    };

    const columns = [
        {
            field: 'title',
            headerName: 'Judul Permintaan',
            flex: 1,
            minWidth: 200,
            renderCell: (params) => (
                <span
                    className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium hover:underline"
                    onClick={() => navigate(`/permintaan/${params.row.request_id}`)}
                >
                    {params.value}
                </span>
            ),
        },
        {
            field: 'deadline',
            headerName: 'Tenggat Waktu',
            width: 200,
            renderCell: (params) => {
                const deadline = params.value;
                const assignmentStatus = params.row.assignment?.status;
                const late = isPastDeadline(deadline, assignmentStatus);

                return (
                    <div className="flex items-center gap-2">
                        <span className={late ? 'text-red-600' : ''}>
                            {deadline ? dateTime(deadline) : '-'}
                        </span>
                        {late && (
                            <Chip
                                label="Terlambat"
                                size="small"
                                sx={{
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                }}
                            />
                        )}
                    </div>
                );
            },
        },
        {
            field: 'assignment_status',
            headerName: 'Status',
            width: 160,
            valueGetter: (value, row) => row.assignment?.status || '-',
            renderCell: (params) => {
                const status = params.row.assignment?.status;
                if (!status) return '-';
                return <StatusChip status={status} />;
            },
        },
        {
            field: 'files_count',
            headerName: 'Jumlah File',
            width: 120,
            align: 'center',
            headerAlign: 'center',
            valueGetter: (value, row) => row.assignment?.files_count ?? 0,
            renderCell: (params) => (
                <div className="flex items-center justify-center gap-1">
                    <DescriptionOutlined sx={{ fontSize: 16, color: '#71717a' }} />
                    <span>{params.row.assignment?.files_count ?? 0}</span>
                </div>
            ),
        },
        {
            field: 'actions',
            headerName: 'Aksi',
            width: 100,
            sortable: false,
            filterable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: (params) => (
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/permintaan/${params.row.request_id}`)}
                    sx={{
                        minWidth: 'unset',
                        padding: '4px 8px',
                        borderColor: '#e4e4e7',
                        color: '#3f3f46',
                        '&:hover': {
                            borderColor: '#3b82f6',
                            color: '#3b82f6',
                            backgroundColor: '#eff6ff',
                        },
                    }}
                >
                    <VisibilityOutlined sx={{ fontSize: 18 }} />
                </Button>
            ),
        },
    ];

    if (listData.loading) {
        return <CustomLoading />;
    }

    return (
        <div className="font-jakarta">
            <PageHeader
                title="Permintaan Berkas"
                subtitle="Daftar permintaan berkas yang ditujukan kepada Anda"
            />

            {pendingAssignments.length > 0 && (
                <Alert
                    severity="info"
                    sx={{
                        mb: 2,
                        borderRadius: '0.5rem',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}
                >
                    Anda memiliki <strong>{pendingAssignments.length}</strong> permintaan yang
                    belum diunggah berkasnya. Segera unggah berkas yang diminta.
                </Alert>
            )}

            {listData.error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: 2,
                        borderRadius: '0.5rem',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}
                >
                    {listData.error}
                </Alert>
            )}

            {/* Filter Bar */}
            <div className="bg-white rounded-lg border border-zinc-200 p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <TextField
                        size="small"
                        placeholder="Cari judul permintaan..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <SearchOutlined sx={{ color: '#a1a1aa', mr: 1, fontSize: 20 }} />
                            ),
                        }}
                        sx={{
                            minWidth: 250,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '0.5rem',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                            },
                        }}
                    />

                    <TextField
                        size="small"
                        select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        sx={{
                            minWidth: 180,
                            '& .MuiOutlinedInput-root': {
                                borderRadius: '0.5rem',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                            },
                        }}
                    >
                        <MenuItem value="all">Semua Status</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="file_uploaded">Submitted</MenuItem>
                        <MenuItem value="approved">Approved</MenuItem>
                        <MenuItem value="rejected">Rejected</MenuItem>
                    </TextField>

                    <Button
                        variant="outlined"
                        startIcon={<RefreshOutlined />}
                        onClick={fetchRequests}
                        sx={{
                            borderRadius: '0.5rem',
                            borderColor: '#e4e4e7',
                            color: '#3f3f46',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            textTransform: 'none',
                            '&:hover': {
                                borderColor: '#3b82f6',
                                color: '#3b82f6',
                                backgroundColor: '#eff6ff',
                            },
                        }}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg border border-zinc-200">
                {filteredData.length === 0 && !listData.loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                        <DescriptionOutlined sx={{ fontSize: 48, color: '#d4d4d8', mb: 2 }} />
                        <p className="text-lg font-medium text-zinc-600">
                            Tidak ada permintaan berkas
                        </p>
                        <p className="text-sm text-zinc-400 mt-1">
                            Belum ada permintaan berkas yang ditujukan kepada Anda
                        </p>
                    </div>
                ) : (
                    <CustomDataTable
                        rows={paginatedData}
                        columns={columns}
                        getRowId={(row) => row.request_id}
                        paginationMode="server"
                        rowCount={filteredData.length}
                        paginationModel={{ page: filters.page, pageSize: filters.per_page }}
                        onPaginationModelChange={handlePaginationChange}
                        pageSizeOptions={[10, 25, 50]}
                        onRowClick={(params) => navigate(`/permintaan/${params.row.request_id}`)}
                        autoHeight
                        disableRowSelectionOnClick
                        sx={{
                            border: 'none',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            '& .MuiDataGrid-cell': {
                                cursor: 'pointer',
                            },
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: '#fafafa',
                                borderBottom: '1px solid #e4e4e7',
                            },
                        }}
                    />
                )}
            </div>
        </div>
    );
}
