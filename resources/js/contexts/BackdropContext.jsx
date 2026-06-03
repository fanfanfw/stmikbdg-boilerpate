import { Backdrop, CircularProgress } from "@mui/material";
import { createContext, useContext, useState } from "react";

const BackdropContext = createContext(null);

export const BackdropProvider = ({ children }) => {
    const [showBackdrop, setShowBackdrop] = useState(false);

    return (
        <BackdropContext.Provider value={{ showBackdrop, setShowBackdrop }}>
            <Backdrop
                sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={showBackdrop}
            >
                <CircularProgress color="inherit" />
            </Backdrop>
            {children}
        </BackdropContext.Provider>
    );
};

export const useBackdrop = () => useContext(BackdropContext);
