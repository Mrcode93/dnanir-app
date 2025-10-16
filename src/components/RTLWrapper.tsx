import React from 'react';
import { View } from 'react-native';
import { useRTL } from '../hooks/useRTL';

interface RTLWrapperProps {
  children: React.ReactNode;
  style?: any;
}

const RTLWrapper: React.FC<RTLWrapperProps> = ({ children, style }) => {
  const { isRTL } = useRTL();
  
  return (
    <View
      style={[
        {
          flex: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export default RTLWrapper;
