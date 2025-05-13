/**
 * Data Analysis Implementation
 * 
 * This file provides utilities for analyzing CSV and JSON data.
 */

// Type for representing tabular data (works for both CSV and JSON)
export type DataTable = {
  headers: string[];
  rows: any[][];
  originalFormat?: 'csv' | 'json';
};

/**
 * Helper class for data analysis operations
 */
export class DataAnalyzer {
  // Parse CSV string into a structured format
  parseCSV(csvContent: string, delimiter: string = ','): DataTable {
    const lines = csvContent.trim().split('\n');
    
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }
    
    // Parse headers
    const headers = this.parseCSVLine(lines[0], delimiter);
    
    // Parse data rows
    const rows: any[][] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const row = this.parseCSVLine(lines[i], delimiter);
        // Convert numeric strings to numbers
        const processedRow = row.map(val => {
          const num = Number(val);
          return !isNaN(num) && val.trim() !== '' ? num : val;
        });
        rows.push(processedRow);
      }
    }
    
    return { headers, rows, originalFormat: 'csv' };
  }
  
  // Helper to parse a CSV line accounting for quoted values
  private parseCSVLine(line: string, delimiter: string = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    return result;
  }
  
  // Parse JSON into a tabular format
  parseJSON(jsonContent: string): DataTable {
    try {
      const parsedData = JSON.parse(jsonContent);
      
      // Handle array of objects
      if (Array.isArray(parsedData) && parsedData.length > 0 && typeof parsedData[0] === 'object') {
        const headers = this.extractJSONHeaders(parsedData);
        const rows = parsedData.map(item => 
          headers.map(header => this.getNestedValue(item, header))
        );
        
        return { headers, rows, originalFormat: 'json' };
      }
      
      // Handle simple object
      if (typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        const headers = Object.keys(parsedData);
        const rows = [headers.map(key => parsedData[key])];
        
        return { headers, rows, originalFormat: 'json' };
      }
      
      throw new Error('Unsupported JSON structure');
    } catch (error: any) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }
  
  // Extract headers from JSON data (first level keys)
  private extractJSONHeaders(jsonArray: any[]): string[] {
    // Collect all unique keys from all objects
    const keysSet = new Set<string>();
    
    for (const item of jsonArray) {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => keysSet.add(key));
      }
    }
    
    return Array.from(keysSet);
  }
  
  // Access nested object properties using dot notation
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return null;
      }
      current = current[key];
    }
    
    return current;
  }
  
  // Convert data table back to CSV string
  toCSV(data: DataTable, delimiter: string = ','): string {
    const lines: string[] = [];
    
    // Add headers
    lines.push(data.headers.join(delimiter));
    
    // Add data rows
    for (const row of data.rows) {
      const processedRow = row.map(item => {
        const stringValue = String(item);
        // Wrap in quotes if contains delimiter or quotes
        if (stringValue.includes(delimiter) || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      
      lines.push(processedRow.join(delimiter));
    }
    
    return lines.join('\n');
  }
  
  // Convert data table back to JSON string
  toJSON(data: DataTable): string {
    const result = data.rows.map(row => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < data.headers.length; i++) {
        obj[data.headers[i]] = row[i];
      }
      return obj;
    });
    
    return JSON.stringify(result, null, 2);
  }
  
  // Count occurrences of values in a specific column
  countValues(data: DataTable, columnName: string): Record<string, number> {
    const columnIndex = data.headers.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found`);
    }
    
    const counts: Record<string, number> = {};
    
    for (const row of data.rows) {
      const value = String(row[columnIndex]);
      counts[value] = (counts[value] || 0) + 1;
    }
    
    return counts;
  }
  
  // Calculate basic statistics for a numeric column
  calculateStats(data: DataTable, columnName: string): {
    min: number;
    max: number;
    sum: number;
    mean: number;
    count: number;
  } {
    const columnIndex = data.headers.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found`);
    }
    
    const values = data.rows
      .map(row => row[columnIndex])
      .filter(val => typeof val === 'number');
    
    if (values.length === 0) {
      throw new Error(`No numeric values found in column "${columnName}"`);
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    
    return {
      min,
      max,
      sum,
      mean,
      count: values.length
    };
  }
  
  // Filter data by a condition on a column
  filterData(data: DataTable, columnName: string, operator: string, value: any): DataTable {
    const columnIndex = data.headers.indexOf(columnName);
    if (columnIndex === -1) {
      throw new Error(`Column "${columnName}" not found`);
    }
    
    const filteredRows = data.rows.filter(row => {
      const cellValue = row[columnIndex];
      
      switch (operator) {
        case '=': 
        case '==': 
          return cellValue == value;
        case '===':
          return cellValue === value;
        case '!=':
        case '<>':
          return cellValue != value;
        case '>':
          return cellValue > value;
        case '>=':
          return cellValue >= value;
        case '<':
          return cellValue < value;
        case '<=':
          return cellValue <= value;
        case 'contains':
          return String(cellValue).includes(String(value));
        case 'startsWith':
          return String(cellValue).startsWith(String(value));
        case 'endsWith':
          return String(cellValue).endsWith(String(value));
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    });
    
    return {
      headers: data.headers,
      rows: filteredRows,
      originalFormat: data.originalFormat
    };
  }
  
  // Search for a term across all columns
  searchTerm(data: DataTable, searchTerm: string, caseSensitive: boolean = false): DataTable {
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    
    const matchingRows = data.rows.filter(row => {
      return row.some(cell => {
        const cellValue = String(cell);
        return caseSensitive 
          ? cellValue.includes(term)
          : cellValue.toLowerCase().includes(term);
      });
    });
    
    return {
      headers: data.headers,
      rows: matchingRows,
      originalFormat: data.originalFormat
    };
  }
  
  // Add or modify columns in a data table
  addOrModifyColumn(
    data: DataTable, 
    columnName: string, 
    valueFunction: (row: any[], headers: string[], rowIndex: number) => any
  ): DataTable {
    const columnIndex = data.headers.indexOf(columnName);
    const headers = [...data.headers];
    const rows = data.rows.map(row => [...row]);
    
    // If column exists, modify values; otherwise, add new column
    if (columnIndex !== -1) {
      // Modify existing column
      for (let i = 0; i < rows.length; i++) {
        rows[i][columnIndex] = valueFunction(rows[i], headers, i);
      }
    } else {
      // Add new column
      headers.push(columnName);
      for (let i = 0; i < rows.length; i++) {
        rows[i].push(valueFunction(rows[i], headers.slice(0, -1), i));
      }
    }
    
    return {
      headers,
      rows,
      originalFormat: data.originalFormat
    };
  }
  
  // Add or modify multiple columns at once
  enrichData(
    data: DataTable,
    columns: Array<{
      name: string;
      valueFunction: (row: any[], headers: string[], rowIndex: number) => any;
    }>
  ): DataTable {
    let enrichedData = { ...data, headers: [...data.headers], rows: data.rows.map(row => [...row]) };
    
    for (const column of columns) {
      enrichedData = this.addOrModifyColumn(
        enrichedData,
        column.name,
        column.valueFunction
      );
    }
    
    return enrichedData;
  }
  
  // Parse a string expression to a function
  parseExpression(expression: string, fallbackValue: any = null): (row: any[], headers: string[], rowIndex: number) => any {
    try {
      // Handle specific expression types
      // 1. Basic column references: ${columnName}
      // 2. Simple arithmetic: ${columnA} + ${columnB}
      // 3. Row index reference: ${_index}
      // 4. Conditional logic: ${columnA} > 10 ? "High" : "Low"
      
      // Replace column references with array accesses
      const functionBody = expression
        .replace(/\${([^}]+)}/g, (_, columnName) => {
          if (columnName === '_index') {
            return 'rowIndex';
          }
          return `row[headers.indexOf("${columnName}")]`;
        });
      
      // Create and return the function
      // eslint-disable-next-line no-new-func
      return new Function('row', 'headers', 'rowIndex', `
        try {
          return ${functionBody};
        } catch (error) {
          return ${JSON.stringify(fallbackValue)};
        }
      `) as (row: any[], headers: string[], rowIndex: number) => any;
    } catch (error) {
      // Return fallback function
      return () => fallbackValue;
    }
  }
}

// Create a singleton instance for easy import
export const dataAnalyzer = new DataAnalyzer(); 