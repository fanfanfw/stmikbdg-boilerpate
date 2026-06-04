import { Button } from '@mui/material';
import { LogoutOutlined, HomeOutlined } from '@mui/icons-material';
import { useUser } from '../../../contexts/UserContext';

export default function NotAllowed() {
    const { role } = useUser();

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="space-y-4 text-center">
                <img
                    src="/images/not-found.png"
                    alt="Akses tidak tersedia"
                    className="w-80 mx-auto"
                />
                <div className="space-y-2">
                    <p className="text-lg sm:text-xl lg:text-2xl font-medium">
                        Halaman ini tidak bisa diakses
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                        Arsip Digital saat ini hanya tersedia untuk role Admin dan Mahasiswa. Role aktif Anda: {role || '-'}.
                    </p>
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button
                        href="/react"
                        variant="contained"
                        size="small"
                        startIcon={<HomeOutlined />}
                        sx={{ textTransform: 'none' }}
                    >
                        Ke Beranda
                    </Button>
                    <Button
                        href="/logout"
                        color="error"
                        variant="outlined"
                        size="small"
                        startIcon={<LogoutOutlined />}
                        sx={{ textTransform: 'none' }}
                    >
                        Keluar
                    </Button>
                </div>
            </div>
        </div>
    );
}
