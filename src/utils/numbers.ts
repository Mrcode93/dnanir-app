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

    // If it's a number, it might have many decimals, let's keep it simple
    // If it's a string, it might have Arabic numbers or existing commas

    // 1. Remove commas
    valStr = valStr.replace(/,/g, '');

    // 2. Separate whole and decimal parts
    const parts = valStr.split('.');

    // 3. Format the integer part with commas
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // 4. Join back
    return parts.join('.');
};
