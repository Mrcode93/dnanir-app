import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { generateAdvancedReport, exportReportToCSV, AdvancedReportData } from '../services/advancedReportsService';
import { generateAdvancedPDFReport, sharePDF } from '../services/pdfService';
import { useCurrency } from '../hooks/useCurrency';
import { ReportFilter } from '../types';
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from '../types';
import { getCustomCategories } from '../database/database';
import { alertService } from '../services/alertService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { tl, useLocalization } from "../localization";
export const AdvancedReportsScreen = ({
  navigation
}: any) => {
  const {
    language
  } = useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency
  } = useCurrency();
  const [reportData, setReportData] = useState<AdvancedReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>({});
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [customSources, setCustomSources] = useState<any[]>([]);
  // Skip the first run of the categories/sources → filter sync effect (both start empty so no change needed)
  const isMountedRef = React.useRef(false);
  const loadCustomCategories = useCallback(async () => {
    try {
      const expenseCategories = await getCustomCategories('expense');
      const incomeSources = await getCustomCategories('income');
      setCustomCategories(expenseCategories);
      setCustomSources(incomeSources);
    } catch (error) {}
  }, []);
  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await generateAdvancedReport(filter);
      setReportData(data);
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء إنشاء التقرير"));
    } finally {
      setLoading(false);
    }
  }, [filter]);
  // Load custom categories once on mount; generateReport is triggered by the [filter] effect below
  useEffect(() => {
    loadCustomCategories();
  }, [loadCustomCategories]);
  const handleExportCSV = async () => {
    try {
      const csv = await exportReportToCSV(filter);
      const fileUri = FileSystem.documentDirectory + `report_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: tl("تصدير التقرير")
      });
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تصدير التقرير"));
    }
  };
  const handleExportPDF = async () => {
    if (!reportData) return;
    try {
      setExportingPDF(true);
      const uri = await generateAdvancedPDFReport(reportData);
      await sharePDF(uri);
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تصدير PDF"));
    } finally {
      setExportingPDF(false);
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
  // Sync selected categories/sources into filter (skip initial mount — both start empty, no change needed)
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setFilter(prev => ({
      ...prev,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      incomeSources: selectedSources.length > 0 ? selectedSources : undefined
    }));
  }, [selectedCategories, selectedSources]);
  // Re-generate report whenever filter changes (also covers initial load)
  useEffect(() => {
    generateReport();
  }, [generateReport]);
  const allCategories = React.useMemo(() => customCategories.map(c => c.name), [customCategories]);
  const allSources = React.useMemo(() => customSources.map(s => s.name), [customSources]);
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Filters */}
        <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.filterCard}>
          <Text style={styles.sectionTitle}>{tl("الفلاتر")}</Text>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>{tl("من تاريخ")}</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartDatePicker(true)}>
              <Text style={styles.dateText}>
                {filter.startDate ? new Date(filter.startDate).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US') : tl("اختر التاريخ")}
              </Text>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            {showStartDatePicker && <CustomDatePicker value={filter.startDate ? new Date(filter.startDate) : new Date()} onChange={(event, date) => {
            if (date) {
              setFilter({
                ...filter,
                startDate: date.toISOString().split('T')[0]
              });
            }
            if (Platform.OS === 'android') setShowStartDatePicker(false);
          }} onClose={() => setShowStartDatePicker(false)} />}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>{tl("إلى تاريخ")}</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndDatePicker(true)}>
              <Text style={styles.dateText}>
                {filter.endDate ? new Date(filter.endDate).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US') : tl("اختر التاريخ")}
              </Text>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            {showEndDatePicker && <CustomDatePicker value={filter.endDate ? new Date(filter.endDate) : new Date()} onChange={(event, date) => {
            if (date) {
              setFilter({
                ...filter,
                endDate: date.toISOString().split('T')[0]
              });
            }
            if (Platform.OS === 'android') setShowEndDatePicker(false);
          }} onClose={() => setShowEndDatePicker(false)} />}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>{tl("الفئات")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              {allCategories.map(category => {
              const isSelected = selectedCategories.includes(category);
              return <TouchableOpacity key={category} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggleCategory(category)}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {tl(EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || category)}
                    </Text>
                  </TouchableOpacity>;
            })}
            </ScrollView>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>{tl("مصادر الدخل")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              {allSources.map(source => {
              const isSelected = selectedSources.includes(source);
              return <TouchableOpacity key={source} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggleSource(source)}>
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {tl(INCOME_SOURCES[source as keyof typeof INCOME_SOURCES] || source)}
                    </Text>
                  </TouchableOpacity>;
            })}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.clearButton} onPress={() => {
          setFilter({});
          setSelectedCategories([]);
          setSelectedSources([]);
        }}>
            <Text style={styles.clearButtonText}>{tl("مسح الفلاتر")}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Summary */}
        {reportData && <>
            <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>{tl("ملخص التقرير")}</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{tl("إجمالي الدخل")}</Text>
                  <Text style={[styles.summaryValue, styles.incomeValue]}>
                    {formatCurrency(reportData.summary.totalIncome)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{tl("إجمالي المصاريف")}</Text>
                  <Text style={[styles.summaryValue, styles.expenseValue]}>
                    {formatCurrency(reportData.summary.totalExpenses)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{tl("الرصيد")}</Text>
                  <Text style={[styles.summaryValue, styles.balanceValue]}>
                    {formatCurrency(reportData.summary.balance)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>{tl("عدد المعاملات")}</Text>
                  <Text style={styles.summaryValue}>
                    {reportData.summary.transactionCount}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Category Breakdown */}
            <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.card}>
              <Text style={styles.sectionTitle}>{tl("توزيع الفئات")}</Text>
              {reportData.categoryBreakdown.map((item, index) => <View key={index} style={styles.categoryRow}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>
                      {tl(EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || item.category)}
                    </Text>
                    <Text style={styles.categoryCount}>{item.count}{tl("معاملة")}</Text>
                  </View>
                  <View style={styles.categoryAmount}>
                    <Text style={styles.categoryAmountText}>{formatCurrency(item.amount)}</Text>
                    <Text style={styles.categoryPercentage}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                </View>)}
            </LinearGradient>

            {/* Top Expenses */}
            <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.card}>
              <Text style={styles.sectionTitle}>{tl("أعلى المصاريف")}</Text>
              {reportData.topExpenses.map((expense, index) => <View key={expense.id} style={styles.transactionRow}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle}>{expense.title}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(expense.date).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US')}
                    </Text>
                  </View>
                  <Text style={styles.transactionAmount}>{formatCurrency(expense.amount)}</Text>
                </View>)}
            </LinearGradient>

            {/* Export Buttons */}
            <View style={styles.exportButtonsContainer}>
              <TouchableOpacity style={[styles.exportButton, {
            flex: 1,
            marginBottom: 0
          }]} onPress={handleExportCSV}>
                <LinearGradient colors={['#4B5563', '#374151']} style={styles.exportButtonGradient}>
                  <Ionicons name="document-text" size={20} color={theme.colors.textInverse} />
                  <Text style={styles.exportButtonText}>{tl("تصدير CSV")}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.exportButton, {
            flex: 1,
            marginBottom: 0
          }]} onPress={handleExportPDF} disabled={exportingPDF}>
                <LinearGradient colors={[theme.colors.primary, theme.colors.info]} style={styles.exportButtonGradient}>
                  {exportingPDF ? <ActivityIndicator color="#FFF" /> : <>
                      <Ionicons name="document" size={20} color={theme.colors.textInverse} />
                      <Text style={styles.exportButtonText}>{tl("تصدير PDF")}</Text>
                    </>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>}
      </ScrollView>
    </SafeAreaView>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 40
  },
  filterCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('md')
  },
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('md')
  },
  summaryCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('md')
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily
  },
  filterGroup: {
    marginBottom: theme.spacing.md
  },
  filterLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily
  },
  dateButton: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  dateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  chipContainer: {
    flexDirection: 'row-reverse',
    marginTop: theme.spacing.xs
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: theme.spacing.xs
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  chipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  chipTextSelected: {
    color: theme.colors.textInverse,
    fontWeight: getPlatformFontWeight('600')
  },
  clearButton: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  clearButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily
  },
  summaryValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  incomeValue: {
    color: theme.colors.success
  },
  expenseValue: {
    color: theme.colors.error
  },
  balanceValue: {
    color: theme.colors.primary
  },
  categoryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  categoryInfo: {
    flex: 1
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  categoryCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily
  },
  categoryAmount: {
    alignItems: 'flex-end'
  },
  categoryAmountText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  categoryPercentage: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily
  },
  transactionRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  transactionInfo: {
    flex: 1
  },
  transactionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  transactionDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily
  },
  transactionAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily
  },
  exportButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md
  },
  exportButtonsContainer: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl
  },
  exportButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  exportButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily
  }
});
