import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { Savings } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrencyAmount } from '../services/currencyService';
import { isRTL } from '../utils/rtl';
import { usePrivacy } from '../context/PrivacyContext';
import { ConfirmAlert } from './ConfirmAlert';

interface SavingsCardProps {
  savings: Savings;
  onPress: (savings: Savings) => void;
  onAddAmount: (savings: Savings) => void;
  onEdit?: (savings: Savings) => void;
  onDelete?: (savings: Savings) => void;
  onTransfer?: (savings: Savings) => void;
}

export const SavingsCard: React.FC<SavingsCardProps> = ({
  savings,
  onPress,
  onAddAmount,
  onEdit,
  onDelete,
  onTransfer,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const [showMenu, setShowMenu] = React.useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = React.useState(false);



  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(savings)}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: (savings.color || theme.colors.success) + '20' }]}>
            <Ionicons
              name={(savings.icon || 'wallet') as any}
              size={24}
              color={savings.color || theme.colors.success}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{savings.title}</Text>
            {savings.description ? (
              <Text style={styles.description} numberOfLines={1}>{savings.description}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => onAddAmount(savings)}
            style={styles.addButton}
          >
            <Ionicons name="add-circle" size={32} color={savings.color || theme.colors.success} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            style={styles.menuButton}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.amountContainer}>
          <View style={styles.amountInfo}>
            <Text style={styles.amountLabel}>المبلغ الحالي</Text>
            <Text style={styles.amountValue}>
              {isPrivacyEnabled ? '****' : formatCurrencyAmount(savings.currentAmount, savings.currency || 'IQD')}
            </Text>
          </View>
        </View>



      </View>

      <Modal
        visible={showMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.dragHandle} />
            <Text style={styles.menuHeaderTitle}>خيارات الحصالة</Text>

            <View style={styles.menuOptionsList}>
              {onEdit && (
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setShowMenu(false);
                    onEdit(savings);
                  }}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={styles.menuOptionTitle}>تعديل</Text>
                    <Text style={styles.menuOptionSubtitle}>تغيير الاسم أو الأيقونة أو اللون</Text>
                  </View>
                </TouchableOpacity>
              )}

              {onTransfer && (
                <TouchableOpacity
                  style={[styles.menuOption, { marginTop: 8 }]}
                  onPress={() => {
                    setShowMenu(false);
                    onTransfer(savings);
                  }}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: theme.colors.info + '15' }]}>
                    <Ionicons name="swap-horizontal-outline" size={22} color={theme.colors.info} />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={styles.menuOptionTitle}>تحويل</Text>
                    <Text style={styles.menuOptionSubtitle}>تحويل مبلغ إلى حصالة أخرى</Text>
                  </View>
                </TouchableOpacity>
              )}

              {onDelete && (
                <TouchableOpacity
                  style={[styles.menuOption, { marginTop: 8 }]}
                  onPress={() => {
                    setShowMenu(false);
                    setShowDeleteAlert(true);
                  }}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: theme.colors.error + '15' }]}>
                    <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={[styles.menuOptionTitle, { color: theme.colors.error }]}>حذف</Text>
                    <Text style={styles.menuOptionSubtitle}>حذف هذه الحصالة نهائياً</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.closeButtonText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <ConfirmAlert
        visible={showDeleteAlert}
        title="حذف الحصالة"
        message="هل أنت متأكد من حذف هذه الحصالة؟ سيتم حذف جميع سجلات التحويل الخاصة بها."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={() => {
          setShowDeleteAlert(false);
          onDelete?.(savings);
        }}
        onCancel={() => setShowDeleteAlert(false)}
        type="danger"
      />
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    marginBottom: 16,
    ...getPlatformShadow('md'),
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginTop: 2,
  },
  addButton: {
    padding: 4,
  },
  amountContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amountInfo: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  menuButton: {
    padding: 8,
    marginLeft: isRTL ? 0 : 4,
    marginRight: isRTL ? 4 : 0,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  menuHeaderTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: 16,
  },
  menuOptionsList: {
    paddingHorizontal: 20,
  },
  menuOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : 12,
    marginLeft: isRTL ? 12 : 0,
  },
  menuOptionTextContainer: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  menuOptionSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  closeButton: {
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },

});
