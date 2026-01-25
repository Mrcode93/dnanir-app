import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { ChallengeCategory, CHALLENGE_CATEGORIES } from '../types';
import { isRTL } from '../utils/rtl';

interface AddCustomChallengeModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (challenge: {
    title: string;
    description: string;
    category: ChallengeCategory;
    icon: string;
    duration: number;
    targetValue?: number;
    targetProgress: number;
  }) => void;
  editingChallenge?: import('../database/database').Challenge | null;
}

const COMMON_ICONS = [
  'trophy-outline',
  'star-outline',
  'flame-outline',
  'rocket-outline',
  'diamond-outline',
  'medal-outline',
  'ribbon-outline',
  'award-outline',
  'checkmark-circle-outline',
  'flag-outline',
  'target-outline',
  'bulb-outline',
  'shield-outline',
  'heart-outline',
  'thunderstorm-outline',
  'flash-outline',
  'pulse-outline',
  'fitness-outline',
  'barbell-outline',
  'trophy',
  'star',
  'flame',
  'rocket',
  'diamond',
] as const;

export const AddCustomChallengeModal = ({
  visible,
  onDismiss,
  onSave,
  editingChallenge,
}: AddCustomChallengeModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('discipline');
  const [selectedIcon, setSelectedIcon] = useState<string>('trophy-outline');
  const [duration, setDuration] = useState('7');
  const [targetValue, setTargetValue] = useState('');
  const [targetProgress, setTargetProgress] = useState('1');

  React.useEffect(() => {
    if (editingChallenge && visible) {
      setTitle(editingChallenge.title);
      setDescription(editingChallenge.description);
      setCategory(editingChallenge.category as ChallengeCategory);
      setSelectedIcon(editingChallenge.icon);
      const startDate = new Date(editingChallenge.startDate);
      const endDate = new Date(editingChallenge.endDate);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      setDuration(daysDiff.toString());
      setTargetValue(editingChallenge.targetValue?.toString() || '');
      setTargetProgress(editingChallenge.targetProgress.toString());
    } else if (!editingChallenge && visible) {
      // Reset form for new challenge
      setTitle('');
      setDescription('');
      setCategory('discipline');
      setSelectedIcon('trophy-outline');
      setDuration('7');
      setTargetValue('');
      setTargetProgress('1');
    }
  }, [editingChallenge, visible]);

  const handleSave = () => {
    if (!title.trim() || !description.trim()) {
      return;
    }

    const durationNum = parseInt(duration) || 7;
    const targetValueNum = targetValue ? parseFloat(targetValue) : undefined;
    const targetProgressNum = parseFloat(targetProgress) || 1;

    onSave({
      title: title.trim(),
      description: description.trim(),
      category,
      icon: selectedIcon,
      duration: durationNum,
      targetValue: targetValueNum,
      targetProgress: targetProgressNum,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setCategory('discipline');
    setSelectedIcon('trophy-outline');
    setDuration('7');
    setTargetValue('');
    setTargetProgress('1');
  };

  const categoryInfo = CHALLENGE_CATEGORIES[category];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingChallenge ? 'تعديل التحدي' : 'إضافة تحدٍ مخصص'}
            </Text>
            <TouchableOpacity onPress={onDismiss}>
              <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>عنوان التحدي</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: لا أشتري ملابس لمدة شهر"
                placeholderTextColor={theme.colors.textMuted}
                textAlign="right"
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>الوصف</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="وصف التحدي بالتفصيل"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>الفئة</Text>
              <View style={styles.categoryContainer}>
                {Object.entries(CHALLENGE_CATEGORIES).map(([key, info]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.categoryChip,
                      category === key && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(key as ChallengeCategory)}
                  >
                    <Ionicons
                      name={info.icon}
                      size={20}
                      color={category === key ? theme.colors.textInverse : info.color}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === key && styles.categoryChipTextActive,
                      ]}
                    >
                      {info.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Icon Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>الأيقونة</Text>
              <View style={styles.iconContainer}>
                {COMMON_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon && styles.iconOptionActive,
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Ionicons
                      name={icon as any}
                      size={24}
                      color={
                        selectedIcon === icon
                          ? theme.colors.textInverse
                          : theme.colors.textPrimary
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>المدة (بالأيام)</Text>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="7"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                textAlign="right"
              />
            </View>

            {/* Target Value (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>القيمة المستهدفة (اختياري)</Text>
              <TextInput
                style={styles.input}
                value={targetValue}
                onChangeText={setTargetValue}
                placeholder="مثال: 50000"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                textAlign="right"
              />
            </View>

            {/* Target Progress */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>قيمة الإنجاز المستهدفة</Text>
              <TextInput
                style={styles.input}
                value={targetProgress}
                onChangeText={setTargetProgress}
                placeholder="1"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="numeric"
                textAlign="right"
              />
              <Text style={styles.helperText}>
                القيمة التي يجب تحقيقها لإكمال التحدي
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onDismiss}
            >
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={!title.trim() || !description.trim()}
            >
              <Text style={styles.saveButtonText}>حفظ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    ...getPlatformShadow('lg'),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalScrollView: {
    maxHeight: 500,
    padding: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    minHeight: 80,
    paddingTop: theme.spacing.md,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  categoryChipTextActive: {
    color: theme.colors.textInverse,
  },
  iconContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  helperText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalActions: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceLight,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
});
