import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export interface AlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface CustomAlertProps {
  visible: boolean;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'info' | 'success' | 'warning' | 'error';
  onDismiss?: () => void;
  dismissable?: boolean;
  icon?: string;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [],
  type = 'info',
  onDismiss,
  dismissable = true,
  icon,
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: icon || 'check-circle',
          iconColor: '#00D4AA',
          gradientColors: ['#00B894', '#00D4AA'],
          defaultConfirmColor: '#00D4AA',
        };
      case 'error':
        return {
          icon: icon || 'error',
          iconColor: '#FF5252',
          gradientColors: ['#E53935', '#FF5252'],
          defaultConfirmColor: '#FF5252',
        };
      case 'warning':
        return {
          icon: icon || 'warning',
          iconColor: '#FFB74D',
          gradientColors: ['#FF9800', '#FFB74D'],
          defaultConfirmColor: '#FFB74D',
        };
      case 'info':
      default:
        return {
          icon: icon || 'info',
          iconColor: '#00D4AA',
          gradientColors: ['#00B894', '#00D4AA'],
          defaultConfirmColor: '#00D4AA',
        };
    }
  };

  const typeConfig = getTypeConfig();

  const handleButtonPress = (button: AlertButton) => {
    button.onPress();
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleOverlayPress = () => {
    if (dismissable && onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleOverlayPress}
      >
        <TouchableOpacity 
          style={styles.alertContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <LinearGradient
            colors={typeConfig.gradientColors as [string, string]}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                {icon === 'hourglass-empty' ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <MaterialIcons
                    name={typeConfig.icon as any}
                    size={24}
                    color="#FFFFFF"
                  />
                )}
              </View>
              {dismissable && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onDismiss}
                >
                  <MaterialIcons
                    name="close"
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {title && <Text style={styles.title}>{title}</Text>}
            {message && <Text style={styles.message}>{message}</Text>}

            {/* Buttons - Hidden by default */}
            {false && buttons.length > 0 && icon !== 'hourglass-empty' && (
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      button.style === 'cancel' && styles.cancelButton,
                      button.style === 'destructive' && styles.destructiveButton,
                      button.style === 'default' && { backgroundColor: typeConfig.defaultConfirmColor }
                    ]}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text style={[
                      styles.buttonText,
                      button.style === 'cancel' && styles.cancelButtonText,
                      button.style === 'destructive' && styles.destructiveButtonText,
                      button.style === 'default' && styles.confirmButtonText
                    ]}>
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    width: width * 0.9,
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#00D4AA',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
    direction: 'rtl',
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Cairo-Regular',
  },
  message: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    fontFamily: 'Cairo-Regular',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButton: {
    backgroundColor: '#404040',
    borderWidth: 1,
    borderColor: '#606060',
  },
  destructiveButton: {
    backgroundColor: '#EF4444',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-Regular',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-Regular',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-Regular',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Cairo-Regular',
  },
});

export default CustomAlert;