import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useCustomAlert } from '../hooks/useCustomAlert';

const CustomAlertExample: React.FC = () => {
  const {
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
    AlertComponent,
  } = useCustomAlert();

  const handleSuccessAlert = () => {
    showSuccess('نجح الحفظ!', 'تم حفظ البيانات بنجاح');
  };

  const handleErrorAlert = () => {
    showError('خطأ في الحفظ', 'حدث خطأ أثناء حفظ البيانات');
  };

  const handleWarningAlert = () => {
    showWarning('تحذير', 'هذا الإجراء لا يمكن التراجع عنه');
  };

  const handleInfoAlert = () => {
    showInfo('معلومات', 'هذه ميزة جديدة في التطبيق');
  };

  const handleConfirmAlert = () => {
    showConfirm(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف هذا العنصر؟',
      () => {
        // Handle confirm action
        showSuccess('تم الحذف', 'تم حذف العنصر بنجاح');
      },
      () => {
        // Handle cancel action
        showInfo('تم الإلغاء', 'لم يتم حذف العنصر');
      }
    );
  };

  const handleCustomAlert = () => {
    showAlert({
      title: 'تنبيه مخصص',
      message: 'هذا تنبيه مخصص مع أزرار متعددة',
      type: 'info',
      buttons: [
        {
          text: 'إلغاء',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'حفظ',
          onPress: () => showSuccess('تم الحفظ', 'تم حفظ البيانات'),
        },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => showError('تم الحذف', 'تم حذف البيانات'),
        },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <Button
        mode="contained"
        onPress={handleSuccessAlert}
        style={styles.button}
        buttonColor="#00D4AA"
      >
        عرض تنبيه نجاح
      </Button>

      <Button
        mode="contained"
        onPress={handleErrorAlert}
        style={styles.button}
        buttonColor="#FF5252"
      >
        عرض تنبيه خطأ
      </Button>

      <Button
        mode="contained"
        onPress={handleWarningAlert}
        style={styles.button}
        buttonColor="#FF9800"
      >
        عرض تنبيه تحذير
      </Button>

      <Button
        mode="contained"
        onPress={handleInfoAlert}
        style={styles.button}
        buttonColor="#2196F3"
      >
        عرض تنبيه معلومات
      </Button>

      <Button
        mode="contained"
        onPress={handleConfirmAlert}
        style={styles.button}
        buttonColor="#9C27B0"
      >
        عرض تنبيه تأكيد
      </Button>

      <Button
        mode="contained"
        onPress={handleCustomAlert}
        style={styles.button}
        buttonColor="#607D8B"
      >
        عرض تنبيه مخصص
      </Button>

      {/* Always include the AlertComponent at the end */}
      <AlertComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
  },
  button: {
    marginVertical: 8,
  },
});

export default CustomAlertExample;
