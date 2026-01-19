/**
 * Escapes a value for CSV format.
 * Handles quotes, commas, and newlines.
 */
export const escapeCsv = (value: any): string => {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    // If contains quote, comma or newline, wrap in quotes and escape internal quotes
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
};

/**
 * Converts an array of objects to a CSV string.
 * Assumes all objects have the same keys (header derived from first object).
 */
export const toCsv = (rows: Record<string, any>[]): string => {
    if (!rows || rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const headerRow = headers.map(escapeCsv).join(',');

    const bodyRows = rows.map(row => {
        return headers.map(header => escapeCsv(row[header])).join(',');
    });

    return [headerRow, ...bodyRows].join('\n');
};

/**
 * Triggers a browser download of the content as a file.
 * Adds UTF-8 BOM to ensure Excel opens it correctly with special characters.
 */
export const downloadTextFile = (filename: string, content: string, mimeType = 'text/csv;charset=utf-8') => {
    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF'; 
    const blob = new Blob([bom + content], { type: mimeType });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};