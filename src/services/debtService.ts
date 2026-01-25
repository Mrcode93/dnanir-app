import {
  addDebt,
  getDebts,
  getDebt,
  updateDebt,
  deleteDebt,
  addDebtInstallment,
  getDebtInstallments,
  updateDebtInstallment,
  deleteDebtInstallment,
  getUpcomingDebtPayments,
  addExpense,
  addDebtPayment,
  Debt,
  DebtInstallment,
} from '../database/database';
import { DEBT_TYPES } from '../types';

/**
 * Create a new debt with optional installments
 */
export const createDebt = async (
  debtorName: string,
  totalAmount: number,
  startDate: string,
  type: 'debt' | 'installment' | 'advance',
  dueDate?: string,
  description?: string,
  currency?: string,
  installments?: { amount: number; dueDate: string }[]
): Promise<number> => {
  const debtId = await addDebt({
    debtorName,
    totalAmount,
    remainingAmount: totalAmount,
    startDate,
    dueDate,
    description,
    type,
    currency: currency || 'IQD',
    isPaid: false,
  });

  // Add installments if provided
  if (installments && installments.length > 0) {
    for (let i = 0; i < installments.length; i++) {
      await addDebtInstallment({
        debtId,
        amount: installments[i].amount,
        dueDate: installments[i].dueDate,
        isPaid: false,
        installmentNumber: i + 1,
      });
    }
  }

  return debtId;
};

/**
 * Mark an installment as paid
 */
export const payInstallment = async (
  installmentId: number,
  amount?: number
): Promise<void> => {
  // We need to find the installment by searching all debts
  const allDebts = await getDebts();
  let installment: DebtInstallment | null = null;
  let debtId = 0;

  for (const debt of allDebts) {
    const installments = await getDebtInstallments(debt.id);
    const found = installments.find(inst => inst.id === installmentId);
    if (found) {
      installment = found;
      debtId = debt.id;
      break;
    }
  }

  if (!installment) {
    throw new Error('Installment not found');
  }

  const debt = await getDebt(debtId);
  if (!debt) {
    throw new Error('Debt not found');
  }

  const paidAmount = amount || installment.amount;
  const paidDate = new Date().toISOString().split('T')[0];

  // Mark installment as paid
  await updateDebtInstallment(installmentId, {
    isPaid: true,
    paidDate,
    amount: paidAmount,
  });

  // Update debt remaining amount
  const newRemainingAmount = Math.max(0, debt.remainingAmount - paidAmount);
  await updateDebt(debt.id, {
    remainingAmount: newRemainingAmount,
    isPaid: newRemainingAmount === 0,
  });

  // Record payment in history
  await addDebtPayment({
    debtId: debt.id,
    amount: paidAmount,
    paymentDate: paidDate,
    installmentId: installmentId,
    description: `دفع القسط رقم ${installment.installmentNumber}`,
  });

  // Add expense automatically
  try {
    await addExpense({
      title: `دفع قسط - ${debt.debtorName}`,
      amount: paidAmount,
      category: 'bills',
      date: paidDate,
      description: `دفع القسط رقم ${installment.installmentNumber} من ${DEBT_TYPES[debt.type]} - ${debt.debtorName}${debt.description ? ` - ${debt.description}` : ''}`,
      currency: debt.currency || 'IQD',
    });
  } catch (error) {
    console.error('Error adding expense for installment payment:', error);
    // Don't throw - payment was successful, expense addition is secondary
  }
};

/**
 * Mark a debt as fully paid
 */
export const payDebt = async (debtId: number, amount?: number): Promise<void> => {
  const debt = await getDebt(debtId);
  if (!debt) {
    throw new Error('Debt not found');
  }

  const paidAmount = amount || debt.remainingAmount;
  const paidDate = new Date().toISOString().split('T')[0];

  await updateDebt(debtId, {
    remainingAmount: Math.max(0, debt.remainingAmount - paidAmount),
    isPaid: debt.remainingAmount - paidAmount <= 0,
  });

  // Record payment in history
  await addDebtPayment({
    debtId: debtId,
    amount: paidAmount,
    paymentDate: paidDate,
    description: amount === debt.remainingAmount ? 'دفع الدين بالكامل' : `دفع جزئي - ${paidAmount}`,
  });

  // Add expense automatically
  try {
    await addExpense({
      title: `دفع ${DEBT_TYPES[debt.type]} - ${debt.debtorName}`,
      amount: paidAmount,
      category: 'bills',
      date: paidDate,
      description: `دفع ${DEBT_TYPES[debt.type]} بالكامل - ${debt.debtorName}${debt.description ? ` - ${debt.description}` : ''}`,
      currency: debt.currency || 'IQD',
    });
  } catch (error) {
    console.error('Error adding expense for debt payment:', error);
    // Don't throw - payment was successful, expense addition is secondary
  }
};

/**
 * Get debts that need payment today
 */
export const getDebtsDueToday = async (): Promise<{ debt: Debt; installment?: DebtInstallment }[]> => {
  const today = new Date().toISOString().split('T')[0];
  const allDebts = await getDebts();
  const result: { debt: Debt; installment?: DebtInstallment }[] = [];

  for (const debt of allDebts) {
    if (debt.isPaid) continue;

    // Check if debt itself is due today
    if (debt.dueDate === today) {
      result.push({ debt });
    }

    // Check installments
    const installments = await getDebtInstallments(debt.id);
    for (const installment of installments) {
      if (!installment.isPaid && installment.dueDate === today) {
        result.push({ debt, installment });
      }
    }
  }

  return result;
};

/**
 * Generate installments for a debt
 */
export const generateInstallments = (
  totalAmount: number,
  numberOfInstallments: number,
  startDate: Date,
  frequency: 'weekly' | 'monthly'
): { amount: number; dueDate: string }[] => {
  const installments: { amount: number; dueDate: string }[] = [];
  const installmentAmount = totalAmount / numberOfInstallments;
  const currentDate = new Date(startDate);

  for (let i = 0; i < numberOfInstallments; i++) {
    if (i > 0) {
      if (frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    installments.push({
      amount: i === numberOfInstallments - 1
        ? totalAmount - (installmentAmount * (numberOfInstallments - 1))
        : installmentAmount,
      dueDate: currentDate.toISOString().split('T')[0],
    });
  }

  return installments;
};
