import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { isRTL } from '../utils/rtl';
import { tl } from '../localization';

interface AIAdvisorBannerProps {
  onPress: () => void;
  style?: any;
}

export const AIAdvisorBanner: React.FC<AIAdvisorBannerProps> = ({ onPress, style }) => {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={onPress}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={isDark ? ['#312E81', '#1E1B4B'] : ['#4338CA', '#312E81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.imageContainer}>
            <Image 
              source={require('../../assets/images/chat/avatar.png')} 
              style={styles.avatar}
            />
            <View style={styles.onlineBadge} />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>{tl("اسأل الحجّي")}</Text>
            <Text style={styles.subtitle}>{tl("مستشارك المالي الذكي بانتظارك...")}</Text>
          </View>

          <View style={styles.actionIconContainer}>
            <View
              style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            >
              <Ionicons 
                name={isRTL ? "chevron-back" : "chevron-forward"} 
                size={20} 
                color="#FFFFFF" 
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginHorizontal: 12, // Reduced from theme.spacing.md (16) to make it wider
    borderRadius: 24,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginRight: isRTL ? 0 : 12,
    marginLeft: isRTL ? 12 : 0,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: isRTL ? undefined : 4,
    left: isRTL ? 4 : undefined,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#312E81',
  },
  textContainer: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: theme.typography.fontFamily,
  },
  actionIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
