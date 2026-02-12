# Agent-Driven API Integration Guide

## Overview

This skill uses **fully agent-driven API integration** - no hardcoded API logic, no external LLM services. **YOU (the agent) should:**

1. Read `api-config.json` to find API for category
2. Read API documentation files from `api-docs/`
3. Construct API calls dynamically based on docs yourself
4. Execute the HTTP requests directly
5. Extract answers from responses yourself

**CRITICAL**: Do NOT call external LLM APIs (like OpenAI). YOU are the LLM - read the config/docs and execute the calls yourself.

**Default Capability**: This skill ships with sports oracle (TheSportsDB API pre-configured). For other categories, your owner must configure APIs and provide documentation.

## API Configuration System

### Structure

```
clawracle-resolver/
├── api-config.json        (API configuration mapping)
└── api-docs/             (API documentation directory)
    ├── thesportsdb.md     (TheSportsDB API docs)
    ├── newsapi.md         (NewsAPI docs)
    ├── openweather.md     (OpenWeather API docs)
    └── ...
```

### How to Access API Information

#### Step 1: Read API Configuration

When a request comes in with a `category` string (e.g., "sports", "market", "politics"), read `api-config.json` to find which API handles that category:

```javascript
const fs = require('fs');
const apiConfig = JSON.parse(fs.readFileSync('./api-config.json', 'utf8'));

// Find API for category "sports"
const sportsAPI = apiConfig.apis.find(api => api.category === "sports");
// Result: { name: "TheSportsDB", docsFile: "api-docs/thesportsdb.md", ... }
```

#### Step 2: Read API Documentation

Once you know which API to use, read its documentation file:

```javascript
const docsPath = `./${sportsAPI.docsFile}`;
const apiDocs = fs.readFileSync(docsPath, 'utf8');
// Now you have the full API documentation to understand endpoints, parameters, etc.
```

#### Step 3: Get API Key from Environment

Read the API key from `.env` using the `apiKeyEnvVar`:

```javascript
require('dotenv').config();
const apiKey = process.env[sportsAPI.apiKeyEnvVar];
// For TheSportsDB: process.env.SPORTSDB_API_KEY

// Fallback to free key if available
if (!apiKey && sportsAPI.freeApiKey) {
  apiKey = sportsAPI.freeApiKey;
}
```

#### Step 4: YOU Construct and Execute the API Call

**CRITICAL**: Do NOT hardcode API call construction. Do NOT call external LLM APIs. **YOU should:**

1. Read and understand the API documentation yourself
2. Parse the natural language query yourself
3. Construct the API call based on the docs yourself
4. Execute the HTTP request directly (using axios, fetch, etc.)
5. Extract the answer from the response yourself

## How YOU Should Construct API Calls

When constructing API calls, consider:
- The user's query
- The API documentation (from `api.docsFile`)
- API configuration (baseUrl, apiKey, apiKeyLocation, etc.)
- **Default Parameters** (if `api.defaultParams` exists) - ALWAYS include these in API calls

Construct a JSON object with:
```json
{
  "method": "GET" or "POST",
  "url": "full URL with parameters",
  "headers": {},
  "body": null or object for POST
}
```

### Example: How YOU Should Think About API Calls

When you receive a query, YOU should:
1. Understand the user's query - extract CORE keywords (not every word)
2. Read the API documentation provided
3. Construct the appropriate API call(s) to answer the query
4. Follow the General API Integration Rulebook (date handling, keyword extraction, pagination, etc.)

IMPORTANT PRIORITIES:
- If query asks "what was" or "who won", prioritize MOST RECENT match
- If query mentions a specific date, ALWAYS use from/to or date parameters (not in query string)
- Extract CORE keywords only (3-5 keywords max) - skip common words
- Use pagination/limiting parameters to keep responses manageable
- For sports queries, prefer endpoints that return recent/completed matches
- Use endpoints that filter by date when available

API Configuration:
- Name: {api.name}
- Base URL: {api.baseUrl}
- API Key Location: {api.apiKeyLocation}
- API Key: {apiKey}
- Free API Key Available: {api.freeApiKey ? `Yes (${api.freeApiKey})` : 'No'}
- Category: {api.category}
- Default Parameters: {api.defaultParams ? JSON.stringify(api.defaultParams) + ' (ALWAYS include these in API calls)' : 'None'}

API Documentation:
{apiDocs}

