# Custom MCP Server

This MCP server implements custom tools for use with your AI models.

## Features

### Weather API

The `get_weather` tool provides current weather information for a given location.

```javascript
// Example usage in model prompt:
// To check the weather in New York
await get_weather({ latitude: 40.7128, longitude: -74.0060 });
```

### Scratchpad Memory

The `scratchpad_memory` tool enables semi-persistent storage and retrieval of information across conversations.

#### Features:
- Store and retrieve text data with key-value pairs
- List all stored keys
- Delete specific entries
- Namespace isolation (create isolated storage spaces with a unique ID)

#### Usage:

```javascript
// Store information
await scratchpad_memory({
  action: "store",
  namespaceId: "conversation-123", // Or any unique identifier
  key: "important_info",
  value: "This is very important information I need to remember"
});

// Retrieve information
const info = await scratchpad_memory({
  action: "get",
  namespaceId: "conversation-123",
  key: "important_info"
});

// List all stored keys
const allKeys = await scratchpad_memory({
  action: "list",
  namespaceId: "conversation-123"
});

// Delete an entry
await scratchpad_memory({
  action: "delete",
  namespaceId: "conversation-123",
  key: "important_info"
});

// Using default namespace
await scratchpad_memory({
  action: "store",
  key: "global_setting",
  value: "Some global value"
});
```

## Data Analysis Tools

The custom MCP server now includes a suite of tools for analyzing CSV and JSON data:

### Data Parse (`data_parse`)
Parses CSV or JSON data into a structured format for analysis and optionally saves it to scratchpad memory.

**Parameters:**
- `data`: String containing the CSV or JSON data to parse
- `format`: The format of the data (`"csv"` or `"json"`)
- `delimiter`: (Optional) The delimiter for CSV data (default: ',')
- `saveToNamespace`: (Optional) Namespace to save the parsed data
- `saveToKey`: (Optional) Key to save the parsed data under

**Example:**
```
Tool: data_parse
Parameters:
  data: "id,name,age\n1,Alice,28\n2,Bob,34\n3,Charlie,42"
  format: "csv"
  delimiter: ","
  saveToNamespace: "mydata"
  saveToKey: "people"
```

### Count Values (`data_count_values`)
Counts occurrences of values in a specific column or field.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `columnName`: The name of the column/field to analyze

**Example:**
```
Tool: data_count_values
Parameters:
  namespaceId: "mydata"
  key: "people"
  columnName: "age"
```

### Calculate Statistics (`data_statistics`)
Calculates basic statistics for a numeric column (min, max, sum, mean, count).

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `columnName`: The name of the numeric column to analyze

**Example:**
```
Tool: data_statistics
Parameters:
  namespaceId: "mydata"
  key: "people"
  columnName: "age"
```

### Search Data (`data_search`)
Searches for rows containing a specific term across all columns or in a specified column.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `searchTerm`: The term to search for
- `columnName`: (Optional) Limit search to this column
- `caseSensitive`: (Optional) Whether the search should be case sensitive (default: false)
- `saveResultToKey`: (Optional) Save results to this key in the same namespace

**Example:**
```
Tool: data_search
Parameters:
  namespaceId: "mydata"
  key: "people"
  searchTerm: "Alice"
  saveResultToKey: "search_results"
```

### Filter Data (`data_filter`)
Filters data by a condition on a column.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `columnName`: The name of the column to filter on
- `operator`: The comparison operator ("=", "!=", ">", ">=", "<", "<=", "contains", "startsWith", "endsWith")
- `value`: The value to compare against
- `saveResultToKey`: (Optional) Save results to this key in the same namespace

**Example:**
```
Tool: data_filter
Parameters:
  namespaceId: "mydata"
  key: "people"
  columnName: "age"
  operator: ">"
  value: 30
  saveResultToKey: "older_people"
```

### Visualize Data (`data_visualize`)
Generates a simple text-based visualization for a column.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `columnName`: The name of the column to visualize
- `type`: The type of visualization (currently only "histogram")
- `buckets`: (Optional) Number of buckets for histogram (default: 10)

**Example:**
```
Tool: data_visualize
Parameters:
  namespaceId: "mydata"
  key: "people"
  columnName: "age"
  type: "histogram"
  buckets: 5
```

### Export Data (`data_export`)
Exports data to CSV or JSON format.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `format`: The format to export to ("csv" or "json")
- `delimiter`: (Optional) The delimiter for CSV format (default: ",")

**Example:**
```
Tool: data_export
Parameters:
  namespaceId: "mydata"
  key: "people"
  format: "json"
```

## Usage Workflow Example

1. Parse your data:
```
Tool: data_parse
Parameters:
  data: "id,name,age,city\n1,Alice,28,New York\n2,Bob,34,Chicago\n3,Charlie,42,Los Angeles"
  format: "csv"
  saveToNamespace: "analysis"
  saveToKey: "people"
```

2. Count values in a column:
```
Tool: data_count_values
Parameters:
  namespaceId: "analysis"
  key: "people"
  columnName: "city"
```

3. Filter data:
```
Tool: data_filter
Parameters:
  namespaceId: "analysis"
  key: "people"
  columnName: "age"
  operator: ">"
  value: 30
  saveResultToKey: "older_people"
```

