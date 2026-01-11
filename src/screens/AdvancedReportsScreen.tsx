import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../utils/theme';
import { generateAdvancedReport, exportReportToCSV, AdvancedReportData } from '../services/advancedReportsService';
import { useCurrency } from '../hooks/useCurrency';
import { ReportFilter } from '../types';
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from '../types';
import { getCustomCategories } from '../database/database';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const AdvancedReportsScreen = ({ navigation }: any) => {
  const { formatCurrency } = useCurrency();
  const [reportData, setReportData] = useState<AdvancedReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>({});
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [customSources, setCustomSources] = useState<any[]>([]);

  useEffect(() => {
    loadCustomCategories();
    generateReport();
  }, []);

  const loadCustomCategories = async () => {
    try {
      const expenseCategories = await getCustomCategories('expense');
      const incomeSources = await getCustomCategories('income');
      setCustomCategories(expenseCategories);
      setCustomSources(incomeSources);
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const data = await generateAdvancedReport(filter);
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء التقرير');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await exportReportToCSV(filter);
      const fileUri = FileSystem.documentDirectory + `report_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تصدير التقرير');
    }
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const toggleSource = (source: string) => {
    if (selectedSources.includes(source)) {
      setSelectedSources(selectedSources.filter(s => s !== source));
    } else {
      setSelectedSources([...selectedSources, source]);
    }
  };

  useEffect(() => {
    setFilter({
      ...filter,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      incomeSources: selectedSources.length > 0 ? selectedSources : undefined,
    });
  }, [selectedCategories, selectedSources]);

  useEffect(() => {
    generateReport();
  }, [filter]);

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES),
    ...customCategories.map(c => c.name),
  ];

  const allSources = [
    ...Object.keys(INCOME_SOURCES),
    ...customSources.map(s => s.name),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Filters */}
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.filterCard}
        >
          <Text style={styles.sectionTitle}>الفلاتر</Text>
          
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>من تاريخ</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {filter.startDate 
                  ? new Date(filter.startDate).toLocaleDateString('ar-IQ')
                  : 'اختر التاريخ'}
              </Text>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            {showStartDatePicker && (
              <DateTimePicker
                value={filter.startDate ? new Date(filter.startDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartDatePicker(false);
                  if (date) {
                    setFilter({ ...filter, startDate: date.toISOString().split('T')[0] });
                  }
                }}
              />
            )}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>إلى تاريخ</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.dateText}>
                {filter.endDate 
                  ? new Date(filter.endDate).toLocaleDateString('ar-IQ')
                  : 'اختر التاريخ'}
              </Text>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            {showEndDatePicker && (
              <DateTimePicker
                value={filter.endDate ? new Date(filter.endDate) : new Date()}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEndDatePicker(false);
                  if (date) {
                    setFilter({ ...filter, endDate: date.toISOString().split('T')[0] });
                  }
                }}
              />
            )}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>الفئات</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              {allCategories.map(category => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>مصادر الدخل</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              {allSources.map(source => {
                const isSelected = selectedSources.includes(source);
                return (
                  <TouchableOpacity
                    key={source}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => toggleSource(source)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {INCOME_SOURCES[source as keyof typeof INCOME_SOURCES] || source}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setFilter({});
              setSelectedCategories([]);
              setSelectedSources([]);
            }}
          >
            <Text style={styles.clearButtonText}>مسح الفلاتر</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Summary */}
        {reportData && (
          <>
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.summaryCard}
            >
              <Text style={styles.sectionTitle}>ملخص التقرير</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>إجمالي الدخل</Text>
                  <Text style={[styles.summaryValue, styles.incomeValue]}>
                    {formatCurrency(reportData.summary.totalIncome)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>إجمالي المصاريف</Text>
                  <Text style={[styles.summaryValue, styles.expenseValue]}>
                    {formatCurrency(reportData.summary.totalExpenses)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>الرصيد</Text>
                  <Text style={[styles.summaryValue, styles.balanceValue]}>
                    {formatCurrency(reportData.summary.balance)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>عدد المعاملات</Text>
                  <Text style={styles.summaryValue}>
                    {reportData.summary.transactionCount}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Category Breakdown */}
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.card}
            >
              <Text style={styles.sectionTitle}>توزيع الفئات</Text>
              {reportData.categoryBreakdown.map((item, index) => (
                <View key={index} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>
                      {EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || item.category}
                    </Text>
                    <Text style={styles.categoryCount}>{item.count} معاملة</Text>
                  </View>
                  <View style={styles.categoryAmount}>
                    <Text style={styles.categoryAmountText}>{formatCurrency(item.amount)}</Text>
                    <Text style={styles.categoryPercentage}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              ))}
            </LinearGradient>

            {/* Top Expenses */}
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.card}
            >
              <Text style={styles.sectionTitle}>أعلى المصاريف</Text>
              {reportData.topExpenses.map((expense, index) => (
                <View key={expense.id} style={styles.transactionRow}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>{expense.title}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(expense.date).toLocaleDateString('ar-IQ')}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>{formatCurrency(expense.amount)}</Text>
                </View>
              ))}
            </LinearGradient>

            {/* Export Button */}
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportCSV}
            >
              <LinearGradient
                colors={[theme.colors.primary, '#2563EB']}
                style={styles.exportButtonGradient}
              >
                <Ionicons name="download" size={20} color={theme.colors.textInverse} />
                <Text style={styles.exportButtonText}>تصدير CSV</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  filterCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  summaryCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
  },
  filterGroup: {
    marginBottom: theme.spacing.md,
  },
  filterLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  dateButton: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  chipContainer: {
    flexDirection: 'row-reverse',
    marginTop: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: theme.spacing.xs,
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  chipTextSelected: {
    color: theme.colors.textInverse,
    fontWeight: '600',
  },
  clearButton: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  summaryValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  incomeValue: {
    color: '#10B981',
  },
  expenseValue: {
    color: '#EF4444',
  },
  balanceValue: {
    color: theme.colors.primary,
  },
  categoryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  categoryCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  categoryAmount: {
    alignItems: 'flex-end',
  },
  categoryAmountText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  categoryPercentage: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  transactionRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  transactionDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  transactionAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  exportButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  exportButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  exportButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
});
