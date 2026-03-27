import { getBillsDueSoon, Bill, updateBill, addBillPayment, getBillPayments, getBillById, addExpense } from '../database/database';
import * as Notifications from 'expo-notifications';

const disableScheduledNotificationsInDev = __DEV__;
const BILL_IDENTIFIER_PREFIX = 'bill-';
const BILL_IDENTIFIER_REGEX = /^bill-(\d+)-/;

const parseBillIdFromIdentifier = (identifier: string): number | null => {
  const match = BILL_IDENTIFIER_REGEX.exec(identifier);
  if (!match) return null;
  const billId = Number(match[1]);
  return Number.isFinite(billId) ? billId : null;
};

const collectBillNotificationIds = (
  scheduled: Notifications.NotificationRequest[],
  billId: number
): string[] => {
  return scheduled
    .filter((item) => item.identifier.startsWith(`${BILL_IDENTIFIER_PREFIX}${billId}-`))
    .map((item) => item.identifier);
};

const cancelScheduledNotificationsByIds = async (identifiers: string[]): Promise<void> => {
  for (const identifier of identifiers) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
};

/**
 * Get bills that are due soon (within specified days)
 */
export const getBillsDueInDays = async (days: number = 7): Promise<Bill[]> => {
  return await getBillsDueSoon(days);
};

/**
 * Mark a bill as paid and record it as an expense (so balance and expenses list stay correct).
 * @param skipAddExpense - When true, only update bill and notifications (e.g. when called from payBill which already adds expenses per payment).
 */
export const markBillAsPaid = async (
  billId: number,
  paymentDate?: string,
  options?: { skipAddExpense?: boolean, walletId?: number }
): Promise<void> => {
  const paidDate = paymentDate || new Date().toISOString();
  const dateOnly = paidDate.slice(0, 10);

  const bill = await getBillById(billId);
  if (!bill) return;

  if (!options?.skipAddExpense) {
    try {
      await addExpense({
        title: `دفع فاتورة - ${bill.title}`,
        amount: bill.amount,
        category: 'bills',
        date: dateOnly,
        description: bill.description ? `فاتورة: ${bill.description}` : undefined,
        currency: bill.currency || 'IQD',
        walletId: options?.walletId,
      });
    } catch (error) {
      
    }
  }

  await updateBill(billId, {
    isPaid: true,
    paidDate: paidDate,
  });

  // Cancel any scheduled notifications for this bill
  try {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = collectBillNotificationIds(allScheduled, billId);
    await cancelScheduledNotificationsByIds(toCancel);
  } catch (error) {
    
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
 * Pay a bill (add payment record and record as expense so balance updates)
 */
export const payBill = async (billId: number, amount: number, paymentDate?: string, description?: string, walletId?: number): Promise<number> => {
  const paidDate = paymentDate || new Date().toISOString();
  const dateOnly = paidDate.slice(0, 10);

  const bill = await getBillById(billId);
  if (!bill) throw new Error('Bill not found');

  // Record this payment as an expense so balance and expenses list stay correct
  try {
    await addExpense({
      title: `دفع فاتورة - ${bill.title}`,
      amount,
      category: 'bills',
      date: dateOnly,
      description: description || bill.description ? `فاتورة: ${bill.description || ''}` : undefined,
      currency: bill.currency || 'IQD',
      walletId: walletId,
    });
  } catch (error) {
    
  }

  const paymentId = await addBillPayment({
    billId,
    amount,
    paymentDate: paidDate,
    description,
  });

  const totalPaid = await getTotalPaidForBill(billId);
  if (totalPaid >= bill.amount) {
    await markBillAsPaid(billId, paidDate, { skipAddExpense: true, walletId });
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
export const scheduleBillReminder = async (
  billId: number,
  options?: { bill?: Bill; scheduledIds?: string[] }
): Promise<void> => {
  try {
    const scheduledIds = options?.scheduledIds;
    const cancelExistingForBill = async () => {
      if (scheduledIds) {
        await cancelScheduledNotificationsByIds(scheduledIds);
        return;
      }
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = collectBillNotificationIds(allScheduled, billId);
      await cancelScheduledNotificationsByIds(toCancel);
    };

    if (disableScheduledNotificationsInDev) {
      await cancelExistingForBill();
      return;
    }

    const bill = options?.bill || await getBillById(billId);

    if (!bill || bill.isPaid) {
      await cancelExistingForBill();
      return;
    }

    // Cancel existing notifications for this bill
    await cancelExistingForBill();

    const dueDate = new Date(bill.dueDate);
    const reminderDays = bill.reminderDaysBefore || 3;
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(dueDate.getDate() - reminderDays);
    const reminderTrigger: Notifications.DateTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    };
    const dueDateTrigger: Notifications.DateTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dueDate,
    };
    
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
        trigger: reminderTrigger,
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
        trigger: dueDateTrigger,
      });
    }
  } catch (error) {
    
  }
};

/**
 * Schedule reminders for all unpaid bills
 */
export const scheduleAllBillReminders = async (): Promise<void> => {
  try {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const billScheduled = allScheduled.filter((item) => item.identifier.startsWith(BILL_IDENTIFIER_PREFIX));
    const scheduledByBill = new Map<number, string[]>();
    for (const scheduled of billScheduled) {
      const parsedBillId = parseBillIdFromIdentifier(scheduled.identifier);
      if (parsedBillId === null) continue;
      const existing = scheduledByBill.get(parsedBillId) || [];
      existing.push(scheduled.identifier);
      scheduledByBill.set(parsedBillId, existing);
    }

    if (disableScheduledNotificationsInDev) {
      await cancelScheduledNotificationsByIds(billScheduled.map((item) => item.identifier));
      return;
    }

    const { getBills } = await import('../database/database');
    const bills = await getBills();
    const unpaidBills = bills.filter(bill => !bill.isPaid);
    const unpaidIds = new Set(unpaidBills.map((bill) => bill.id));

    // Cleanup scheduled notifications for bills that are now paid or removed.
    const staleIdentifiers: string[] = [];
    for (const [billId, identifiers] of scheduledByBill.entries()) {
      if (!unpaidIds.has(billId)) {
        staleIdentifiers.push(...identifiers);
      }
    }
    if (staleIdentifiers.length > 0) {
      await cancelScheduledNotificationsByIds(staleIdentifiers);
    }

    for (const bill of unpaidBills) {
      await scheduleBillReminder(bill.id, {
        bill,
        scheduledIds: scheduledByBill.get(bill.id) || [],
      });
    }
  } catch (error) {
    
  }
};
