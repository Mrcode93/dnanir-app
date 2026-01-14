import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';

interface MonthFilterProps {
  selectedMonth: { year: number; month: number } | null;
  onMonthChange: (year: number, month: number) => void;
  showAllOption?: boolean;
  style?: any;
  availableMonths?: Array<{ year: number; month: number }>;
}

export const MonthFilter: React.FC<MonthFilterProps> = ({
  selectedMonth,
  onMonthChange,
  showAllOption = true,
  style,
  availableMonths,
}) => {
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Month names in Arabic
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  // Get month label
  const getMonthLabel = () => {
    if (!selectedMonth || (selectedMonth.year === 0 && selectedMonth.month === 0)) {
      return 'الكل';
    }
    return `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`;
  };

  // Generate months list (only months with data + current month)
  const getMonthsList = () => {
    const months: Array<{ year: number; month: number; label: string }> = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Add "All" option if enabled
    if (showAllOption) {
      months.push({ year: 0, month: 0, label: 'الكل (جميع البيانات)' });
    }
    
    // Create a Set of available months for quick lookup
    const availableMonthsSet = new Set<string>();
    if (availableMonths) {
      availableMonths.forEach(m => {
        availableMonthsSet.add(`${m.year}-${m.month}`);
      });
    }
    
    // Always include current month
    const currentMonthKey = `${currentYear}-${currentMonth}`;
    if (!availableMonthsSet.has(currentMonthKey)) {
      availableMonthsSet.add(currentMonthKey);
    }
    
    // Convert available months to array and sort by date (newest first)
    const monthsArray: Array<{ year: number; month: number }> = Array.from(availableMonthsSet).map(key => {
      const [year, month] = key.split('-').map(Number);
      return { year, month };
    }).sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year; // Newer year first
      }
      return b.month - a.month; // Newer month first
    });
    
    // Add months to list
    monthsArray.forEach(({ year, month }) => {
      const isCurrent = year === currentYear && month === currentMonth;
      months.push({
        year,
        month,
        label: `${monthNames[month - 1]} ${year}${isCurrent ? ' (الحالي)' : ''}`,
      });
    });
    
    return months;
  };

  const handleMonthSelect = (year: number, month: number) => {
    if (year === 0 && month === 0) {
      onMonthChange(0, 0); // All data
    } else {
      onMonthChange(year, month);
    }
    setShowMonthPicker(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.filterButton, style]}
        onPress={() => setShowMonthPicker(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.filterButtonGradient}
        >
          <Ionicons name="calendar" size={16} color={theme.colors.textInverse} />
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {getMonthLabel()}
          </Text>
          <Ionicons name="chevron-down" size={14} color={theme.colors.textInverse} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر الفترة</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.monthList}>
              {getMonthsList().map((item, index) => {
                const isSelected = selectedMonth
                  ? (item.year === 0 && item.month === 0 && selectedMonth.year === 0 && selectedMonth.month === 0)
                    || (item.year === selectedMonth.year && item.month === selectedMonth.month)
                  : (item.year === 0 && item.month === 0);
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.monthItem,
                      isSelected && styles.monthItemSelected,
                    ]}
                    onPress={() => handleMonthSelect(item.year, item.month)}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={styles.monthItemGradient}
                      >
                        <Text style={styles.monthItemTextSelected}>{item.label}</Text>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.textInverse} />
                      </LinearGradient>
                    ) : (
                      <>
                        <Text style={styles.monthItemText}>{item.label}</Text>
                        <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  filterButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    minWidth: 120,
    maxWidth: 160,
    ...theme.shadows.md,
  },
  filterButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filterButtonText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
    ...theme.shadows.lg,
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
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  monthList: {
    maxHeight: 400,
  },
  monthItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    direction: 'ltr',
  },
  monthItemSelected: {
    borderRadius: 0,
  },
  monthItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  monthItemText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  monthItemTextSelected: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
