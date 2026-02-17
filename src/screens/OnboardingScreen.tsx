import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { ONBOARDING_SLIDES, type OnboardingSlide } from '../constants/onboardingData';
import { onboardingStorage } from '../services/onboardingStorage';

type OnboardingScreenProps = {
  navigation: any;
  onFinish?: () => void;
};

type SlideItemProps = {
  item: OnboardingSlide;
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  styles: ReturnType<typeof createStyles>;
};

const SlideItem = React.memo(
  ({ item, width, height, topInset, bottomInset, styles }: SlideItemProps) => {
    const contentTop = Math.max(topInset, 12) + 56;
    const contentBottom = Math.max(bottomInset, 16) + 140;

    return (
      <View style={[styles.slide, { width, height, paddingTop: contentTop, paddingBottom: contentBottom }]}>
        <View style={styles.illustrationContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name={item.icon} size={64} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.title}>{item.title}</Text>

        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        {item.bullets?.length ? (
          <View style={styles.bullets}>
            {item.bullets.map((bullet, index) => (
              <View key={`${item.key}-bullet-${index}`} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <View style={styles.bulletContent}>
                  <Text style={styles.bulletTitle}>{bullet.title}</Text>
                  {bullet.text ? <Text style={styles.bulletText}>{bullet.text}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  }
);

const Pagination = ({
  data,
  scrollX,
  width,
  styles,
}: {
  data: OnboardingSlide[];
  scrollX: Animated.Value;
  width: number;
  styles: ReturnType<typeof createStyles>;
}) => {
  return (
    <View style={styles.pagination}>
      {data.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];
        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.8, 1.4, 0.8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.35, 1, 0.35],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={`dot-${index}`}
            style={[
              styles.dot,
              {
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

export const OnboardingScreen = ({ navigation, onFinish }: OnboardingScreenProps) => {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const flatListRef = useRef<FlatList<OnboardingSlide> | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const slides = useMemo(() => ONBOARDING_SLIDES, []);
  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(index, slides.length - 1)),
    [slides.length]
  );

  const getIndexFromOffset = useCallback(
    (offsetX: number) => {
      const rawOffset = Math.abs(offsetX);
      const index = Math.round(rawOffset / width);
      return clampIndex(index);
    },
    [clampIndex, width]
  );

  const scrollToIndexOffset = useCallback(
    (index: number) => {
      const clamped = clampIndex(index);
      flatListRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    },
    [clampIndex, width]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: any) => {
      const offsetX = event?.nativeEvent?.contentOffset?.x ?? 0;
      setCurrentIndex(getIndexFromOffset(offsetX));
    },
    [getIndexFromOffset]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<OnboardingSlide> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

  const handleScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      ),
    [scrollX]
  );

  const navigateToAuth = useCallback(() => {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'Auth' }],
    });
  }, [navigation]);

  const completeOnboarding = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    await onboardingStorage.setHasSeenOnboarding(true);
    onFinish?.();
    navigateToAuth();
  }, [isCompleting, navigateToAuth, onFinish]);

  const handleNext = useCallback(() => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollToIndexOffset(nextIndex);
    } else {
      completeOnboarding();
    }
  }, [completeOnboarding, currentIndex, scrollToIndexOffset, slides.length]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      const nextIndex = currentIndex - 1;
      setCurrentIndex(nextIndex);
      scrollToIndexOffset(nextIndex);
    }
  }, [currentIndex, scrollToIndexOffset]);

  const renderItem = useCallback(
    ({ item }: { item: OnboardingSlide }) => (
      <SlideItem
        item={item}
        width={width}
        height={height}
        topInset={insets.top}
        bottomInset={insets.bottom}
        styles={styles}
      />
    ),
    [height, insets.bottom, insets.top, styles, width]
  );

  const isLast = currentIndex === slides.length - 1;
  const footerPaddingBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 16);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={getItemLayout}
        initialNumToRender={1}
        windowSize={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        style={styles.list}
        snapToInterval={width}
        decelerationRate="fast"
        disableIntervalMomentum
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top', 'bottom']}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={completeOnboarding}
            activeOpacity={0.8}
            disabled={isCompleting}
          >
            <Text style={styles.skipText}>تخطي</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
          <Pagination data={slides} scrollX={scrollX} width={width} styles={styles} />

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, currentIndex === 0 && styles.disabledButton]}
              onPress={handleBack}
              disabled={currentIndex === 0 || isCompleting}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryText, currentIndex === 0 && styles.disabledText]}>رجوع</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              disabled={isCompleting}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryText}>{isLast ? 'ابدأ' : 'التالي'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      direction: 'ltr',
    },
    list: {
      ...StyleSheet.absoluteFillObject,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isRTL ? 'flex-start' : 'flex-end',
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.sm,
    },
    skipButton: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.35)',
      ...getPlatformShadow('sm'),
    },
    skipText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.sm,
      color: '#FFFFFF',
      fontWeight: getPlatformFontWeight('600'),
    },
    slide: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      backgroundColor: '#0B5A7A',
      paddingHorizontal: theme.spacing.xl,
    },
    illustrationContainer: {
      width: 180,
      height: 180,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 90,
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      marginBottom: theme.spacing.lg,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      ...getPlatformShadow('md'),
    },
    title: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.xxl,
      color: '#FFFFFF',
      fontWeight: getPlatformFontWeight('800'),
      textAlign: 'center',
      writingDirection: 'rtl',
      marginBottom: theme.spacing.sm,
    },
    description: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.md,
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 26,
      marginBottom: theme.spacing.md,
    },
    bullets: {
      width: '100%',
      marginTop: theme.spacing.sm,
      gap: 12,
    },
    bulletItem: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    bulletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
      marginTop: 6,
    },
    bulletContent: {
      flex: 1,
    },
    bulletTitle: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.md,
      color: '#FFFFFF',
      fontWeight: getPlatformFontWeight('700'),
      textAlign: 'right',
      writingDirection: 'rtl',
      marginBottom: 2,
    },
    bulletText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.sm,
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'right',
      writingDirection: 'rtl',
      lineHeight: 22,
    },
    footer: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.md,
    },
    pagination: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#FFFFFF',
    },
    buttonsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.4)',
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      alignItems: 'center',
    },
    secondaryText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.md,
      color: '#FFFFFF',
      fontWeight: getPlatformFontWeight('600'),
    },
    primaryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      ...getPlatformShadow('md'),
    },
    primaryText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.sizes.md,
      color: '#003459',
      fontWeight: getPlatformFontWeight('700'),
    },
    disabledButton: {
      opacity: 0.4,
    },
    disabledText: {
      color: theme.colors.textMuted,
    },
  });
