import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  I18nManager,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Title,
  Paragraph,
  FAB,
  IconButton,
  Chip,
  Searchbar,
  Menu,
  Button,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RTLText from '../components/RTLText';

import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { getExpenses, deleteExpense } from '../database/database';
import { formatCurrency } from '../services/financialService';
import AddEditExpenseModal from '../components/AddEditExpenseModal';
import { gradientColors, colors } from '../utils/gradientColors';

const ExpensesScreen = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const loadExpenses = async () => {
    try {
      const expensesData = await getExpenses();
      setExpenses(expensesData);
      setFilteredExpenses(expensesData);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    filterExpenses();
  }, [expenses, searchQuery, selectedCategory]);

  const filterExpenses = () => {
    let filtered = expenses;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(expense =>
        expense.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(expense => expense.category === selectedCategory);
    }

    setFilteredExpenses(filtered);
  };

  const handleDeleteExpense = (id: number) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف هذا المصروف؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(id);
              await loadExpenses();
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء حذف المصروف');
            }
          },
        },
      ]
    );
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingExpense(null);
    loadExpenses();
  };

  const getCategoryColor = (category: string) => {
    // Use vibrant green accent for all categories to match theme
    return colors.primary;
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <LinearGradient
      colors={gradientColors.background.card}
      style={styles.expenseCard}
    >
      <View style={styles.expenseContent}>
        <View style={styles.expenseHeader}>
          <View style={styles.expenseInfo}>
            <RTLText style={styles.expenseTitle}>{item.title}</RTLText>
            <RTLText style={styles.expenseDate}>
              {new Date(item.date).toLocaleDateString('ar-IQ')}
            </RTLText>
          </View>
          <View style={styles.expenseActions}>
            <RTLText style={styles.expenseAmount}>
              {formatCurrency(item.amount)}
            </RTLText>
            <View style={styles.actionButtons}>
              <IconButton
                icon="pencil"
                size={20}
                iconColor={colors.primary}
                onPress={() => handleEditExpense(item)}
              />
              <IconButton
                icon="delete"
                size={20}
                iconColor={colors.error}
                onPress={() => handleDeleteExpense(item.id)}
              />
            </View>
          </View>
        </View>
        <View style={styles.expenseFooter}>
          <Chip
            style={[styles.categoryChip, { backgroundColor: getCategoryColor(item.category) }]}
            textStyle={styles.categoryChipText}
          >
            {EXPENSE_CATEGORIES[item.category as ExpenseCategory]}
          </Chip>
          {item.description && (
            <RTLText style={styles.expenseDescription}>
              {item.description}
            </RTLText>
          )}
        </View>
      </View>
    </LinearGradient>
  );

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterScrollContent}
      style={styles.filterScrollView}
    >
      <View style={styles.categoryFilter}>
        <Chip
          selected={selectedCategory === 'all'}
          onPress={() => setSelectedCategory('all')}
          style={[
            styles.filterChip,
            selectedCategory === 'all' ? styles.selectedFilterChip : styles.unselectedFilterChip
          ]}
          textStyle={styles.filterChipText}
        >
          الكل
        </Chip>
        {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
          <Chip
            key={key}
            selected={selectedCategory === key}
            onPress={() => setSelectedCategory(key as ExpenseCategory)}
            style={[
              styles.filterChip,
              selectedCategory === key ? styles.selectedFilterChip : styles.unselectedFilterChip
            ]}
            textStyle={styles.filterChipText}
          >
            {label}
          </Chip>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Searchbar
          placeholder="البحث في المصاريف..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          iconColor="#9E9E9E"
          inputStyle={styles.searchInput}
          placeholderTextColor="#9E9E9E"
        />
        {renderCategoryFilter()}
      </View>

      <FlatList
        data={filteredExpenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#CCC" />
            <RTLText style={styles.emptyText}>لا توجد مصاريف</RTLText>
            <RTLText style={styles.emptySubtext}>اضغط على + لإضافة مصروف جديد</RTLText>
          </View>
        }
      />

       <LinearGradient
         colors={gradientColors.button.primary}
         style={styles.fabGradient}
       >
         <FAB
           style={styles.fab}
           icon="plus"
           onPress={() => setShowAddModal(true)}
           size="small"
           color={colors.text}
         />
       </LinearGradient>

      <AddEditExpenseModal
        visible={showAddModal}
        onClose={handleModalClose}
        expense={editingExpense}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    marginBottom: 12,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
  },
  searchInput: {
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categoryFilter: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  filterChip: {
    marginLeft: 2,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 2,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary,
  },
  unselectedFilterChip: {
    backgroundColor: colors.surfaceLight,
  },
  filterChipText: {
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  expenseCard: {
    marginBottom: 12,
    elevation: 2,
    borderRadius: 16,
  },
  expenseContent: {
    padding: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right', // RTL alignment
    color: colors.text,
  },
  expenseDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right', // RTL alignment
  },
  expenseActions: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingTop: 10,
    color: colors.error,
    marginBottom: 8,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right', // RTL alignment
  },
  actionButtons: {
    flexDirection: 'row-reverse',
  },
  expenseFooter: {
    marginTop: 8,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
  },
  expenseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: 'Cairo-Regular',
    textAlign: 'right', // RTL alignment
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginTop: 16,
    fontFamily: 'Cairo-Regular',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    fontFamily: 'Cairo-Regular',
  },
  fabGradient: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    backgroundColor: 'transparent',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScrollView: {
    marginBottom: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 0,
    flexDirection: 'row-reverse',
  },
});

export default ExpensesScreen;
