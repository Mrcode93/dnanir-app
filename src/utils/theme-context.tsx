import React, { createContext, useContext, useMemo } from 'react';
import { lightTheme, AppTheme } from './theme-constants';

export type ThemeContextValue = {
    theme: AppTheme;
    isDark: boolean;
    setIsDark: (dark: boolean) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
    theme: lightTheme,
    isDark: false,
    setIsDark: () => { },
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
    return useMemo(() => factory(activeTheme), [activeTheme, factory]);
};
