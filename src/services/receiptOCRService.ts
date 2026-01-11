import * as ImagePicker from 'expo-image-picker';
import { ExpenseCategory, EXPENSE_CATEGORIES } from '../types';

// محاولة استيراد OCR - قد لا يكون متوفراً في جميع الإصدارات
let TextRecognition: any = null;
try {
  TextRecognition = require('expo-text-recognition');
} catch (e) {
  console.log('expo-text-recognition not available, using fallback');
}

export interface ReceiptData {
  amount?: number;
  date?: Date;
  title?: string;
  category?: ExpenseCategory;
  description?: string;
}

/**
 * طلب إذن الوصول إلى الكاميرا والمكتبة
 */
export const requestImagePermissions = async (): Promise<boolean> => {
  const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
  const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  return cameraStatus === 'granted' && libraryStatus === 'granted';
};

/**
 * اختيار صورة من المكتبة
 */
export const pickImageFromLibrary = async (): Promise<string | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
};

/**
 * التقاط صورة من الكاميرا
 */
export const takePhotoWithCamera = async (): Promise<string | null> => {
  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
};

/**
 * استخراج المبلغ من النص
 * يبحث عن المبلغ بجانب كلمات محددة مثل: المجموع، المجموع بعد الخصم، إلخ
 */
const extractAmount = (text: string): number | null => {
  // كلمات مفتاحية للبحث عن المبلغ الإجمالي
  const totalKeywords = [
    'المجموع',
    'المجموع بعد الخصم',
    'المجموع الكلي',
    'المجموع النهائي',
    'الإجمالي',
    'المبلغ الإجمالي',
    'المبلغ الكلي',
    'المبلغ النهائي',
    'total',
    'total amount',
    'grand total',
    'final total',
    'sum',
    'amount',
    'المجموع الكلي بعد الخصم',
    'المجموع النهائي',
  ];

  // أنماط البحث عن المبلغ بجانب الكلمات المفتاحية
  const amountPatterns: Array<{ pattern: RegExp; priority: number }> = [];

  // إضافة أنماط لكل كلمة مفتاحية
  totalKeywords.forEach((keyword) => {
    // نمط 1: الكلمة المفتاحية متبوعة بـ : أو = ثم المبلغ
    amountPatterns.push({
      pattern: new RegExp(`${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s:=\\-]*([\\d]{1,3}(?:[,\\s]\\d{3})*(?:\\.\\d{2})?)\\s*(?:دينار|د\\.ع|IQD|دينار عراقي|ريال|دولار|USD|EUR|GBP)?`, 'i'),
      priority: 10,
    });

    // نمط 2: المبلغ متبوعاً بالكلمة المفتاحية
    amountPatterns.push({
      pattern: new RegExp(`([\\d]{1,3}(?:[,\\s]\\d{3})*(?:\\.\\d{2})?)\\s*(?:دينار|د\\.ع|IQD|دينار عراقي|ريال|دولار|USD|EUR|GBP)?[\\s:=\\-]*${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
      priority: 9,
    });

    // نمط 3: الكلمة المفتاحية في نفس السطر مع المبلغ
    amountPatterns.push({
      pattern: new RegExp(`${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?([\\d]{1,3}(?:[,\\s]\\d{3})*(?:\\.\\d{2})?)`, 'i'),
      priority: 8,
    });
  });

  // ترتيب الأنماط حسب الأولوية (الأعلى أولاً)
  amountPatterns.sort((a, b) => b.priority - a.priority);

  // البحث في الأنماط المرتبة
  for (const { pattern } of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/[,\s]/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0 && amount < 1000000000) {
        return amount;
      }
    }
  }

  // إذا لم نجد مبلغ بجانب كلمات مفتاحية، نبحث عن "المجموع بعد الخصم" أولاً (الأهم)
  const afterDiscountPattern = /المجموع\s+بعد\s+الخصم[:\s]*([\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)/i;
  const afterDiscountMatch = text.match(afterDiscountPattern);
  if (afterDiscountMatch) {
    const amountStr = afterDiscountMatch[1].replace(/[,\s]/g, '');
    const amount = parseFloat(amountStr);
    if (!isNaN(amount) && amount > 0) {
      return amount;
    }
  }

  // البحث عن "المجموع" العادي
  const totalPattern = /المجموع[:\s]*([\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)/i;
  const totalMatch = text.match(totalPattern);
  if (totalMatch) {
    const amountStr = totalMatch[1].replace(/[,\s]/g, '');
    const amount = parseFloat(amountStr);
    if (!isNaN(amount) && amount > 0) {
      return amount;
    }
  }

  // البحث عن "Total" بالإنجليزية
  const totalEnglishPattern = /total[:\s]*([\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?)/i;
  const totalEnglishMatch = text.match(totalEnglishPattern);
  if (totalEnglishMatch) {
    const amountStr = totalEnglishMatch[1].replace(/[,\s]/g, '');
    const amount = parseFloat(amountStr);
    if (!isNaN(amount) && amount > 0) {
      return amount;
    }
  }

  // كحل أخير، البحث عن أكبر رقم معقول في النص
  const numbers = text.match(/\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?/g);
  if (numbers) {
    const amounts = numbers
      .map(n => parseFloat(n.replace(/[,\s]/g, '')))
      .filter(n => !isNaN(n) && n > 0 && n < 1000000000 && n > 100); // مبالغ معقولة (أكبر من 100)
    
    if (amounts.length > 0) {
      // نرجع أكبر مبلغ (على افتراض أنه المجموع)
      return Math.max(...amounts);
    }
  }

  return null;
};

/**
 * استخراج التاريخ من النص
 */
const extractDate = (text: string): Date | null => {
  // أنماط التاريخ: 2024-01-15, 15/01/2024, 15-01-2024, 15 يناير 2024
  const datePatterns = [
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
    /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/,
    /(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/i,
  ];

  const months: Record<string, number> = {
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4,
    'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8,
    'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  };

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let year: number, month: number, day: number;

      if (match[2] && months[match[2]]) {
        // نمط: 15 يناير 2024
        day = parseInt(match[1]);
        month = months[match[2]];
        year = parseInt(match[3]);
      } else if (pattern.source.includes('(\\d{4})')) {
        // نمط: 2024-01-15
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else {
        // نمط: 15/01/2024
        day = parseInt(match[1]);
        month = parseInt(match[2]);
        year = parseInt(match[3]);
      }

      if (year && month && day) {
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }

  // إذا لم نجد تاريخ، نستخدم تاريخ اليوم
  return new Date();
};

/**
 * استخراج اسم المتجر/العنوان من النص
 */
const extractTitle = (text: string): string | null => {
  // البحث عن أسماء متاجر شائعة
  const storePatterns = [
    /(?:متجر|محل|سوبرماركت|مول|مطعم|مقهى|صيدلية|مستشفى|عيادة)\s+([^\n]+)/i,
    /^([^\n]{2,30})/m, // أول سطر في النص
  ];

  for (const pattern of storePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const title = match[1].trim();
      if (title.length > 2 && title.length < 50) {
        return title;
      }
    }
  }

  // إذا لم نجد، نستخدم "فاتورة"
  return 'فاتورة';
};

/**
 * تحديد الفئة بناءً على النص
 */
const detectCategory = (text: string): ExpenseCategory => {
  const lowerText = text.toLowerCase();

  // كلمات مفتاحية لكل فئة
  const categoryKeywords: Record<ExpenseCategory, string[]> = {
    food: ['مطعم', 'مقهى', 'طعام', 'مشروب', 'بيتزا', 'برجر', 'سندويش', 'restaurant', 'food', 'cafe'],
    transport: ['تاكسي', 'أوبر', 'بنزين', 'وقود', 'مواصلات', 'taxi', 'fuel', 'gas', 'transport'],
    shopping: ['متجر', 'محل', 'تسوق', 'شراء', 'shop', 'store', 'shopping', 'mall'],
    bills: ['فاتورة', 'كهرباء', 'ماء', 'إنترنت', 'هاتف', 'bill', 'invoice', 'utility'],
    entertainment: ['سينما', 'حديقة', 'ترفيه', 'cinema', 'entertainment', 'park'],
    health: ['صيدلية', 'مستشفى', 'عيادة', 'دواء', 'pharmacy', 'hospital', 'clinic', 'medicine'],
    education: ['مدرسة', 'جامعة', 'كتاب', 'school', 'university', 'book'],
    other: [],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return category as ExpenseCategory;
    }
  }

  return 'other';
};

/**
 * تحليل النص المستخرج من الفاتورة
 * 
 * ملاحظة: هذه دالة بسيطة لتحليل النص. 
 * في الإصدارات المستقبلية، يمكن استخدام OCR حقيقي مثل Google Vision API
 */
export const parseReceiptText = (text: string): ReceiptData => {
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  const amount = extractAmount(normalizedText);
  const date = extractDate(normalizedText);
  const title = extractTitle(normalizedText);
  const category = detectCategory(normalizedText);

  return {
    amount: amount || undefined,
    date: date || undefined,
    title: title || undefined,
    category,
    description: normalizedText.length > 100 ? normalizedText.substring(0, 100) + '...' : normalizedText,
  };
};

/**
 * معالجة صورة الفاتورة باستخدام OCR
 */
export const processReceiptImage = async (imageUri: string): Promise<ReceiptData> => {
  try {
    // محاولة استخدام OCR إذا كان متوفراً
    if (TextRecognition && TextRecognition.recognizeTextAsync) {
      try {
        const result = await TextRecognition.recognizeTextAsync(imageUri, {
          language: 'ar+en', // العربية والإنجليزية
        });

        if (result && result.text && result.text.trim().length > 0) {
          // تحليل النص المستخرج
          const parsedData = parseReceiptText(result.text);
          return parsedData;
        }
      } catch (ocrError) {
        console.log('OCR not available or failed, using fallback:', ocrError);
      }
    }

    // Fallback: إذا لم يتوفر OCR أو فشل، نعيد بيانات افتراضية
    // المستخدم يمكنه إدخال النص يدوياً
    return {
      date: new Date(),
      category: 'other',
      title: 'فاتورة',
    };
  } catch (error) {
    console.error('Error in OCR processing:', error);
    // في حالة الخطأ، نعيد بيانات افتراضية
    return {
      date: new Date(),
      category: 'other',
      title: 'فاتورة',
    };
  }
};


/**
 * عرض خيارات اختيار الصورة
 */
export const showImagePickerOptions = async (): Promise<string | null> => {
  // هذا سيتم استدعاؤه من المكون
  // سنستخدم Alert أو ActionSheet
  return null;
};
