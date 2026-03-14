import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { AddSavingsTransactionModal } from '../components/AddSavingsTransactionModal';
import { SavingsTransferModal } from '../components/SavingsTransferModal';

import { SavingsCard } from '../components/SavingsCard';
import {
  getSavings,
  deleteSavings,
  addSavingsTransaction,
  transferBetweenSavings,
} from '../database/database';
import { Savings } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { usePrivacy } from '../context/PrivacyContext';

export const SavingsScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const [savingsList, setSavingsList] = useState<Savings[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalSavings, setTotalSavings] = useState(0);
  const [selectedSavings, setSelectedSavings] = useState<Savings | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [loading, setLoading] = useState(false);


  const loadSavings = useCallback(async () => {
    try {
      const data = await getSavings();
      setSavingsList(data);
      
      const total = data.reduce((sum, item) => sum + item.currentAmount, 0);
      setTotalSavings(total);
    } catch (error) {
      
    }
  }, []);

  useEffect(() => {
    loadSavings();
    const unsubscribe = navigation.addListener('focus', loadSavings);
    return unsubscribe;
  }, [navigation, loadSavings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavings();
    setRefreshing(false);
  };

  const handleAddSavings = () => {
    navigation.navigate('AddSavings');
  };

  const handleSavingsPress = (savings: Savings) => {
    // Navigate to savings details if needed, or just show modal
    // For now, let's just use the card's onAddAmount
  };

  const handleAddAmount = (savings: Savings) => {
    setSelectedSavings(savings);
    setShowTransactionModal(true);
  };

  const handleTransferPress = (savings: Savings) => {
    setSelectedSavings(savings);
    setShowTransferModal(true);
  };

  const handleTransactionConfirm = async (amount: number, type: 'deposit' | 'withdrawal') => {
    if (!selectedSavings) return;
    try {
      await addSavingsTransaction({
        savingsId: selectedSavings.id,
        amount,
        type,
        date: new Date().toISOString().split('T')[0],
      });
      loadSavings();
      alertService.toastSuccess(type === 'deposit' ? 'تمت إضافة المبلغ بنجاح' : 'تم سحب المبلغ بنجاح');
    } catch (error) {
      alertService.toastError('حدث خطأ أثناء العملية');
      throw error;
    }
  };

  const handleTransferConfirm = async (fromId: number, toId: number, amount: number) => {
    try {
      await transferBetweenSavings(
        fromId,
        toId,
        amount,
        new Date().toISOString().split('T')[0]
      );
      loadSavings();
      alertService.toastSuccess('تم تحويل المبلغ بنجاح');
    } catch (error) {
      alertService.toastError('حدث خطأ أثناء عملية التحويل');
      throw error;
    }
  };


  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <LinearGradient
          colors={theme.gradients.success as any}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconContainer}>
              <Ionicons name="wallet-outline" size={32} color="#FFFFFF" />
            </View>
            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryLabel}>إجمالي المدخرات</Text>
              <Text style={styles.summaryValue}>
                {isPrivacyEnabled ? '****' : formatCurrency(totalSavings)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryFooter}>
            <Text style={styles.summaryFooterText}>لديك {savingsList.length} حصالات نشطة</Text>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>حصالاتي</Text>
          <TouchableOpacity onPress={handleAddSavings} style={styles.addSmallButton}>
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={styles.addSmallButtonText}>جديدة</Text>
          </TouchableOpacity>
        </View>

        {savingsList.length > 0 ? (
          savingsList.map((item) => (
            <SavingsCard
              key={item.id}
              savings={item}
              onPress={handleSavingsPress}
              onAddAmount={handleAddAmount}
              onEdit={(s) => navigation.navigate('AddSavings', { savings: s })}
               onDelete={async (s) => {
                try {
                  await deleteSavings(s.id);
                  loadSavings();
                  alertService.toastSuccess('تم حذف الحصالة بنجاح');
                } catch (error) {
                  alertService.toastError('حدث خطأ أثناء حذف الحصالة');
                }
              }}
              onTransfer={handleTransferPress}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="wallet-outline" size={64} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>لا توجد حصالات بعد</Text>
            <Text style={styles.emptySubtitle}>
              ابدأ بإنشاء حصالة جديدة لتوفير المال لأهدافك المختلفة
            </Text>
            <TouchableOpacity style={styles.createButton} onPress={handleAddSavings}>
              <Text style={styles.createButtonText}>إنشاء حصالة الآن</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* FAB for adding new savings */}
      {savingsList.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={handleAddSavings}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <AddSavingsTransactionModal
        visible={showTransactionModal}
        savings={selectedSavings}
        onClose={() => setShowTransactionModal(false)}
        onConfirm={handleTransactionConfirm}
      />

      <SavingsTransferModal
        visible={showTransferModal}
        fromSavings={selectedSavings}
        allSavings={savingsList}
        onClose={() => setShowTransferModal(false)}
        onTransfer={handleTransferConfirm}
      />
    </SafeAreaView>

  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    ...getPlatformShadow('lg'),
  },
  summaryHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextContainer: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  summaryFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  summaryFooterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  addSmallButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addSmallButtonText: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.border + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    ...getPlatformShadow('sm'),
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('lg'),
  },
});
