import React from 'react';
import { Text, TextProps, Platform } from 'react-native';
import { defaultTextStyle, getFontStyle } from '../utils/fontUtils';

interface CairoTextProps extends TextProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  weight?: 'regular' | 'medium' | 'light' | 'bold';
  children: React.ReactNode;
}

const CairoText: React.FC<CairoTextProps> = ({ 
  size = 'md', 
  weight = 'regular', 
  style, 
  children, 
  ...props 
}) => {
  const fontStyle = getFontStyle(size, weight);
  
  return (
    <Text 
      style={[
        defaultTextStyle,
        fontStyle,
        style,
      ]} 
      {...props}
    >
      {children}
    </Text>
  );
};

export default CairoText;
