import { CustomAlert, AlertType } from '../components/CustomAlert';

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
}

class AlertService {
  private alertComponent: React.ComponentType<any> | null = null;
  private setAlertState: ((options: AlertOptions | null) => void) | null = null;
  private setToastState: ((options: { visible: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info' } | null) => void) | null = null;

  setAlertComponent(component: React.ComponentType<any>, setState: (options: AlertOptions | null) => void) {
    this.alertComponent = component;
    this.setAlertState = setState;
  }

  setToastComponent(setState: (options: { visible: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info' } | null) => void) {
    this.setToastState = setState;
  }

  show(options: AlertOptions) {
    if (this.setAlertState) {
      this.setAlertState(options);
    }
  }

  hide() {
    if (this.setAlertState) {
      this.setAlertState(null);
    }
  }

  // Convenience methods
  success(title: string, message: string, onConfirm?: () => void) {
    // Use toast for success messages (auto-dismiss)
    if (this.setToastState) {
      this.setToastState({
        visible: true,
        message: message || title,
        type: 'success',
      });
      // Call onConfirm after toast is shown (if provided)
      if (onConfirm) {
        // Small delay to ensure toast is visible
        setTimeout(() => {
          onConfirm();
        }, 100);
      }
    } else {
      // Fallback to modal if toast is not available
      this.show({
        title,
        message,
        type: 'success',
        onConfirm,
      });
    }
  }

  error(title: string, message: string, onConfirm?: () => void) {
    // Use toast for error messages (auto-dismiss)
    if (this.setToastState) {
      this.setToastState({
        visible: true,
        message: message || title,
        type: 'error',
      });
      // Call onConfirm after toast is shown (if provided)
      if (onConfirm) {
        setTimeout(() => {
          onConfirm();
        }, 100);
      }
    } else {
      // Fallback to modal if toast is not available
      this.show({
        title,
        message,
        type: 'error',
        onConfirm,
      });
    }
  }

  warning(title: string, message: string, onConfirm?: () => void) {
    // Use toast for warning messages (auto-dismiss)
    if (this.setToastState) {
      this.setToastState({
        visible: true,
        message: message || title,
        type: 'warning',
      });
      // Call onConfirm after toast is shown (if provided)
      if (onConfirm) {
        setTimeout(() => {
          onConfirm();
        }, 100);
      }
    } else {
      // Fallback to modal if toast is not available
      this.show({
        title,
        message,
        type: 'warning',
        onConfirm,
      });
    }
  }

  info(title: string, message: string, onConfirm?: () => void) {
    // Use toast for info messages (auto-dismiss)
    if (this.setToastState) {
      this.setToastState({
        visible: true,
        message: message || title,
        type: 'info',
      });
      // Call onConfirm after toast is shown (if provided)
      if (onConfirm) {
        setTimeout(() => {
          onConfirm();
        }, 100);
      }
    } else {
      // Fallback to modal if toast is not available
      this.show({
        title,
        message,
        type: 'info',
        onConfirm,
      });
    }
  }

  confirm(
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void
  ) {
    this.show({
      title,
      message,
      type: 'warning',
      confirmText: 'تأكيد',
      cancelText: 'إلغاء',
      showCancel: true,
      onConfirm,
      onCancel,
    });
  }
}

export const alertService = new AlertService();
