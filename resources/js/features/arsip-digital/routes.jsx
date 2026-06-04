import { Routes, Route } from "react-router-dom";
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

import NotAllowed from "./common/NotAllowed";

export default function ArsipDigitalRoutes() {
    const { role } = useUser();
    const isAdmin = role === 'admin';
    const isMahasiswa = role === 'mahasiswa';

    if (isAdmin) {
        return (
            <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/arsip-pengguna" element={<AdminArchive />} />
                <Route path="/permintaan" element={<AdminRequests />} />
                <Route path="/permintaan/:id" element={<AdminRequestDetail />} />
                <Route path="/distribusi" element={<AdminDistributions />} />
                <Route path="/audit" element={<AdminAudit />} />
                <Route path="*" element={<NotAllowed />} />
            </Routes>
        );
    }

    if (isMahasiswa) {
        return (
            <Routes>
                <Route path="/" element={<UserDashboard />} />
                <Route path="/arsip-saya" element={<PersonalArchive />} />
                <Route path="/permintaan" element={<UserRequests />} />
                <Route path="/permintaan/:id" element={<UserRequestDetail />} />
                <Route path="/distribusi" element={<UserDistributions />} />
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
