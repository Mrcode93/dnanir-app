import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { ScreenContainer } from '../design-system';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, eachDayOfInterval, isToday } from 'date-fns';
import { TransactionItem } from '../components/TransactionItem';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getExpensesPaginated, getIncomePaginated, getCustomCategories, CustomCategory, deleteExpense, deleteIncome } from '../database/database';
import { Expense, Income } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { formatDateLocal } from '../utils/date';
import { alertService } from '../services/alertService';
import { tl, useLocalization } from "../localization";
const {
  width
} = Dimensions.get('window');
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAY_NAMES = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
export const CalendarScreen = ({
  navigation,
  route
}: any) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency
  } = useCurrency();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<(Expense | Income)[]>([]);
  const [loading, setLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<(Expense | Income) | null>(null);
  const [monthActivity, setMonthActivity] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (route?.params?.action === 'today') {
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today);
      navigation.setParams({
        action: undefined
      });
    }
  }, [route?.params?.action, navigation]);

  // Fetch transactions for the whole month to show activity dots
  const fetchMonthActivity = useCallback(async () => {
    try {
      const start = formatDateLocal(startOfMonth(currentMonth));
      const end = formatDateLocal(endOfMonth(currentMonth));
      const [expenses, income] = await Promise.all([getExpensesPaginated({
        startDate: start,
        endDate: end
      }), getIncomePaginated({
        startDate: start,
        endDate: end
      })]);
      const dates = new Set<string>();
      expenses.forEach(e => dates.add(e.date));
      income.forEach(i => dates.add(i.date));
      setMonthActivity(dates);
    } catch (error) {}
  }, [currentMonth]);

  // Fetch transactions for the selected date
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = formatDateLocal(selectedDate);
      const [expenses, income, categories] = await Promise.all([getExpensesPaginated({
        startDate: dateStr,
        endDate: dateStr
      }), getIncomePaginated({
        startDate: dateStr,
        endDate: dateStr
      }), getCustomCategories()]);

      // Tag transactions with their type
      const taggedExpenses = expenses.map(e => ({
        ...e,
        type: 'expense' as const
      }));
      const taggedIncome = income.map(i => ({
        ...i,
        type: 'income' as const
      }));

      // Combine and sort (expenses first then income, or by id)
      setTransactions([...taggedExpenses, ...taggedIncome]);
      setCustomCategories(categories);
    } catch (error) {} finally {
      setLoading(false);
    }
  }, [selectedDate]);
  useEffect(() => {
    fetchTransactions();
    fetchMonthActivity();
  }, [fetchTransactions, fetchMonthActivity]);
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const renderHeader = () => {
    const monthName = tl(MONTH_NAMES[currentMonth.getMonth()]);
    const year = currentMonth.getFullYear();
    return <View style={styles.calendarHeader}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.headerButton}>
                    <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={22} color={theme.colors.primary} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{monthName}</Text>
                    <Text style={styles.headerYear}>{year}</Text>
                </View>
                <TouchableOpacity onPress={handleNextMonth} style={styles.headerButton}>
                    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={22} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>;
  };
  const renderDaysOfWeek = () => {
    return <View style={styles.daysOfWeekContainer}>
                {WEEKDAY_NAMES.map((day, index) => <View key={index} style={styles.dayOfWeekItem}>
                        <Text style={styles.dayOfWeekText}>{tl(day)}</Text>
                    </View>)}
            </View>;
  };
  const calendarGrid = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({
      start,
      end
    });
  }, [currentMonth]);
  const renderCalendarGrid = () => {
    return <View style={styles.calendarGrid}>
                {calendarGrid.map((day, index) => {
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, currentMonth);
        const isDayToday = isToday(day);
        return <TouchableOpacity key={index} style={[styles.dayItemOuter, !isCurrentMonth && styles.notCurrentMonthItem]} onPress={() => setSelectedDate(day)}>
                            {isSelected ? <LinearGradient colors={theme.gradients.primary as any} style={styles.selectedDayGradient} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }}>
                                    <Text style={styles.selectedDayText}>
                                        {day.getDate()}
                                    </Text>
                                </LinearGradient> : <View style={[styles.dayItemInner, !isDayToday && monthActivity.has(formatDateLocal(day)) && styles.activeDayInner]}>
                                    <Text style={[styles.dayText, isDayToday && styles.todayText, !isCurrentMonth && styles.notCurrentMonthText]}>
                                        {day.getDate()}
                                    </Text>
                                    {isDayToday && <View style={styles.todayDot} />}
                                </View>}
                        </TouchableOpacity>;
      })}
            </View>;
  };
  return <ScreenContainer scrollable={false}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} stickyHeaderIndices={[1]}>
                <View style={styles.calendarCard}>
                    {renderHeader()}
                    {renderDaysOfWeek()}
                    {renderCalendarGrid()}
                </View>

                <View style={styles.stickySectionBg}>
                    <View style={styles.transactionsSection}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionTitleRow}>
                                <Text style={styles.sectionTitle}>{tl("عمليات يوم")}{selectedDate.getDate()} {tl(MONTH_NAMES[selectedDate.getMonth()])}</Text>
                                <View style={styles.transactionCountBadge}>
                                    <Text style={styles.transactionCountText}>{transactions.length}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('AddExpense', {
              initialDate: selectedDate
            })} style={styles.addSmallBtn}>
                                <Ionicons name="add" size={24} color={theme.colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.listContainer}>
                    {loading ? <ActivityIndicator style={{
          marginTop: 40
        }} color={theme.colors.primary} size="large" /> : transactions.length > 0 ? transactions.map(item => <View key={`${(item as any).type}-${item.id}`} style={styles.itemWrapper}>
                                <TransactionItem item={item} type={(item as any).type} formatCurrency={formatCurrency} customCategories={customCategories} onPress={() => {
            setSelectedTransaction(item);
            setShowDetails(true);
          }} onEdit={() => {
            if ((item as any).type === 'expense') {
              navigation.navigate('AddExpense', {
                expense: item
              });
            } else {
              navigation.navigate('AddIncome', {
                income: item
              });
            }
          }} onDelete={async () => {
            try {
              if ((item as any).type === 'expense') {
                await deleteExpense(item.id);
              } else {
                await deleteIncome(item.id);
              }
              alertService.toastSuccess(tl("تم الحذف بنجاح"));
              fetchTransactions();
            } catch (error) {
              alertService.toastError(tl("حدث خطأ أثناء الحذف"));
            }
          }} />
                            </View>) : <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBg}>
                                <Ionicons name="calendar-outline" size={60} color={theme.colors.textMuted + '25'} />
                            </View>
                            <Text style={styles.emptyText}>{tl("لا توجد أي عمليات مسجلة في هذا التاريخ")}</Text>
                            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => navigation.navigate('AddExpense', {
            initialDate: selectedDate
          })}>
                                <Text style={styles.emptyAddBtnText}>{tl("أضف عملية الآن")}</Text>
                            </TouchableOpacity>
                        </View>}
                    <View style={{
          height: 100
        }} />
                </View>
            </ScrollView>

            <TransactionDetailsModal visible={showDetails} item={selectedTransaction} type={(selectedTransaction as any)?.type} customCategories={customCategories} onClose={() => {
      setShowDetails(false);
      setSelectedTransaction(null);
    }} onEdit={() => {
      if (selectedTransaction) {
        if ((selectedTransaction as any).type === 'expense') {
          navigation.navigate('AddExpense', {
            expense: selectedTransaction
          });
        } else {
          navigation.navigate('AddIncome', {
            income: selectedTransaction
          });
        }
      }
    }} />
        </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  topHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '50'
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center'
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  scrollContent: {
    flexGrow: 1
  },
  calendarCard: {
    margin: 16,
    padding: 16,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 28,
    ...getPlatformShadow('lg'),
    borderWidth: 1,
    borderColor: theme.colors.border + '30'
  },
  calendarHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitleContainer: {
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  headerYear: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginTop: -2
  },
  daysOfWeekContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingHorizontal: 4
  },
  dayOfWeekItem: {
    width: (width - 64) / 7,
    alignItems: 'center'
  },
  dayOfWeekText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily
  },
  calendarGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap'
  },
  dayItemOuter: {
    width: Math.floor((width - 64) / 7) - 0.2,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4
  },
  dayItemInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14
  },
  activeDayInner: {
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary + '25'
  },
  selectedDayGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('md')
  },
  notCurrentMonthItem: {
    opacity: 0.25
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900'
  },
  todayText: {
    color: theme.colors.primary,
    fontWeight: '900'
  },
  notCurrentMonthText: {
    color: theme.colors.textMuted
  },
  todayDot: {
    position: 'absolute',
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary
  },
  stickySectionBg: {
    backgroundColor: theme.colors.background,
    paddingTop: 8
  },
  transactionsSection: {
    paddingHorizontal: 16,
    paddingBottom: 4
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionTitleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  transactionCountBadge: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border + '50'
  },
  transactionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary
  },
  addSmallBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40
  },
  itemWrapper: {
    marginBottom: 2
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
    marginTop: 20,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.border + '50',
    borderStyle: 'dashed'
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  emptyAddBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    ...getPlatformShadow('sm')
  },
  emptyAddBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  }
});
