import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
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

    const togglePrivacy = useCallback(() => {
        const newState = !isPrivacyEnabled;
        setIsPrivacyEnabled(newState);
        AsyncStorage.setItem('privacy_mode', String(newState));

        // Sync to Widget Storage (DefaultPreference)
        import('react-native-default-preference').then((DefaultPreference) => {
            DefaultPreference.default.setName('group.com.mrcodeiq.dinar');
            DefaultPreference.default.set('privacy_mode', String(newState));
        });
    }, [isPrivacyEnabled]);

    const value = useMemo(
        () => ({ isPrivacyEnabled, togglePrivacy }),
        [isPrivacyEnabled, togglePrivacy]
    );

    return (
        <PrivacyContext.Provider value={value}>
            {children}
        </PrivacyContext.Provider>
    );
};

export const usePrivacy = () => useContext(PrivacyContext);
