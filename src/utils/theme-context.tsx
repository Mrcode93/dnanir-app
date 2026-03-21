import React, { createContext, useContext, useMemo } from 'react';
import { lightTheme, AppTheme } from './theme-constants';
import { useLocalization } from '../localization';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeContextValue = {
    theme: AppTheme;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    isDark: boolean;
};

export const ThemeContext = createContext<ThemeContextValue>({
    theme: lightTheme,
    themeMode: 'light',
    setThemeMode: () => { },
    isDark: false,
});

export const ThemeProvider: React.FC<{ value: ThemeContextValue; children: React.ReactNode }> = ({
    value,
    children,
}) => {
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);

export const useThemedStyles = <T extends Record<string, any>>(
    factory: (theme: AppTheme) => T
): T => {
    const { theme: activeTheme } = useAppTheme();
    const { isRTL } = useLocalization();
    return useMemo(() => factory(activeTheme), [activeTheme, factory, isRTL]);
};
