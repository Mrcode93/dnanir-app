import { useState, useEffect } from 'react';
import { I18nManager } from 'react-native';

// Custom hook to force RTL for Arabic app
export const useRTL = () => {
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    // Force RTL for Arabic app
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
    I18nManager.swapLeftAndRightInRTL(true);

    // Check RTL status
    const checkRTL = () => {
      const rtlStatus = I18nManager.isRTL;
      setIsRTL(rtlStatus);
      
      if (!rtlStatus) {
        // Force RTL behavior even if system doesn't detect it
        setIsRTL(true);
      }
    };

    checkRTL();

    // Re-check after a delay
    const timer = setTimeout(checkRTL, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return {
    isRTL: true, // Always return true for Arabic app
    isRTLSystem: I18nManager.isRTL, // System detection
    getFlexDirection: (defaultDirection: 'row' | 'column' = 'row') => {
      if (defaultDirection === 'row') {
        return 'row-reverse'; // Always RTL for Arabic
      }
      return defaultDirection;
    },
    getTextAlign: (defaultAlign: 'left' | 'right' | 'center' = 'left') => {
      if (defaultAlign === 'left') {
        return 'right'; // Always RTL for Arabic
      }
      if (defaultAlign === 'right') {
        return 'left'; // Always RTL for Arabic
      }
      return defaultAlign;
    },
    getMargin: (left: number = 0, right: number = 0) => ({
      marginLeft: right,
      marginRight: left,
    }),
    getPadding: (left: number = 0, right: number = 0) => ({
      paddingLeft: right,
      paddingRight: left,
    }),
    getPosition: (left?: number, right?: number) => ({
      left: right,
      right: left,
    }),
  };
};
