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
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RTLText from '../components/RTLText';

import { Income, IncomeSource, INCOME_SOURCES } from '../types';
import { getIncome, deleteIncome } from '../database/database';
import { formatCurrency } from '../services/financialService';
import AddEditIncomeModal from '../components/AddEditIncomeModal';
import { gradientColors, colors } from '../utils/gradientColors';

const IncomeScreen = () => {
  const [income, setIncome] = useState<Income[]>([]);
  const [filteredIncome, setFilteredIncome] = useState<Income[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<IncomeSource | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  const loadIncome = async () => {
    try {
      const incomeData = await getIncome();
      setIncome(incomeData);
      setFilteredIncome(incomeData);
    } catch (error) {
      console.error('Error loading income:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIncome();
    setRefreshing(false);
  };

  useEffect(() => {
    loadIncome();
  }, []);

  useEffect(() => {
    filterIncome();
  }, [income, searchQuery, selectedSource]);

  const filterIncome = () => {
    let filtered = income;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(incomeItem =>
        incomeItem.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incomeItem.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by source
    if (selectedSource !== 'all') {
      filtered = filtered.filter(incomeItem => incomeItem.source === selectedSource);
    }

    setFilteredIncome(filtered);
  };

  const handleDeleteIncome = (id: number) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف هذا الدخل؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIncome(id);
              await loadIncome();
            } catch (error) {
              console.error('Error deleting income:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء حذف الدخل');
            }
          },
        },
      ]
    );
  };

  const handleEditIncome = (incomeItem: Income) => {
    setEditingIncome(incomeItem);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingIncome(null);
    loadIncome();
  };

  const getSourceColor = (source: string) => {
    return colors.primary;
  };

  const renderIncomeItem = ({ item }: { item: Income }) => (
    <LinearGradient
      colors={gradientColors.background.card}
      style={styles.incomeCard}
    >
      <View style={styles.incomeContent}>
        <View style={styles.incomeHeader}>
          <View style={styles.incomeInfo}>
            <RTLText style={styles.incomeTitle}>{item.source}</RTLText>
            <RTLText style={styles.incomeDate}>
              {new Date(item.date).toLocaleDateString('ar-IQ')}
            </RTLText>
          </View>
          <View style={styles.incomeActions}>
            <RTLText style={styles.incomeAmount}>
              {formatCurrency(item.amount)}
            </RTLText>
            <View style={styles.actionButtons}>
              <IconButton
                icon="pencil"
                size={20}
                iconColor={colors.primary}
                onPress={() => handleEditIncome(item)}
              />
              <IconButton
                icon="delete"
                size={20}
                iconColor={colors.error}
                onPress={() => handleDeleteIncome(item.id)}
              />
            </View>
          </View>
        </View>
        <View style={styles.incomeFooter}>
          <Chip
            style={styles.sourceChip}
            textStyle={styles.sourceChipText}
          >
            {INCOME_SOURCES[item.source as IncomeSource]}
          </Chip>
          {item.description && (
            <Paragraph style={styles.incomeDescription}>
              {item.description}
            </Paragraph>
          )}
        </View>
      </View>
    </LinearGradient>
  );

  const renderSourceFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterScrollContent}
      style={styles.filterScrollView}
    >
      <View style={styles.sourceFilter}>
        <Chip
          selected={selectedSource === 'all'}
          onPress={() => setSelectedSource('all')}
          style={[styles.filterChip, selectedSource === 'all' && styles.selectedFilterChip]}
          textStyle={styles.filterChipText}
        >
          الكل
        </Chip>
        {Object.entries(INCOME_SOURCES).map(([key, label]) => (
          <Chip
            key={key}
            selected={selectedSource === key}
            onPress={() => setSelectedSource(key as IncomeSource)}
            style={[styles.filterChip, selectedSource === key && styles.selectedFilterChip]}
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
          placeholder="البحث في الدخل..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          iconColor="#9E9E9E"
          inputStyle={styles.searchInput}
          placeholderTextColor="#9E9E9E"
        />
        {renderSourceFilter()}
      </View>

      <FlatList
        data={filteredIncome}
        renderItem={renderIncomeItem}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={64} color="#9E9E9E" />
            <RTLText style={styles.emptyText}>لا يوجد دخل مسجل</RTLText>
            <RTLText style={styles.emptySubtext}>اضغط على + لإضافة دخل جديد</RTLText>
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

      <AddEditIncomeModal
        visible={showAddModal}
        onClose={handleModalClose}
        income={editingIncome}
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
  filterScrollView: {
    marginBottom: 8,
  },
  filterScrollContent: {
    paddingHorizontal: 0,
  },
  sourceFilter: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
    marginBottom: 4,
    backgroundColor: colors.surfaceLight,
  },
  selectedFilterChip: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontFamily: 'Cairo-Regular',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  incomeCard: {
    marginBottom: 12,
    elevation: 2,
    borderRadius: 16,
  },
  incomeContent: {
    padding: 16,
  },
  incomeHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  incomeInfo: {
    flex: 1,
  },
  incomeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    color: colors.text,
  },
  incomeDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
  },
  incomeActions: {
    alignItems: 'flex-end',
  },
  incomeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row-reverse',
  },
  incomeFooter: {
    marginTop: 8,
  },
  sourceChip: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    backgroundColor: colors.primary,
  },
  sourceChipText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
  },
  incomeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
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
    paddingTop:14,
    paddingBottom: 14,
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
});

export default IncomeScreen;
