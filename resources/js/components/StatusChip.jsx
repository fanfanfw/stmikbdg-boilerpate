import { Chip } from '@mui/material';
import { statusLabel } from '../libs/format';

const colorMap = {
    approved: 'success',
    published: 'success',
    confirmed: 'success',
    completed: 'success',
    active: 'success',
    file_uploaded: 'success',
    available: 'success',
    downloaded: 'success',
    issued: 'success',

    pending: 'warning',
    processing: 'warning',
    preview_ready: 'warning',
    waiting_verification: 'warning',
    not_submitted: 'warning',
    queued: 'warning',

    rejected: 'error',
    failed: 'error',
    cancelled: 'error',
    expired: 'error',
    late: 'error',
    revoked: 'error',
    replaced: 'error',

    draft: 'default',
    archived: 'default',
    closed: 'default',
    inactive: 'default',
};

export default function StatusChip({ status, size = 'small', ...props }) {
    const color = colorMap[status] || 'default';
    const label = statusLabel(status);

    return (
        <Chip
            label={label}
            color={color}
            size={size}
            variant="outlined"
            {...props}
        />
    );
}
