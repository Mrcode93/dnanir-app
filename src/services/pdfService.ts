import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getExpenses, getIncome, getCustomCategories } from '../database/database';
import { calculateFinancialSummary, getCurrentMonthData, getSelectedCurrencyCode } from './financialService';
import { getCurrentMonthBudgets, calculateBudgetStatus } from './budgetService';
import { EXPENSE_CATEGORIES } from '../types';
import { formatCurrencyAmount } from './currencyService';
import { AdvancedReportData } from './advancedReportsService';

const getCategoryName = (category: string, customCategories: any[]) => {
  return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] ||
    customCategories.find(c => c.name === category)?.name ||
    category;
};

export const generateMonthlyReport = async (): Promise<string> => {
  try {
    const now = new Date();
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const monthName = monthNames[now.getMonth()];
    const year = now.getFullYear();

    const summary = await calculateFinancialSummary();
    const monthlyData = await getCurrentMonthData();
    const budgets = await getCurrentMonthBudgets();
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
          <p>${monthName} ${year}</p>
          <p>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ')}</p>
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
              ${summary.topExpenseCategories.map(cat => `
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
              ${monthlyData.expenses.slice(0, 50).map(expense => `
                <tr>
                  <td>${new Date(expense.date).toLocaleDateString('ar-IQ')}</td>
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
              ${monthlyData.income.map(inc => `
                <tr>
                  <td>${new Date(inc.date).toLocaleDateString('ar-IQ')}</td>
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
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const sharePDF = async (uri: string) => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      console.warn('Sharing is not available on this device');
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'تصدير التقرير',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('Error sharing PDF:', error);
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
          <p>تم الإنشاء: ${new Date().toLocaleDateString('ar-IQ')}</p>
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
                  <td>${new Date(expense.date).toLocaleDateString('ar-IQ')}</td>
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
    console.error('Error generating advanced PDF:', error);
    throw error;
  }
};

