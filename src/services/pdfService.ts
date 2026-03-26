import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getExpenses, getIncome, getCustomCategories } from '../database/database';
import { calculateFinancialSummary, getCurrentMonthData, getSelectedCurrencyCode, getMonthData } from './financialService';
import { getCurrentMonthBudgets, calculateBudgetStatus } from './budgetService';
import { EXPENSE_CATEGORIES } from '../types';
import { formatCurrencyAmount } from './currencyService';
import { AdvancedReportData } from './advancedReportsService';

const getCategoryName = (category: string, customCategories: any[]) => {
  return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] ||
    customCategories.find(c => c.name === category)?.name ||
    category;
};

export const generateMonthlyReport = async (month?: number, year?: number): Promise<string> => {
  try {
    const now = new Date();
    const targetMonth = month !== undefined ? month : now.getMonth(); // 0-indexed
    const targetYear = year !== undefined ? year : now.getFullYear();

    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const monthName = monthNames[targetMonth];

    const monthlyData = await getMonthData(targetYear, targetMonth + 1);
    const summary = {
      totalIncome: monthlyData.totalIncome,
      totalExpenses: monthlyData.totalExpenses,
      balance: monthlyData.balance,
      topExpenseCategories: monthlyData.topExpenseCategories
    };

    const budgets = await getCurrentMonthBudgets(); // Note: budgets are usually current, but we could filter if needed
    const budgetStatuses = await calculateBudgetStatus();
    const customCategories = await getCustomCategories();
    const currencyCode = await getSelectedCurrencyCode();

    // Create formatCurrency function for PDF
    const formatCurrency = (amount: number) => formatCurrencyAmount(amount, currencyCode);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
          
          body {
            font-family: 'Cairo', 'Arial', sans-serif;
            padding: 20px;
            direction: rtl;
            background: #fff;
            color: #111827;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #3B82F6;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #3B82F6;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #6B7280;
            margin: 5px 0;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .section-title {
            background: #3B82F6;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: bold;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #F8F9FA;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #E5E7EB;
          }
          .summary-card.income {
            border-color: #10B981;
          }
          .summary-card.expense {
            border-color: #EF4444;
          }
          .summary-card.balance {
            border-color: #3B82F6;
          }
          .summary-card h3 {
            margin: 0 0 10px 0;
            color: #6B7280;
            font-size: 14px;
          }
          .summary-card .amount {
            font-size: 24px;
            font-weight: bold;
            color: #111827;
          }
          .summary-card.income .amount {
            color: #10B981;
          }
          .summary-card.expense .amount {
            color: #EF4444;
          }
          .summary-card.balance .amount {
            color: #3B82F6;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            padding: 12px;
            text-align: right;
            border-bottom: 1px solid #E5E7EB;
          }
          th {
            background: #F8F9FA;
            font-weight: bold;
            color: #111827;
          }
          .budget-row.exceeded {
            background: #FEE2E2;
          }
          .budget-row.warning {
            background: #FEF3C7;
          }
          .category-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            background: #E5E7EB;
            color: #111827;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            text-align: center;
            color: #6B7280;
            font-size: 12px;
          }
          /* Fix for Arabic numbers and text alignment in some PDF engines */
          * {
            unicode-bidi: isolate;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير مالي شهري</h1>
          <p>${monthName} ${targetYear}</p>
          <p>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ-u-nu-latn')}</p>
        </div>
        
        <div class="section">
          <div class="section-title">ملخص مالي</div>
          <div class="summary-grid">
            <div class="summary-card income">
              <h3>إجمالي الدخل</h3>
              <div class="amount">${formatCurrency(summary.totalIncome)}</div>
            </div>
            <div class="summary-card expense">
              <h3>إجمالي المصاريف</h3>
              <div class="amount">${formatCurrency(summary.totalExpenses)}</div>
            </div>
            <div class="summary-card balance">
              <h3>الرصيد</h3>
              <div class="amount">${formatCurrency(summary.balance)}</div>
            </div>
          </div>
        </div>
        
        ${budgets.length > 0 ? `
        <div class="section">
          <div class="section-title">الميزانية</div>
          <table>
            <thead>
              <tr>
                <th>الفئة</th>
                <th>الميزانية</th>
                <th>المصروف</th>
                <th>المتبقي</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              ${budgetStatuses.map(status => {
      const rowClass = status.isExceeded ? 'exceeded' : status.percentage >= 80 ? 'warning' : '';
      return `
                  <tr class="budget-row ${rowClass}">
                    <td>${getCategoryName(status.budget.category, customCategories)}</td>
                    <td>${formatCurrency(status.budget.amount)}</td>
                    <td>${formatCurrency(status.spent)}</td>
                    <td>${formatCurrency(status.remaining)}</td>
                    <td>${status.percentage.toFixed(1)}%</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        
        <div class="section">
          <div class="section-title">أعلى فئات المصاريف</div>
          <table>
            <thead>
              <tr>
                <th>الفئة</th>
                <th>المبلغ</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              ${summary.topExpenseCategories.map((cat: any) => `
                <tr>
                  <td>${getCategoryName(cat.category, customCategories)}</td>
                  <td>${formatCurrency(cat.amount)}</td>
                  <td>${cat.percentage.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">المصاريف الشهرية (${monthlyData.expenses.length})</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الوصف</th>
                <th>الفئة</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData.expenses.slice(0, 50).map((expense: any) => `
                <tr>
                  <td>${new Date(expense.date).toLocaleDateString('ar-IQ-u-nu-latn')}</td>
                  <td>${expense.title}</td>
                  <td><span class="category-badge">${getCategoryName(expense.category, customCategories)}</span></td>
                  <td>${formatCurrency(expense.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">الدخل الشهري (${monthlyData.income.length})</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المصدر</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData.income.map((inc: any) => `
                <tr>
                  <td>${new Date(inc.date).toLocaleDateString('ar-IQ-u-nu-latn')}</td>
                  <td>${inc.source}</td>
                  <td>${formatCurrency(inc.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة تطبيق دنانير</p>
          <p>© ${year} جميع الحقوق محفوظة</p>
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    
    throw error;
  }
};

export const sharePDF = async (uri: string) => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'تصدير التقرير',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    
  }
};

export const generateAdvancedPDFReport = async (reportData: AdvancedReportData): Promise<string> => {
  try {
    const currencyCode = await getSelectedCurrencyCode();
    const customCategories = await getCustomCategories('expense');

    // Create formatCurrency function for PDF
    const formatCurrency = (amount: number) => formatCurrencyAmount(amount, currencyCode);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
          
          body {
            font-family: 'Cairo', 'Arial', sans-serif;
            padding: 20px;
            direction: rtl;
            background: #fff;
            color: #111827;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #3B82F6;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #3B82F6;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #6B7280;
            margin: 5px 0;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .section-title {
            background: #3B82F6;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: bold;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 20px;
          }
          .summary-card {
            background: #F8F9FA;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #E5E7EB;
          }
          .summary-card h3 {
            margin: 0 0 10px 0;
            color: #6B7280;
            font-size: 14px;
          }
          .summary-card .amount {
            font-size: 20px;
            font-weight: bold;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            padding: 10px;
            text-align: right;
            border-bottom: 1px solid #E5E7EB;
            font-size: 12px;
          }
          th {
            background: #F8F9FA;
            font-weight: bold;
            color: #111827;
          }
          .category-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            background: #E5E7EB;
            color: #111827;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            text-align: center;
            color: #6B7280;
            font-size: 12px;
          }
          * {
            unicode-bidi: isolate;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير مالي مفصل</h1>
          <p>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ-u-nu-latn')}</p>
        </div>
        
        <div class="section">
          <div class="section-title">ملخص التقرير</div>
          <div class="summary-grid">
            <div class="summary-card">
              <h3>إجمالي الدخل</h3>
              <div class="amount" style="color: #10B981">${formatCurrency(reportData.summary.totalIncome)}</div>
            </div>
            <div class="summary-card">
              <h3>إجمالي المصاريف</h3>
              <div class="amount" style="color: #EF4444">${formatCurrency(reportData.summary.totalExpenses)}</div>
            </div>
            <div class="summary-card">
              <h3>الرصيد</h3>
              <div class="amount" style="color: #3B82F6">${formatCurrency(reportData.summary.balance)}</div>
            </div>
            <div class="summary-card">
              <h3>معاملات</h3>
              <div class="amount">${reportData.summary.transactionCount}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">توزيع الفئات</div>
          <table>
            <thead>
              <tr>
                <th>الفئة</th>
                <th>المبلغ</th>
                <th>النسبة</th>
                <th>عدد العمليات</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.categoryBreakdown.map((cat: any) => `
                <tr>
                  <td>${getCategoryName(cat.category, customCategories)}</td>
                  <td>${formatCurrency(cat.amount)}</td>
                  <td>${cat.percentage.toFixed(1)}%</td>
                  <td>${cat.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <div class="section-title">أعلى المصاريف</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الوصف</th>
                <th>الفئة</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.topExpenses.map((expense: any) => `
                <tr>
                  <td>${new Date(expense.date).toLocaleDateString('ar-IQ-u-nu-latn')}</td>
                  <td>${expense.title}</td>
                  <td><span class="category-badge">${getCategoryName(expense.category, customCategories)}</span></td>
                  <td>${formatCurrency(expense.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة تطبيق دنانير</p>
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    
    throw error;
  }
};

export const generateFullReport = async (): Promise<string> => {
  try {
    const { getExpenses, getIncome, getCustomCategories } = await import('../database/database');
    const expenses = await getExpenses();
    const income = await getIncome();
    const customCategories = await getCustomCategories();
    const currencyCode = await getSelectedCurrencyCode();
    const formatCurrency = (amount: number) => formatCurrencyAmount(amount, currencyCode);

    const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const balance = totalIncome - totalExpenses;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
          body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; color: #111827; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3B82F6; padding-bottom: 20px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { background: #3B82F6; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; font-size: 18px; font-weight: bold; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
          .summary-card { background: #F8F9FA; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #E5E7EB; }
          .summary-card h3 { margin: 0 0 10px 0; color: #6B7280; font-size: 14px; }
          .amount { font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
          th { background: #F8F9FA; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير مالي كامل (جميع البيانات)</h1>
          <p>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ-u-nu-latn')}</p>
        </div>
        <div class="section">
          <div class="section-title">ملخص مالي شامل</div>
          <div class="summary-grid">
            <div class="summary-card"><h3>إجمالي الدخل</h3><div class="amount" style="color: #10B981">${formatCurrency(totalIncome)}</div></div>
            <div class="summary-card"><h3>إجمالي المصاريف</h3><div class="amount" style="color: #EF4444">${formatCurrency(totalExpenses)}</div></div>
            <div class="summary-card"><h3>الرصيد الكلي</h3><div class="amount" style="color: #3B82F6">${formatCurrency(balance)}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">أحدث العمليات (آخر 100)</div>
          <table>
            <thead><tr><th>التاريخ</th><th>الوصف</th><th>الفئة</th><th>المبلغ</th></tr></thead>
            <tbody>
              ${expenses.slice(0, 100).map(e => `
                <tr>
                  <td>${new Date(e.date).toLocaleDateString('ar-IQ-u-nu-latn')}</td>
                  <td>${e.title}</td>
                  <td>${getCategoryName(e.category, customCategories)}</td>
                  <td>${formatCurrency(e.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    
    throw error;
  }
};


export const generateDebtorReport = async (
  debtor: any,
  debts: any[],
  installmentsMap: Record<number, any[]>
): Promise<string> => {
  try {
    const currencyCode = await getSelectedCurrencyCode();
    const formatCurrency = (amount: number, cur?: string) => formatCurrencyAmount(amount, cur || currencyCode);

    const totalsByCurrency: Record<string, { toMe: number; byMe: number; net: number }> = {};
    debts.forEach(d => {
      if (d.isPaid) return;
      const cur = d.currency || 'IQD';
      if (!totalsByCurrency[cur]) {
        totalsByCurrency[cur] = { toMe: 0, byMe: 0, net: 0 };
      }
      if (d.direction === 'owed_to_me') totalsByCurrency[cur].toMe += d.remainingAmount;
      else totalsByCurrency[cur].byMe += d.remainingAmount;
    });
    
    Object.keys(totalsByCurrency).forEach(cur => {
      totalsByCurrency[cur].net = totalsByCurrency[cur].toMe - totalsByCurrency[cur].byMe;
    });

    const currencies = Object.keys(totalsByCurrency);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
          body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; color: #111827; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3B82F6; padding-bottom: 20px; }
          .header h1 { color: #3B82F6; margin: 0; font-size: 24px; }
          .debtor-info { margin-bottom: 20px; text-align: right; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { background: #3B82F6; color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; font-size: 18px; font-weight: bold; }
          .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
          .summary-card { background: #F8F9FA; padding: 15px; border-radius: 8px; text-align: center; border: 2px solid #E5E7EB; }
          .summary-card h3 { margin: 0 0 10px 0; color: #6B7280; font-size: 14px; }
          .amount { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: right; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
          th { background: #F8F9FA; font-weight: bold; }
          .status-paid { color: #10B981; font-weight: bold; }
          .status-pending { color: #F59E0B; font-weight: bold; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #E5E7EB; text-align: center; color: #6B7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>كشف حساب مالي</h1>
          <p>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ-u-nu-latn')}</p>
        </div>
        
        <div class="debtor-info">
          <p><strong>الاسم:</strong> ${debtor.name}</p>
          ${debtor.phone ? `<p><strong>الهاتف:</strong> ${debtor.phone}</p>` : ''}
        </div>

        <div class="section">
          <div class="section-title">ملخص الأرصدة المتبقية</div>
          <div class="summary-grid">
            ${currencies.length > 0 ? currencies.map(cur => `
              <div class="summary-card">
                <h3>صافي الرصيد (${cur})</h3>
                <div class="amount" style="color: ${totalsByCurrency[cur].net >= 0 ? '#10B981' : '#EF4444'}">
                  ${totalsByCurrency[cur].net > 0 ? '+' : ''}${formatCurrency(totalsByCurrency[cur].net, cur)}
                </div>
              </div>
            `).join('') : '<div class="summary-card"><h3>لا توجد ديون معلقة</h3><div class="amount">0</div></div>'}
          </div>
        </div>

        <div class="section">
          <div class="section-title">سجل العمليات (${debts.length})</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الوصف</th>
                <th>النوع</th>
                <th>المبلغ الكلي</th>
                <th>المتبقي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${debts.map(d => `
                <tr>
                  <td>${new Date(d.startDate).toLocaleDateString('ar-IQ-u-nu-latn')}</td>
                  <td>${d.description || d.debtorName}</td>
                  <td>${d.direction === 'owed_to_me' ? 'دين لي' : 'دين علي'}</td>
                  <td>${formatCurrency(d.totalAmount, d.currency)}</td>
                  <td>${formatCurrency(d.remainingAmount, d.currency)}</td>
                  <td class="${d.isPaid ? 'status-paid' : 'status-pending'}">
                    ${d.isPaid ? 'مسدد' : 'قيد الانتظار'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة تطبيق دنانير</p>
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    throw error;
  }
};
