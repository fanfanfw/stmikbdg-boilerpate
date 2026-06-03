import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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

    const displayName = userdata?.profile?.nama || userdata?.account?.name || userdata?.user_email || 'User';
    const displayRole = role || 'user';

    return (
        <div className="font-jakarta min-h-screen bg-gradient-to-b from-zinc-100 to-white flex text-xs sm:text-sm">
            {/* Mobile overlay */}
            {showSidebar && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 h-full w-64 bg-white border-r border-zinc-200 z-50 
                transform transition-transform duration-200 ease-out
                lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen
                ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-zinc-200">
                        <div className="flex items-center justify-between">
                            <h1 className="text-sm font-semibold text-zinc-800">Arsip Digital</h1>
                            <button
                                onClick={() => setShowSidebar(false)}
                                className="lg:hidden p-1 rounded hover:bg-zinc-100"
                            >
                                <CloseOutlined fontSize="small" />
                            </button>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">STMIK Bandung</p>
                    </div>

                    {/* User info */}
                    <div className="px-4 py-3 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                            <PersonOutlined fontSize="small" className="text-zinc-400" />
                            <div className="overflow-hidden">
                                <p className="text-xs font-medium text-zinc-700 truncate">{displayName}</p>
                                <p className="text-xs text-zinc-400 capitalize">{displayRole}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-3 py-2.5 rounded-md text-xs transition-colors duration-100
                                    ${isActive
                                        ? 'bg-blue-50 text-blue-600 font-medium border-l-2 border-blue-500'
                                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800'
                                    }
                                `}
                            >
                                <item.icon fontSize="small" />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* Logout */}
                    <div className="p-3 border-t border-zinc-200">
                        <a
                            href="/logout"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-xs text-red-500 hover:bg-red-50 transition-colors duration-100"
                        >
                            <LogoutOutlined fontSize="small" />
                            <span>Keluar</span>
                        </a>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar (mobile) */}
                <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="p-1 rounded hover:bg-zinc-100"
                    >
                        <MenuOutlined fontSize="small" />
                    </button>
                    <h1 className="text-xs font-semibold text-zinc-700">Arsip Digital</h1>
                    <div className="w-6" />
                </header>

                {/* Work panel */}
                <main className="flex-1 p-4 lg:p-6">
                    <div className="bg-white rounded-lg border border-zinc-300 shadow-md p-4 lg:p-6 min-h-[calc(100vh-6rem)]">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