4. Export filtered data:
```
Tool: data_export
Parameters:
  namespaceId: "analysis"
  key: "older_people"
  format: "json"
```
### Export Data (`data_export`)
Exports data to CSV or JSON format.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `format`: The format to export to ("csv" or "json")
- `delimiter`: (Optional) The delimiter for CSV format (default: ",")

**Example:**
```
Tool: data_export
Parameters:
  namespaceId: "mydata"
  key: "people"
  format: "json"
```

### Enrich Data (`data_enrich`)
Add or modify columns in a dataset while maintaining the original structure.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `columns`: Array of column configurations to add or modify
  - `name`: Name of the column to add or modify
  - `expression`: Expression to calculate the column value
  - `fallbackValue`: (Optional) Fallback value if expression evaluation fails
- `saveResultToKey`: (Optional) Save enriched data to this key in the same namespace

**Expressions:**
- Reference other columns using `${columnName}` syntax
- Use `${_index}` to access the current row index (0-based)
- Expressions support arithmetic operations, conditional logic, and more
- Examples:
  - `${age} + 1` - Add 1 to the "age" column
  - `${price} * ${quantity}` - Multiply "price" by "quantity"
  - `${_index}` - Use the row index as the value
  - `${age} > 30 ? "Adult" : "Young"` - Conditional expression

**Example:**
```
Tool: data_enrich
Parameters:
  namespaceId: "mydata"
  key: "people"
  columns: [
    {
      "name": "ageGroup",
      "expression": "${age} >= 40 ? 'Senior' : (${age} >= 30 ? 'Adult' : 'Young')",
      "fallbackValue": "Unknown"
    },
    {
      "name": "fullName",
      "expression": "${firstName} + ' ' + ${lastName}"
    },
    {
      "name": "rowNumber",
      "expression": "${_index} + 1"
    }
  ]
  saveResultToKey: "people_enriched"
```

### LLM Enrich Data (`data_llm_enrich`)
Enrich data by adding or modifying columns with AI-generated content based on existing row data.

**Parameters:**
- `namespaceId`: The namespace where the data is stored
- `key`: The key under which the data is stored
- `columns`: Array of column configurations to add or modify with AI-generated content
  - `name`: Name of the column to add or modify
  - `prompt`: Prompt template for the LLM to generate content
  - `maxTokens`: (Optional) Maximum tokens for the generated content (default: 100)
  - `fallbackValue`: (Optional) Fallback value if LLM generation fails
- `saveResultToKey`: (Optional) Save enriched data to this key in the same namespace
- `sampleSize`: (Optional) Number of rows to process (0 means all rows, default: 0)

**Prompt Templates:**
- Reference column values using `{{columnName}}` syntax in your prompts
- The prompt will be customized for each row using its specific values
- Example: "Summarize the customer profile: {{name}} is {{age}} years old and lives in {{city}}"

**Example:**
```
Tool: data_llm_enrich
Parameters:
  namespaceId: "mydata"
  key: "products"
  columns: [
    {
      "name": "productDescription",
      "prompt": "Write a compelling product description for {{productName}} which costs {{price}} dollars. It belongs to the {{category}} category.",
      "maxTokens": 200,
      "fallbackValue": "No description available"
    },
    {
      "name": "marketingTagline",
      "prompt": "Create a short, catchy marketing tagline for {{productName}}.",
      "maxTokens": 50
    }
  ],
  "sampleSize": 10,
  "saveResultToKey": "products_with_ai_content"
```

## Usage Workflow Example

// ... existing code ...

3. Filter data:
```
Tool: data_filter
Parameters:
  namespaceId: "analysis"
  key: "people"
  columnName: "age"
  operator: ">"
  value: 30
  saveResultToKey: "older_people"
```

4. Enrich the filtered data with a new column:
```
Tool: data_enrich
Parameters:
  namespaceId: "analysis"
  key: "older_people"
  columns: [
    {
      "name": "ageCategory",
      "expression": "${age} >= 40 ? 'Middle-aged' : 'Adult'",
      "fallbackValue": "Unknown"
    }
  ]
  saveResultToKey: "older_people_enriched"
```

5. Add AI-generated content:
```
Tool: data_llm_enrich
Parameters:
  namespaceId: "analysis"
  key: "older_people_enriched"
  columns: [
    {
      "name": "personalizedMessage",
      "prompt": "Write a personalized health recommendation for {{name}}, who is {{age}} years old and lives in {{city}}.",
      "maxTokens": 150
    }
  ]
  saveResultToKey: "older_people_with_recommendations"
```

6. Export the enriched data:
```
Tool: data_export
Parameters:
  namespaceId: "analysis"
  key: "older_people_with_recommendations"
  format: "json"
```

// ... existing code ... 

## Implementation Details

The scratchpad memory feature implements a simple but flexible storage system with namespace isolation.

### Current Implementation
- Uses an in-memory Map with namespace-prefixed keys
- Data persists only for the lifetime of the server
- Provides namespace isolation through the namespaceId parameter
- If no namespaceId is provided, uses a "default" namespace

### Usage Tips
- Use consistent namespaceId values to maintain isolation
- Consider using conversation IDs, user IDs, or session IDs as namespaceIds
- For global/shared information, omit the namespaceId parameter to use the default namespace

## Development

To run the server:

```bash
npm start
``` 