User Query: "{query}"

Return JSON with the API call details:
{
  "method": "GET" or "POST",
  "url": "full URL with parameters",
  "headers": {},
  "body": null or object for POST
}
```

## General API Integration Rulebook

**IMPORTANT**: These are universal rules that apply to ALL APIs. Follow these patterns when constructing API calls for any API, regardless of which one it is.

### 1. Date/Time Parameter Handling

**Rule**: If the query mentions a date/time AND the API documentation shows date/time parameters, ALWAYS use those parameters (never put dates in query strings).

- **Extract dates from query**: Look for dates in any format (e.g., "February 9, 2026", "2026-02-09", "Feb 9", "yesterday", "last week")
- **Check API docs for date params**: Look for parameters like `from`, `to`, `date`, `startDate`, `endDate`, `since`, `until`, `publishedAt`, etc.
- **Use separate date parameters**: If API has `from`/`to` or similar, use them. Format dates as required by the API (usually `YYYY-MM-DD` or ISO 8601)
- **Never put dates in query strings**: Don't include dates in the `q` or search parameter - use dedicated date parameters
- **Example**: Query "Did X happen on Feb 9, 2026?" with API that has `from`/`to` → Use `q=X&from=2026-02-09&to=2026-02-09`

### 2. Query String Construction (Keyword Filtering)

**Rule**: Extract CORE keywords only - avoid including every word from the query.

- **Extract main subjects**: People, organizations, topics, entities
- **Include key actions/topics**: Only if they're essential to the query (e.g., "midterm", "election", "score", "price")
- **Skip common words**: Articles, prepositions, common verbs ("did", "the", "for", "at", "on", "his", "her", "was", "were", etc.)
- **Use 3-5 core keywords maximum**: More keywords = narrower search = fewer results
- **Examples**:
  - Query: "Did Trump announce his midterm plans?" → Keywords: `Trump midterm plans` (not "Trump announce his midterm plans")
  - Query: "What was the score of Arsenal vs Sunderland?" → Keywords: `Arsenal Sunderland score` (not "What was the score of Arsenal vs Sunderland")
  - Query: "Did the White House deny plans for ICE at polling places?" → Keywords: `White House ICE polling` (not every word)

### 3. Pagination and Result Limiting

**Rule**: If the API documentation shows pagination/limiting parameters, use them to keep responses manageable.

- **Look for pagination params**: `pageSize`, `limit`, `per_page`, `maxResults`, `count`, etc.
- **Use reasonable limits**: Default to 5-10 results unless query specifically needs more
- **Check API defaults**: Some APIs default to 20-100 results which may be too many
- **Purpose**: Keeps API responses small, improves processing speed

### 4. Parameter Location (API Keys, Auth)

**Rule**: Follow the API documentation exactly for where parameters go.

- **API Key location**: Check `apiKeyLocation` in config - could be `header`, `query_param`, or `url_path`
- **Header parameters**: Use `headers` object for API keys, auth tokens, content-type, etc.
- **Query parameters**: Use URL query string for filters, search terms, pagination
- **URL path parameters**: Some APIs require keys in the path (e.g., `/api/v1/{API_KEY}/endpoint`)
- **Body parameters**: For POST requests, use request body (usually JSON)

### 5. Error Handling and Fallbacks

**Rule**: Always check API responses for errors and handle gracefully.

- **Check response status**: Look for `status`, `error`, `code`, `message` fields
- **Handle empty results**: If `totalResults: 0` or empty arrays, the answer may not exist in the API
- **Rate limiting**: If you get 429 errors, the API is rate-limited (wait before retry)
- **Invalid parameters**: If you get 400 errors, check parameter format/values
- **Network errors**: Retry with exponential backoff for transient failures

### 6. Response Processing

**Rule**: Process API responses intelligently based on structure.

- **Check response structure**: Look for `data`, `results`, `articles`, `items`, etc. - structure varies by API
- **Handle arrays vs objects**: Some APIs return arrays directly, others wrap in objects
- **Extract relevant fields**: Focus on fields that answer the query (title, description, content, score, price, etc.)
- **Prioritize recent data**: If multiple results, prioritize most recent (check `publishedAt`, `date`, `timestamp` fields)
- **Date-specific queries**: If query asks about a specific date, filter results to that date even if API returned more

### 7. Multiple API Calls (If Needed)

**Rule**: Some queries may require multiple API calls - construct them sequentially.

- **Identify dependencies**: If you need data from one call to make another, do them in order
- **Example**: First call gets team ID, second call gets team details using that ID
- **Return first call in main response**: If multiple calls needed, return the first one in the main `url` field
- **List steps**: Use `steps` array to document all API calls needed

## How YOU Should Extract Answers

After making the API call, YOU should extract a concise answer yourself:

**Guidelines:**
1. Read the API response
2. Understand the user's query
3. Extract a SINGLE, CONCISE answer (1-2 sentences max)
4. Prioritize recent/relevant data if multiple results
5. If query asks about a specific date, only use data from that date
6. Return ONLY the answer as a plain string (no JSON, no explanation, just the answer)
7. If the answer cannot be found in the response, return "Could not find answer in API response"

**Example:**
- Query: "What was the score of Arsenal vs Chelsea?"
- API Response: `{ "matches": [{ "homeTeam": "Arsenal", "awayTeam": "Chelsea", "score": "2-1" }] }`
- YOU extract: "Arsenal 2-1 Chelsea"

## Complete Agent-Driven Example

```javascript
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Generic agent-driven function - works for ANY API/category
// YOU (the agent) should implement this logic yourself
async function fetchDataForQuery(query, category, apiConfig) {
  // 1. Find API for this category
  const api = apiConfig.apis.find(a => a.category.toLowerCase() === category.toLowerCase());
  if (!api) {
    throw new Error(`No API configured for category "${category}"`);
  }
  
  // 2. Read API documentation (check multiple paths)
  const docsPaths = [
    api.docsFile,
    `./${api.docsFile}`,
    `./developement/clawracle/${api.docsFile}`,
    `./guide/${api.docsFile}`
  ];
  
  let apiDocs = '';
  for (const docsPath of docsPaths) {
    try {
      apiDocs = fs.readFileSync(docsPath, 'utf8');
      break;
    } catch (error) {
      continue;
    }
  }
  
  if (!apiDocs) {
    throw new Error(`Could not read API docs for ${api.name}`);
  }
  
  // 3. Get API key
  let apiKey = process.env[api.apiKeyEnvVar];
  if (!apiKey && api.freeApiKey) {
    apiKey = api.freeApiKey;
  }
  
  // 4. YOU construct the API call yourself
  // Read the API docs, understand the query, build the URL/params
  // Example: Based on query and API docs, construct:
  const apiCallPlan = {
    method: "GET",
    url: `${api.baseUrl}/endpoint?param1=value1&param2=value2`,
    headers: {},
    body: null
  };
  
  // 5. Execute API call directly (YOU make the HTTP request)
  const response = await axios({
    method: apiCallPlan.method,
    url: apiCallPlan.url,
    headers: apiCallPlan.headers || {},
    data: apiCallPlan.body || null
  });
  
  // 6. YOU extract the answer yourself from the API response
  // Parse the response and find the relevant answer
  // Example: Extract the most relevant field from response.data based on the query
  const answer = extractAnswerFromResponse(response.data, query);
  
  return {
    answer,
    source: api.name,
    isPrivate: false
  };
}
```

## Adding a New API

1. **Add API documentation**: Create `api-docs/your-api.md` with full API documentation
2. **Update `api-config.json`**: Add entry with:
   ```json
   {
     "name": "YourAPI",
     "category": "your-category",
     "docsFile": "api-docs/your-api.md",
     "apiKeyEnvVar": "YOUR_API_KEY",
     "apiKeyRequired": true,
     "apiKeyLocation": "query_param",
     "baseUrl": "https://api.example.com",
     "description": "What this API provides",
     "defaultParams": {
       "param": "value"
     },
     "capabilities": [
       "Feature 1",
       "Feature 2"
     ]
   }
   ```
3. **Add API key to `.env`**: `YOUR_API_KEY=your_key_here`
4. **Test**: YOU will automatically use the new API when queries match the category

## Default Parameters

Some APIs have default parameters that should always be included. For example, OpenWeather uses `units: "metric"` to return Celsius instead of Kelvin.

These are specified in `api-config.json` as `defaultParams`:

```json
{
  "name": "OpenWeather",
  "defaultParams": {
    "units": "metric"
  }
}
```

**IMPORTANT**: When constructing API calls, ALWAYS include these default parameters. Make sure YOU include them when building the API call.
