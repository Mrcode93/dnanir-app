import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Animated, Dimensions } from 'react-native';
import * as ExpoSplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('screen');

interface SplashScreenProps {
  ready: boolean;
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ ready, onFinish }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const hiddenRef = useRef(false);

  useEffect(() => {
    // Hide native splash immediately and take over with our custom one
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || hiddenRef.current) return;
    hiddenRef.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [ready]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Image
        source={require('../../assets/images/splash.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    width,
    height,
    backgroundColor: '#003459',
    zIndex: 999,
  },
  image: {
    width,
    height,
  },
});
