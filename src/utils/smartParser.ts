import {
    EXPENSE_INTENTS,
    INCOME_INTENTS,
    EXPENSE_KEYWORDS,
    INCOME_KEYWORDS,
    CATEGORY_DISPLAY_NAMES,
    NEGATIVE_INTENTS
} from './iraqi-language-pack';

export interface ParsedTransaction {
    amount: number | null;
    category: string;
    type: 'expense' | 'income';
    title: string;
    confidence: number; // 0 to 1
}

const ROOT_MATCHERS = {
    spend: /(صرف|اصرف|صرفت|مصروف|مصاريف|دفع|ادفع|دفعت|دفاع|مخطط)/,
    get: /(جاني|اجاني|وصلني|استلمت|قبضت|اخذت|اخذت|ربح|ارباح)/,
};

const ARABIC_NUMERALS: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

const ARABIC_NUMBER_WORDS: Record<string, number> = {
    'صفر': 0,
    'واحد': 1,
    'اثنين': 2,
    'ثلاثة': 3,
    'ثلاثه': 3,
    'اربعة': 4,
    'اربعا': 4,
    'خمسة': 5,
    'خمسه': 5,
    'ستة': 6,
    'سبعة': 7,
    'سبعه': 7,
    'ثمانية': 8,
    'ثمانيه': 8,
    'تسعة': 9,
    'تسعه': 9,
    'عشرة': 10,
    'عشره': 10,
    'عشرين': 20,
    'ثلاثين': 30,
    'اربعين': 40,
    'خمسين': 50,
    'ستين': 60,
    'سبعين': 70,
    'ثمانين': 80,
    'تسعين': 90,
    'مية': 100,
    'مائة': 100,
    'ميتين': 200,
    'ربع': 250,
    'نص': 500,
    'نصف': 500,
};

export const EXPENSE_CATEGORY_LIST = Object.keys(EXPENSE_KEYWORDS);
export const INCOME_CATEGORY_LIST = Object.keys(INCOME_KEYWORDS);

export { CATEGORY_DISPLAY_NAMES };

const convertArabicNumerals = (text: string): string => {
    return text.replace(/[٠-٩]/g, (d) => ARABIC_NUMERALS[d]);
};

// 3. Smart Iraqi Amount Parsing
const parseIraqiAmount = (text: string): number | null => {
    const lowerText = text.toLowerCase();

    // Check for "ربع" or "نص" without leading numbers
    if (lowerText === 'ربع') return 250;
    if (lowerText === 'نص' || lowerText === 'نصف') return 500;

    // Regex for numbers + optional multipliers + optional fractions
    let match = lowerText.match(/(\d+(?:[.,]\d+)?)\s*(الف|الاف|آلاف|مليون|ملايين|ورقة|شدة|k|m)?\s*(و?نص|و?ربع|و?نصف)?/);

    if (!match) return null;

    let baseAmount = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2]?.toLowerCase();
    const fraction = match[3];

    let scale = 1; // Default scale for fractions

    if (multiplier) {
        if (['الف', 'الاف', 'آلاف', 'k'].includes(multiplier)) {
            scale = 1000;
            baseAmount *= 1000;
        } else if (['مليون', 'ملايين', 'm'].includes(multiplier)) {
            scale = 1000000;
            baseAmount *= 1000000;
        } else if (multiplier === 'ورقة') {
            scale = 100 * 1500; // Simplified estimation for 100 USD in IQD
            baseAmount *= scale;
        } else if (multiplier === 'شدة') {
            scale = 10000 * 1500;
            baseAmount *= scale;
        }
    } else {
        // Heuristic: If number < 1000, assume it's thousands in Iraqi context
        if (baseAmount < 1000 && baseAmount > 0) {
            baseAmount *= 1000;
            scale = 1000;
        } else {
            scale = 1; // If it's already large, assume literal
        }
    }

    // Fractions - scaled by the context
    if (fraction) {
        const fractionValue = fraction.includes('نص') ? 0.5 : 0.25;
        baseAmount += fractionValue * scale;
    }

    return baseAmount;
};

