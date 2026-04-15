import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Switch, Image, Keyboard, StatusBar, FlatList } from 'react-native';
import { TextInput } from 'react-native-paper';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Subscription, SubscriptionCategory, SUBSCRIPTION_CATEGORIES, CURRENCIES } from '../types';
import { addSubscription, updateSubscription, getCustomCategories } from '../database/database';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { convertCurrency } from '../services/currencyService';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { tl, useLocalization } from "../localization";

interface AddSubscriptionScreenProps {
  navigation: any;
  route: any;
}

export const AddSubscriptionScreen: React.FC<AddSubscriptionScreenProps> = ({
  navigation,
  route
}) => {
  const { language } = useLocalization();
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, currency: currencyObj } = useCurrency();

  const subscription = route?.params?.subscription as Subscription | undefined;

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [category, setCategory] = useState<SubscriptionCategory>('google');
  const [startDate, setStartDate] = useState(new Date());
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'weekly'>('monthly');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const custom = await getCustomCategories('subscription');
      setCustomCategories(custom);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (subscription) {
      setName(subscription.name);
      setAmount(formatNumberWithCommas(subscription.amount));
      setSelectedCurrency(subscription.currency || currencyCode);
      setCategory(subscription.category as SubscriptionCategory);
      setStartDate(new Date(subscription.startDate));
      setBillingCycle(subscription.billingCycle);
      setDescription(subscription.description || '');
      setIsActive(subscription.isActive);
    }
  }, [subscription]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const calculateNextPaymentDate = (start: Date, cycle: string): Date => {
    const next = new Date(start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (next <= today) {
      if (cycle === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (cycle === 'yearly') next.setFullYear(next.getFullYear() + 1);
      else if (cycle === 'weekly') next.setDate(next.getDate() + 7);
      else break;
    }
    return next;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال اسم الاشتراك"));
      return;
    }

    Keyboard.dismiss();
    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim() || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ صحيح"));
      return;
    }

    setLoading(true);
    try {
      const nextDate = calculateNextPaymentDate(startDate, billingCycle);
      
      const baseAmount = await convertCurrency(Number(cleanAmount), selectedCurrency, 'IQD');
      
      const subData = {
        name: name.trim(),
        amount: Number(cleanAmount),
        currency: selectedCurrency,
        billingCycle,
        startDate: startDate.toISOString().split('T')[0],
        nextPaymentDate: nextDate.toISOString().split('T')[0],
        category,
        description: description.trim() || undefined,
        isActive,
        walletId: subscription?.walletId, // Keep existing wallet if editing
        base_amount: baseAmount,
      };

      if (subscription) {
        await updateSubscription(subscription.id, subData);
        alertService.toastSuccess(tl("تم تحديث الاشتراك بنجاح"));
      } else {
        await addSubscription(subData);
        alertService.toastSuccess(tl("تم إضافة الاشتراك بنجاح"));
      }
      handleClose();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حفظ الاشتراك"));
    } finally {
      setLoading(false);
    }
  };

  const getCategoryInfo = (cat: string) => {
    const predefined = SUBSCRIPTION_CATEGORIES[cat as SubscriptionCategory];
    if (predefined) return predefined;
    const custom = customCategories.find(c => c.name === cat);
    if (custom) return { label: custom.name, icon: custom.icon, color: custom.color, library: 'Ionicons' as const };
    return SUBSCRIPTION_CATEGORIES.other;
  };

  const categoryInfo = getCategoryInfo(category);
  const currencyInfo = CURRENCIES.find(c => c.code === selectedCurrency) || currencyObj;

  return (
    <ScreenContainer scrollable edges={[]} scrollPadBottom={32} style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <AppHeader 
        title={subscription ? tl("تعديل اشتراك") : tl("اشتراك جديد")} 
        backIcon="close" 
        onBack={handleClose} 
      />

      {/* Amount Section */}
      <View style={styles.amountSection}>
        <TouchableOpacity 
          style={styles.currencySelector} 
          onPress={() => setShowCurrencyPicker(true)}
        >
          <Text style={styles.currencySymbol}>{currencyInfo?.symbol || selectedCurrency}</Text>
          <Ionicons name="chevron-down" size={12} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <TextInput
          value={amount}
          onChangeText={(v) => {
            const cleaned = convertArabicToEnglish(v);
            setAmount(formatNumberWithCommas(cleaned));
          }}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted + '80'}
          style={styles.amountInput}
          keyboardType="decimal-pad"
          selectionColor={categoryInfo.color}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
        />
      </View>

      {/* Category hint */}
      <View style={styles.categoryHint}>
        <View style={[styles.categoryHintBadge, { backgroundColor: categoryInfo.color + '15' }]}>
          {categoryInfo.library === 'Ionicons' ? (
            <Ionicons name={categoryInfo.icon as any} size={14} color={categoryInfo.color} />
          ) : (
            <MaterialCommunityIcons name={categoryInfo.icon as any} size={14} color={categoryInfo.color} />
          )}
          <Text style={[styles.categoryHintText, { color: categoryInfo.color }]}>{categoryInfo.label}</Text>
        </View>
      </View>

      {/* Main Form Card */}
      <View style={styles.card}>
        {/* Service selection */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{tl("الخدمة الرقمية")}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ManageCategories', { type: 'subscription' })}>
            <Text style={styles.manageText}>{tl("إدارة")}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <FlatList
            data={[...Object.keys(SUBSCRIPTION_CATEGORIES), ...customCategories.map(c => c.name)] as string[]}
            horizontal
            inverted={isRTL}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item: cat }) => {
              const info = getCategoryInfo(cat);
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catItem, isSelected && { borderColor: info.color }]}
                  onPress={() => setCategory(cat as any)}
                >
                  <View style={[styles.catIcon, { backgroundColor: isSelected ? info.color : theme.colors.surfaceLight }]}>
                    {info.library === 'Ionicons' ? (
                      <Ionicons 
                        name={(isSelected || info.icon.startsWith('logo-')) ? info.icon as any : `${info.icon}-outline` as any} 
                        size={24} 
                        color={isSelected ? '#FFFFFF' : theme.colors.textSecondary} 
                      />
                    ) : (
                      <MaterialCommunityIcons 
                        name={info.icon as any} 
                        size={24} 
                        color={isSelected ? '#FFFFFF' : theme.colors.textSecondary} 
                      />
                    )}
                  </View>
                  <Text style={[styles.catName, isSelected && { color: info.color, fontWeight: getPlatformFontWeight('700') }]} numberOfLines={1}>
                    {cat === 'other' ? tl("أخرى") : info.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View style={styles.divider} />

        {/* Name */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="bookmark-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput
            placeholder={tl("اسم الاشتراك (مثال: Google One)")}
            value={name}
            onChangeText={setName}
            style={styles.fieldInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        <View style={styles.divider} />

        {/* Start Date */}
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.fieldText}>
            {tl("تاريخ البدء:")} {startDate.toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Billing Cycle */}
        <View style={styles.cycleSection}>
          <Text style={styles.sectionLabel}>{tl("دورة الدفع")}</Text>
          <View style={styles.recurrenceChips}>
            {(['monthly', 'yearly', 'weekly'] as const).map((cycle) => (
              <TouchableOpacity
                key={cycle}
                onPress={() => setBillingCycle(cycle)}
                style={[
                  styles.freqChip,
                  billingCycle === cycle && { backgroundColor: categoryInfo.color, borderColor: categoryInfo.color }
                ]}
              >
                <Text style={[styles.freqChipText, billingCycle === cycle && { color: '#FFFFFF' }]}>
                  {cycle === 'monthly' ? tl("شهري") : cycle === 'yearly' ? tl("سنوي") : tl("أسبوعي")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Status */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="power-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.fieldToggleRow}>
            <Text style={styles.fieldText}>{tl("الاشتراك نشط")}</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: theme.colors.border, true: categoryInfo.color + '80' }}
              thumbColor={isActive ? categoryInfo.color : theme.colors.surfaceCard}
            />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Notes */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput
            placeholder={tl("ملاحظات إضافية...")}
            value={description}
            onChangeText={setDescription}
            style={styles.fieldInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </View>
      </View>

      {/* Save Button */}
      <View style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 24 }}>
        <AppButton 
          label={loading ? tl("جاري الحفظ...") : subscription ? tl("تحديث الاشتراك") : tl("إضافة الاشتراك")} 
          onPress={handleSave} 
          variant="primary" 
          size="lg" 
          loading={loading}
          disabled={loading}
          rightIcon="checkmark-circle"
          style={{ backgroundColor: categoryInfo.color }}
        />
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <CustomDatePicker
          value={startDate}
          onChange={(_, selectedDate) => {
            if (selectedDate) setStartDate(selectedDate);
            if (Platform.OS === 'android') setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Currency Picker */}
      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={selectedCurrency}
        onSelect={(code) => {
          setSelectedCurrency(code);
          setShowCurrencyPicker(false);
        }}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  amountSection: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  currencySelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: 8,
    gap: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
    height: 70,
  },
  categoryHint: {
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryHintBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryHintText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manageText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  section: {
    marginBottom: 16,
  },
  cycleSection: {
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
    fontWeight: getPlatformFontWeight('600'),
  },
  categoriesList: {
    paddingHorizontal: 0,
    gap: 12,
  },
  catItem: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    padding: 4,
    borderColor: 'transparent',
    borderRadius: 16,
  },
  catIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('xs'),
  },
  catName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    width: 70,
    textAlign: 'center',
    fontWeight: getPlatformFontWeight('600'),
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
    opacity: 0.5,
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 50,
    padding: 0,
  },
  fieldText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
  },
  fieldToggleRow: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurrenceChips: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  freqChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  freqChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600'),
  },
});
