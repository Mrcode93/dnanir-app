import React, { useState, useRef, useEffect } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent, Text, Linking, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { tl } from '../localization';
import { isRTL } from '../utils/rtl';

interface BannerItem {
  id: string;
  title: string;
  text: string;
  url?: string;
  imageUrl?: any; // Changed from string to any to support require()
  onPress?: () => void;
}

interface PromoCarouselProps {
  items?: BannerItem[];
  autoPlayInterval?: number;
  onPress?: () => void;
  style?: any;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * A premium carousel banner for the dashboard.
 * Supports multiple slides with title, text, and optional URL.
 * Recommended image dimensions: 1200x500 pixels (approx. 2.4:1 ratio)
 */
export const PromoBanner: React.FC<PromoCarouselProps> = ({
  items: propItems,
  autoPlayInterval = 6000,
  onPress: rootOnPress,
  style
}) => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(createStyles);
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePress = async (item: BannerItem) => {
    if (item.onPress) {
      item.onPress();
    } else if (item.url) {
      try {
        const canOpen = await Linking.canOpenURL(item.url);
        if (canOpen) {
          await Linking.openURL(item.url);
        } else if (rootOnPress) {
          rootOnPress();
        }
      } catch (error) {
        if (rootOnPress) rootOnPress();
      }
    } else if (rootOnPress) {
      rootOnPress();
    }
  };

  // Default premium Arabic placeholders with local images
  const defaultItems = [
    {
      id: 'ai_hajji',
      title: tl("استشر الحجّي"),
      text: tl("مستشارك المالي العراقي الذكي جاهز لمساعدتك في إدارة ميزانيتك بحكمة."),
      imageUrl: require('../../assets/images/chat/haji-banner.png'),
      onPress: () => navigation.navigate('AIAdvisor')
    },
    {
      id: '0',
      title: tl("أوروكس للحلول البرمجية"),
      text: tl("نطور مواقع، تطبيقات، وأنظمة ذكية لأفكارك الرقمية المبتكرة."),
      url: 'https://urux.guru',
      imageUrl: require('../../assets/images/promo-images/urux.png')
    },
    {
      id: '1',
      title: tl("اشترك في برو"),
      text: tl("استمتع بمميزات حصرية مثل المزامنة السحابية و الادخال الصوتي و المحافظ المتعددة."),
      imageUrl: require('../../assets/images/promo-images/Pro-Subscription.png'),
      onPress: () => navigation.navigate('Plans')
    },
    {
      id: '2',
      title: tl("التحليل الذكي"),
      text: tl("دع الذكاء الاصطناعي يحلل مصاريفك ويعطيك نصائح لتوفير المال."),
      imageUrl: require('../../assets/images/promo-images/Smart-AI-Analysis.png'),
      onPress: () => navigation.navigate('AISmartInsights')
    },
    {
      id: '3',
      title: tl("الأهداف المالية"),
      text: tl("حدد أهدافك للادخار وتابع تقدمك خطوة بخطوة حتى تصل لهدفك."),
      imageUrl: require('../../assets/images/promo-images/Financial-Goals.png'),
      onPress: () => navigation.navigate('Goals')
    },
    {
      id: '4',
      title: tl("شارك التطبيق"),
      text: tl("ساعد أصدقاءك على إدارة أموالهم وشاركهم تجربة دنانير الرائعة."),
      imageUrl: require('../../assets/images/promo-images/Share-App.png'),
      onPress: () => {
        Share.share({
          message: tl('جرب تطبيق دنانير لإدارة مصاريفك! تطبيق رائع وسهل الاستخدام. حمله الآن من هنا: https://mrcodeiq.com/dnanir'),
          url: 'https://mrcodeiq.guru/apps',
          title: tl('تطبيق دنانير')
        });
      }
    },
  ];

  const items = propItems || defaultItems;
  const displayItems = isRTL ? [...items].reverse() : items;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const itemWidth = SCREEN_WIDTH - theme.spacing.lg * 2;
    const visualIndex = Math.round(scrollOffset / itemWidth);

    // Map visual back to logical
    const logicalIndex = isRTL ? (displayItems.length - 1 - visualIndex) : visualIndex;

    if (logicalIndex !== activeIndex && logicalIndex >= 0 && logicalIndex < items.length) {
      setActiveIndex(logicalIndex);
    }
  };

  useEffect(() => {
    if (items.length <= 1) return;

    const timer = setInterval(() => {
      const nextLogicalIndex = (activeIndex + 1) % items.length;
      const visualIndex = isRTL ? (displayItems.length - 1 - nextLogicalIndex) : nextLogicalIndex;
      const itemWidth = SCREEN_WIDTH - theme.spacing.lg * 2;

      scrollViewRef.current?.scrollTo({
        x: visualIndex * itemWidth,
        animated: true,
      });
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [activeIndex, items.length, autoPlayInterval, theme.spacing.lg, displayItems.length]);

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        // Ensure starting on the right
        contentOffset={isRTL ? { x: (displayItems.length - 1) * (SCREEN_WIDTH - theme.spacing.lg * 2), y: 0 } : undefined}
      >
        {displayItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.9}
            onPress={() => handlePress(item)}
            style={styles.bannerWrapper}
          >
            {item.imageUrl ? (
              <Image
                source={typeof item.imageUrl === 'string' ? { uri: item.imageUrl } : item.imageUrl}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.placeholder, { backgroundColor: theme.colors.surfaceLight }]}>
                <View style={[styles.abstractCircle, { backgroundColor: theme.colors.primary + '15', top: -30, right: -20, width: 120, height: 120 }]} />
                <View style={[styles.abstractCircle, { backgroundColor: theme.colors.info + '10', bottom: -40, left: -10, width: 150, height: 150 }]} />
              </View>
            )}

            {/* Overlay Content using Gradient for professional look - Stronger on the right */}
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.45)', 'transparent']}
              start={{ x: 1, y: 0.5 }} // Start from right
              end={{ x: 0, y: 0.5 }}   // Fade towards left
              style={styles.overlay}
            >
              <View style={styles.textContainer}>
                <View style={styles.titleWrapper}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.titleIndicator} />
                </View>
                <Text style={styles.text} numberOfLines={2}>{item.text}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination Indicators - Respect RTL order visually */}
      {items.length > 1 && (
        <View style={[styles.pagination, isRTL && { flexDirection: 'row-reverse' }]}>
          {items.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                activeIndex === index ? styles.activeDot : styles.inactiveDot,
                { backgroundColor: activeIndex === index ? theme.colors.primary : theme.colors.border + '50' }
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 0,
    marginBottom: theme.spacing.md,
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  bannerWrapper: {
    width: SCREEN_WIDTH - theme.spacing.lg * 2,
    height: 110,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    ...getPlatformShadow('md'),
    borderWidth: 1,
    borderColor: theme.colors.border + '50',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  abstractCircle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  textContainer: {
    width: '65%', // Limit width for better layout
    alignItems: 'flex-end',
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  titleIndicator: {
    width: 3,
    height: 14,
    backgroundColor: theme.colors.primary,
    marginLeft: 8,
    borderRadius: 2,
  },
  text: {
    color: 'rgba(255, 255, 255, 0.7)', // Even lighter
    fontSize: 10,
    fontFamily: 'Tajawal', // Using Tajawal font
    lineHeight: 14,
    textAlign: 'right',
    fontWeight: '300',
    paddingRight: 0,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
  },
  inactiveDot: {
    width: 6,
  }
});
