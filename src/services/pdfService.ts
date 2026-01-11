import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Share } from 'react-native';
import { getExpenses, getIncome } from '../database/database';
import { calculateFinancialSummary, getCurrentMonthData, getSelectedCurrencyCode } from './financialService';
import { getCurrentMonthBudgets, calculateBudgetStatus } from './budgetService';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';
import { formatCurrencyAmount } from './currencyService';

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
          body {
            font-family: 'Arial', sans-serif;
            padding: 20px;
            direction: rtl;
            background: #fff;
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
    await Share.share({
      url: uri,
      title: 'تقرير مالي شهري',
    });
  } catch (error) {
    console.error('Error sharing PDF:', error);
  }
};
