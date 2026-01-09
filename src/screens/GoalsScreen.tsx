import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { GoalCard } from '../components/GoalCard';
import { AddGoalModal } from '../components/AddGoalModal';
import {
  getFinancialGoals,
  addFinancialGoal,
  updateFinancialGoal,
  deleteFinancialGoal,
} from '../database/database';
import { FinancialGoal } from '../types';
import { formatCurrency } from '../services/financialService';
import { isRTL } from '../utils/rtl';

export const GoalsScreen = ({ navigation }: any) => {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);

  const loadGoals = async () => {
    try {
      const allGoals = await getFinancialGoals();
      setGoals(allGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  useEffect(() => {
    loadGoals();
    const unsubscribe = navigation.addListener('focus', loadGoals);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  const handleAddGoal = () => {
    setEditingGoal(null);
    setModalVisible(true);
  };

  const handleEditGoal = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setModalVisible(true);
  };

  const handleSaveGoal = async (goalData: Omit<FinancialGoal, 'id' | 'createdAt'>) => {
    try {
      if (editingGoal) {
        await updateFinancialGoal(editingGoal.id, goalData);
      } else {
        await addFinancialGoal(goalData);
      }
      await loadGoals();
    } catch (error) {
      console.error('Error saving goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    try {
      await deleteFinancialGoal(goalId);
      await loadGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {activeGoals.length > 0 && (
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeader}>
              <Ionicons name="trophy-outline" size={32} color={theme.colors.textInverse} />
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>الأهداف النشطة</Text>
                <Text style={styles.summarySubtitle}>
                  {activeGoals.length} هدف
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(overallProgress, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(overallProgress)}% من إجمالي الأهداف
              </Text>
            </View>

            <View style={styles.summaryAmounts}>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>المحقق</Text>
                <Text style={styles.summaryAmountValue}>
                  {formatCurrency(totalCurrent)}
                </Text>
              </View>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>المستهدف</Text>
                <Text style={styles.summaryAmountValue}>
                  {formatCurrency(totalTarget)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأهداف النشطة</Text>
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => handleEditGoal(goal)}
              />
            ))}
          </View>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأهداف المنجزة</Text>
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => handleEditGoal(goal)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {goals.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyStateTitle}>لا توجد أهداف بعد</Text>
            <Text style={styles.emptyStateText}>
              ابدأ بتحديد هدف مالي جديد واتبع تقدمك نحو تحقيقه
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.fabGradient}
      >
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={handleAddGoal}
          size="medium"
          color={theme.colors.textInverse}
        />
      </LinearGradient>

      {/* Add/Edit Goal Modal */}
      <AddGoalModal
        visible={modalVisible}
        onDismiss={() => {
          setModalVisible(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        editingGoal={editingGoal}
      />
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
    paddingBottom: 100,
    direction: 'rtl',
  },
  summaryCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  summaryText: {
    flex: 1,
    ...(isRTL ? { marginRight: theme.spacing.md } : { marginLeft: theme.spacing.md }),
  },
  summaryTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summarySubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.textInverse,
    borderRadius: theme.borderRadius.round,
  },
  progressText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryAmount: {
    alignItems: 'flex-end',
  },
  summaryAmountLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  summaryAmountValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  section: {
    marginBottom: theme.spacing.lg,
    direction: 'rtl',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    lineHeight: 24,
  },
  fabGradient: {
    position: 'absolute',
    ...(isRTL ? { left: theme.spacing.lg } : { right: theme.spacing.lg }),
    bottom: theme.spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  fab: {
    backgroundColor: 'transparent',
  },
});
