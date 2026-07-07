import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, CircularProgress, IconButton, Popover } from '@mui/material';
import { Circle, NotificationsNoneOutlined } from '@mui/icons-material';
import { arsipApi } from '../../../libs/arsip_api';
import { formatArsipError } from '../../../libs/arsip_http';
import { dateTime } from '../../../libs/format';
import { useUser } from '../../../contexts/UserContext';
import { useArsipNotifications } from '../hooks/useArsipNotifications';

const availableRoutes = new Set(['/home/permintaan', '/home/permintaan/:id', '/home/distribusi']);

function routeAvailable(route) {
    if (availableRoutes.has(route)) return true;
    return /^\/home\/permintaan\/[^/]+$/.test(route) && availableRoutes.has('/home/permintaan/:id');
}

function notificationData(notification) {
    if (!notification?.data) return {};
    if (typeof notification.data === 'string') {
        try {
            return JSON.parse(notification.data) || {};
        } catch {
            return {};
        }
    }

    return notification.data;
}

function firstValue(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
}

function routeForNotification(notification, role) {
    const type = notification?.type;
    const entityType = notification?.entity_type;
    const data = notificationData(notification);
    const requestId = firstValue(data.request_id, entityType === 'request' ? notification?.entity_id : null);

    if (role === 'admin') {
        if (['request_file_submitted', 'request_file_reused'].includes(type) || entityType === 'request_file') {
            const detailRoute = requestId ? `/home/permintaan/${requestId}` : null;
            return detailRoute && routeAvailable(detailRoute) ? detailRoute : '/home/permintaan';
        }

        if (type === 'distribution_file_available' || String(entityType || '').startsWith('distribution')) {
            return '/home/distribusi';
        }
    }

    if (role === 'mahasiswa' || role === 'dosen') {
        if (['request_published', 'request_target_added', 'request_file_approved', 'request_file_rejected'].includes(type)
            || ['request', 'request_assignment', 'request_file'].includes(entityType)) {
            const detailRoute = requestId ? `/home/permintaan/${requestId}` : null;
            return detailRoute && routeAvailable(detailRoute) ? detailRoute : '/home/permintaan';
        }

        if (type === 'distribution_file_available') {
            return '/home/distribusi';
        }
    }

    return null;
}

function notificationId(notification) {
    return notification?.notification_id ?? notification?.id;
}

function listOf(response) {
    const data = response?.data ?? response ?? {};
    return Array.isArray(data.notifications) ? data.notifications : [];
}

export default function ArsipNotificationBell({ enabled = true }) {
    const navigate = useNavigate();
    const { role } = useUser();
    const { unreadCount, refreshUnreadCount } = useArsipNotifications({ enabled });
    const [badgeCount, setBadgeCount] = useState(0);
    const [anchorEl, setAnchorEl] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);

    const open = Boolean(anchorEl);
    useEffect(() => {
        setBadgeCount(unreadCount);
    }, [unreadCount]);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await arsipApi.notifications({ page: 1, per_page: 10 });
            setNotifications(listOf(response));
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleToggle = (event) => {
        if (open) {
            setAnchorEl(null);
            return;
        }

        setAnchorEl(event.currentTarget);
        loadNotifications();
    };

    const handleNotificationClick = async (notification) => {
        const id = notificationId(notification);
        if (actionLoading) return;

        const route = routeForNotification(notification, role);

        setActionLoading(true);
        setError(null);
        try {
            if (id && !notification?.read_at) {
                await arsipApi.markNotificationRead(id);
                setNotifications((current) => current.map((item) => (
                    notificationId(item) === id ? { ...item, read_at: new Date().toISOString() } : item
                )));
                setBadgeCount((current) => Math.max(0, current - 1));
                refreshUnreadCount();
            }
            setAnchorEl(null);
            if (route && routeAvailable(route)) {
                navigate(route);
            }
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        if (actionLoading) return;

        setActionLoading(true);
        setError(null);
        try {
            await arsipApi.markAllNotificationsRead();
            const now = new Date().toISOString();
            setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || now })));
            setBadgeCount(0);
            refreshUnreadCount();
        } catch (err) {
            const formatted = await formatArsipError(err);
            setError(formatted.message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <>
            <IconButton
                aria-label="Buka notifikasi"
                size="small"
                onClick={handleToggle}
                disabled={!enabled}
            >
                <Badge badgeContent={badgeCount} color="error" max={99} invisible={badgeCount <= 0}>
                    <NotificationsNoneOutlined fontSize="small" />
                </Badge>
            </IconButton>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ className: 'w-80 max-w-[calc(100vw-2rem)]' }}
            >
                <div className="p-3 space-y-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-semibold text-zinc-800">Notifikasi</p>
                            <p className="text-zinc-500">{badgeCount} belum dibaca</p>
                        </div>
                        <Button
                            size="small"
                            variant="text"
                            onClick={handleMarkAllRead}
                            disabled={actionLoading || badgeCount <= 0}
                        >
                            Tandai semua dibaca
                        </Button>
                    </div>

                    {error && <Alert severity="error">{error}</Alert>}

                    {loading ? (
                        <div className="py-8 flex justify-center">
                            <CircularProgress size={24} />
                        </div>
                    ) : notifications.length === 0 ? (
                        <p className="py-8 text-center text-zinc-500">Belum ada notifikasi.</p>
                    ) : (
                        <div className="max-h-96 overflow-auto divide-y divide-zinc-200">
                            {notifications.map((notification) => {
                                const unread = !notification?.read_at;
                                return (
                                    <button
                                        key={notificationId(notification)}
                                        type="button"
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full text-left p-3 hover:bg-zinc-50 flex gap-3 ${unread ? 'bg-blue-50/70' : 'bg-white'}`}
                                    >
                                        <Circle
                                            className={unread ? 'text-blue-600 mt-1' : 'text-transparent mt-1'}
                                            sx={{ fontSize: 8 }}
                                        />
                                        <span className="min-w-0 space-y-1">
                                            <span className="block font-semibold text-zinc-800 truncate">
                                                {notification.title || 'Notifikasi'}
                                            </span>
                                            <span className="block text-zinc-600 leading-relaxed">
                                                {notification.message || '-'}
                                            </span>
                                            <span className="block text-[11px] text-zinc-400">
                                                {dateTime(notification.created_at)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Popover>
        </>
    );
}
