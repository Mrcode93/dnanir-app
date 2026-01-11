import { CustomAlert, AlertType } from '../components/CustomAlert';

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

class AlertService {
  private alertComponent: React.ComponentType<any> | null = null;
  private setAlertState: ((options: AlertOptions | null) => void) | null = null;

  setAlertComponent(component: React.ComponentType<any>, setState: (options: AlertOptions | null) => void) {
    this.alertComponent = component;
    this.setAlertState = setState;
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
    this.show({
      title,
      message,
      type: 'success',
      onConfirm,
    });
  }

  error(title: string, message: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: 'error',
      onConfirm,
    });
  }

  warning(title: string, message: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: 'warning',
      onConfirm,
    });
  }

  info(title: string, message: string, onConfirm?: () => void) {
    this.show({
      title,
      message,
      type: 'info',
      onConfirm,
    });
  }

  confirm(
    title: string,
    message: string,
    onConfirm: () => void,
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
