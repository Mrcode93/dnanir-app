import React, { useState, useCallback } from 'react';
import { CustomAlert, AlertType } from './CustomAlert';
import { Toast, ToastType } from './Toast';
import { alertService, AlertOptions } from '../services/alertService';
import { authModalService, AuthModalOptions } from '../services/authModalService';
import { AuthScreen } from '../screens/AuthScreen';

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);
  const [toastOptions, setToastOptions] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  } | null>(null);
  const [authVisible, setAuthVisible] = useState(false);
  const [authOptions, setAuthOptions] = useState<AuthModalOptions>({});

  React.useEffect(() => {
    alertService.setAlertComponent(CustomAlert, setAlertOptions);
    alertService.setToastComponent(setToastOptions);
    authModalService.register(setAuthVisible, setAuthOptions);
  }, []);

  const handleConfirm = useCallback(() => {
    const callback = alertOptions?.onConfirm;
    // Close the alert immediately
    setAlertOptions(null);

    if (callback) {
      try {
        const result = callback();
        // If it's a promise, we still let it run in background
        // but the modal is already closed
        if (result instanceof Promise) {
          result.catch(error => {
            
          });
        }
      } catch (error) {
        
      }
    }
  }, [alertOptions]);

  const handleCancel = useCallback(() => {
    if (alertOptions?.onCancel) {
      alertOptions.onCancel();
    }
    setAlertOptions(null);
  }, [alertOptions]);

  const handleToastHide = useCallback(() => {
    setToastOptions((prev) => {
      if (prev) {
        return { ...prev, visible: false };
      }
      return null;
    });
    // Clear after animation completes
    setTimeout(() => {
      setToastOptions(null);
    }, 300);
  }, []);

  React.useEffect(() => {
  }, [alertOptions]);

  return (
    <>
      {children}
      {alertOptions && (
        <CustomAlert
          visible={!!alertOptions}
          title={alertOptions.title}
          message={alertOptions.message}
          type={alertOptions.type || 'info'}
          confirmText={alertOptions.confirmText}
          cancelText={alertOptions.cancelText}
          showCancel={alertOptions.showCancel}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      {toastOptions && (
        <Toast
          visible={toastOptions.visible}
          message={toastOptions.message}
          type={toastOptions.type}
          onHide={handleToastHide}
        />
      )}
      <AuthScreen
        visible={authVisible}
        isLogin={authOptions.isLogin}
        onSuccess={authOptions.onSuccess}
        onClose={() => setAuthVisible(false)}
      />
    </>
  );
};
