import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Avatar, Button, IconButton, Slide, Tooltip } from "@mui/material";
import { useSidebar } from "../contexts/SidebarContext";
import { useUser } from "../contexts/UserContext";
import {
    DashboardOutlined,
    FolderOutlined,
    DescriptionOutlined,
    LocalShippingOutlined,
    SchoolOutlined,
    FileDownloadOutlined,
    HistoryOutlined,
    SettingsOutlined,
    MenuOutlined,
    CloseOutlined,
    LogoutOutlined,
    PersonOutlined,
    HomeOutlined,
} from "@mui/icons-material";

const userMenuItems = [
    { label: 'Dashboard', path: '/', icon: DashboardOutlined },
    { label: 'Arsip Saya', path: '/arsip-saya', icon: FolderOutlined },
    { label: 'Permintaan Berkas', path: '/permintaan', icon: DescriptionOutlined },
    { label: 'Berkas Kampus', path: '/distribusi', icon: LocalShippingOutlined },
];

const adminMenuItems = [
    { label: 'Dashboard', path: '/', icon: DashboardOutlined },
    { label: 'Arsip Pengguna', path: '/arsip-pengguna', icon: FolderOutlined },
    { label: 'Permintaan Berkas', path: '/permintaan', icon: DescriptionOutlined },
    { label: 'Distribusi Berkas', path: '/distribusi', icon: LocalShippingOutlined },
    { label: 'Beasiswa', path: '/beasiswa', icon: SchoolOutlined },
    { label: 'Export ZIP', path: '/export', icon: FileDownloadOutlined },
    { label: 'Audit Log', path: '/audit', icon: HistoryOutlined },
    { label: 'Pengaturan', path: '/pengaturan', icon: SettingsOutlined },
];

