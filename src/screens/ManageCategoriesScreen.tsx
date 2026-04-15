import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getCustomCategories, deleteCustomCategory, CustomCategory } from '../database/database';
import { INCOME_SOURCES, EXPENSE_CATEGORIES } from '../types';
import { alertService } from '../services/alertService';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { tl, useLocalization } from "../localization";
import { isRTL } from '../utils/rtl';

interface ManageCategoriesScreenProps {
  navigation: any;
  route: any;
}

export const ManageCategoriesScreen: React.FC<ManageCategoriesScreenProps> = ({
  navigation,
  route
}) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
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
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تحميل الفئات"));
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
    alertService.confirm(tl("حذف الفئة"), tl("هل تريد حذف \"{{}}\"؟", [categoryName]), async () => {
      try {
        await deleteCustomCategory(categoryId);
        await loadCategories();
        alertService.toastSuccess(tl("تم حذف الفئة بنجاح"));
      } catch (error) {
        alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حذف الفئة"));
      }
    });
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
    } else if (type === 'subscription') {
      return false; // All custom subscription categories are custom
    } else {
      return Object.values(EXPENSE_CATEGORIES).includes(categoryName);
    }
  };

  const addFooter = (
    <AppButton 
      label={type === 'income' ? tl("إضافة مصدر جديد") : type === 'subscription' ? tl("إضافة خدمة رقمية") : tl("إضافة فئة جديدة")} 
      onPress={handleAdd} 
      variant="success" 
      size="lg" 
      leftIcon="add-circle" 
    />
  );

  return (
    <ScreenContainer 
      scrollable 
      footer={addFooter} 
      edges={['left', 'right']} 
      style={{
        backgroundColor: theme.colors.surfaceCard,
      }}
    >
      <AppHeader 
        title={type === 'income' ? tl("إدارة مصادر الدخل") : type === 'subscription' ? tl("إدارة الخدمات الرقمية") : tl("إدارة فئات المصاريف")} 
        backIcon="close" 
        onBack={handleClose} 
      />

      <View style={styles.categoriesSection}>
        <Text style={styles.sectionTitle}>
          {type === 'income' ? tl("جميع المصادر") : tl("جميع الفئات")}
        </Text>
        
        {loading ? null : categories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>
              {type === 'income' ? tl("لا توجد مصادر") : tl("لا توجد فئات")}
            </Text>
            <Text style={styles.emptySubtext}>
              {type === 'income' ? tl("أضف مصادر دخل جديدة لتسهيل تصنيف دخلك") : tl("أضف فئات جديدة لتسهيل تصنيف مصاريفك")}
            </Text>
          </View>
        ) : (
          categories.map(category => {
            const isDefault = isDefaultCategory(category.name);
            return (
              <View key={category.id} style={styles.categoryItem}>
                <View style={styles.categoryItemLeft}>
                  <View style={[styles.categoryIconContainer, {
                    backgroundColor: category.color + '20'
                  }]}>
                    <Ionicons name={category.icon as any} size={24} color={category.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <Text style={styles.categoryType}>
                      {isDefault ? type === 'income' ? tl("مصدر افتراضي") : tl("فئة افتراضية") : type === 'income' ? tl("مصدر مخصص") : tl("فئة مخصصة")}
                    </Text>
                  </View>
                </View>
                <View style={styles.categoryActions}>
                  <TouchableOpacity onPress={() => handleEdit(category)} style={styles.editButton}>
                    <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                  {!isDefault && (
                    <TouchableOpacity onPress={() => handleDelete(category.id, category.name)} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  categoriesSection: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    textAlign: isRTL ? 'right' : 'left'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg * 2
  },
  emptyText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.md,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.sm,
    textAlign: 'center'
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...getPlatformShadow('xs')
  },
  categoryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md
  },
  categoryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryInfo: {
    flex: 1
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left'
  },
  categoryType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  categoryActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
