import { I18nManager } from 'react-native';

// RTL-aware style utilities
export const RTLStyles = {
  // RTL-aware flex direction
  flexRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  
  flexRowReverse: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
  },
  
  // RTL-aware margins
  marginLeft: (value: number) => ({
    marginLeft: I18nManager.isRTL ? 0 : value,
    marginRight: I18nManager.isRTL ? value : 0,
  }),
  
  marginRight: (value: number) => ({
    marginRight: I18nManager.isRTL ? 0 : value,
    marginLeft: I18nManager.isRTL ? value : 0,
  }),
  
  // RTL-aware padding
  paddingLeft: (value: number) => ({
    paddingLeft: I18nManager.isRTL ? 0 : value,
    paddingRight: I18nManager.isRTL ? value : 0,
  }),
  
  paddingRight: (value: number) => ({
    paddingRight: I18nManager.isRTL ? 0 : value,
    paddingLeft: I18nManager.isRTL ? value : 0,
  }),
  
  // RTL-aware positioning
  left: (value: number) => ({
    left: I18nManager.isRTL ? undefined : value,
    right: I18nManager.isRTL ? value : undefined,
  }),
  
  right: (value: number) => ({
    right: I18nManager.isRTL ? undefined : value,
    left: I18nManager.isRTL ? value : undefined,
  }),
  
  // RTL-aware text alignment
  textAlign: {
    left: I18nManager.isRTL ? 'right' : 'left',
    right: I18nManager.isRTL ? 'left' : 'right',
    center: 'center',
  },
  
  // RTL-aware direction
  direction: I18nManager.isRTL ? 'rtl' : 'ltr',
  
  // RTL-aware writing direction
  writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  
  // Common RTL styles
  container: {
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  
  // RTL-aware header
  header: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  
  // RTL-aware card
  card: {
    direction: I18nManager.isRTL ? 'rtl' : 'ltr',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  
  // RTL-aware button row
  buttonRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
  },
  
  // RTL-aware icon with text
  iconWithText: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
};