export default function MainLayout({ children }) {
    const { showSidebar, setShowSidebar } = useSidebar();
    const { role, userdata } = useUser();
    const location = useLocation();

    const isAdmin = role === 'admin' || role === 'developer';
    const menuItems = isAdmin ? adminMenuItems : userMenuItems;

    const displayName = userdata?.profile?.nama || userdata?.account?.name || userdata?.user_email || 'Memuat pengguna';
    const displayRole = role === 'admin' || role === 'developer'
        ? 'Admin'
        : role === 'dosen'
            ? 'Dosen'
            : 'Mahasiswa';

    useEffect(() => {
        setShowSidebar(false);
    }, [location.pathname, setShowSidebar]);

    return (
        <div className="font-jakarta min-h-screen bg-gradient-to-b from-zinc-100 to-white text-zinc-700 text-xs sm:text-sm flex flex-col justify-between">
            {showSidebar && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            <div className="w-full flex gap-3">
                <aside className="hidden lg:block lg:w-2/12 min-w-60 sticky top-3 h-fit pl-4 overflow-auto">
                    <SidebarContent
                        menuItems={menuItems}
                        displayName={displayName}
                        displayRole={displayRole}
                    />
                </aside>

                <Slide direction="right" in={showSidebar} mountOnEnter unmountOnExit>
                    <aside className="fixed inset-0 min-h-screen bg-white shadow-lg z-50 md:hidden p-4 overflow-auto">
                        <SidebarContent
                            menuItems={menuItems}
                            displayName={displayName}
                            displayRole={displayRole}
                            mobile
                            onClose={() => setShowSidebar(false)}
                        />
                    </aside>
                </Slide>

                <div className="w-full lg:w-10/12 relative overflow-auto p-3">
                    <div className="bg-white w-full rounded-lg border border-zinc-300 shadow-md overflow-hidden min-h-[calc(100vh-1.5rem)]">
                        <div className="divide-y divide-zinc-300">
                            <header className="p-2 lg:p-4">
                                <div className="flex justify-between items-center gap-3">
                                    <div className="flex items-center gap-1 lg:gap-3 min-w-0">
                                        <div className="lg:hidden">
                                            <IconButton onClick={() => setShowSidebar(true)} size="small">
                                                <MenuOutlined fontSize="small" />
                                            </IconButton>
                                        </div>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="hidden sm:flex h-9 w-9 rounded-md bg-blue-700 text-white items-center justify-center shadow-sm">
                                                <HomeOutlined fontSize="small" />
                                            </div>
                                            <div className="min-w-0">
                                                <h1 className="text-base md:text-lg font-semibold tracking-wide text-zinc-800 truncate">
                                                    Arsip Digital
                                                </h1>
                                                <p className="text-xs text-zinc-500 truncate">
                                                    STMIK Bandung
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        href="/logout"
                                        color="error"
                                        variant="outlined"
                                        size="small"
                                        startIcon={<LogoutOutlined fontSize="small" />}
                                        sx={{ textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', borderRadius: '0.5rem' }}
                                    >
                                        Keluar
                                    </Button>
                                </div>
                            </header>
                            <main className="p-3 lg:p-5">
                                {children}
                            </main>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="px-4 py-3 text-xs text-zinc-500 flex flex-col sm:flex-row justify-between gap-2">
                <span>© Since 2024 - STMIK Bandung</span>
                <span>Arsip Digital</span>
            </footer>
        </div>
    );
}

function SidebarContent({ menuItems, displayName, displayRole, mobile = false, onClose }) {
    const location = useLocation();

    return (
        <div className="py-2 font-jakarta">
            <div className="space-y-4">
                <div className="flex items-center gap-4 w-full">
                    <Avatar sx={{ bgcolor: '#1d4ed8', width: 40, height: 40 }}>
                        <PersonOutlined fontSize="small" />
                    </Avatar>
                    <div className="space-y-1 w-full min-w-0">
                        <div className="flex gap-4 justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold opacity-50">Selamat Datang,</p>
                                <p className="font-semibold text-blue-600 text-sm truncate">{displayName}</p>
                            </div>
                            {mobile && (
                                <IconButton onClick={onClose} size="small">
                                    <CloseOutlined fontSize="small" />
                                </IconButton>
                            )}
                        </div>
                        <p className="px-2 py-0.5 rounded w-fit bg-blue-700/80 text-white text-xs font-medium tracking-tight">
                            {displayRole}
                        </p>
                    </div>
                </div>
            </div>

            <hr className="my-5 border-zinc-400" />

            <div className="overflow-hidden relative">
                <p className="font-medium opacity-60 text-xs px-5">Menu Utama</p>
                <hr className="my-1 opacity-0" />
                <nav className="space-y-1">
                    {menuItems.map((item) => {
                        const active = item.path === '/'
                            ? location.pathname === '/react' || location.pathname === '/react/' || location.pathname === '/'
                            : location.pathname.endsWith(item.path);
                        return (
                            <div key={item.path} className="relative overflow-clip w-full">
                                <div className={`absolute top-0 left-0 w-2 h-full rounded-md bg-blue-500 ${active ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="px-5">
                                    <Tooltip title={item.label} arrow placement="right">
                                        <NavLink
                                            to={item.path}
                                            end={item.path === '/'}
                                            className={({ isActive }) => `
                                                p-2 w-full rounded-md flex items-center gap-3 transition-colors duration-100
                                                ${(isActive || active)
                                                    ? 'border bg-white border-zinc-300 text-zinc-800 font-medium'
                                                    : 'text-zinc-600 hover:bg-zinc-200'
                                                }
                                            `}
                                        >
                                            <item.icon color={active ? 'primary' : undefined} fontSize="small" />
                                            <span>{item.label}</span>
                                        </NavLink>
                                    </Tooltip>
                                </div>
                            </div>
                        );
                    })}
                </nav>
            </div>

            <hr className="my-5 border-zinc-400" />

            <div className="px-5">
                <Button
                    href="/logout"
                    color="error"
                    variant="outlined"
                    size="small"
                    fullWidth
                    startIcon={<LogoutOutlined />}
                    sx={{ textTransform: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', borderRadius: '0.5rem' }}
                >
                    Keluar
                </Button>
            </div>
        </div>
    );
}
