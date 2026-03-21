import React from 'react';
import { Keyboard, View } from 'react-native';
import { SmartAddModal } from '../components/SmartAddModal';
import { useAppTheme } from '../utils/theme-context';

export const SmartAddActionScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();

  const handleClose = () => {
    Keyboard.dismiss();
    // Small delay to let keyboard start dismissing before navigation starts
    // This helps prevent UI shifting bugs on both iOS and Android
    setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    }, 100);
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
