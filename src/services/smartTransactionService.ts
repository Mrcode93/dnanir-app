import { parseWithGemini, GeminiTransaction } from './geminiService';
import { parseMultipleTransactions, parseTransactionText, CATEGORY_DISPLAY_NAMES, ParsedTransaction } from '../utils/smartParser';
import { addExpense, addIncome, getSavings, addSavingsTransaction, addSavings } from '../database/database';
import { incrementSmartAddUsage } from './smartAddUsage';
import { ExpenseCategory, IncomeSource } from '../types';

/**
 * Common logic to process text into transactions and save to database.
 * Used by both the SmartAddModal and background Widget processing.
 */
export const processSmartText = async (text: string): Promise<void> => {
    if (!text || !text.trim()) return;

    let results: Array<GeminiTransaction | ParsedTransaction> = [];
    let usedAI = false;

    try {
        // 1. Try Gemini AI first
        const geminiResults = await parseWithGemini(text);
        if (geminiResults && geminiResults.length > 0) {
            results = geminiResults;
            usedAI = true;
            await incrementSmartAddUsage();
        }
    } catch (error) {
        
    }

    // 2. Fallback to Local Parser
    if (results.length === 0) {
        results = parseMultipleTransactions(text);
        if (results.length === 0) {
            results = [parseTransactionText(text)];
        }
    }

    // 3. Save to Database
    await saveTransactions(results, usedAI);
};

/**
 * Save an array of parsed transactions to the database
 */
export const saveTransactions = async (results: Array<GeminiTransaction | ParsedTransaction>, viaAI: boolean = false): Promise<void> => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    for (const item of results) {
        if (!item.amount) continue;

        const finalTitle = item.title?.trim() || CATEGORY_DISPLAY_NAMES[item.category] || 'معاملة';

        if (item.type === 'expense') {
            await addExpense({
                title: finalTitle,
                amount: item.amount,
                base_amount: item.amount,
                category: item.category as ExpenseCategory,
                date: dateStr,
                description: viaAI ? 'أضيف بالذكاء الاصطناعي' : 'أضيف ذكياً (محلي)',
                currency: 'IQD',
            });
        } else if (item.type === 'income') {
            await addIncome({
                source: finalTitle,
                amount: item.amount,
                base_amount: item.amount,
                date: dateStr,
                category: item.category as IncomeSource,
                description: viaAI ? 'أضيف بالذكاء الاصطناعي' : 'أضيف ذكياً (محلي)',
                currency: 'IQD',
            });
        } else if (item.type === 'savings') {
             try {
                const savingsList = await getSavings();
                let targetId;

                if (savingsList.length === 0) {
                    targetId = await addSavings({
                        title: 'حصالة عامة',
                        targetAmount: 0,
                        currency: 'IQD',
                        icon: 'wallet',
                        color: '#10B981',
                        description: 'تم إنشاؤها تلقائياً للإضافة الذكية'
                    });
                } else {
                    targetId = savingsList[0].id;
                    const match = savingsList.find(s =>
                        s.title.toLowerCase().includes(item.title?.toLowerCase() || '') ||
                        (item.title || '').toLowerCase().includes(s.title.toLowerCase())
                    );
                    if (match) targetId = match.id;
                }

                await addSavingsTransaction({
                    savingsId: targetId,
                    amount: item.amount,
                    type: 'deposit',
                    date: dateStr,
                    description: item.title || 'إيداع ذكي',
                });
            } catch (e) {
                
            }
        }
    }
};
