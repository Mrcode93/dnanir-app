import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  TextInput,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import RTLText from './RTLText';
import { useCustomAlert } from '../hooks/useCustomAlert';

import { getUserSettings } from '../database/database';
import { colors } from '../utils/gradientColors';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [userSettings, setUserSettings] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const { showError, showSuccess, AlertComponent } = useCustomAlert();

  useEffect(() => {
    loadUserSettings();
    checkBiometricAvailability();
  }, []);

  const loadUserSettings = async () => {
    try {
      const settings = await getUserSettings();
      setUserSettings(settings);
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && enrolled);
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      setBiometricAvailable(false);
    }
  };

  const authenticateWithBiometric = async () => {
    try {
      setLoading(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `مرحباً ${userSettings?.name || ''}، استخدم بصمتك للدخول`,
        cancelLabel: 'إلغاء',
        fallbackLabel: 'استخدام كلمة المرور',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onAuthenticated();
      } else {
        showError('فشل المصادقة', 'لم يتم التعرف على البصمة');
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      showError('خطأ', 'حدث خطأ أثناء المصادقة بالبصمة');
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithPassword = async () => {
    if (!password.trim()) {
      showError('خطأ', 'يرجى إدخال كلمة المرور');
      return;
    }

    try {
      setLoading(true);
      // Simple password comparison (in real app, you'd hash and compare)
      if (password === userSettings?.passwordHash) {
        onAuthenticated();
      } else {
        showError('خطأ', 'كلمة المرور غير صحيحة');
        setPassword('');
      }
    } catch (error) {
      console.error('Password authentication error:', error);
      showError('خطأ', 'حدث خطأ أثناء التحقق من كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricPress = () => {
    if (userSettings?.authMethod === 'biometric' && biometricAvailable) {
      authenticateWithBiometric();
    }
  };

  const handlePasswordSubmit = () => {
    if (userSettings?.authMethod === 'password' || userSettings?.authMethod === 'biometric') {
      authenticateWithPassword();
    }
  };

  if (!userSettings) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.backgroundContainer}>
          <View style={styles.loadingContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="wallet" size={60} color={colors.primary} />
            </View>
            <RTLText style={styles.appName}>دنانير</RTLText>
            <RTLText style={styles.loadingTitle}>جاري التحميل...</RTLText>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // If no authentication is set up, allow direct access
  if (userSettings.authMethod === 'none') {
    onAuthenticated();
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backgroundContainer}>
        <KeyboardAvoidingView 
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Logo & Welcome */}
            <View style={styles.header}>
            
              <RTLText style={styles.appName}>دنانير</RTLText>
              <RTLText style={styles.title}>مرحباً {userSettings.name}!</RTLText>
              <RTLText style={styles.subtitle}>
                {userSettings.authMethod === 'biometric' 
                  ? 'استخدم بصمتك أو كلمة المرور للدخول'
                  : 'أدخل كلمة المرور للمتابعة'
                }
              </RTLText>
            </View>

            {/* Auth Card */}
            <View style={styles.authCard}>
              {/* Biometric Button */}
              {userSettings.authMethod === 'biometric' && biometricAvailable && (
                <View style={styles.biometricSection}>
                  <Button
                    mode="contained"
                    onPress={handleBiometricPress}
                    style={styles.biometricButton}
                    contentStyle={styles.biometricButtonContent}
                    loading={loading}
                    disabled={loading}
                    buttonColor="#00D4AA"
                    icon={() => <Ionicons name="finger-print" size={24} color="#FFFFFF" />}
                  >
                    <RTLText style={styles.biometricButtonText}>استخدام البصمة</RTLText>
                  </Button>
                  
                  {(userSettings.authMethod === 'biometric' && userSettings.passwordHash) && (
                    <View style={styles.dividerContainer}>
                      <View style={styles.dividerLine} />
                      <RTLText style={styles.dividerText}>أو</RTLText>
                      <View style={styles.dividerLine} />
                    </View>
                  )}
                </View>
              )}

              {/* Password Section */}
              {(userSettings.authMethod === 'password' || 
                (userSettings.authMethod === 'biometric' && userSettings.passwordHash)) && (
                <View style={styles.passwordSection}>
                  <View style={styles.passwordHeader}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
                    <RTLText style={styles.passwordLabel}>كلمة المرور</RTLText>
                  </View>
                  
                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      mode="outlined"
                      placeholder="أدخل كلمة المرور"
                      outlineColor="#404040"
                      activeOutlineColor={colors.primary}
                      style={styles.passwordInput}
                      onSubmitEditing={handlePasswordSubmit}
                      theme={{
                        colors: {
                          background: '#1A1A1A',
                          text: '#FFFFFF',
                          placeholder: '#9E9E9E',
                        }
                      }}
                      right={password.length > 0 ? <TextInput.Icon icon="check-circle" color={colors.primary} /> : null}
                    />
                  </View>
                  
                  <Button
                    mode="contained"
                    onPress={handlePasswordSubmit}
                    style={styles.passwordButton}
                    contentStyle={styles.passwordButtonContent}
                    loading={loading}
                    disabled={loading || !password.trim()}
                    buttonColor={colors.primary}
                  >
                    <RTLText style={styles.passwordButtonText}>دخول</RTLText>
                  </Button>
                </View>
              )}

              {/* Warning */}
              {userSettings.authMethod === 'biometric' && !biometricAvailable && (
                <View style={styles.warningBox}>
                  <Ionicons name="warning-outline" size={20} color="#FFB74D" />
                  <RTLText style={styles.warningText}>
                    البصمة غير متوفرة، يرجى استخدام كلمة المرور
                  </RTLText>
                </View>
              )}
            </View>

            {/* Footer Info */}
            <View style={styles.footer}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
              <RTLText style={styles.footerText}>بياناتك محمية ومشفرة</RTLText>
            </View>
          </View>
        </ScrollView>
        <AlertComponent />
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  backgroundContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 8,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingTop: 10,
    color: colors.text,
    marginBottom: 8,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'Cairo-Regular',
    lineHeight: 24,
  },
  authCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  biometricSection: {
    marginBottom: 20,
  },
  biometricButton: {
    borderRadius: 12,
    elevation: 0,
  },
  biometricButtonContent: {
    paddingVertical: 12,
    flexDirection: 'row-reverse',
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
  },
  dividerContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#404040',
  },
  dividerText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
  },
  passwordSection: {
    gap: 16,
  },
  passwordHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    fontFamily: 'Cairo-Regular',
  },
  inputWrapper: {
    marginBottom: 4,
  },
  passwordInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    fontSize: 16,
  },
  passwordButton: {
    borderRadius: 12,
    elevation: 0,
    marginTop: 8,
  },
  passwordButtonContent: {
    paddingVertical: 12,
  },
  passwordButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
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
  footer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
  },
});

export default AuthScreen;
