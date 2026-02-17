
/**
 * Internal Notification Constants
 * Define categories, texts, and timing for local notifications
 */

export const NOTIFICATION_CATEGORIES = {
    DAILY_REMINDER: 'daily-reminder',
    EXPENSE_REMINDER: 'expense-reminder',
    BUDGET_ALERTS: 'budget-alerts',
    DEBT_REMINDERS: 'debt-reminders',
    INSIGHTS: 'insights',
    ACHIEVEMENTS: 'achievements',
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
            title: 'نسيت شي اليوم؟ 🤔',
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
