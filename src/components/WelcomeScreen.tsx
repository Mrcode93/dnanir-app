import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Card, Button, TextInput, TouchableRipple } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useRTL } from '../hooks/useRTL';
import RTLText from './RTLText';
import * as LocalAuthentication from 'expo-local-authentication';
import { upsertUserSettings } from '../database/database';
import { colors } from '../utils/gradientColors';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onGetStarted }) => {
  const { isRTL, isRTLSystem } = useRTL();
  const [step, setStep] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [authMethod, setAuthMethod] = useState<'biometric' | 'password' | 'none'>('none');
  const [biometricAvailable, setBiometricAvailable] = useState<boolean>(false);
  const [biometricChecked, setBiometricChecked] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState<boolean>(false);

  // Check biometric availability on component mount
  React.useEffect(() => {
    const checkBiometric = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hasHardware && enrolled);
      } catch (error) {
        console.log('Biometric check failed:', error);
        setBiometricAvailable(false);
      } finally {
        setBiometricChecked(true);
      }
    };
    checkBiometric();
  }, []);

  const authenticateWithBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'استخدم بصمتك أو وجهك للدخول',
        cancelLabel: 'إلغاء',
        fallbackLabel: 'استخدام كلمة المرور',
        disableDeviceFallback: false,
      });
      
      if (result.success) {
        setBiometricEnrolled(true);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log('Biometric authentication failed:', error);
      return false;
    }
  };

  const goNext = async () => {
    if (step === 0) {
      // Welcome screen -> Name input
      setStep(1);
      return;
    }
    
    if (step === 1) {
      // Name input -> Auth method selection
      if (!name.trim()) return;
      setStep(2);
      return;
    }
    
    if (step === 2) {
      // Auth method selection -> Next step based on choice
      if (authMethod === 'none') {
        // No authentication -> Finish immediately
        await saveAndFinish({ useBiometric: false, usePassword: false });
        return;
      }
      
      if (authMethod === 'biometric') {
        if (biometricAvailable) {
          // Biometric available -> Go to password setup (required fallback)
          setStep(3);
          return;
        } else {
          // Biometric not available -> Switch to password only
          setAuthMethod('password');
          setStep(3);
          return;
        }
      }
      
      if (authMethod === 'password') {
        // Password only -> Go to password setup
        setStep(3);
        return;
      }
    }
    
    if (step === 3) {
      // Password setup -> Validate and go to next step
      if (!password || password.length < 4) return;
      if (password !== confirmPassword) return;
      
      if (authMethod === 'biometric' && biometricAvailable) {
        // Go to biometric enrollment step
        setStep(4);
        return;
      } else {
        // Password only or biometric unavailable -> Finish
        const useBiometric = authMethod === 'biometric' && biometricAvailable;
        await saveAndFinish({ useBiometric, usePassword: true });
        return;
      }
    }
    
    if (step === 4) {
      // Biometric enrollment -> Finish
      if (authMethod === 'biometric' && biometricAvailable) {
        await saveAndFinish({ useBiometric: true, usePassword: true });
        return;
      }
    }
  };

  const saveAndFinish = async ({ useBiometric, usePassword }: { useBiometric: boolean; usePassword?: boolean; }) => {
    try {
      setSaving(true);
      await upsertUserSettings({
        name: name.trim(),
        authMethod: useBiometric ? 'biometric' : usePassword ? 'password' : 'none',
        passwordHash: usePassword ? password : null,
        biometricsEnabled: !!useBiometric,
      });
      onGetStarted();
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name="wallet" size={80} color="#00D4AA" />
          </View>
          <RTLText style={styles.title}>مرحباً بك في دنانير</RTLText>
          <RTLText style={styles.subtitle}>تطبيقك الذكي لإدارة الأموال بطريقة ممتعة وسهلة</RTLText>
          <Card style={styles.featureCard}>
            <Card.Content>
              <View style={styles.feature}>
                <Ionicons name="analytics" size={24} color="#00D4AA" />
                <RTLText style={styles.featureText}>تتبع المصاريف والدخل</RTLText>
              </View>
              <View style={styles.feature}>
                <Ionicons name="trending-up" size={24} color="#00D4AA" />
                <RTLText style={styles.featureText}>تحليلات ذكية</RTLText>
              </View>
              <View style={styles.feature}>
                <Ionicons name="bulb" size={24} color="#00D4AA" />
                <RTLText style={styles.featureText}>نصائح لتوفير المال</RTLText>
              </View>
            </Card.Content>
          </Card>
          <View style={styles.taglineContainer}>
            <RTLText style={styles.taglineArabic}>"دنانير: كل دينار مهم!"</RTLText>
         
          </View>
        </>
      );
    }
    if (step === 1) {
      return (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Ionicons name="person-circle-outline" size={32} color="#00D4AA" />
            <RTLText style={styles.stepTitle}>شنو اسمك؟</RTLText>
          </View>
          
          <RTLText style={styles.infoTextStep2}>
            أخبرنا باسمك لنخصص تجربتك في التطبيق
          </RTLText>
          
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
            <TextInput
              mode="outlined"
              label="اسمك"
              value={name}
              onChangeText={setName}
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              style={styles.input}
              contentStyle={styles.inputContent}
              theme={{
                colors: {
                  background: colors.background,
                  text: colors.text,
                  placeholder: colors.textSecondary,
                },
                fonts: {
                  bodyMedium: {
                    fontFamily: 'Cairo-Regular',
                  },
                },
              }}
              right={name.trim().length > 0 ? <TextInput.Icon icon="check-circle" color={colors.primary} /> : null}
            />
          </View>
          
          {name.trim().length > 0 && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#00D4AA" />
              <RTLText style={styles.successText}>مرحباً {name}! 👋</RTLText>
            </View>
          )}
        </View>
      );
    }
    if (step === 2) {
      return (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Ionicons name="shield-checkmark-outline" size={32} color="#00D4AA" />
            <RTLText style={styles.stepTitle}>طريقة القفل</RTLText>
          </View>
          <RTLText style={styles.infoTextStep2}>
            اختر طريقة القفل التي تفضلها لحماية بياناتك المالية
          </RTLText>
          
          <View style={styles.authOptionsContainer}>
            {/* Biometric Option */}
            <TouchableRipple
              onPress={() => setAuthMethod('biometric')}
              disabled={!biometricChecked || !biometricAvailable}
              style={[
                styles.authOption,
                authMethod === 'biometric' && styles.authOptionSelected,
                (!biometricChecked || !biometricAvailable) && styles.authOptionDisabled,
              ]}
              rippleColor="rgba(0, 212, 170, 0.2)"
            >
              <View style={styles.authOptionContent}>
                <Ionicons 
                  name={authMethod === 'biometric' ? 'finger-print' : 'finger-print-outline'} 
                  size={28} 
                  color={(!biometricChecked || !biometricAvailable) ? '#666' : authMethod === 'biometric' ? '#00D4AA' : '#9E9E9E'} 
                />
                <View style={styles.authOptionTextContainer}>
                  <RTLText style={[
                    styles.authOptionTitle,
                    (!biometricChecked || !biometricAvailable) && styles.authOptionTitleDisabled,
                    authMethod === 'biometric' && styles.authOptionTitleSelected,
                  ]}>
                    {biometricChecked 
                      ? (biometricAvailable ? 'بصمة / وجه' : 'بصمة / وجه')
                      : 'بصمة / وجه...'}
                  </RTLText>
                  <RTLText style={[
                    styles.authOptionDescription,
                    (!biometricChecked || !biometricAvailable) && styles.authOptionDescriptionDisabled,
                  ]}>
                    {!biometricChecked 
                      ? 'جاري التحقق...'
                      : biometricAvailable 
                        ? 'استخدم بصمتك أو وجهك للدخول'
                        : 'غير متوفرة على هذا الجهاز'}
                  </RTLText>
                </View>
                {authMethod === 'biometric' && (
                  <Ionicons name="checkmark-circle" size={24} color="#00D4AA" />
                )}
              </View>
            </TouchableRipple>

            {/* Password Option */}
            <TouchableRipple
              onPress={() => setAuthMethod('password')}
              style={[
                styles.authOption,
                authMethod === 'password' && styles.authOptionSelected,
              ]}
              rippleColor="rgba(0, 212, 170, 0.2)"
            >
              <View style={styles.authOptionContent}>
                <Ionicons 
                  name={authMethod === 'password' ? 'lock-closed' : 'lock-closed-outline'} 
                  size={28} 
                  color={authMethod === 'password' ? '#00D4AA' : '#9E9E9E'} 
                />
                <View style={styles.authOptionTextContainer}>
                  <RTLText style={[
                    styles.authOptionTitle,
                    authMethod === 'password' && styles.authOptionTitleSelected,
                  ]}>
                    كلمة مرور
                  </RTLText>
                  <RTLText style={styles.authOptionDescription}>
                    احمِ بياناتك بكلمة مرور قوية
                  </RTLText>
                </View>
                {authMethod === 'password' && (
                  <Ionicons name="checkmark-circle" size={24} color="#00D4AA" />
                )}
              </View>
            </TouchableRipple>

            {/* No Lock Option */}
            <TouchableRipple
              onPress={() => setAuthMethod('none')}
              style={[
                styles.authOption,
                authMethod === 'none' && styles.authOptionSelected,
              ]}
              rippleColor="rgba(0, 212, 170, 0.2)"
            >
              <View style={styles.authOptionContent}>
                <Ionicons 
                  name={authMethod === 'none' ? 'lock-open' : 'lock-open-outline'} 
                  size={28} 
                  color={authMethod === 'none' ? '#00D4AA' : '#9E9E9E'} 
                />
                <View style={styles.authOptionTextContainer}>
                  <RTLText style={[
                    styles.authOptionTitle,
                    authMethod === 'none' && styles.authOptionTitleSelected,
                  ]}>
                    بدون قفل
                  </RTLText>
                  <RTLText style={styles.authOptionDescription}>
                    دخول مباشر بدون حماية
                  </RTLText>
                </View>
                {authMethod === 'none' && (
                  <Ionicons name="checkmark-circle" size={24} color="#00D4AA" />
                )}
              </View>
            </TouchableRipple>
          </View>

          {authMethod === 'biometric' && !biometricAvailable && biometricChecked && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color="#FFB74D" />
              <RTLText style={styles.warningText}>البصمة غير متوفرة. سيتم استخدام كلمة المرور.</RTLText>
            </View>
          )}
          
          {authMethod === 'biometric' && biometricAvailable && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#00D4AA" />
              <RTLText style={styles.infoBoxText}>ستستخدم البصمة المسجلة في النظام + كلمة مرور احتياطية</RTLText>
            </View>
          )}
          
          {authMethod === 'password' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#00D4AA" />
              <RTLText style={styles.infoBoxText}>ستحتاج إلى إدخال كلمة المرور عند فتح التطبيق</RTLText>
            </View>
          )}
          
          {authMethod === 'none' && (
            <View style={styles.warningBox}>
              <Ionicons name="alert-circle-outline" size={20} color="#FFB74D" />
              <RTLText style={styles.warningText}>لن يتم حماية بياناتك. يمكن لأي شخص الوصول للتطبيق</RTLText>
            </View>
          )}
        </View>
      );
    }
    if (step === 3) {
      return (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Ionicons 
              name="lock-closed" 
              size={32} 
              color="#00D4AA" 
            />
            <RTLText style={styles.stepTitle}>
              {authMethod === 'biometric' 
                ? 'كلمة مرور احتياطية' 
                : 'كلمة المرور'
              }
            </RTLText>
          </View>
          
          {authMethod === 'biometric' && biometricAvailable && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#00D4AA" />
              <RTLText style={styles.infoBoxText}>
                كلمة المرور الاحتياطية مطلوبة في حالة عدم عمل البصمة
              </RTLText>
            </View>
          )}
          {authMethod === 'password' && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#00D4AA" />
              <RTLText style={styles.infoBoxText}>
                اختر كلمة مرور قوية لحماية بياناتك (4 أحرف على الأقل)
              </RTLText>
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
              <TextInput
                mode="outlined"
                label="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.input}
                contentStyle={styles.inputContent}
                theme={{
                  colors: {
                    background: colors.background,
                    text: colors.text,
                    placeholder: colors.textSecondary,
                  },
                  fonts: {
                    bodyMedium: {
                      fontFamily: 'Cairo-Regular',
                    },
                  },
                }}
                right={password.length >= 4 ? <TextInput.Icon icon="check-circle" color={colors.primary} /> : null}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#9E9E9E" style={styles.inputIcon} />
              <TextInput
                mode="outlined"
                label="تأكيد كلمة المرور"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                outlineColor={colors.border}
                activeOutlineColor={colors.primary}
                style={styles.input}
                contentStyle={styles.inputContent}
                theme={{
                  colors: {
                    background: colors.background,
                    text: colors.text,
                    placeholder: colors.textSecondary,
                  },
                  fonts: {
                    bodyMedium: {
                      fontFamily: 'Cairo-Regular',
                    },
                  },
                }}
                right={
                  confirmPassword.length > 0 && password === confirmPassword 
                    ? <TextInput.Icon icon="check-circle" color={colors.primary} /> 
                    : null
                }
              />
            </View>
          </View>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <View style={styles.passwordStrengthContainer}>
              <RTLText style={styles.passwordStrengthLabel}>قوة كلمة المرور:</RTLText>
              <View style={styles.passwordStrengthBar}>
                <View style={[
                  styles.passwordStrengthFill,
                  {
                    width: password.length < 4 ? '33%' : password.length < 8 ? '66%' : '100%',
                    backgroundColor: password.length < 4 ? '#FF5252' : password.length < 8 ? '#FFB74D' : '#00D4AA',
                  }
                ]} />
              </View>
              <RTLText style={[
                styles.passwordStrengthText,
                {
                  color: password.length < 4 ? '#FF5252' : password.length < 8 ? '#FFB74D' : '#00D4AA',
                }
              ]}>
                {password.length < 4 ? 'ضعيفة' : password.length < 8 ? 'متوسطة' : 'قوية'}
              </RTLText>
            </View>
          )}

          {password !== confirmPassword && confirmPassword.length > 0 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color="#FFB74D" />
              <RTLText style={styles.warningText}>كلمات المرور غير متطابقة</RTLText>
            </View>
          )}

          {password === confirmPassword && confirmPassword.length > 0 && password.length >= 4 && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#00D4AA" />
              <RTLText style={styles.successText}>كلمة المرور مطابقة وجاهزة!</RTLText>
            </View>
          )}
        </View>
      );
    }
    
    if (step === 4) {
      return (
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Ionicons name="finger-print" size={32} color="#00D4AA" />
            <RTLText style={styles.stepTitle}>اختبار البصمة</RTLText>
          </View>
          
          <View style={styles.biometricContainer}>
            <View style={styles.biometricIconCircle}>
              <Ionicons name="shield-checkmark" size={60} color="#00D4AA" />
            </View>
            
            <RTLText style={styles.biometricTitle}>
              جاهز لاختبار البصمة!
            </RTLText>
            
            <View style={styles.biometricInfoList}>
              <View style={styles.biometricInfoItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00D4AA" />
                <RTLText style={styles.biometricInfoText}>
                  اضغط على الزر أدناه لاختبار بصمتك أو وجهك
                </RTLText>
              </View>
              
              <View style={styles.biometricInfoItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00D4AA" />
                <RTLText style={styles.biometricInfoText}>
                  سيتم استخدام البصمة المسجلة في النظام للدخول
                </RTLText>
              </View>
              
              <View style={styles.biometricInfoItem}>
                <Ionicons name="checkmark-circle" size={20} color="#00D4AA" />
                <RTLText style={styles.biometricInfoText}>
                  يمكنك أيضاً استخدام كلمة المرور كبديل
                </RTLText>
              </View>
            </View>
          </View>
        </View>
      );
    }
    
    return null;
  };

  const handleSkipPassword = async () => {
    // Only allow skip for password-only users
    if (authMethod === 'password') {
      await saveAndFinish({ useBiometric: false, usePassword: false });
    }
  };

  const handleBiometricTest = async () => {
    const success = await authenticateWithBiometric();
    if (success) {
      await saveAndFinish({ useBiometric: true, usePassword: true });
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {renderStep()}
        <View style={styles.buttonContainer}>
          {step === 3 && authMethod === 'password' && (
            <Button
              mode="outlined"
              onPress={handleSkipPassword}
              style={styles.skipButton}
              contentStyle={styles.buttonContent}
              disabled={saving}
            >
              بدون قفل
            </Button>
          )}
          {step === 4 ? (
            <Button
              mode="contained"
              onPress={handleBiometricTest}
              style={styles.getStartedButton}
              contentStyle={styles.buttonContent}
              disabled={saving}
            >
             <RTLText style={styles.buttonText}>اختبار البصمة</RTLText>
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={goNext}
              style={styles.getStartedButton}
              contentStyle={styles.buttonContent}
              disabled={saving}
            >
              <RTLText style={styles.buttonText}>{step === 0 ? 'ابدأ الآن' : step < 3 ? 'التالي' : 'حفظ'}</RTLText>
            </Button>
          )}
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: '100%',
  },
  stepCard: {
    width: '100%',
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    direction: 'rtl', 
   },
  stepHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
    direction: 'rtl', 
  },
  stepTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    paddingTop: 10,
    fontWeight: 'bold',
    fontFamily: 'Cairo-Regular',
    textAlign: 'left',
    flex: 1,

  },
  input: {
    backgroundColor: colors.background,
    marginBottom: 12,
    borderRadius: 12,
    textAlign: 'right',
    direction: 'rtl',
    flex: 1,
  },
  inputContent: {
    textAlign: 'right',
    fontFamily: 'Cairo-Regular',
    writingDirection: 'rtl',
  },
  inputContainer: {
    gap: 16,
    marginTop: 16,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 20,
    zIndex: 1,
  },
  warning: {
    color: '#FFB74D',
    marginTop: 8,
    textAlign: 'left',
    fontFamily: 'Cairo-Regular',
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    paddingTop: 32,
    paddingBottom: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Cairo-Regular',
  },
  subtitle: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'Cairo-Regular',
  },
  featureCard: {
    width: '100%',
    marginBottom: 32,
    elevation: 2,
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
  },
  feature: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
  },
  featureText: {
    marginRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  tagline: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00D4AA',
    marginBottom: 8,
    fontFamily: 'Cairo-Regular',
  },
  taglineArabic: {
    fontSize: 16,
    color: '#9E9E9E',
    fontStyle: 'italic',
    fontFamily: 'Cairo-Regular',
  },
  rtlStatus: {
    fontSize: 12,
    color: '#00D4AA',
    marginTop: 8,
    fontFamily: 'Cairo-Regular',
  },
  infoText: {
    color: '#9E9E9E',
    marginBottom: 16,
    textAlign: 'right',
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
  },
  infoTextStep2: {
    color: '#B0B0B0',
    marginBottom: 24,
    textAlign: 'right',
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  authOptionsContainer: {
    marginBottom: 16,
    gap: 12,
  },
  authOption: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#404040',
    overflow: 'hidden',
  },
  authOptionSelected: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0, 212, 170, 0.05)',
  },
  authOptionDisabled: {
    opacity: 0.5,
  },
  authOptionContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  authOptionTextContainer: {
    flex: 1,
    gap: 4,
  },
  authOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
  },
  authOptionTitleSelected: {
    color: '#00D4AA',
  },
  authOptionTitleDisabled: {
    color: '#666',
  },
  authOptionDescription: {
    fontSize: 13,
    color: '#9E9E9E',
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    lineHeight: 18,
  },
  authOptionDescriptionDisabled: {
    color: '#666',
  },
  warningBox: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.3)',
  },
  warningText: {
    color: '#FFB74D',
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },
  infoBoxText: {
    color: '#00D4AA',
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
  },
  successBox: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#00D4AA',
  },
  successText: {
    color: '#00D4AA',
    fontFamily: 'Cairo-Regular',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
    lineHeight: 20,
    fontWeight: 'bold',
  },
  passwordStrengthContainer: {
    marginTop: 16,
    gap: 8,
  },
  passwordStrengthLabel: {
    fontSize: 14,
    color: '#9E9E9E',
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
  },
  passwordStrengthBar: {
    height: 8,
    backgroundColor: '#404040',
    borderRadius: 4,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 4,
  },
  passwordStrengthText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  biometricContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 20,
  },
  biometricIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderWidth: 3,
    borderColor: '#00D4AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  biometricTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingTop: 10,
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
    marginBottom: 8,
  },
  biometricInfoList: {
    width: '100%',
    gap: 12,
  },
  biometricInfoItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 8,
  },
  biometricInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#B0B0B0',
    fontFamily: 'Cairo-Regular',
    textAlign: 'right',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row-reverse',
    gap: 12,
    width: '100%',
  },
  getStartedButton: {
    backgroundColor: '#00D4AA',
    paddingHorizontal: 32,
    flex: 1,
  },
  skipButton: {
    borderColor: '#404040',
    borderWidth: 1,
    flex: 1,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});

export default WelcomeScreen;
