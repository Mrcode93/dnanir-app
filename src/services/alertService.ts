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

  // Convenience methods — تعرض Custom Alert (مودال) بدل التوست
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

  /** عرض توست فقط (يختفي تلقائياً) — للاستخدام بعد إكمال إجراء مثل إضافة من اختصار */
  toastSuccess(message: string) {
    if (this.setToastState) {
      this.setToastState({ visible: true, message, type: 'success' });
    }
  }

  toastError(message: string) {
    if (this.setToastState) {
      this.setToastState({ visible: true, message, type: 'error' });
    }
  }
}

export const alertService = new AlertService();
