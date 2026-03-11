import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { addSavings, updateSavings } from '../database/database';
import { Savings, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';

export const AddSavingsScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { currencyCode } = useCurrency();
  const editingSavings = route.params?.savings as Savings | undefined;

  const [title, setTitle] = useState('');

  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('wallet');
  const [color, setColor] = useState('#10B981');
  const [currency, setCurrency] = useState(currencyCode);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingSavings) {
      setTitle(editingSavings.title);

      setDescription(editingSavings.description || '');
      setIcon(editingSavings.icon || 'wallet');
      setColor(editingSavings.color || '#10B981');
      setCurrency(editingSavings.currency || currencyCode);
    }
  }, [editingSavings]);

  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان للحصالة');
      return;
    }

    setLoading(true);

    try {
      const data = {
        title: title.trim(),

        description: description.trim() || undefined,
        icon,
        color,
        currency,
      };

      if (editingSavings) {
        await updateSavings(editingSavings.id, data);
        alertService.toastSuccess('تم تحديث الحصالة بنجاح');
      } else {
        await addSavings(data);
        alertService.toastSuccess('تم إنشاء الحصالة بنجاح');
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving savings:', error);
      alertService.error('خطأ', 'فشل حفظ الحصالة');
    } finally {
      setLoading(false);
    }
  };

  const icons = ['wallet', 'bag', 'car', 'home', 'airplane', 'gift', 'heart', 'school', 'construct', 'star'];
  const colors = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#22C55E', '#6366F1', '#6B7280'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.background}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={28} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{editingSavings ? 'تعديل الحصالة' : 'إنشاء حصالة جديدة'}</Text>
              <Text style={styles.headerSubtitle}>وفر أموالك بذكاء وسهولة</Text>
            </View>
            <View style={[styles.headerIcon, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon as any} size={24} color={color} />
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Input */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Ionicons name="bookmark-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.inputLabel}>عنوان الحصالة</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: عمرة، سيارة، طوارئ..."
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>


            {/* Icon Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>اختر أيقونة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {icons.map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setIcon(item)}
                    style={[
                      styles.pickerItem,
                      icon === item && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary, borderWidth: 1 }
                    ]}
                  >
                    <Ionicons name={item as any} size={24} color={icon === item ? theme.colors.primary : theme.colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Color Picker */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>اختر لوناً</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
                {colors.map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setColor(item)}
                    style={[
                      styles.colorItem,
                      { backgroundColor: item },
                      color === item && { borderColor: '#FFFFFF', borderWidth: 2, transform: [{ scale: 1.2 }] }

                    ]}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Description */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.inputLabel}>وصف بسيط</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="لماذا تدخر هذا المال؟"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

          </ScrollView>

          {/* Footer Save */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveButton}
              activeOpacity={0.8}
              disabled={loading || !title}
            >

              <LinearGradient
                colors={loading || !title ? ['#9CA3AF', '#6B7280'] as any : theme.gradients.success as any}
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>{loading ? 'جاري الحفظ...' : editingSavings ? 'تحديث' : 'إنشاء'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  inputCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...getPlatformShadow('sm'),
  },
  inputHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  textInput: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    padding: 12,
    textAlign: isRTL ? 'right' : 'left',
  },

  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
  },
  pickerRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  pickerItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
