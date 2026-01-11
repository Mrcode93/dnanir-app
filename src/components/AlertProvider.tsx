import React, { useState, useCallback } from 'react';
import { CustomAlert, AlertType } from './CustomAlert';
import { alertService, AlertOptions } from '../services/alertService';

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertOptions, setAlertOptions] = useState<AlertOptions | null>(null);

  React.useEffect(() => {
    alertService.setAlertComponent(CustomAlert, setAlertOptions);
  }, []);

  const handleConfirm = useCallback(() => {
    const callback = alertOptions?.onConfirm;
    
    if (callback) {
      try {
        const result = callback();
        if (result instanceof Promise) {
          result
            .then(() => {
              setAlertOptions(null);
            })
            .catch(error => {
              console.error('Error in async onConfirm callback:', error);
              setAlertOptions(null);
            });
        } else {
          setAlertOptions(null);
        }
      } catch (error) {
        console.error('Error in onConfirm callback:', error);
        setAlertOptions(null);
    }
    } else {
    setAlertOptions(null);
    }
  }, [alertOptions]);

  const handleCancel = useCallback(() => {
    if (alertOptions?.onCancel) {
      alertOptions.onCancel();
    }
    setAlertOptions(null);
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
    </>
  );
};
