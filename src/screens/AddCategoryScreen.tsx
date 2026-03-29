import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, ScrollView, Platform, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { addCustomCategory, updateCustomCategory } from '../database/database';
import { alertService } from '../services/alertService';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { tl, useLocalization } from "../localization";
import { isRTL } from '../utils/rtl';
import { IconPickerModal } from '../components/IconPickerModal';

interface AddCategoryScreenProps {
  navigation: any;
  route: any;
}

const AVAILABLE_ICONS = ['restaurant', 'car', 'bag', 'receipt', 'musical-notes', 'medical', 'school', 'ellipse', 'cash', 'briefcase', 'trending-up', 'gift', 'home', 'airplane', 'heart', 'star', 'pizza', 'cafe', 'bicycle', 'train', 'shirt', 'watch', 'phone-portrait', 'laptop', 'game-controller', 'fitness', 'book', 'pencil', 'gift-outline', 'trophy', 'diamond', 'flower', 'leaf', 'sunny', 'moon'];

const COLOR_PRESETS = [
  ['#F59E0B', '#D97706'], // Orange
  ['#3B82F6', '#2563EB'], // Blue
  ['#EC4899', '#DB2777'], // Pink
  ['#EF4444', '#DC2626'], // Red
  ['#8B5CF6', '#7C3AED'], // Purple
  ['#10B981', '#059669'], // Green
  ['#06B6D4', '#0891B2'], // Cyan
  ['#6B7280', '#4B5563'], // Gray
  ['#F97316', '#EA580C'], // Orange Dark
  ['#14B8A6', '#0D9488']  // Teal
];

export const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({
  navigation,
  route
}) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const category = route?.params?.category;
  const type = route?.params?.type || 'expense';
  
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('ellipse');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [isIconPickerVisible, setIsIconPickerVisible] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name);
      setSelectedIcon(category.icon);
      const colorIndex = COLOR_PRESETS.findIndex(c => c[0] === category.color);
      if (colorIndex !== -1) {
        setSelectedColor(COLOR_PRESETS[colorIndex]);
      } else {
        setSelectedColor([category.color, category.color]);
      }
    }
  }, [category]);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (category?.id) {
        await updateCustomCategory(category.id, {
          name: name.trim(),
          icon: selectedIcon,
          color: selectedColor[0]
        });
        alertService.toastSuccess(tl("تم تحديث الفئة بنجاح"));
      } else {
        await addCustomCategory({
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor[0]
        });
        alertService.toastSuccess(tl("تم إضافة الفئة بنجاح"));
      }
      navigation.goBack();
    } catch (error: any) {
      alertService.error(tl("خطأ"), error?.message || tl("حدث خطأ أثناء حفظ الفئة"));
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const saveFooter = (
    <View style={styles.actions}>
      <AppButton label={tl("إلغاء")} onPress={handleClose} variant="ghost" size="md" style={styles.cancelButton} />
      <AppButton 
        label={category ? tl("تحديث") : tl("حفظ")} 
        onPress={handleSave} 
        variant="primary" 
        size="md" 
        disabled={!name.trim()} 
        style={[styles.saveButton, {
          backgroundColor: name.trim() ? selectedColor[0] : undefined
        }]} 
      />
    </View>
  );

  return (
    <ScreenContainer scrollable edges={['left', 'right']} scrollPadBottom={32} style={{
      backgroundColor: theme.colors.surfaceCard
    }}>
      <AppHeader 
        title={category ? tl("تعديل الفئة") : tl("إضافة فئة جديدة")} 
        backIcon="close" 
        onBack={handleClose} 
      />

      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <Text style={styles.subtitle}>
          {category ? type === 'expense' ? tl("قم بتعديل بيانات فئة المصاريف") : tl("قم بتعديل بيانات مصدر الدخل") : type === 'expense' ? tl("أضف فئة جديدة للمصاريف") : tl("أضف مصدر دخل جديد")}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{tl("اسم الفئة")}</Text>
          <TextInput 
            style={styles.input} 
            value={name} 
            onChangeText={setName} 
            placeholder={tl("أدخل اسم الفئة")} 
            placeholderTextColor={theme.colors.textMuted} 
            maxLength={30} 
            autoFocus 
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{tl("اختر الأيقونة")}</Text>
          <TouchableOpacity 
            onPress={() => setIsIconPickerVisible(true)} 
            style={[styles.selectedIconContainer, { borderColor: selectedColor[0] + '40', backgroundColor: selectedColor[0] + '05' }]} 
            activeOpacity={0.7}
          >
            <View style={[styles.selectedIconCircle, { backgroundColor: selectedColor[0] }]}>
              <Ionicons name={selectedIcon as any} size={32} color="#FFFFFF" />
            </View>
            <View style={styles.selectedIconInfo}>
              <Text style={styles.selectedIconLabel}>{tl("تغيير الأيقونة")}</Text>
              <Text style={styles.selectedIconSub}>{tl("أكثر من 50 أيقونة متاحة")}</Text>
            </View>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>{tl("اختر اللون")}</Text>
          <FlatList 
            data={COLOR_PRESETS}
            horizontal 
            inverted={isRTL}
            showsHorizontalScrollIndicator={false} 
            style={styles.colorScroll} 
            contentContainerStyle={styles.colorContainer}
            keyExtractor={color => color[0]}
            renderItem={({ item: color, index }) => {
              const isSelected = selectedColor[0] === color[0];
              return (
                <TouchableOpacity onPress={() => setSelectedColor(color)} style={styles.colorButton} activeOpacity={0.7}>
                  <LinearGradient 
                    colors={color as any} 
                    style={[styles.colorGradient, isSelected && { borderWidth: 3, borderColor: theme.colors.textPrimary }]} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }}
                  >
                    {isSelected && <Ionicons name="checkmark" size={20} color={theme.colors.textInverse} />}
                  </LinearGradient>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View style={{ marginTop: 32, marginBottom: 20 }}>
          {saveFooter}
        </View>
      </View>

      <IconPickerModal
        visible={isIconPickerVisible}
        selectedIcon={selectedIcon}
        onSelect={setSelectedIcon}
        onClose={() => setIsIconPickerVisible(false)}
      />
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    textAlign: isRTL ? 'right' : 'left'
  },
  inputContainer: {
    marginBottom: theme.spacing.lg
  },
  label: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: isRTL ? 'right' : 'left'
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    borderWidth: 1.5,
    borderColor: theme.colors.border
  },
  section: {
    marginBottom: theme.spacing.lg
  },
  selectedIconContainer: {
    flexDirection: 'row', // forced RTL handles this
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  selectedIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  selectedIconInfo: {
    flex: 1,
  },
  selectedIconLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  selectedIconSub: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  colorScroll: {
    marginTop: theme.spacing.xs
  },
  colorContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: theme.spacing.xs
  },
  colorButton: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden'
  },
  colorGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md
  },
  cancelButton: {
    flex: 1
  },
  saveButton: {
    flex: 2
  }
});