export const parseTransactionText = (text: string): ParsedTransaction => {
    let cleanText = text.trim();
    cleanText = convertArabicNumerals(cleanText);
    const lowerText = cleanText.toLowerCase();

    let amount: number | null = null;
    let category = 'other';
    let type: 'expense' | 'income' = 'expense';
    let title = cleanText;
    let confidence = 0;

    // 1. Intent Check
    const hasExpenseIntent = EXPENSE_INTENTS.some(w => lowerText.includes(w)) || ROOT_MATCHERS.spend.test(lowerText);
    const hasIncomeIntent = INCOME_INTENTS.some(w => lowerText.includes(w)) || ROOT_MATCHERS.get.test(lowerText);

    if (hasIncomeIntent && !hasExpenseIntent) {
        type = 'income';
    } else if (hasExpenseIntent) {
        type = 'expense';
    }

    // 2. Amount Extraction
    amount = parseIraqiAmount(lowerText);

    if (amount === null) {
        // Check word-based numbers if no numeric match
        for (const [word, val] of Object.entries(ARABIC_NUMBER_WORDS)) {
            if (lowerText.includes(word)) {
                amount = val < 1000 ? val * 1000 : val;
                break;
            }
        }
    }

    // 3. Category Determination
    let foundCategory = false;
    const searchKeywords = type === 'income' ? INCOME_KEYWORDS : EXPENSE_KEYWORDS;

    for (const [key, keywords] of Object.entries(searchKeywords)) {
        if (keywords.some(k => lowerText.includes(k))) {
            category = key;
            foundCategory = true;
            break;
        }
    }

    // 4. Title Refinement - Strip intents and numbers
    title = cleanText
        .replace(/(\d+(?:[.,]\d+)?)/g, '') // Remove numbers
        .replace(new RegExp(`(${EXPENSE_INTENTS.concat(INCOME_INTENTS).join('|')})`, 'g'), '') // Remove intent words
        .replace(/\s*(الف|الاف|آلاف|دينار|د\.ع|alf|مليون|ملايين|m|ورقة|شدة|ربع|نص|ونص|وربع|ونصف)\s*/gi, '') // Remove units
        .replace(/\s+/g, ' ')
        .trim();

    if (!title || title.length < 2) {
        title = CATEGORY_DISPLAY_NAMES[category] || 'معاملة';
    }

    // 5. Confidence Calculation
    if (amount) confidence += 0.4;
    if (foundCategory) confidence += 0.3;
    if (hasExpenseIntent || hasIncomeIntent) confidence += 0.2;
    if (title.length > 3 && title !== CATEGORY_DISPLAY_NAMES[category]) confidence += 0.1;

    // Penalize if it looks like "nothing" or negative context
    if (NEGATIVE_INTENTS.some(ni => lowerText.includes(ni))) {
        confidence -= 0.5;
    }

    return {
        amount,
        category,
        type,
        title,
        confidence: Math.max(0, Math.min(confidence, 1))
    };
};

export const parseMultipleTransactions = (fullText: string): ParsedTransaction[] => {
    const trimmed = fullText.trim();
    if (!trimmed) return [];

    const cleaned = convertArabicNumerals(trimmed);
    const lowerCleaned = cleaned.toLowerCase();

    // Filler words to strip from titles
    const FILLER_WORDS = /\b(اليوم|رحت|طلعت|بره|برا|من|على|عند|مع|في|ب|مال|هسه|بعد|قبل|هم|هاي|هذا|ذاك|للمطعم|لل)\b/g;

    // --- Strategy: Find all amount patterns, then extract context around each ---

    // Match: digits (with commas), optionally followed by multiplier/unit words
    const amountRegex = /(\d+(?:[.,]\d+)?)\s*(الف|الاف|آلاف|مليون|ملايين|ورقة|شدة|دينار|k|m)?\s*(و?نص|و?ربع|و?نصف)?/g;

    interface AmountMatch {
        fullMatch: string;
        startIndex: number;
        endIndex: number;
        rawAmount: number;
    }

    const amountMatches: AmountMatch[] = [];
    let match;

    while ((match = amountRegex.exec(lowerCleaned)) !== null) {
        const rawNum = parseFloat(match[1].replace(/,/g, ''));
        if (rawNum <= 0) continue;

        // Calculate real amount using parseIraqiAmount on this match
        const realAmount = parseIraqiAmount(match[0]);
        if (realAmount === null || realAmount <= 0) continue;

        amountMatches.push({
            fullMatch: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            rawAmount: realAmount,
        });
    }

    console.log('  Found', amountMatches.length, 'amount(s):', amountMatches.map(a => `${a.rawAmount} @${a.startIndex}`));

    if (amountMatches.length === 0) {
        // No numeric amounts found, try single parse (might catch word-based numbers)
        return [];
    }

    if (amountMatches.length === 1) {
        // Single amount - use existing single parser
        const result = parseTransactionText(cleaned);
        if (result.amount && result.amount > 0) {
            result.title = result.title.replace(FILLER_WORDS, '').replace(/\s+/g, ' ').trim();
            if (!result.title || result.title.length < 2) {
                result.title = CATEGORY_DISPLAY_NAMES[result.category] || 'معاملة';
            }
            return [result];
        }
        return [];
    }

    // --- Multiple amounts: split text into regions around each amount ---
    const results: ParsedTransaction[] = [];

    for (let i = 0; i < amountMatches.length; i++) {
        const current = amountMatches[i];

        // Context region: from end of previous amount to start of next amount
        const regionStart = i === 0 ? 0 : amountMatches[i - 1].endIndex;
        const regionEnd = i === amountMatches.length - 1 ? cleaned.length : amountMatches[i + 1].startIndex;

        // Get the text region for this amount (context before + amount + context after)
        const region = cleaned.substring(regionStart, regionEnd).trim();

        if (!region) continue;

        console.log(`  Region[${i}]: "${region}" → amount=${current.rawAmount}`);

        // Parse the region for category/type/title
        const parsed = parseTransactionText(region);

        // Override amount with our accurately parsed amount
        parsed.amount = current.rawAmount;

        // Clean the title
        let cleanTitle = parsed.title
            .replace(FILLER_WORDS, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanTitle || cleanTitle.length < 2) {
            cleanTitle = CATEGORY_DISPLAY_NAMES[parsed.category] || 'معاملة';
        }
        parsed.title = cleanTitle;

        // Ensure minimum confidence
        parsed.confidence = Math.max(0.4, parsed.confidence);

        results.push(parsed);
    }

    return results;
};


