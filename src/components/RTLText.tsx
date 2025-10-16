import React from 'react';
import { Text, TextProps, Platform } from 'react-native';
import { useRTL } from '../hooks/useRTL';
import { defaultTextStyle } from '../utils/fontUtils';

interface RTLTextProps extends TextProps {
  children: React.ReactNode;
  fontFamily?: string;
}

const RTLText: React.FC<RTLTextProps> = ({ 
  children, 
  style, 
  fontFamily = 'Cairo-Regular',
  ...props 
}) => {
  const { getTextAlign } = useRTL();
  
  return (
    <Text
      style={[
        defaultTextStyle, // Apply default Cairo font style
        {
          fontFamily: fontFamily, // Use the provided fontFamily directly
          textAlign: getTextAlign('left'), // Always RTL for Arabic
          writingDirection: 'rtl', // Always RTL for Arabic
          direction: 'rtl', // Always RTL for Arabic
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

export default RTLText;
