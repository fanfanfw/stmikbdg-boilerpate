import { Routes, Route, Navigate } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";

// User pages
import UserDashboard from "./user/UserDashboard";
import PersonalArchive from "./user/PersonalArchive";
import UserRequests from "./user/UserRequests";
import UserRequestDetail from "./user/UserRequestDetail";
import UserDistributions from "./user/UserDistributions";

// Admin pages
import AdminDashboard from "./admin/AdminDashboard";
import AdminArchive from "./admin/AdminArchive";
import AdminRequests from "./admin/AdminRequests";
import AdminRequestDetail from "./admin/AdminRequestDetail";
import AdminDistributions from "./admin/AdminDistributions";
import AdminAudit from "./admin/AdminAudit";
import AdminSettings from "./admin/AdminSettings";

import NotAllowed from "./common/NotAllowed";

export default function ArsipDigitalRoutes() {
    const { role } = useUser();
    const isAdmin = role === 'admin';
    const isUser = role === 'mahasiswa' || role === 'dosen';

    if (isAdmin) {
        return (
            <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<AdminDashboard />} />
                <Route path="/home/arsip-pengguna" element={<AdminArchive />} />
                <Route path="/home/permintaan" element={<AdminRequests />} />
                <Route path="/home/permintaan/:id" element={<AdminRequestDetail />} />
                <Route path="/home/distribusi" element={<AdminDistributions />} />
                <Route path="/home/audit" element={<AdminAudit />} />
                <Route path="/home/pengaturan" element={<AdminSettings />} />
                <Route path="*" element={<NotAllowed />} />
            </Routes>
        );
    }

    if (isUser) {
        return (
            <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<UserDashboard />} />
                <Route path="/home/arsip-saya" element={<PersonalArchive />} />
                <Route path="/home/permintaan" element={<UserRequests />} />
                <Route path="/home/permintaan/:id" element={<UserRequestDetail />} />
                <Route path="/home/distribusi" element={<UserDistributions />} />
                <Route path="*" element={<NotAllowed />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route path="*" element={<NotAllowed />} />
        </Routes>
    );
}
