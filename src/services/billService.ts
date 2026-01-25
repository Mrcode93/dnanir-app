import { getBillsDueSoon, Bill, updateBill, addBillPayment, getBillPayments } from '../database/database';
import * as Notifications from 'expo-notifications';

/**
 * Get bills that are due soon (within specified days)
 */
export const getBillsDueInDays = async (days: number = 7): Promise<Bill[]> => {
  return await getBillsDueSoon(days);
};

/**
 * Mark a bill as paid
 */
export const markBillAsPaid = async (billId: number, paymentDate?: string): Promise<void> => {
  const paidDate = paymentDate || new Date().toISOString();
  await updateBill(billId, {
    isPaid: true,
    paidDate: paidDate,
  });
  
  // Cancel any scheduled notifications for this bill
  try {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = allScheduled.filter(n => n.identifier.startsWith(`bill-${billId}-`));
    for (const notification of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  } catch (error) {
    console.error('Error canceling bill notifications:', error);
  }
};

/**
 * Mark a bill as unpaid
 */
export const markBillAsUnpaid = async (billId: number): Promise<void> => {
  await updateBill(billId, {
    isPaid: false,
    paidDate: undefined,
  });
  
  // Reschedule notifications for this bill
  await scheduleBillReminder(billId);
};

/**
 * Pay a bill (add payment record)
 */
export const payBill = async (billId: number, amount: number, paymentDate?: string, description?: string): Promise<number> => {
  const paidDate = paymentDate || new Date().toISOString();
  const paymentId = await addBillPayment({
    billId,
    amount,
    paymentDate: paidDate,
    description,
  });
  
  // Mark bill as paid if full amount is paid
  const bill = await getBillById(billId);
  if (bill) {
    const totalPaid = await getTotalPaidForBill(billId);
    if (totalPaid >= bill.amount) {
      await markBillAsPaid(billId, paidDate);
    }
  }
  
  return paymentId;
};

/**
 * Get total amount paid for a bill
 */
export const getTotalPaidForBill = async (billId: number): Promise<number> => {
  const payments = await getBillPayments(billId);
  return payments.reduce((total, payment) => total + payment.amount, 0);
};

/**
 * Get bill payment history
 */
export const getBillPaymentHistory = async (billId: number) => {
  return await getBillPayments(billId);
};

/**
 * Schedule reminder notification for a bill
 */
export const scheduleBillReminder = async (billId: number): Promise<void> => {
  try {
    const { getBillById } = await import('../database/database');
    const bill = await getBillById(billId);
    
    if (!bill || bill.isPaid) {
      return;
    }
    
    // Cancel existing notifications for this bill
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = allScheduled.filter(n => n.identifier.startsWith(`bill-${billId}-`));
    for (const notification of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    
    const dueDate = new Date(bill.dueDate);
    const reminderDays = bill.reminderDaysBefore || 3;
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(dueDate.getDate() - reminderDays);
    
    // Only schedule if reminder date is in the future
    if (reminderDate > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `bill-${billId}-reminder`,
        content: {
          title: 'تذكير بفاتورة مستحقة',
          body: `فاتورة "${bill.title}" مستحقة خلال ${reminderDays} أيام. المبلغ: ${bill.amount} ${bill.currency || 'IQD'}`,
          sound: true,
          data: { billId, type: 'bill_reminder' },
        },
        trigger: reminderDate,
      });
    }
    
    // Schedule notification for due date
    if (dueDate > new Date()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `bill-${billId}-due`,
        content: {
          title: 'فاتورة مستحقة اليوم',
          body: `فاتورة "${bill.title}" مستحقة اليوم. المبلغ: ${bill.amount} ${bill.currency || 'IQD'}`,
          sound: true,
          data: { billId, type: 'bill_due' },
        },
        trigger: dueDate,
      });
    }
  } catch (error) {
    console.error('Error scheduling bill reminder:', error);
  }
};

/**
 * Schedule reminders for all unpaid bills
 */
export const scheduleAllBillReminders = async (): Promise<void> => {
  try {
    const { getBills } = await import('../database/database');
    const bills = await getBills();
    const unpaidBills = bills.filter(bill => !bill.isPaid);
    
    for (const bill of unpaidBills) {
      await scheduleBillReminder(bill.id);
    }
  } catch (error) {
    console.error('Error scheduling all bill reminders:', error);
  }
};

// Helper function to get bill by ID (imported from database)
const getBillById = async (id: number) => {
  const { getBillById: getBill } = await import('../database/database');
  return await getBill(id);
};
