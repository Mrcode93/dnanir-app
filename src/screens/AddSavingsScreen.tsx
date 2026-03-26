import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Keyboard, FlatList, StatusBar } from 'react-native';
import { TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { addSavings, updateSavings } from '../database/database';
import { Savings } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { tl, useLocalization } from "../localization";
export const AddSavingsScreen = ({
  navigation,
  route
}: any) => {
  useLocalization();
  const {
    theme,
    isDark
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    currencyCode
  } = useCurrency();
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
  }, [editingSavings, currencyCode]);
  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال عنوان للحصالة"));
      return;
    }
    setLoading(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        currency
      };
      if (editingSavings) {
        await updateSavings(editingSavings.id, data);
        alertService.toastSuccess(tl("تم تحديث الحصالة بنجاح"));
      } else {
        await addSavings(data);
        alertService.toastSuccess(tl("تم إنشاء الحصالة بنجاح"));
      }
      navigation.goBack();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل حفظ الحصالة"));
    } finally {
      setLoading(false);
    }
  };
  const icons = ['wallet', 'bag', 'car', 'home', 'airplane', 'gift', 'heart', 'school', 'construct', 'star'];
  const colors = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#22C55E', '#6366F1', '#6B7280'];
  const saveFooter = <AppButton label={editingSavings ? tl("تحديث الحصالة") : tl("إنشاء الحصالة")} onPress={handleSave} variant="primary" size="lg" loading={loading} disabled={loading || !title} rightIcon="checkmark-circle" style={{
    backgroundColor: color
  }} />;
  return <ScreenContainer scrollable edges={[]} scrollPadBottom={32}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <AppHeader title={editingSavings ? tl("تعديل الحصالة") : tl("حصالة جديدة")} backIcon="close" onBack={() => navigation.goBack()} />

      {/* Icon Preview */}
      <View style={styles.previewSection}>
        <View style={[styles.previewCircle, {
        backgroundColor: color + '20'
      }]}>
           <Ionicons name={icon as any} size={48} color={color} />
        </View>
        <Text style={styles.previewLabel}>{title || tl("اسم الحصالة")}</Text>
      </View>

      {/* Form Card */}
      <View style={styles.card}>
        {/* Title */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="bookmark-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput placeholder={tl("اسم الحصالة (عمرة، سيارة...)")} value={title} onChangeText={setTitle} style={styles.fieldInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />
        </View>

        <View style={styles.divider} />

        {/* Icons Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl("الأيقونة")}</Text>
          <FlatList data={icons} horizontal inverted={isRTL} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerList} renderItem={({
          item
        }) => <TouchableOpacity key={item} onPress={() => setIcon(item)} style={[styles.pickerItem, icon === item && {
          backgroundColor: color + '20',
          borderColor: color,
          borderWidth: 2
        }]}>
                <Ionicons name={item as any} size={24} color={icon === item ? color : theme.colors.textSecondary} />
              </TouchableOpacity>} />
        </View>

        <View style={styles.divider} />

        {/* Colors Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl("اللون")}</Text>
          <FlatList data={colors} horizontal inverted={isRTL} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerList} renderItem={({
          item
        }) => <TouchableOpacity key={item} onPress={() => setColor(item)} style={[styles.colorItem, {
          backgroundColor: item
        }, color === item && {
          borderColor: theme.colors.surface,
          borderWidth: 3,
          ...getPlatformShadow('md')
        }]} />} />
        </View>

        <View style={styles.divider} />

        {/* Description */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput placeholder={tl("ملاحظات إضافية...")} value={description} onChangeText={setDescription} style={styles.fieldInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} multiline />
        </View>
      </View>

      <View style={{
      paddingHorizontal: 20,
      marginTop: 12,
      marginBottom: 24
    }}>
        {saveFooter}
      </View>

    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  previewSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32
  },
  previewCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  previewLabel: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('sm')
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
    fontWeight: getPlatformFontWeight('600')
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 50,
    padding: 0
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
    opacity: 0.5
  },
  pickerList: {
    paddingHorizontal: 0,
    gap: 12
  },
  pickerItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderColor: 'transparent',
    borderWidth: 2
  },
  colorItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 12
  }
});
