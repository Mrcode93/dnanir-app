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
  Keyboard,
  Animated,
  Modal,
  Pressable,
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
import { ScreenContainer } from '../design-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authStorage } from '../services/authStorage';
import { authModalService } from '../services/authModalService';

const CHAT_STORAGE_KEY = 'al_hajji_chat_history';

interface Action {
  title: string;
  screen: string;
  params?: any;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'hajji';
  timestamp: Date;
  suggestions?: string[];
  actions?: Action[];
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
  const [showOptions, setShowOptions] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const optionsAnim = useRef(new Animated.Value(0)).current;

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const [token, user] = await Promise.all([
        authStorage.getAccessToken(),
        authStorage.getUser(),
      ]);
      
      if (!token || !user) {
        navigation.goBack();
        setTimeout(() => {
          authModalService.show();
          alertService.info(tl("تسجيل الدخول"), tl("يجب تسجيل الدخول أولاً للتحدث مع الحجّي"));
        }, 300);
      } else {
        setIsAuthenticated(true);
      }
    };
    checkAuth();
  }, [navigation]);

  // Load chat history from AsyncStorage
  useEffect(() => {
    if (!isAuthenticated) return;

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
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
    };
    loadChat();
  }, [isAuthenticated]);

  // Save chat history to AsyncStorage
  useEffect(() => {
    if (isLoaded && isAuthenticated) {
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(e => 
        console.error('Failed to save chat history', e)
      );
    }
  }, [messages, isLoaded, isAuthenticated]);

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
              suggestions: response.data.suggestions,
              actions: response.data.actions
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

        return prev;
      });
    } catch (error) {
      setLoading(false);
    }
  }, [inputText, loading, getFinancialSummary, currencyCode]);

  const clearHistory = useCallback(() => {
    setShowOptions(false);
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

  const toggleOptions = useCallback((show: boolean) => {
    if (show) {
      setShowOptions(true);
      Animated.timing(optionsAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(optionsAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShowOptions(false));
    }
  }, [optionsAnim]);

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
            onPress={() => toggleOptions(true)}
            style={{ padding: 8, marginRight: isRTL ? 16 : 0, marginLeft: isRTL ? 0 : 8 }}
          >
            <Ionicons name="ellipsis-vertical-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerAvatarContainer}>
            <Image 
              source={require('../../assets/images/chat/avatar.png')} 
              style={styles.headerAvatar}
            />
          </View>
        </View>
      )
    });
  }, [navigation, toggleOptions, styles, isRTL]);

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const ThinkingIndicator = () => {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const animateDot = (anim: Animated.Value, delay: number) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
          ])
        ).start();
      };
      animateDot(dot1, 0);
      animateDot(dot2, 150);
      animateDot(dot3, 300);
    }, []);

    const dotStyle = (anim: Animated.Value) => ({
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
      marginHorizontal: 3,
    });

    return (
      <View style={[styles.typingContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.avatarContainerMini}>
          <Image source={require('../../assets/images/chat/avatar.png')} style={styles.avatarMini} />
        </View>
        <View style={[styles.thinkingBubble, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#FFFFFF' }]}>
          <Animated.View style={dotStyle(dot1)} />
          <Animated.View style={dotStyle(dot2)} />
          <Animated.View style={dotStyle(dot3)} />
          <Text style={[styles.typingText, { color: theme.colors.textSecondary, marginLeft: 8 }]}>
            {tl("الحجّي ديفكر...")}
          </Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Message, index: number }) => {
    const isHajji = item.sender === 'hajji';
    const isNewestHajji = isHajji && index === messages.length - 1;
    
    return (
      <Animated.View 
        style={[
          styles.messageWrapper,
          isHajji ? styles.hajjiWrapper : styles.userWrapper,
          { flexDirection: isHajji ? (isRTL ? 'row-reverse' : 'row') : (isRTL ? 'row' : 'row-reverse') },
          { transform: [{ translateY: 0 }] } // Future: add entry animation
        ]}
      >
        {isHajji && (
          <View style={[styles.avatarContainer, { marginLeft: isRTL ? 10 : 0, marginRight: isRTL ? 0 : 10 }]}>
            <LinearGradient
              colors={isDark ? ['#334155', '#1E293B'] : ['#E2E8F0', '#F8FAFC']}
              style={styles.avatarGradient}
            >
              <Image
                source={require('../../assets/images/chat/avatar.png')}
                style={styles.avatar}
              />
            </LinearGradient>
          </View>
        )}
        <View style={[styles.messageContent, { alignItems: isHajji ? 'flex-start' : 'flex-end' }]}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onLongPress={() => deleteMessage(item.id)}
            style={[
              styles.bubble,
              isHajji ? styles.hajjiBubble : styles.userBubble,
              { 
                backgroundColor: isHajji ? (isDark ? 'rgba(30, 41, 59, 0.95)' : '#FFFFFF') : theme.colors.primary,
                borderWidth: isHajji ? 1 : 0,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              }
            ]}
          >
            <Text style={[
              styles.messageText,
              { color: isHajji ? theme.colors.textPrimary : '#FFFFFF' }
            ]}>
              {item.text}
            </Text>
          </TouchableOpacity>

          {isHajji && item.actions && item.actions.length > 0 && (
            <View style={[styles.actionsWrapper, { justifyContent: isRTL ? 'flex-end' : 'flex-start' }]}>
              {item.actions.map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    if (action.screen) {
                      navigation.navigate(action.screen, action.params);
                    }
                  }}
                >
                  <Ionicons 
                    name={
                      action.screen === 'AddExpense' ? 'remove-circle' :
                      action.screen === 'AddIncome' ? 'add-circle' :
                      action.screen === 'Bills' ? 'receipt' :
                      action.screen === 'Debts' ? 'cash' :
                      action.screen === 'Goals' ? 'trophy' :
                      'flash'
                    } 
                    size={16} 
                    color="#FFFFFF" 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={styles.actionBtnText}>
                    {action.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isHajji && item.suggestions && item.suggestions.length > 0 && (
            <View style={[styles.suggestionsContainer, { justifyContent: isRTL ? 'flex-end' : 'flex-start' }]}>
              {item.suggestions.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.suggestionBtn, 
                    { 
                      borderColor: theme.colors.primary + '30',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)'
                    }
                  ]}
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
      </Animated.View>
    );
  };

  return (
    <ScreenContainer
      scrollable={false}
      keyboardOffset={Platform.OS === 'ios' ? 100 : 40}
      edges={['left', 'right', 'bottom']}
      footer={
        <View style={[styles.inputArea, { borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={[styles.inputContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
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
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, idx) => item.id + idx}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => loading ? <ThinkingIndicator /> : null}
        />
      </Animated.View>

      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => toggleOptions(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => toggleOptions(false)}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              {
                transform: [{
                  translateY: optionsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0]
                  })
                }]
              }
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
              <Text style={styles.modalTitle}>{tl("خيارات الدردشة")}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={clearHistory}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </View>
              <Text style={[styles.optionText, { color: '#EF4444' }]}>
                {tl("مسح محتوى المحادثة")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, { marginTop: 8 }]}
              onPress={() => toggleOptions(false)}
            >
              <View style={[styles.optionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <Ionicons name="close-outline" size={22} color={theme.colors.textPrimary} />
              </View>
              <Text style={styles.optionText}>{tl("إلغاء")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  headerAvatarContainer: {
    padding: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: isRTL ? 0 : 8,
    marginRight: isRTL ? 8 : 0,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: 40,
  },
  messageWrapper: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  hajjiWrapper: {
    alignSelf: 'flex-start',
  },
  userWrapper: {
    alignSelf: 'flex-end',
  },
  avatarContainer: {
    elevation: 2,
  },
  avatarGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageContent: {
    maxWidth: '85%',
  },
  bubble: {
    padding: theme.spacing.md,
    borderRadius: 20,
    ...getPlatformShadow('xs'),
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
    textAlign: isRTL ? 'right' : 'left',
  },
  actionsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  actionBtn: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    ...getPlatformShadow('sm'),
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
    gap: 8,
  },
  suggestionBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
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
    gap: 8,
  },
  typingText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily,
  },
  thinkingBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderTopLeftRadius: isRTL ? 20 : 4,
    borderTopRightRadius: isRTL ? 4 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...getPlatformShadow('xs'),
  },
  avatarContainerMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
    ...getPlatformShadow('xs'),
  },
  avatarMini: {
    width: '100%',
    height: '100%',
  },
  inputArea: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 0 : 8,
    borderTopWidth: 1,
  },
  inputContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: Platform.OS === 'ios' ? 4 : 2,
    borderRadius: 30,
    marginHorizontal: 12,
    ...getPlatformShadow('sm'),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 15,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    margin: 4,
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...getPlatformShadow('lg'),
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
  },
  modalOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : 12,
    marginLeft: isRTL ? 12 : 0,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left',
  }
});
