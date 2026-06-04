import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import CssBaseline from '@mui/material/CssBaseline';
import 'dayjs/locale/id';

import { UserProvider } from './contexts/UserContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { BackdropProvider } from './contexts/BackdropContext';
import { RedirectProvider } from './contexts/RedirectContext';
import ArsipDigitalApp from './Pages/ArsipDigitalApp';

// Bootstrap CSRF token
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (csrfToken) {
    window.axios = window.axios || {};
    window.axios.defaults = window.axios.defaults || {};
    window.axios.defaults.headers = window.axios.defaults.headers || {};
    window.axios.defaults.headers.common = window.axios.defaults.headers.common || {};
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
}

function App() {
    return (
        <BrowserRouter>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="id">
                <CssBaseline />
                <UserProvider>
                    <SidebarProvider>
                        <BackdropProvider>
                            <RedirectProvider>
                                <ArsipDigitalApp />
                            </RedirectProvider>
                        </BackdropProvider>
                    </SidebarProvider>
                </UserProvider>
            </LocalizationProvider>
        </BrowserRouter>
    );
}

const container = document.getElementById('react-app');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
