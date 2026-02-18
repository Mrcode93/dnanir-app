import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Month names in Arabic
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  // Get month label
  const getMonthLabel = () => {
    if (!selectedMonth || (selectedMonth.year === 0 && selectedMonth.month === 0)) {
      return 'الكل';
    }
    return `${monthNames[selectedMonth.month - 1]} (${selectedMonth.month}) ${selectedMonth.year}`;
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
        label: `${monthNames[month - 1]} (${month}) ${year}${isCurrent ? ' (الحالي)' : ''}`,
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
        activeOpacity={0.7}
      >
        <View style={styles.filterButtonContent}>
          <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {getMonthLabel()}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {/* Pro Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تصفية حسب الفترة</Text>
              <TouchableOpacity
                onPress={() => setShowMonthPicker(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

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
                        <View style={[styles.iconBox, isAllOption && { backgroundColor: '#F1F5F9' }]}>
                          <Ionicons
                            name={isAllOption ? "layers-outline" : "calendar-outline"}
                            size={22}
                            color={isAllOption ? '#64748B' : theme.colors.textSecondary}
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
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => setShowMonthPicker(false)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={theme.gradients.primary as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmGradient}
                >
                  <Text style={styles.confirmButtonText}>موافق</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  filterButton: {
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 110,
    maxWidth: 150,
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
    color: '#0F172A',
    fontSize: 13,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF', // Clean white
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    ...getPlatformShadow('xl'),
    paddingBottom: 20,
    direction: 'ltr',

  },
  dragHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 12,
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A', // Slate 900
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right', // Explicitly aligned
    writingDirection: 'rtl',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 50,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  allDataCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
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
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 12 : 0,
    marginRight: isRTL ? 0 : 12,
  },
  iconBoxSelected: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF', // White background for icon inside gradient
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 12 : 0,
    marginRight: isRTL ? 0 : 12,
  },
  textNormal: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textSelected: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  allBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
  },
  allBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    fontFamily: theme.typography.fontFamily,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmButton: {
    height: 50,
    borderRadius: 15,
    overflow: 'hidden',
  },
  confirmGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
  },
});
