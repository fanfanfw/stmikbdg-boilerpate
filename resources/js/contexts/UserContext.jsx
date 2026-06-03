import { createContext, useContext, useState } from "react";

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [userdata, setUserdata] = useState(null);
    const [loadingUserdata, setLoadingUserdata] = useState(true);
    const [role, setRole] = useState(null);
    const [profile, setProfile] = useState(null);

    return (
        <UserContext.Provider value={{ userdata, setUserdata, loadingUserdata, setLoadingUserdata, role, setRole, profile, setProfile }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
