import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Avatar, Fade, IconButton, Slide } from "@mui/material";
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
    LogoutOutlined,
    PersonOutlined,
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

function Footer() {
    return (
        <div className="p-4 flex justify-center items-center gap-5 italic text-xs">
            <div className="w-full flex flex-col sm:flex-row sm:justify-between items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-4">
                        <img src="/images/stmik.png" className="w-12" alt="Logo STMIK" />
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-bold tracking-tight text-sm text-blue-800">
                                    Arsip Digital
                                </p>
                                <p>//</p>
                                <p className="font-bold tracking-tight text-sm text-blue-800">
                                    STMIK Bandung
                                </p>
                            </div>
                            <p>Sistem Arsip Digital Kampus</p>
                        </div>
                    </div>
                </div>
                <div className="w-full sm:w-fit">
                    <p>© Since 2026 - STMIK Bandung</p>
                </div>
                <div className="w-full sm:w-fit">
                    <div className="flex items-start sm:items-center gap-6 flex-col sm:flex-row">
                        <a href="https://stmik-bandung.ac.id" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline w-fit cursor-pointer">
                            Web Utama
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MainLayout({ children }) {
    const { showSidebar, setShowSidebar } = useSidebar();
    const { role, userdata } = useUser();
    const location = useLocation();

    const isAdmin = role === 'admin';
    const isMahasiswa = role === 'mahasiswa';
    const menuItems = isAdmin ? adminMenuItems : isMahasiswa ? userMenuItems : [];

    const displayName = userdata?.profile?.nama || userdata?.account?.name || userdata?.user_email || 'Memuat pengguna';
    const displayRole = isAdmin
        ? 'Admin'
        : isMahasiswa
            ? 'Mahasiswa'
            : role || '-';

    useEffect(() => {
        setShowSidebar(false);
    }, [location.pathname, setShowSidebar]);

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-white font-jakarta text-zinc-700 text-xs sm:text-sm flex flex-col justify-between">
            {showSidebar && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            <div className="w-full flex gap-3">
                <div className="hidden lg:block lg:w-2/12 min-w-60 sticky top-3 h-fit pl-4 overflow-auto">
                    <SidebarContent
                        menuItems={menuItems}
                        displayName={displayName}
                        displayRole={displayRole}
                    />
                </div>

                <Slide direction="right" in={showSidebar} mountOnEnter unmountOnExit>
                    <div className="fixed inset-0 min-h-screen bg-white shadow-lg z-50 md:hidden p-4 overflow-auto">
                        <SidebarContent
                            menuItems={menuItems}
                            displayName={displayName}
                            displayRole={displayRole}
                            mobile
                            onClose={() => setShowSidebar(false)}
                        />
                    </div>
                </Slide>

                <div className="w-full lg:w-10/12 relative overflow-auto p-3">
                    <Fade in={true} timeout={300}>
                        <div className="bg-white w-full rounded-lg border border-zinc-300 shadow-md">
                            <div className="divide-y divide-zinc-300">
                                <div className="p-2 lg:p-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center lg:gap-3">
                                            <div className="lg:hidden">
                                                <IconButton onClick={() => setShowSidebar(true)} size="small">
                                                    <MenuOutlined fontSize="small" />
                                                </IconButton>
                                            </div>
                                            <h1 className="text-lg md:text-xl font-semibold tracking-wide">
                                                Arsip Digital
                                            </h1>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 lg:p-5">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </Fade>
                </div>
            </div>

            <Footer />
        </div>
    );
}

function SidebarContent({ menuItems, displayName, displayRole, mobile = false, onClose }) {
    const location = useLocation();

    return (
        <>
            <hr className="my-2 opacity-0" />
            <div className="space-y-4">
                <div className="flex items-center gap-4 w-full">
                    <Avatar src={null}>
                        <PersonOutlined fontSize="small" />
                    </Avatar>
                    <div className="space-y-1 w-full min-w-0">
                        <div className="flex gap-4 justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold opacity-50">
                                    Selamat Datang,
                                </p>
                                <p className="font-semibold text-blue-600 text-sm truncate">
                                    {displayName}
                                </p>
                            </div>
                            {mobile && (
                                <IconButton onClick={onClose} size="small">
                                    <MenuOutlined fontSize="small" />
                                </IconButton>
                            )}
                        </div>
                        <p className="px-2 py-0.5 rounded w-fit bg-blue-700/80 text-white text-xs font-medium tracking-tighter">
                            {displayRole}
                        </p>
                    </div>
                </div>
            </div>
            <hr className="my-5 border-zinc-400" />
            <div className="overflow-hidden relative">
                <p className="font-medium opacity-60 text-xs px-5">
                    Menu Utama
                </p>
                <hr className="my-1 opacity-0" />
                {menuItems.map((item) => {
                    const active = item.path === '/'
                        ? location.pathname === '/react' || location.pathname === '/react/' || location.pathname === '/'
                        : location.pathname.endsWith(item.path);
                    return (
                        <div key={item.path} className="relative overflow-clip w-full">
                            <div className={`absolute top-0 left-0 w-2 h-full rounded-md bg-blue-500 ${active ? 'opacity-100' : 'opacity-0'}`} />
                            <div className="px-5">
                                <NavLink
                                    to={item.path}
                                    end={item.path === '/'}
                                    className={`p-2 w-full rounded-md flex items-center gap-3 transition-colors duration-100 ${
                                        active
                                            ? 'border bg-white border-zinc-300 text-zinc-800 font-medium'
                                            : 'text-zinc-600 hover:bg-zinc-200'
                                    }`}
                                >
                                    <item.icon color={active ? 'primary' : undefined} fontSize="small" />
                                    <p className="font-medium">
                                        {item.label}
                                    </p>
                                </NavLink>
                            </div>
                        </div>
                    );
                })}
            </div>
            <hr className="my-5 border-zinc-400" />
            <div className="relative overflow-visible w-full">
                <div className="px-5">
                    <a href="/logout" className="p-2 w-full rounded-md hover:bg-zinc-200 ease-out duration-100 flex items-center gap-3 text-red-500">
                        <LogoutOutlined fontSize="small" />
                        <p className="font-medium">
                            Keluar
                        </p>
                    </a>
                </div>
            </div>
        </>
    );
}
