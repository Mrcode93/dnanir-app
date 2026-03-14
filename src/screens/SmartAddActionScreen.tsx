import React from 'react';
import { View } from 'react-native';
import { SmartAddModal } from '../components/SmartAddModal';
import { useAppTheme } from '../utils/theme-context';

export const SmartAddActionScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <SmartAddModal
        visible={true}
        onClose={handleClose}
        onSuccess={handleClose}
        navigation={navigation}
      />
    </View>
  );
};
