export const convertArabicToEnglish = (str: string): string => {
    if (!str) return str;
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    // Replace Arabic numerals
    let result = str.replace(/[٠-٩]/g, (d) => {
        return arabicNumbers.indexOf(d).toString();
    });
    // Replace Arabic decimal separator (U+066B) with dot
    result = result.replace(/\u066B/g, '.');
    // Remove commas (thousand separators) before processing
    result = result.replace(/,/g, '');
    // Remove any non-numeric and non-dot characters
    result = result.replace(/[^0-9.]/g, '');
    return result;
};

export const convertArabicToEnglishSimple = (str: string): string => {
    if (!str) return str;
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str.replace(/[٠-٩]/g, (d) => {
        return arabicNumbers.indexOf(d).toString();
    });
};

export const formatNumberWithCommas = (value: string | number): string => {
    if (value === null || value === undefined || value === '') return '';
    let valStr = typeof value === 'number' ? value.toString() : value;

    // 1. Remove commas
    valStr = valStr.replace(/,/g, '');

    // 2. Separate whole and decimal parts
    const parts = valStr.split('.');

    // 3. Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // 4. Join back
    return parts.join('.');
};

/**
 * Consistently format numbers for display using English numerals (0-9)
 */
export const formatDisplayNumber = (amount: number, options: Intl.NumberFormatOptions = {}): string => {
    return amount.toLocaleString('en-US', options);
};

/**
 * Consistently format dates for display using Arabic text but English numerals (0-9)
 */
export const formatDisplayDate = (date: Date | string, options: Intl.DateTimeFormatOptions = {}): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // We try to use ar-IQ with latin numbering system if possible
    // If it fails or doesn't produce the expected result in some environments, 
    // we fallback to en-US or similar but usually ar-IQ with u-nu-latn 
    // is well supported in modern JSC/Hermes.
    try {
        return dateObj.toLocaleDateString('ar-IQ-u-nu-latn', options);
    } catch (e) {
        // Fallback to simple en-US if locale string subsetting isn't supported
        return dateObj.toLocaleDateString('en-GB', options);
    }
};
