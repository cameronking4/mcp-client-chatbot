# Custom MCP Server with Scratchpad Resources

This is a custom Model Context Protocol (MCP) server that implements resources and tools for managing and retrieving data from a scratchpad memory store, along with additional utility functions.

## MCP Resources

Resources in MCP are read-only, addressable content entities that provide context to language models. This server implements the following resources:

### 1. List Available Namespaces

- **URI:** `scratchpad://namespaces`
- **Description:** Returns a list of all namespaces in the scratchpad
- **Output Format:** JSON object with a `namespaces` array

### 2. List Keys in a Namespace

- **URI Template:** `scratchpad://{namespace}/keys`
- **Description:** Returns all keys stored in a specific namespace
- **Parameters:**
  - `{namespace}`: The namespace to list keys from
- **Output Format:** JSON object with a `keys` array

### 3. Get Value by Key

- **URI Template:** `scratchpad://{namespace}/{key}`
- **Description:** Returns the value stored at a specific key in a namespace
- **Parameters:**
  - `{namespace}`: The namespace containing the key
  - `{key}`: The key to retrieve
- **Output Format:** JSON string (or whatever format was stored)

## MCP Tools

Tools in MCP are actionable functions that can be called to perform operations. This server implements the following tools:

### 1. Scratchpad Memory

- **Name:** `scratchpad_memory`
- **Description:** Store and retrieve information in a persistent scratchpad
- **Parameters:**
  - `action`: Operation to perform (`get`, `store`, `list`, or `delete`)
  - `key`: (optional) The key to operate on
  - `value`: (optional) The value to store
  - `namespaceId`: (optional, default: "default") The namespace to operate in

### 2. Weather Information

- **Name:** `get_weather`
- **Description:** Get the current weather at a location
- **Parameters:**
  - `latitude`: Latitude coordinate
  - `longitude`: Longitude coordinate

### 3. Data Analysis Tools

Several data analysis tools are also available:
- `data_parse`: Parse CSV or JSON data
- `data_count_values`: Count occurrences in a column
- `data_statistics`: Calculate statistics for numeric columns
- And more...

## Usage Examples

### Storing and Retrieving Data

1. Store data using the tool:
   ```
   Call tool: scratchpad_memory
   Parameters: { "action": "store", "namespaceId": "contacts", "key": "alice", "value": "Alice Smith, alice@example.com" }
   ```

2. Access the data as a resource:
   ```
   Read resource: scratchpad://contacts/alice
   ```

3. List all keys in a namespace:
   ```
   Read resource: scratchpad://contacts/keys
   ```

### Working with Data

1. Parse CSV data:
   ```
   Call tool: data_parse
   Parameters: { "data": "name,age\nAlice,30\nBob,25", "format": "csv", "saveToNamespace": "people", "saveToKey": "employees" }
   ```

2. Access parsed data as a resource:
   ```
   Read resource: scratchpad://people/employees
   ```

3. Calculate statistics:
   ```
   Call tool: data_statistics
   Parameters: { "namespaceId": "people", "key": "employees", "columnName": "age" }
   ```

## Implementation Details

The scratchpad is implemented with an in-memory store that persists for the duration of the server session. Data is organized by namespaces and keys, providing isolation between different types of data.

Resources follow the official MCP protocol and are designed to provide read-only access to data, while tools allow modification and processing of that data.

## Protocol Compliance

This implementation follows the Model Context Protocol (MCP) specification, with resources and tools designed according to the protocol's expectations:

- Resources are read-only and identified by URIs
- Resource templates allow for parameterized access
- Tools provide actions with defined input schemas
- Error handling follows the protocol's recommendations 