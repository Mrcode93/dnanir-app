import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, useAppTheme, useThemedStyles } from '../utils/theme';
import { AppDialog, AppButton, AppInput } from '../design-system';

interface AddCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, icon: string, color: string, id?: number) => void;
  type: 'expense' | 'income';
  category?: {
    id: number;
    name: string;
    icon: string;
    color: string;
  } | null;
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

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  visible,
  onClose,
  onSave,
  type,
  category,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('ellipse');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);

  useEffect(() => {
    if (visible) {
      // Load category data if editing
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
    } else {
      setName('');
      setSelectedIcon('ellipse');
      setSelectedColor(COLOR_PRESETS[0]);
    }
  }, [visible, category]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), selectedIcon, selectedColor[0], category?.id);
      onClose();
    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
      title={category ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
      subtitle={
        category
          ? (type === 'expense' ? 'قم بتعديل بيانات فئة المصاريف' : 'قم بتعديل بيانات مصدر الدخل')
          : (type === 'expense' ? 'أضف فئة جديدة للمصاريف' : 'أضف مصدر دخل جديد')
      }
    >
      <View style={styles.inputContainer}>
        <Text style={styles.label}>اسم الفئة</Text>
        <AppInput
          value={name}
          onChangeText={setName}
          placeholder="أدخل اسم الفئة"
          style={styles.input}
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

      <View style={styles.actions}>
        <AppButton
          label="إلغاء"
          onPress={onClose}
          variant="secondary"
          style={styles.cancelButton}
        />
        <AppButton
          label={category ? 'تحديث' : 'حفظ'}
          onPress={handleSave}
          variant="primary"
          disabled={!name.trim()}
          style={styles.saveButton}
        />
      </View>
    </AppDialog>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  inputContainer: {
    width: '100%',
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
  },
  section: {
    width: '100%',
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
    width: '100%',
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
});
