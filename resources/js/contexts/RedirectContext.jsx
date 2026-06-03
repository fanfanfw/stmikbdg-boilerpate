import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

const RedirectContext = createContext(null);

export const RedirectProvider = ({ children }) => {
    const [showAnimation, setShowAnimation] = useState(true);
    const navigate = useNavigate();

    const goTo = (path) => {
        setShowAnimation(false);
        setTimeout(() => {
            navigate(path);
            setShowAnimation(true);
        }, 300);
    };

    const goExternal = (path) => {
        setShowAnimation(false);
        setTimeout(() => {
            window.location.href = path;
        }, 300);
    };

    return (
        <RedirectContext.Provider value={{ showAnimation, goTo, goExternal }}>
            {children}
        </RedirectContext.Provider>
    );
};

export const useRedirect = () => useContext(RedirectContext);
