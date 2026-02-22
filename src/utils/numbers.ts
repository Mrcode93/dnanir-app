export const convertArabicToEnglish = (str: string): string => {
    if (!str) return str;
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    // Replace Arabic numerals
    let result = str.replace(/[٠-٩]/g, (d) => {
        return arabicNumbers.indexOf(d).toString();
    });
    // Replace Arabic decimal separator (U+066B) with dot
    result = result.replace(/\u066B/g, '.');
    // Replace comma with dot for decimals (some Arabic keyboards use comma as decimal)
    // Only if there is no dot already, to avoid interfering with thousands separators (though usually we don't want those anyway)
    if (result.includes(',') && !result.includes('.')) {
        result = result.replace(',', '.');
    }
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
