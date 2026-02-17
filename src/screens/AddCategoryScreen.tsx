import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { addCustomCategory, updateCustomCategory } from '../database/database';
import { alertService } from '../services/alertService';

interface AddCategoryScreenProps {
  navigation: any;
  route: any;
}

const AVAILABLE_ICONS = [
  'restaurant', 'car', 'bag', 'receipt', 'musical-notes', 'medical', 'school',
  'ellipse', 'cash', 'briefcase', 'trending-up', 'gift', 'home', 'airplane',
  'heart', 'star', 'pizza', 'cafe', 'bicycle', 'train', 'shirt', 'watch',
  'phone-portrait', 'laptop', 'game-controller', 'fitness', 'book', 'pencil',
  'gift-outline', 'trophy', 'diamond', 'flower', 'leaf', 'sunny', 'moon',
];

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
  ['#14B8A6', '#0D9488'], // Teal
];

export const AddCategoryScreen: React.FC<AddCategoryScreenProps> = ({
  navigation,
  route,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const category = route?.params?.category;
  const type = route?.params?.type || 'expense';


  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('ellipse');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);

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
        alertService.success('نجح', 'تم تحديث الفئة بنجاح');
      } else {
        await addCustomCategory({
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor[0]
        });
        alertService.success('نجح', 'تم إضافة الفئة بنجاح');
      }
      navigation.goBack();
    } catch (error: any) {
      alertService.error('خطأ', error?.message || 'حدث خطأ أثناء حفظ الفئة');
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {category ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.subtitle}>
              {category
                ? (type === 'expense' ? 'قم بتعديل بيانات فئة المصاريف' : 'قم بتعديل بيانات مصدر الدخل')
                : (type === 'expense' ? 'أضف فئة جديدة للمصاريف' : 'أضف مصدر دخل جديد')
              }
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>اسم الفئة</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="أدخل اسم الفئة"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={30}
                autoFocus
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>اختر الأيقونة</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.iconScroll}
                contentContainerStyle={styles.iconContainer}
              >
                {AVAILABLE_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    onPress={() => setSelectedIcon(icon)}
                    style={[
                      styles.iconButton,
                      selectedIcon === icon && styles.iconButtonSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={icon as any}
                      size={24}
                      color={
                        selectedIcon === icon
                          ? theme.colors.textInverse
                          : theme.colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>اختر اللون</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.colorScroll}
                contentContainerStyle={styles.colorContainer}
              >
                {COLOR_PRESETS.map((color, index) => {
                  const isSelected =
                    selectedColor[0] === color[0] && selectedColor[1] === color[1];
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setSelectedColor(color)}
                      style={styles.colorButton}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={color as any}
                        style={[
                          styles.colorGradient,
                          isSelected && styles.colorGradientSelected,
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={theme.colors.textInverse}
                          />
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.cancelButton}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveButton}
              activeOpacity={0.7}
              disabled={!name.trim()}
            >
              <LinearGradient
                colors={name.trim() ? (selectedColor as any) : ['#9CA3AF', '#6B7280']}
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.saveButtonText}>
                  {category ? 'تحديث' : 'حفظ'}
                </Text>
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
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
  },
  inputContainer: {
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
  iconScroll: {
    marginTop: theme.spacing.sm,
  },
  iconContainer: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  iconButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  colorScroll: {
    marginTop: theme.spacing.sm,
  },
  colorContainer: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  colorGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorGradientSelected: {
    borderColor: theme.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
});
