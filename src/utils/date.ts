/**
 * Format a Date object to YYYY-MM-DD string using local time
 * (Avoiding timezone shifts from toISOString())
 */
export const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get the start and end of a month as YYYY-MM-DD strings using local time
 */
export const getMonthRange = (year: number, month: number) => {
    // month is 1-indexed (1-12)
    const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDayObj = new Date(year, month, 0);
    const lastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDayObj.getDate().toString().padStart(2, '0')}`;

    return { firstDay, lastDay };
};
