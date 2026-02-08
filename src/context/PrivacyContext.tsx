import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PrivacyContextType = {
    isPrivacyEnabled: boolean;
    togglePrivacy: () => void;
};

const PrivacyContext = createContext<PrivacyContextType>({
    isPrivacyEnabled: false,
    togglePrivacy: () => { },
});

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isPrivacyEnabled, setIsPrivacyEnabled] = useState(false);

    useEffect(() => {
        // Load persisted state
        AsyncStorage.getItem('privacy_mode').then((value) => {
            if (value !== null) {
                setIsPrivacyEnabled(value === 'true');
            }
        });
    }, []);

    const togglePrivacy = () => {
        const newState = !isPrivacyEnabled;
        setIsPrivacyEnabled(newState);
        AsyncStorage.setItem('privacy_mode', String(newState));
    };

    return (
        <PrivacyContext.Provider value={{ isPrivacyEnabled, togglePrivacy }}>
            {children}
        </PrivacyContext.Provider>
    );
};

export const usePrivacy = () => useContext(PrivacyContext);
