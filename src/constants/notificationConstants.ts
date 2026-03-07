
/**
 * Internal Notification Constants
 * Define categories, texts, and timing for local notifications
 */

export const NOTIFICATION_CATEGORIES = {
    DAILY_REMINDER: 'daily-reminder',
    EXPENSE_REMINDER: 'expense-reminder',
    BUDGET_ALERTS: 'budget-alerts',
    BILL_ALERTS: 'bill-alerts',
    DEBT_REMINDERS: 'debt-reminders',
    INSIGHTS: 'insights',
    SPENDING_ALERTS: 'spending-alerts',
    ACHIEVEMENTS: 'achievements',
    SUBSCRIPTION_ALERTS: 'subscription-alerts',
};

export const NOTIFICATION_CHANNELS = {
    FINANCIAL: 'financial-reminders',
    SYSTEM: 'system-alerts',
    CHALLENGES: 'challenge-achievements',
};

// Dialect-friendly notification messages
export const NOTIFICATION_MESSAGES = {
    DAILY_MORNING: [
        {
            title: 'صباح الخير ☀️',
            body: 'تذكر تسجل ميزانيتك اليوم حتى تسيطر على مصاريفك.',
        },
        {
            title: 'يومك سعيد! 💸',
            body: 'خطط لمصاريفك اليوم وخلي ميزانيتك دائماً تحت السيطرة.',
        }
    ],
    DAILY_EVENING: [
        {
            title: 'نسيت شي اليوم? 🤔',
            body: 'تذكر تسجل كل شي صرفته اليوم حتى حساباتك تبقى مضبوطة.',
        },
        {
            title: 'مراجعة الميزانية 📝',
            body: 'دقايق من وقتك سجل بيها مصاريف اليوم وارتاح.',
        },
        {
            title: 'وين راحت الفلوس؟ 🧐',
            body: 'سجل معاملاتك هسة حتى ما تنسى وين صرفت فلوسك.',
        }
    ],
    BUDGET_WARNING: {
        title: '📈 اقتراب من الحد',
        body: (category: string, percentage: number) =>
            `دير بالك! وصلت ${percentage}% من ميزانية ${category}.`,
    },
    BUDGET_EXCEEDED: {
        title: '⚠️ تجاوزت الميزانية',
        body: (category: string, amount: number) =>
            `عبرت ميزانية ${category} بمبلغ ${amount} دينار. حاول تقتصد لبقية الشهر.`,
    },
    DEBT_REMINDER: {
        title: '📅 موعد سداد',
        body: (name: string, amount: number) =>
            `تذكير: باجر لازم تسدد ${amount} دينار لـ ${name}.`,
    },
    BILL_DUE_SOON: {
        title: (daysLeft: number) => daysLeft === 0 ? '🚨 فاتورة مستحقة اليوم' : daysLeft === 1 ? '⏰ فاتورة مستحقة غداً' : '📅 فاتورة قريبة الاستحقاق',
        body: (billTitle: string, amount: number, currency: string, daysLeft: number) =>
            daysLeft === 0
                ? `فاتورة "${billTitle}" مستحقة اليوم بقيمة ${amount} ${currency}.`
                : `فاتورة "${billTitle}" مستحقة خلال ${daysLeft} أيام بقيمة ${amount} ${currency}.`,
    },
    SUBSCRIPTION_DUE_SOON: {
        title: '🔄 تجديد اشتراك قادم',
        body: (name: string, amount: number, currency: string) =>
            `سيتم خصم مبلغ "${amount} ${currency}" مقابل اشتراك "${name}" خلال 24 ساعة.`,
    },
    SPENDING_ANOMALY: {
        title: '📊 نمط صرف غير طبيعي',
        body: (todayTotal: number, average: number, percent: number) =>
            `صرفك اليوم (${todayTotal}) أعلى من متوسطك اليومي (${average}) بحوالي ${percent}%.`,
    },
    WEEKLY_SUMMARY: {
        title: '📊 تقريرك الأسبوعي',
        body: 'خلص الأسبوع! شوف ملخص مصاريفك وشكد وفرت.',
    }
};

export const DEFAULT_TIMING = {
    MORNING_REMINDER: '09:00',
    EVENING_REMINDER: '21:00',
    DEBT_CHECK: '08:30',
};
