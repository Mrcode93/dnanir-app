import { I18nManager } from 'react-native';

// RTL Configuration for the entire app
export const RTL_CONFIG = {
  // Force RTL layout
  isRTL: I18nManager.isRTL,
  
  // RTL-aware flex direction
  getFlexDirection: (defaultDirection: 'row' | 'column' = 'row') => {
    if (defaultDirection === 'row') {
      return I18nManager.isRTL ? 'row-reverse' : 'row';
    }
    return defaultDirection;
  },
  
  // RTL-aware margins
  getMargin: (left: number = 0, right: number = 0) => ({
    marginLeft: I18nManager.isRTL ? right : left,
    marginRight: I18nManager.isRTL ? left : right,
  }),
  
  // RTL-aware padding
  getPadding: (left: number = 0, right: number = 0) => ({
    paddingLeft: I18nManager.isRTL ? right : left,
    paddingRight: I18nManager.isRTL ? left : right,
  }),
  
  // RTL-aware positioning
  getPosition: (left?: number, right?: number) => {
    if (I18nManager.isRTL) {
      return {
        left: right,
        right: left,
      };
    }
    return {
      left,
      right,
    };
  },
  
  // RTL-aware text alignment
  getTextAlign: (defaultAlign: 'left' | 'right' | 'center' = 'left') => {
    if (defaultAlign === 'left') {
      return I18nManager.isRTL ? 'right' : 'left';
    }
    if (defaultAlign === 'right') {
      return I18nManager.isRTL ? 'left' : 'right';
    }
    return defaultAlign;
  },
  
  // RTL-aware writing direction
  getWritingDirection: () => I18nManager.isRTL ? 'rtl' : 'ltr',
  
  // RTL-aware direction
  getDirection: () => I18nManager.isRTL ? 'rtl' : 'ltr',
};

// Initialize RTL for the entire app
export const initializeRTL = () => {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
};
