export const validateCsvFormat = (file: File): Promise<{ isValid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        // Remove BOM (Byte Order Mark) if present
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        // Normalize line endings (handle both \r\n and \n)
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        if (lines.length === 0) {
          resolve({ isValid: false, error: 'CSV-filen er tom' });
          return;
        }
        
        // Get the header row (first line)
        let headerRow = lines[0].trim();
        
        // Remove quotes if present around the entire header or individual columns
        headerRow = headerRow.replace(/^["']|["']$/g, '');
        
        // Detect delimiter: count tabs, commas, and semicolons to determine which is the delimiter
        const tabCount = (headerRow.match(/\t/g) || []).length;
        const commaCount = (headerRow.match(/,/g) || []).length;
        const semicolonCount = (headerRow.match(/;/g) || []).length;
        
        // Use the delimiter that appears most frequently
        let delimiter: string;
        if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) {
          delimiter = '\t';
        } else if (semicolonCount >= commaCount && semicolonCount > 0) {
          delimiter = ';';
        } else if (commaCount > 0) {
          delimiter = ',';
        } else if (tabCount > 0) {
          delimiter = '\t';
        } else {
          // No delimiter found, might be single column or space-separated
          delimiter = ',';
        }
        
        // Split headers by detected delimiter and normalize
        let headers = headerRow.split(delimiter)
          .map(header => {
            // Remove quotes, trim whitespace, normalize
            return header.replace(/^["']+|["']+$/g, '').trim();
          })
          .filter(header => header.length > 0) // Remove empty headers
          .map(header => header.toLowerCase());
        
        // Required columns in Norwegian (only 3 columns)
        const requiredColumnsOriginal = ['gate/vei 2', 'postnummer', 'poststed'];
        const requiredColumnsLower = requiredColumnsOriginal.map(col => col.toLowerCase());
        
        // Helper function to check if headers match required columns
        const checkHeaders = (headerList: string[]): boolean => {
          return requiredColumnsLower.every(col => headerList.includes(col));
        };
        
        // Check if all required columns are present (case-insensitive)
        let isValid = checkHeaders(headers);
        
        // If validation failed, try other delimiters as fallback (try all three: tab, comma, semicolon)
        if (!isValid) {
          const delimitersToTry = ['\t', ',', ';'].filter(d => d !== delimiter);
          
          for (const altDelimiter of delimitersToTry) {
            const alternativeHeaders = headerRow.split(altDelimiter)
              .map(header => header.replace(/^["']+|["']+$/g, '').trim())
              .filter(header => header.length > 0)
              .map(header => header.toLowerCase());
            
            if (checkHeaders(alternativeHeaders)) {
              headers = alternativeHeaders;
              isValid = true;
              delimiter = altDelimiter;
              break;
            }
          }
        }
        
        if (!isValid) {
          // Get missing columns
          const missingColumnsIndices: number[] = [];
          requiredColumnsLower.forEach((col, index) => {
            if (!headers.includes(col)) {
              missingColumnsIndices.push(index);
            }
          });
          
          const missingColumnsOriginal = missingColumnsIndices.map(index => requiredColumnsOriginal[index]);
          
          // Debug: log what was found vs what was expected
          const delimiterName = delimiter === '\t' ? 'TAB' : delimiter === ';' ? 'SEMICOLON' : 'COMMA';
          console.log('CSV Validation Debug:', {
            headerRow,
            delimiter: delimiterName,
            foundHeaders: headers,
            expectedHeaders: requiredColumnsLower,
            missingColumns: missingColumnsOriginal,
            tabCount,
            commaCount,
            semicolonCount
          });
          
          resolve({ 
            isValid: false, 
            error: `CSV-filen mangler følgende kolonner: ${missingColumnsOriginal.join(', ')}. Vennligst formater CSV-filen med kolonnene: ${requiredColumnsOriginal.join(', ')}` 
          });
          return;
        }
        
        // Check if there are any data rows
        if (lines.length < 2) {
          resolve({ isValid: false, error: 'CSV-filen inneholder ingen data-rader' });
          return;
        }
        
        resolve({ isValid: true });
      } catch (error) {
        console.error('CSV validation error:', error);
        resolve({ isValid: false, error: 'Kunne ikke lese CSV-filen' });
      }
    };
    
    reader.onerror = () => {
      resolve({ isValid: false, error: 'Kunne ikke lese filen' });
    };
    
    reader.readAsText(file);
  });
}; 