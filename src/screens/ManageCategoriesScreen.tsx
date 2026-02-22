import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import {
  getCustomCategories,
  deleteCustomCategory,
  addCustomCategory,
  updateCustomCategory,
  CustomCategory,
} from '../database/database';
import { INCOME_SOURCES, EXPENSE_CATEGORIES } from '../types';
import { alertService } from '../services/alertService';

interface ManageCategoriesScreenProps {
  navigation: any;
  route: any;
}

export const ManageCategoriesScreen: React.FC<ManageCategoriesScreenProps> = ({
  navigation,
  route,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const type = route?.params?.type || 'expense';


  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCustomCategories(type);
      setCategories(data);
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء تحميل الفئات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    const unsubscribe = navigation.addListener('focus', () => {
      loadCategories();
    });
    return unsubscribe;
  }, [navigation, type]);

  const handleEdit = (category: CustomCategory) => {
    navigation.navigate('AddCategory', {
      category,
      type
    });
  };

  const handleDelete = async (categoryId: number, categoryName: string) => {
    alertService.confirm(
      'حذف الفئة',
      `هل تريد حذف "${categoryName}"؟`,
      async () => {
        try {
          await deleteCustomCategory(categoryId);
          await loadCategories();
          alertService.success('نجح', 'تم حذف الفئة بنجاح');
        } catch (error) {
          alertService.error('خطأ', 'حدث خطأ أثناء حذف الفئة');
        }
      }
    );
  };

  const handleAdd = () => {
    navigation.navigate('AddCategory', {
      type
    });
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const isDefaultCategory = (categoryName: string) => {
    if (type === 'income') {
      return Object.values(INCOME_SOURCES).includes(categoryName);
    } else {
      return Object.values(EXPENSE_CATEGORIES).includes(categoryName);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.gradient}
        >


          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.categoriesSection}>
              <Text style={styles.sectionTitle}>
                {type === 'income' ? 'جميع المصادر' : 'جميع الفئات'}
              </Text>
              {categories.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="folder-outline" size={64} color={theme.colors.textMuted} />
                  <Text style={styles.emptyText}>
                    {type === 'income' ? 'لا توجد مصادر' : 'لا توجد فئات'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {type === 'income'
                      ? 'أضف مصادر دخل جديدة لتسهيل تصنيف دخلك'
                      : 'أضف فئات جديدة لتسهيل تصنيف مصاريفك'}
                  </Text>
                </View>
              ) : (
                categories.map((category) => {
                  const isDefault = isDefaultCategory(category.name);
                  return (
                    <View key={category.id} style={styles.categoryItem}>
                      <View style={styles.categoryItemLeft}>
                        <View
                          style={[
                            styles.categoryIconContainer,
                            { backgroundColor: category.color + '20' },
                          ]}
                        >
                          <Ionicons
                            name={category.icon as any}
                            size={24}
                            color={category.color}
                          />
                        </View>
                        <View style={styles.categoryInfo}>
                          <Text style={styles.categoryName}>{category.name}</Text>
                          <Text style={styles.categoryType}>
                            {isDefault
                              ? type === 'income'
                                ? 'مصدر افتراضي'
                                : 'فئة افتراضية'
                              : type === 'income'
                                ? 'مصدر مخصص'
                                : 'فئة مخصصة'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.categoryActions}>
                        <TouchableOpacity
                          onPress={() => handleEdit(category)}
                          style={styles.editButton}
                        >
                          <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        {!isDefault && (
                          <TouchableOpacity
                            onPress={() => handleDelete(category.id, category.name)}
                            style={styles.deleteButton}
                          >
                            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleAdd}
              style={styles.addButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669'] as any}
                style={styles.addButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.textInverse} />
                <Text style={styles.addButtonText}>
                  {type === 'income' ? 'إضافة مصدر جديد' : 'إضافة فئة جديدة'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    direction: 'ltr',
    writingDirection: 'rtl',
  },
  keyboardView: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  categoriesSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    textAlign: 'right',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg * 2,
  },
  emptyText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  categoryItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryItemLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'right',
  },
  categoryType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  categoryActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  addButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  addButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
});
