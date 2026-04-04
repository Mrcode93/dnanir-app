import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { aiApiService } from '../services/aiApiService';
import { alertService } from '../services/alertService';
import { getCurrentMonthData, getMonthData, getSelectedCurrencyCode } from '../services/financialService';
import { getDebts, getFinancialGoals, getBills } from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { tl, useLocalization } from "../localization";
import { isRTL } from '../utils/rtl';
import { useWallets } from '../context/WalletContext';
import { ScreenContainer, AppHeader } from '../design-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_STORAGE_KEY = 'al_hajji_chat_history';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'hajji';
  timestamp: Date;
  suggestions?: string[];
}

export const AIAdvisorScreen = ({ navigation }: any) => {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode } = useCurrency();
  const { selectedWallet, wallets } = useWallets();
  const { t } = useLocalization();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Load chat history from AsyncStorage
  useEffect(() => {
    const loadChat = async () => {
      try {
        const saved = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const formatted = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }));
          setMessages(formatted);
        } else {
          // Initialize with welcome message if no history
          setMessages([
            {
              id: '1',
              text: tl("هلا بيك يالغالي، نورتني. أني الحجّي، مستشارك المالي اللي يهمة مصلحتك. كلي شنو ببالك؟ تريد نصيحة عن مصروفك لو عندك سؤال مالي؟"),
              sender: 'hajji',
              timestamp: new Date(),
              suggestions: [
                tl("شلون وضعي المالي هالشهر؟"),
                tl("انطيني نصيحة للتوفير"),
                tl("الميزانية اليومية شكد؟")
              ]
            }
          ]);
        }
      } catch (e) {
        console.error('Failed to load chat history', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadChat();
  }, []);

  // Save chat history to AsyncStorage
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(e => 
        console.error('Failed to save chat history', e)
      );
    }
  }, [messages, isLoaded]);

  const getFinancialSummary = useCallback(async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const [current, previous, currency, debts, goals, bills] = await Promise.all([
        getCurrentMonthData(selectedWallet?.id),
        getMonthData(prevYear, prevMonth, selectedWallet?.id),
        getSelectedCurrencyCode(),
        getDebts(),
        getFinancialGoals(),
        getBills()
      ]);

      const lastDay = new Date(year, month, 0).getDate();
      const today = now.getDate();
      const daysLeftInMonth = Math.max(1, lastDay - today);

      return {
        totalIncome: current.totalIncome,
        totalExpenses: current.totalExpenses,
        balance: current.balance,
        byCategory: (current.topExpenseCategories || []).map((c: any) => ({
          category: c.category,
          amount: c.amount,
          percentage: c.percentage
        })),
        daysLeftInMonth,
        walletName: selectedWallet?.name,
        wallets: (wallets || []).map(w => ({ name: w.name, balance: w.balance })),
        currency: currencyCode || currency,
        debts: (debts || []).map(d => ({ 
          name: d.debtorName, 
          total: d.totalAmount, 
          remaining: d.remainingAmount,
          direction: d.direction,
          isPaid: !!d.isPaid 
        })).filter(d => !d.isPaid),
        goals: (goals || []).map(g => ({
          title: g.title,
          target: g.targetAmount,
          current: g.currentAmount,
          deadline: g.targetDate
        })).filter(g => g.current < g.target),
        bills: (bills || []).map(b => ({
          title: b.title,
          amount: b.amount,
          isPaid: !!b.isPaid,
          dueDate: b.dueDate
        })).filter(b => !b.isPaid)
      };
    } catch (e) {
      console.error('Failed to get summary for Al-Hajji', e);
      return {};
    }
  }, [selectedWallet, currencyCode, wallets]);

  const handleSend = useCallback(async (text: string = inputText) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const summary = await getFinancialSummary();
      
      // Use optimistic update logic with functional setState
      setMessages(prev => {
        const historyContext = prev.slice(-10).map(m => ({
          sender: m.sender,
          text: m.text
        }));

        aiApiService.askAlHajji(
          text.trim(), 
          summary, 
          currencyCode, 
          historyContext as any
        ).then(response => {
          if (response.success && response.data) {
            const hajjiMessage: Message = {
              id: (Date.now() + 1).toString(),
              text: response.data.response,
              sender: 'hajji',
              timestamp: new Date(),
              suggestions: response.data.suggestions
            };
            setMessages(current => [...current, hajjiMessage]);
          } else {
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              text: tl("اعتذر منك يا بويه، صار عندي تعب بالحسابات. شوية وارجع اسولف وياك."),
              sender: 'hajji',
              timestamp: new Date()
            };
            setMessages(current => [...current, errorMessage]);
          }
          setLoading(false);
        }).catch(() => setLoading(false));

        return prev; // Waiting for the promise
      });
    } catch (error) {
      setLoading(false);
    }
  }, [inputText, loading, getFinancialSummary, currencyCode]);

  const clearHistory = useCallback(() => {
    alertService.show({
      title: tl("مسح المحادثة"),
      message: tl("هل أنت متأكد من مسح جميع الرسائل؟ لا يمكن التراجع عن هذه الخطوة."),
      type: 'warning',
      confirmText: tl("مسح الكل"),
      cancelText: tl("إلغاء"),
      showCancel: true,
      onConfirm: async () => {
        try {
          await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
          setMessages([
            {
              id: '1',
              text: tl("هلا بيك يالغالي، نورتني. أني الحجّي، مستشارك المالي اللي يهمة مصلحتك. كلي شنو ببالك؟ تريد نصيحة عن مصروفك لو عندك سؤال مالي؟"),
              sender: 'hajji',
              timestamp: new Date(),
              suggestions: [
                tl("شلون وضعي المالي هالشهر؟"),
                tl("انطيني نصيحة للتوفير"),
                tl("الميزانية اليومية شكد؟")
              ]
            }
          ]);
        } catch (e) {}
      }
    });
  }, []);

  const deleteMessage = useCallback((id: string) => {
    alertService.show({
      title: tl("حذف الرسالة"),
      message: tl("هل تريد حذف هذه الرسالة من المحادثة؟"),
      type: 'info',
      confirmText: tl("حذف"),
      cancelText: tl("إلغاء"),
      showCancel: true,
      onConfirm: () => {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages.length, loading]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={clearHistory}
            style={{ padding: 8, marginRight: isRTL ? 16 : 0, marginLeft: isRTL ? 0 : 8 }}
          >
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Image 
            source={require('../../assets/images/chat/avatar.png')} 
            style={styles.headerAvatar}
          />
        </View>
      )
    });
  }, [navigation, clearHistory, styles.headerAvatar]); // Simplified dependencies

  const renderMessage = ({ item }: { item: Message }) => {
    const isHajji = item.sender === 'hajji';
    return (
      <View style={[
        styles.messageWrapper,
        isHajji ? styles.hajjiWrapper : styles.userWrapper,
        { flexDirection: isHajji ? (isRTL ? 'row-reverse' : 'row') : (isRTL ? 'row' : 'row-reverse') }
      ]}>
        {isHajji && (
          <View style={[styles.avatarContainer, { marginLeft: isRTL ? 8 : 0, marginRight: isRTL ? 0 : 8 }]}>
            <Image
              source={require('../../assets/images/chat/avatar.png')}
              style={styles.avatar}
            />
          </View>
        )}
        <View style={[styles.messageContent, { alignItems: isHajji ? 'flex-start' : 'flex-end' }]}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onLongPress={() => deleteMessage(item.id)}
            style={[
              styles.bubble,
              isHajji ? styles.hajjiBubble : styles.userBubble,
              { backgroundColor: isHajji ? (isDark ? '#1E293B' : '#F1F5F9') : theme.colors.primary }
            ]}
          >
            <Text style={[
              styles.messageText,
              { color: isHajji ? theme.colors.textPrimary : '#FFFFFF' }
            ]}>
              {item.text}
            </Text>
          </TouchableOpacity>

          {isHajji && item.suggestions && item.suggestions.length > 0 && (
            <View style={[styles.suggestionsContainer, { justifyContent: isRTL ? 'flex-end' : 'flex-start' }]}>
              {item.suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.suggestionBtn, { borderColor: theme.colors.primary + '40' }]}
                  onPress={() => handleSend(suggestion)}
                >
                  <Text style={[styles.suggestionText, { color: theme.colors.primary }]}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer
      scrollable={false}
      keyboardOffset={Platform.OS === 'ios' ? 100 : 40}
      edges={['left', 'right', 'bottom']}
      footer={
        <View style={[styles.inputArea, { borderTopColor: theme.colors.border }]}>
          <View style={[styles.inputContainer, { backgroundColor: isDark ? '#1E293B' : '#F8F9FA' }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.textPrimary, maxHeight: 100 }]}
              placeholder={tl("اسأل الحجّي...")}
              placeholderTextColor={theme.colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={!inputText.trim() || loading}
              style={[
                styles.sendBtn,
                { opacity: inputText.trim() ? 1 : 0.5 }
              ]}
            >
              <LinearGradient
                colors={theme.gradients.primary as any}
                style={styles.sendGradient}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" style={{ transform: [{ rotate: isRTL ? '180deg' : '0deg' }] }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {loading && (
          <View style={[styles.typingContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.typingText, { color: theme.colors.textSecondary }]}>
              {tl("الحجّي ديفكر...")}
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xl,
  },
  messageWrapper: {
    marginBottom: theme.spacing.lg,
    width: '100%',
  },
  hajjiWrapper: {
    alignSelf: 'flex-start',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  avatarContainer: {
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceCard,
  },
  messageContent: {
    maxWidth: '85%',
  },
  bubble: {
    padding: theme.spacing.md,
    borderRadius: 20,
    ...getPlatformShadow('sm'),
  },
  hajjiBubble: {
    borderTopLeftRadius: isRTL ? 20 : 4,
    borderTopRightRadius: isRTL ? 4 : 20,
  },
  userBubble: {
    borderTopLeftRadius: isRTL ? 4 : 20,
    borderTopRightRadius: isRTL ? 20 : 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  suggestionBtn: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceCard,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  typingContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  typingText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
  },
  inputArea: {
    paddingVertical: theme.spacing.xs,
    borderTopWidth: 1,
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    borderRadius: 24,
    ...getPlatformShadow('sm'),
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    margin: 4,
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
