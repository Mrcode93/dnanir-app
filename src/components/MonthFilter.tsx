import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { AppBottomSheet, AppButton } from '../design-system';

interface MonthFilterProps {
  selectedMonth: { year: number; month: number } | null;
  onMonthChange: (year: number, month: number) => void;
  showAllOption?: boolean;
  style?: any;
  availableMonths?: Array<{ year: number; month: number }>;
  textColor?: string;
  iconColor?: string;
  arrowColor?: string;
}

export const MonthFilter: React.FC<MonthFilterProps> = ({
  selectedMonth,
  onMonthChange,
  showAllOption = true,
  style,
  availableMonths,
  textColor: propTextColor,
  iconColor: propIconColor,
  arrowColor: propArrowColor,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Default themed colors
  const textColor = propTextColor || theme.colors.primary;
  const iconColor = propIconColor || theme.colors.primary;
  const arrowColor = propArrowColor || theme.colors.textMuted;

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
  const getMonthsList = useMemo(() => () => {
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
        label: `${monthNames[month - 1]} (${month}) ${year}${isCurrent ? ' (الحالي)' : ''}`,
      });
    });

    return months;
  }, [availableMonths, showAllOption]);

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
        activeOpacity={0.7}
      >
        <View style={styles.filterButtonContent}>
          <Ionicons name="calendar-outline" size={18} color={iconColor} />
          <Text style={[styles.filterButtonText, { color: textColor }]} numberOfLines={1}>
            {getMonthLabel()}
          </Text>
          <Ionicons name="chevron-down" size={14} color={arrowColor} />
        </View>
      </TouchableOpacity>

      <AppBottomSheet
        visible={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        title="تصفية حسب الفترة"
        maxHeight="80%"
      >
        <ScrollView style={styles.monthList} contentContainerStyle={styles.monthListContent}>
          {getMonthsList().map((item, index) => {
            const isSelected = selectedMonth
              ? (item.year === 0 && item.month === 0 && selectedMonth.year === 0 && selectedMonth.month === 0)
              || (item.year === selectedMonth.year && item.month === selectedMonth.month)
              : (item.year === 0 && item.month === 0);

            const isAllOption = item.year === 0 && item.month === 0;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthCard,
                  isSelected && styles.monthCardSelected,
                  isAllOption && !isSelected && styles.allDataCard
                ]}
                onPress={() => handleMonthSelect(item.year, item.month)}
                activeOpacity={0.9}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.selectedGradient}
                  >
                    <View style={styles.cardContent}>
                      <View style={styles.iconBoxSelected}>
                        <Ionicons name={isAllOption ? "layers" : "calendar"} size={22} color={theme.colors.primary} />
                      </View>
                      <Text style={styles.textSelected}>{item.label}</Text>
                      <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                      </View>
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={styles.cardContent}>
                    <View style={[styles.iconBox, isAllOption && { backgroundColor: theme.colors.surfaceLight }]}>
                      <Ionicons
                        name={isAllOption ? "layers-outline" : "calendar-outline"}
                        size={22}
                        color={isAllOption ? theme.colors.textSecondary : theme.colors.textSecondary}
                      />
                    </View>
                    <Text style={[styles.textNormal, isAllOption && { fontWeight: '700' }]}>{item.label}</Text>
                    {isAllOption && <View style={styles.allBadge}><Text style={styles.allBadgeText}>الكل</Text></View>}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>

        <View style={styles.modalFooter}>
          <AppButton
            label="موافق"
            onPress={() => setShowMonthPicker(false)}
            variant="primary"
          />
        </View>
      </AppBottomSheet>
    </>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  filterButton: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    flex: 1,
  },
  monthList: {
    maxHeight: 500,
  },
  monthListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  monthCard: {
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  allDataCard: {
    backgroundColor: theme.colors.surfaceLight,
    borderColor: theme.colors.border,
  },
  monthCardSelected: {
    borderWidth: 0,
    ...getPlatformShadow('md'),
  },
  selectedGradient: {
    padding: 0,
  },
  cardContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 12 : 0,
    marginRight: isRTL ? 0 : 12,
  },
  iconBoxSelected: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 12 : 0,
    marginRight: isRTL ? 0 : 12,
  },
  textNormal: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  textSelected: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.primary + '15',
    borderRadius: theme.borderRadius.md,
  },
  allBadgeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
