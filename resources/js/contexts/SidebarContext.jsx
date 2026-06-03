import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
    const [showSidebar, setShowSidebar] = useState(false);
    const pathname = useLocation();

    useEffect(() => {
        setShowSidebar(false);
    }, [pathname]);

    return (
        <SidebarContext.Provider value={{ showSidebar, setShowSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => useContext(SidebarContext);
