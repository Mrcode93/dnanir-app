import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import {
  getChallenges,
  deleteChallenge,
  updateChallenge,
  Challenge,
} from '../database/database';
import {
  ChallengeType,
  CHALLENGE_TYPES,
  CHALLENGE_CATEGORIES,
  ChallengeCategory,
} from '../types';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import {
  createChallenge,
  createCustomChallenge,
  updateAllChallenges,
  getChallengesByCategory,
} from '../services/challengeService';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { AddCustomChallengeModal } from '../components/AddCustomChallengeModal';
import { shareChallengeCompletion } from '../services/shareService';

export const ChallengesScreen = ({ navigation, route }: any) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory | 'all'>('all');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [challengeToDelete, setChallengeToDelete] = useState<Challenge | null>(null);
  const [showMenuForChallenge, setShowMenuForChallenge] = useState<number | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  const loadChallenges = async () => {
    try {
      const allChallenges = await getChallenges();
      // Update progress for all challenges
      await updateAllChallenges();
      const updatedChallenges = await getChallenges();
      setChallenges(updatedChallenges);
    } catch (error) {
      console.error('Error loading challenges:', error);
    }
  };

  useEffect(() => {
    loadChallenges();
    const unsubscribe = navigation.addListener('focus', loadChallenges);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      setShowAddModal(true);
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      });
    }
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
            elevation: 8,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            flexDirection: 'row',
            display: 'flex',
          },
          tabBarShowLabel: true,
        });
      }
    };
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  };

  const handleAddChallenge = async (type: ChallengeType) => {
    try {
      await createChallenge(type);
      await loadChallenges();
      setShowAddModal(false);
      alertService.success('نجح', 'تم إضافة التحدي بنجاح');
    } catch (error) {
      console.error('Error creating challenge:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء إضافة التحدي');
    }
  };

  const handleAddCustomChallenge = async (challengeData: {
    title: string;
    description: string;
    category: ChallengeCategory;
    icon: string;
    duration: number;
    targetValue?: number;
    targetProgress: number;
  }) => {
    try {
      await createCustomChallenge(
        challengeData.title,
        challengeData.description,
        challengeData.category,
        challengeData.icon,
        challengeData.duration,
        challengeData.targetProgress,
        challengeData.targetValue
      );
      await loadChallenges();
      setShowCustomModal(false);
      alertService.success('نجح', 'تم إضافة التحدي المخصص بنجاح');
    } catch (error) {
      console.error('Error creating custom challenge:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء إضافة التحدي المخصص');
    }
  };

  const handleDeleteChallenge = async () => {
    if (!challengeToDelete) {
      setShowDeleteAlert(false);
      return;
    }
    
    const challengeId = challengeToDelete.id;
    
    try {
      await deleteChallenge(challengeId);
      setShowDeleteAlert(false);
      setChallengeToDelete(null);
      setShowMenuForChallenge(null);
      await loadChallenges();
      alertService.success('نجح', 'تم حذف التحدي بنجاح');
    } catch (error) {
      console.error('Error deleting challenge:', error);
      setShowDeleteAlert(false);
      setChallengeToDelete(null);
      alertService.error('خطأ', 'حدث خطأ أثناء حذف التحدي');
    }
  };

  const handleEditChallenge = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setShowMenuForChallenge(null);
    setShowCustomModal(true);
  };

  const handleDeletePress = (challenge: Challenge) => {
    console.log('handleDeletePress called for challenge:', challenge.id);
    setChallengeToDelete(challenge);
    setShowMenuForChallenge(null);
    setShowDeleteAlert(true);
    console.log('showDeleteAlert set to true');
  };

  const handleCompleteChallenge = async (challenge: Challenge) => {
    try {
      await updateChallenge(challenge.id, {
        completed: true,
        completedAt: new Date().toISOString(),
        currentProgress: challenge.targetProgress, // Ensure progress is at target
      });
      await loadChallenges();
      setShowMenuForChallenge(null);
      alertService.success('نجح', 'تم إكمال التحدي بنجاح! 🎉');
      
      // Offer to share
      try {
        await shareChallengeCompletion(challenge.title);
      } catch (shareError) {
        // User cancelled or error, ignore
        console.log('Share cancelled or error:', shareError);
      }
    } catch (error) {
      console.error('Error completing challenge:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء إكمال التحدي');
    }
  };

  const handleReopenChallenge = async (challenge: Challenge) => {
    try {
      await updateChallenge(challenge.id, {
        completed: false,
        completedAt: undefined,
      });
      await loadChallenges();
      setShowMenuForChallenge(null);
      alertService.success('نجح', 'تم إعادة فتح التحدي');
    } catch (error) {
      console.error('Error reopening challenge:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء إعادة فتح التحدي');
    }
  };

  const handleUpdateProgress = async (challenge: Challenge) => {
    // For custom challenges, allow manual progress update
    if (challenge.isCustom || challenge.type === 'custom') {
      // Open edit modal with focus on progress
      handleEditChallenge(challenge);
    } else {
      // For auto-calculated challenges, just refresh
      try {
        await updateAllChallenges();
        await loadChallenges();
        alertService.success('نجح', 'تم تحديث التقدم');
      } catch (error) {
        console.error('Error updating progress:', error);
        alertService.error('خطأ', 'حدث خطأ أثناء تحديث التقدم');
      }
    }
  };


  const handleCategorySelect = (category: ChallengeCategory | 'all') => {
    setSelectedCategory(category);
  };

  const getSelectedCategoryLabel = () => {
    if (selectedCategory === 'all') return 'الكل';
    return CHALLENGE_CATEGORIES[selectedCategory].label;
  };

  const filteredChallenges = selectedCategory === 'all'
    ? challenges
    : challenges.filter(c => c.category === selectedCategory);

  const activeChallenges = filteredChallenges.filter(c => !c.completed);
  const completedChallenges = filteredChallenges.filter(c => c.completed);

  const getProgressPercentage = (challenge: Challenge): number => {
    if (challenge.targetProgress === 0) return 0;
    return Math.min(100, (challenge.currentProgress / challenge.targetProgress) * 100);
  };

  const getDaysRemaining = (challenge: Challenge): number => {
    const today = new Date();
    const endDate = new Date(challenge.endDate);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const renderChallengeCard = (challenge: Challenge) => {
    const progress = getProgressPercentage(challenge);
    const daysRemaining = getDaysRemaining(challenge);
    const isExpired = daysRemaining === 0 && !challenge.completed;
    const categoryInfo = CHALLENGE_CATEGORIES[challenge.category as ChallengeCategory];

    return (
      <View style={styles.challengeCardWrapper}>
        <View
          style={[
            styles.challengeCard,
            challenge.completed && styles.challengeCardCompleted,
            isExpired && styles.challengeCardExpired,
          ]}
        >
          <View style={styles.challengeHeader}>
            <View style={styles.challengeIconContainer}>
              <Ionicons
                name={challenge.icon as any}
                size={24}
                color={categoryInfo.color}
              />
            </View>
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <Text style={styles.challengeDescription}>{challenge.description}</Text>
            </View>
            <View style={styles.challengeHeaderActions}>
              {challenge.completed && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
                </View>
              )}
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => {
                  setShowMenuForChallenge(showMenuForChallenge === challenge.id ? null : challenge.id);
                }}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={
                  challenge.completed
                    ? [theme.colors.success, theme.colors.success]
                    : isExpired
                    ? [theme.colors.error, theme.colors.error]
                    : [categoryInfo.color, categoryInfo.color]
                }
                style={[styles.progressFill, { width: `${progress}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress)}% ({challenge.currentProgress.toFixed(0)} / {challenge.targetProgress.toFixed(0)})
            </Text>
          </View>

          <View style={styles.challengeFooter}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryInfo.color + '20' }]}>
              <Ionicons
                name={categoryInfo.icon}
                size={14}
                color={categoryInfo.color}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.categoryText, { color: categoryInfo.color }]}>
                {categoryInfo.label}
              </Text>
            </View>
            {!challenge.completed && (
              <View style={styles.footerRight}>
                {progress >= 100 && (
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleCompleteChallenge(challenge)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={[theme.colors.success, theme.colors.success]}
                      style={styles.completeButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={theme.colors.textInverse} />
                      <Text style={styles.completeButtonText}>إكمال</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                <Text style={styles.daysRemaining}>
                  {isExpired ? 'انتهى' : `${daysRemaining} يوم متبقي`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Options Menu - Outside the card */}
        {showMenuForChallenge === challenge.id && (
          <View style={styles.optionsMenu} pointerEvents="box-none">
            <View style={styles.menuContent} pointerEvents="auto">
              {!challenge.completed ? (
                <>
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      handleCompleteChallenge(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                    <Text style={[styles.menuOptionText, { color: theme.colors.success }]}>
                      إكمال التحدي
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      handleUpdateProgress(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.menuOptionText}>
                      {challenge.isCustom || challenge.type === 'custom' ? 'تحديث التقدم' : 'تحديث تلقائي'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      handleEditChallenge(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.menuOptionText}>تعديل</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={(e) => {
                      e.stopPropagation();
                      console.log('Delete button pressed (active)');
                      handleDeletePress(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    <Text style={[styles.menuOptionText, { color: theme.colors.error }]}>حذف</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      handleReopenChallenge(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.menuOptionText}>إعادة فتح</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => {
                      handleEditChallenge(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.menuOptionText}>تعديل</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={(e) => {
                      e.stopPropagation();
                      console.log('Delete button pressed (completed)');
                      handleDeletePress(challenge);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    <Text style={[styles.menuOptionText, { color: theme.colors.error }]}>حذف</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderAddChallengeModal = () => {
    const categories: ChallengeCategory[] = ['spending_reduction', 'saving', 'discipline', 'debt'];
    
    return (
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر تحدياً جديداً</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {/* Custom Challenge Option */}
              <TouchableOpacity
                style={[styles.challengeOption, styles.customChallengeOption]}
                onPress={() => {
                  setShowAddModal(false);
                  setShowCustomModal(true);
                }}
              >
                <View style={styles.customChallengeIconContainer}>
                  <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
                </View>
                <View style={styles.challengeOptionInfo}>
                  <Text style={styles.challengeOptionTitle}>تحدي مخصص</Text>
                  <Text style={styles.challengeOptionDescription}>
                    أنشئ تحدياً خاصاً بك
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {categories.map(category => {
                const categoryInfo = CHALLENGE_CATEGORIES[category];
                const categoryChallenges = Object.entries(CHALLENGE_TYPES).filter(
                  ([_, def]) => def.category === category
                );

                return (
                  <View key={category} style={styles.categorySection}>
                    <View style={styles.categorySectionHeader}>
                      <Ionicons
                        name={categoryInfo.icon}
                        size={20}
                        color={categoryInfo.color}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.categorySectionTitle}>
                        {categoryInfo.label}
                      </Text>
                    </View>
                    {categoryChallenges.map(([type, def]) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.challengeOption}
                        onPress={() => handleAddChallenge(type as ChallengeType)}
                      >
                        <Ionicons
                          name={def.icon as any}
                          size={24}
                          color={categoryInfo.color}
                          style={{ marginRight: theme.spacing.md }}
                        />
                        <View style={styles.challengeOptionInfo}>
                          <Text style={styles.challengeOptionTitle}>{def.title}</Text>
                          <Text style={styles.challengeOptionDescription}>{def.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Category Filter */}
      <View style={styles.header}>
        {/* Filter Buttons Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          <TouchableOpacity
            onPress={() => handleCategorySelect('all')}
            style={styles.filterButton}
            activeOpacity={0.7}
          >
            {selectedCategory === 'all' ? (
              <LinearGradient
                colors={theme.gradients.primary as any}
                style={styles.filterButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="apps" size={16} color={theme.colors.textInverse} />
                <Text style={styles.filterButtonTextActive}>الكل</Text>
              </LinearGradient>
            ) : (
              <View style={styles.filterButtonDefault}>
                <Ionicons name="apps-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.filterButtonText}>الكل</Text>
              </View>
            )}
          </TouchableOpacity>
          {Object.entries(CHALLENGE_CATEGORIES).map(([key, info]) => {
            const isSelected = selectedCategory === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleCategorySelect(key as ChallengeCategory)}
                style={styles.filterButton}
                activeOpacity={0.7}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={[info.color, info.color] as any}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={info.icon}
                      size={16}
                      color={theme.colors.textInverse}
                    />
                    <Text style={styles.filterButtonTextActive} numberOfLines={1}>
                      {info.label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.filterButtonDefault}>
                    <Ionicons
                      name={info.icon}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                      {info.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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
        onScrollBeginDrag={() => {
          // Close menu when scrolling
          if (showMenuForChallenge !== null) {
            setShowMenuForChallenge(null);
          }
        }}
      >
        {/* Active Challenges */}
        {activeChallenges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>التحديات النشطة</Text>
            {activeChallenges.map((challenge) => (
              <View key={challenge.id}>{renderChallengeCard(challenge)}</View>
            ))}
          </View>
        )}

        {/* Completed Challenges */}
        {completedChallenges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>التحديات المكتملة</Text>
            {completedChallenges.map((challenge) => (
              <View key={challenge.id}>{renderChallengeCard(challenge)}</View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {filteredChallenges.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyStateTitle}>لا توجد تحديات بعد</Text>
            <Text style={styles.emptyStateText}>
              ابدأ بتحدي جديد لتحسين عاداتك المالية
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Menu Overlay - outside ScrollView to not block menu */}
      {showMenuForChallenge !== null && (
        <Pressable
          style={styles.menuOverlay}
          onPress={() => {
            setShowMenuForChallenge(null);
          }}
        />
      )}

      {/* Add Challenge Modal */}
      {renderAddChallengeModal()}

      {/* Add Custom Challenge Modal */}
      <AddCustomChallengeModal
        visible={showCustomModal}
        onDismiss={() => {
          setShowCustomModal(false);
          setEditingChallenge(null);
        }}
        onSave={async (challengeData) => {
          if (editingChallenge) {
            // Update existing challenge
            try {
              await updateChallenge(editingChallenge.id, {
                title: challengeData.title,
                description: challengeData.description,
                category: challengeData.category,
                icon: challengeData.icon,
                endDate: (() => {
                  const startDate = new Date(editingChallenge.startDate);
                  const endDate = new Date(startDate);
                  endDate.setDate(startDate.getDate() + challengeData.duration);
                  return endDate.toISOString().split('T')[0];
                })(),
                targetValue: challengeData.targetValue,
                targetProgress: challengeData.targetProgress,
              });
              await loadChallenges();
              setShowCustomModal(false);
              setEditingChallenge(null);
              alertService.success('نجح', 'تم تحديث التحدي بنجاح');
            } catch (error) {
              console.error('Error updating challenge:', error);
              alertService.error('خطأ', 'حدث خطأ أثناء تحديث التحدي');
            }
          } else {
            await handleAddCustomChallenge(challengeData);
          }
        }}
        editingChallenge={editingChallenge}
      />

      {/* Delete Confirmation */}
      <ConfirmAlert
        visible={showDeleteAlert}
        title="حذف التحدي"
        message="هل أنت متأكد من حذف هذا التحدي؟"
        onConfirm={handleDeleteChallenge}
        onCancel={() => {
          setShowDeleteAlert(false);
          setChallengeToDelete(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    direction: 'rtl',
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    direction: 'rtl',
  },
  filterRow: {
    marginBottom: 0,
  },
  filterRowContent: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  filterButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  filterButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  filterButtonDefault: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  filterButtonText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  filterButtonTextActive: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  challengeCardWrapper: {
    marginBottom: theme.spacing.md,
    position: 'relative',
  },
  challengeCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    direction: 'ltr',
  },
  challengeCardCompleted: {
    opacity: 0.8,
    borderColor: theme.colors.success,
  },
  challengeCardExpired: {
    borderColor: theme.colors.error,
    opacity: 0.7,
  },
  challengeHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  challengeHeaderActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  menuButton: {
    padding: theme.spacing.xs,
    marginRight: theme.spacing.xs,
  },
  optionsMenu: {
    position: 'absolute',
    top: 50,
    right: theme.spacing.md,
    zIndex: 100,
    elevation: 100,
  },
  menuContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.xs,
    minWidth: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.lg,
    zIndex: 101,
    elevation: 101,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  menuOptionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    elevation: 90,
    backgroundColor: 'transparent',
  },
  challengeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  challengeDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  completedBadge: {
    marginRight: theme.spacing.sm,
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
  },
  progressText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  categoryText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  completeButton: {
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  completeButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  completeButtonText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  customChallengeOption: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    marginBottom: theme.spacing.md,
  },
  customChallengeIconContainer: {
    marginRight: theme.spacing.md,
  },
  daysRemaining: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalScrollView: {
    maxHeight: 500,
  },
  categorySection: {
    padding: theme.spacing.md,
  },
  categorySectionHeader: {
    marginBottom: theme.spacing.md,
  },
  categorySectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  challengeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  challengeOptionIcon: {
    fontSize: 28,
    marginRight: theme.spacing.md,
  },
  challengeOptionInfo: {
    flex: 1,
  },
  challengeOptionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  challengeOptionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
