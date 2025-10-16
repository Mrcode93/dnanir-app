import { useState, useCallback } from 'react';
import CustomAlert, { AlertButton, CustomAlertProps } from '../components/CustomAlert';

export interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'info' | 'success' | 'warning' | 'error';
  dismissable?: boolean;
}

export const useCustomAlert = () => {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    options: AlertOptions;
  }>({
    visible: false,
    options: { title: '' },
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({
      visible: true,
      options,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  // Convenience methods for common alert types
  const showSuccess = useCallback((title: string, message?: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'success',
      buttons: [
        {
          text: 'موافق',
          onPress: onOk,
        },
      ],
    });
  }, [showAlert]);

  const showError = useCallback((title: string, message?: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'error',
      buttons: [
        {
          text: 'موافق',
          onPress: onOk,
        },
      ],
    });
  }, [showAlert]);

  const showWarning = useCallback((title: string, message?: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'warning',
      buttons: [
        {
          text: 'موافق',
          onPress: onOk,
        },
      ],
    });
  }, [showAlert]);

  const showInfo = useCallback((title: string, message?: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'info',
      buttons: [
        {
          text: 'موافق',
          onPress: onOk,
        },
      ],
    });
  }, [showAlert]);

  const showConfirm = useCallback((
    title: string,
    message?: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText: string = 'تأكيد',
    cancelText: string = 'إلغاء'
  ) => {
    showAlert({
      title,
      message,
      type: 'warning',
      buttons: [
        {
          text: cancelText,
          style: 'cancel',
          onPress: onCancel,
        },
        {
          text: confirmText,
          style: 'destructive',
          onPress: onConfirm,
        },
      ],
    });
  }, [showAlert]);

  const AlertComponent = useCallback(() => (
    <CustomAlert
      visible={alertState.visible}
      title={alertState.options.title}
      message={alertState.options.message}
      buttons={alertState.options.buttons}
      type={alertState.options.type}
      onDismiss={hideAlert}
      dismissable={alertState.options.dismissable}
    />
  ), [alertState, hideAlert]);

  return {
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    AlertComponent,
  };
};
