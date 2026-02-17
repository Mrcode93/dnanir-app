import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { 
  getRecurringExpenses, 
  deleteRecurringExpense, 
  RecurringExpense 
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { getNextOccurrenceDate } from '../services/recurringExpenseService';
import { AddRecurringExpenseModal } from '../components/AddRecurringExpenseModal';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';

export const RecurringExpensesScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<RecurringExpense | null>(null);
  const [customCategories, setCustomCategories] = useState<any[]>([]);

  const loadRecurringExpenses = async () => {
    try {
      const expenses = await getRecurringExpenses();
      setRecurringExpenses(expenses);
    } catch (error) {
      console.error('Error loading recurring expenses:', error);
    }
  };

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  useEffect(() => {
    loadRecurringExpenses();
    loadCustomCategories();
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecurringExpenses();
      loadCustomCategories();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecurringExpenses();
    setRefreshing(false);
  };

  const handleDelete = (expense: RecurringExpense) => {
    setExpenseToDelete(expense);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (expenseToDelete) {
      try {
        await deleteRecurringExpense(expenseToDelete.id);
        await loadRecurringExpenses();
        setShowDeleteAlert(false);
        setExpenseToDelete(null);
      } catch (error) {
        console.error('Error deleting recurring expense:', error);
      }
    }
  };

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setShowAddModal(true);
  };

  const handleAdd = () => {
    setEditingExpense(null);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingExpense(null);
    loadRecurringExpenses();
  };

  const getCategoryName = (category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || 
           customCategories.find(c => c.name === category)?.name || 
           category;
  };

  const getRecurrenceText = (expense: RecurringExpense) => {
    const types: Record<string, string> = {
      daily: 'يومي',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      yearly: 'سنوي',
    };
    
    if (expense.recurrenceValue === 1) {
      return `كل ${types[expense.recurrenceType]}`;
    }
    return `كل ${expense.recurrenceValue} ${types[expense.recurrenceType]}`;
  };

  const renderRecurringExpense = ({ item }: { item: RecurringExpense }) => {
    const nextOccurrence = getNextOccurrenceDate(item);
    const nextDate = nextOccurrence ? new Date(nextOccurrence).toLocaleDateString('ar-IQ') : 'انتهى';

    return (
      <LinearGradient
        colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
        style={styles.expenseCard}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={styles.expenseTitle}>{item.title}</Text>
              <Text style={styles.expenseCategory}>{getCategoryName(item.category)}</Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          </View>
          
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="repeat" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.detailText}>{getRecurrenceText(item)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.detailText}>التالي: {nextDate}</Text>
            </View>
            {!item.isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>غير نشط</Text>
              </View>
            )}
          </View>
          
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEdit(item)}
            >
              <Ionicons name="pencil" size={18} color={theme.colors.primary} />
              <Text style={styles.actionText}>تعديل</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash" size={18} color="#EF4444" />
              <Text style={[styles.actionText, styles.deleteText]}>حذف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {recurringExpenses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="repeat-outline" size={80} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>لا توجد مصاريف متكررة</Text>
          <Text style={styles.emptySubtext}>أضف مصروف متكرر لتتبعه تلقائياً</Text>
        </View>
      ) : (
        <FlatList
          data={recurringExpenses}
          renderItem={renderRecurringExpense}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
      
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={handleAdd}
        color={theme.colors.textInverse}
      />
      
      <AddRecurringExpenseModal
        visible={showAddModal}
        onClose={handleModalClose}
        editingExpense={editingExpense}
      />
      
      <ConfirmAlert
        visible={showDeleteAlert}
        onClose={() => {
          setShowDeleteAlert(false);
          setExpenseToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="حذف المصروف المتكرر"
        message="هل أنت متأكد من حذف هذا المصروف المتكرر؟"
        confirmText="حذف"
        cancelText="إلغاء"
        icon="trash"
        type="danger"
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  expenseCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  cardContent: {
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  expenseCategory: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  cardDetails: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  detailText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  inactiveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.xs,
  },
  inactiveText: {
    fontSize: theme.typography.sizes.xs,
    color: '#DC2626',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  cardActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    gap: theme.spacing.xs,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  actionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  deleteText: {
    color: '#DC2626',
  },
  fab: {
    position: 'absolute',
    margin: theme.spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
  },
});
