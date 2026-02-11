// Clawracle Agent - Listens for requests and resolves them using OpenAI + APIs
const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

// Configuration
const STORAGE_FILE = './agent-storage.json';

// Load API config from multiple possible locations
function loadAPIConfig() {
  const configPaths = [
    './api-config.json',
    './developement/clawracle/api-config.json',
    './guide/api-config.json'
  ];
  
  for (const path of configPaths) {
    try {
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('Could not find api-config.json in any expected location');
}

// Initialize OpenAI (if API key is provided)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Load storage
function loadStorage() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading storage:', error);
  }
  return { trackedRequests: {} };
}

// Save storage
function saveStorage(storage) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));
  } catch (error) {
    console.error('Error saving storage:', error);
  }
}

let storage = loadStorage();
console.log(`Loaded ${Object.keys(storage.trackedRequests).length} tracked requests`);

// Lock to prevent concurrent execution of resolveQuery for the same request
const processingLocks = new Set();

// Setup blockchain connection
// Use WebSocket for event listening (Monad doesn't support eth_newFilter)
const WS_RPC_URL = process.env.MONAD_WS_RPC_URL || 'wss://testnet-rpc.monad.xyz';
const HTTP_RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

// WebSocket provider for event listening
const wsProvider = new ethers.WebSocketProvider(WS_RPC_URL);

// HTTP provider for transactions (more reliable)
const httpProvider = new ethers.JsonRpcProvider(HTTP_RPC_URL);
const wallet = new ethers.Wallet(process.env.CLAWRACLE_AGENT_KEY, httpProvider);

console.log('🤖 Clawracle Agent Starting...');
console.log(`Wallet: ${wallet.address}`);

// Contract addresses
const registryAddress = process.env.CLAWRACLE_REGISTRY || '0x36F799abBB9C36F2a1a605f51Bd281EfbD63589E';
const tokenAddress = process.env.CLAWRACLE_TOKEN || '0xF1e9B3B3efdeE7576119426b40C4F85A4Bd59416';

// Contract ABIs
const registryABI = [
  "event RequestSubmitted(uint256 indexed requestId, address indexed requester, string ipfsCID, string category, uint256 validFrom, uint256 deadline, uint256 reward, uint256 bondRequired)",
  "event AnswerProposed(uint256 indexed requestId, uint256 indexed answerId, address indexed agent, uint256 agentId, bytes answer, uint256 bond)",
  "event AnswerDisputed(uint256 indexed requestId, uint256 indexed answerId, address indexed disputer, uint256 disputerAgentId, bytes disputedAnswer, uint256 bond, uint256 originalAnswerId)",
  "event RequestFinalized(uint256 indexed requestId, uint256 indexed winningAnswerId, address indexed winner, uint256 reward)",
  "function getQuery(uint256 requestId) external view returns (tuple(uint256 requestId, string ipfsCID, uint256 validFrom, uint256 deadline, address requester, string category, uint8 expectedFormat, uint256 bondRequired, uint256 reward, uint8 status, uint256 createdAt, uint256 resolvedAt))",
  "function resolveRequest(uint256 requestId, uint256 agentId, bytes calldata answer, string calldata source, bool isPrivateSource) external",
  "function getAnswers(uint256 requestId) external view returns (tuple(uint256 answerId, uint256 requestId, address agent, uint256 agentId, bytes answer, string source, bool isPrivateSource, uint256 bond, uint256 validations, uint256 disputes, uint256 timestamp, bool isOriginal)[])",
  "function finalizeRequest(uint256 requestId) external"
];

const tokenABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

// Use WebSocket provider for event listening, wallet for transactions
const registry = new ethers.Contract(registryAddress, registryABI, wsProvider);
const registryWithWallet = new ethers.Contract(registryAddress, registryABI, wallet); // For transactions
const token = new ethers.Contract(tokenAddress, tokenABI, wallet);

// Extract CID from various formats (ipfs://, https://ipfs.io/ipfs/, etc.)
function extractCID(cidOrUrl) {
  if (!cidOrUrl) return null;
  
  // Remove ipfs:// prefix
  let cid = cidOrUrl.replace(/^ipfs:\/\//, '');
  
  // Extract from URL patterns
  const urlMatch = cid.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (urlMatch) {
    cid = urlMatch[1];
  }
  
  // Remove any trailing slashes or query params
  cid = cid.split('/')[0].split('?')[0];
  
  return cid;
}

// Fetch query from IPFS (try multiple gateways, ipfs.io is most efficient)
async function fetchIPFS(cidOrUrl) {
  const cid = extractCID(cidOrUrl);
  if (!cid) {
    console.error(`Invalid CID format: ${cidOrUrl}`);
    return null;
  }

  const gateways = [
    `https://ipfs.io/ipfs/${cid}`,  // Primary - most efficient
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
    `https://ipfs.filebase.io/ipfs/${cid}`
  ];

  for (let i = 0; i < gateways.length; i++) {
    const gateway = gateways[i];
    try {
      const response = await axios.get(gateway, { 
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        validateStatus: (status) => status === 200
      });
      
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      // Log first attempt, but don't spam
      if (i === 0) {
        console.log(`   Trying ${gateway}... (${error.response?.status || error.message})`);
      }
      // Try next gateway
      continue;
    }
  }
  
  console.error(`❌ Error fetching IPFS ${cid}: All gateways failed`);
  console.error(`   Tried ${gateways.length} gateways`);
  return null;
}

// Use OpenAI to understand query and extract information
async function understandQuery(query) {
  if (!openai) {
    console.log('⚠️  OpenAI not configured, using basic parsing');
    return { teams: extractTeamsBasic(query), date: extractDateBasic(query) };
  }

  // Get model from env or use default
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  
  try {
    let response;
    let useJsonMode = false;
    
    // Try with JSON mode first (for models that support it)
    try {
      response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a query parser for a sports oracle. Extract teams, dates, and question type from queries. Return ONLY valid JSON with: teams (array), date (YYYY-MM-DD or null), questionType (score, winner, etc). Do not include any text outside the JSON object.'
          },
          {
            role: 'user',
            content: `Parse this query and return JSON: ${query}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });
      useJsonMode = true;
    } catch (jsonError) {
      // Fallback: try without JSON mode (for models that don't support it)
      console.log(`   JSON mode not supported, trying without...`);
      try {
        response = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a query parser for a sports oracle. Extract teams, dates, and question type from queries. You MUST return ONLY valid JSON, no other text. Format: {"teams": ["team1", "team2"], "date": "YYYY-MM-DD or null", "questionType": "score|winner|etc"}'
            },
            {
              role: 'user',
              content: `Parse this query and return ONLY JSON: ${query}`
            }
          ],
          temperature: 0.1
        });
      } catch (fallbackError) {
        console.error('OpenAI API error:', fallbackError.message);
        return { teams: extractTeamsBasic(query), date: extractDateBasic(query) };
      }
    }

    const content = response.choices[0].message.content.trim();
    
    // Robust JSON extraction - handle any format
    let jsonStr = content;
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Extract JSON object (handles text before/after)
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    // Try to parse
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Validate structure
      if (!parsed.teams || !Array.isArray(parsed.teams)) {
        parsed.teams = extractTeamsBasic(query);
      }
      if (!parsed.date) {
        parsed.date = extractDateBasic(query);
      }
      if (!parsed.questionType) {
        parsed.questionType = 'score';
      }
      
      return parsed;
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('   Content:', content.substring(0, 200));
      // Fallback to basic extraction
      return { teams: extractTeamsBasic(query), date: extractDateBasic(query) };
    }
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return { teams: extractTeamsBasic(query), date: extractDateBasic(query) };
  }
}

// Basic extraction fallback
function extractTeamsBasic(query) {
  const queryLower = query.toLowerCase();
  const teams = [];
  const commonTeams = ['arsenal', 'chelsea', 'sunderland', 'liverpool', 'manchester united', 'manchester city'];
  for (const team of commonTeams) {
    if (queryLower.includes(team)) {
      teams.push(team);
    }
  }
  return teams.length >= 2 ? teams : null;
}

function extractDateBasic(query) {
  const dateMatch = query.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch ? dateMatch[1] : null;
}

// Generic LLM-driven data fetching - NO HARDCODED API LOGIC
async function fetchDataForQuery(query, category, apiConfig) {
  if (!openai) {
    console.error('   OpenAI not configured - cannot fetch data dynamically');
    return null;
  }

  // Find API for this category
  const api = apiConfig.apis.find(a => a.category.toLowerCase() === category.toLowerCase());
  if (!api) {
    console.error(`   No API configured for category "${category}"`);
    return null;
  }

  // Read API documentation
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
      console.log(`   Loaded API docs from ${docsPath}`);
      break;
    } catch (error) {
      continue;
    }
  }

  if (!apiDocs) {
    console.error(`   Could not read API docs for ${api.name}`);
    return null;
  }

  // Get API key - use env var, then free key if available, then error if required
  let apiKey = process.env[api.apiKeyEnvVar];
  if (!apiKey) {
    if (api.freeApiKey) {
      apiKey = api.freeApiKey;
      console.log(`   Using free API key: ${apiKey}`);
    } else if (api.apiKeyRequired) {
      console.error(`   API key required but not found: ${api.apiKeyEnvVar}`);
      return null;
    }
  }

  // Use LLM to construct API call based on docs
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  
  try {
    console.log(`   Using LLM to construct API call for ${api.name}...`);
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are an API integration assistant. Your job is to:
1. Understand the user's query - extract CORE keywords (not every word)
2. Read the API documentation provided
3. Construct the appropriate API call(s) to answer the query
4. Return a JSON object with the API call details

CRITICAL RULES FOR QUERY CONSTRUCTION:
1. Extract CORE keywords only (main subjects, key topics) - avoid including every word:
   - Good: "Trump midterm plans" (core: person + topic)
   - Bad: "Trump announce his midterm plans on February" (too many words)
   - Good: "White House ICE polling" (core entities)
   - Bad: "White House deny plans for ICE at polling places" (too specific)

2. DATE HANDLING - ALWAYS use separate date parameters, NEVER put date in query string:
   - If query mentions a date (e.g., "February 9, 2026"), extract it and use "from" and "to" parameters
   - Format: from=YYYY-MM-DD&to=YYYY-MM-DD (use same date for both if single day)
   - NEVER include date in the "q" parameter - dates go in "from"/"to" only
   - Example: Query "Did X happen on Feb 9, 2026?" → q=X&from=2026-02-09&to=2026-02-09

3. Keyword selection:
   - Include main subjects (people, organizations, topics)
   - Include key actions/topics if relevant (e.g., "midterm", "election", "score")
   - Skip common words: "did", "the", "for", "at", "on", "his", "her", etc.
   - Use 3-5 core keywords maximum for better search results

IMPORTANT PRIORITIES:
- If query asks "what was" or "who won", prioritize MOST RECENT match
- If query mentions a specific date, ALWAYS use from/to parameters (not in query string)
- For sports queries, prefer endpoints that return recent/completed matches
- Use endpoints that filter by date when available

API Configuration:
- Name: ${api.name}
- Base URL: ${api.baseUrl}
- API Key Location: ${api.apiKeyLocation}
- API Key: ${apiKey || 'Not required'}
- Free API Key Available: ${api.freeApiKey ? `Yes (${api.freeApiKey})` : 'No'}
- Category: ${api.category}
${api.defaultParams ? `- Default Parameters: ${JSON.stringify(api.defaultParams)} (ALWAYS include these in API calls)` : ''}

API Documentation:
${apiDocs}

Return JSON with this structure:
{
  "method": "GET" or "POST",
  "url": "full URL with parameters",
  "headers": {},
  "body": null or object for POST,
  "steps": ["step1", "step2"] // if multiple API calls needed
}

If multiple API calls are needed, return the first one in "url" and list all steps in "steps" array.
Prioritize endpoints that return recent/completed matches first.`
        },
        {
          role: 'user',
          content: `Query: "${query}"

Construct the API call(s) needed to answer this query using the API documentation above.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const apiCallPlan = JSON.parse(response.choices[0].message.content);
    console.log(`   API call plan: ${apiCallPlan.method} ${apiCallPlan.url}`);

    // Execute the API call
    let apiResponse;
    if (apiCallPlan.method === 'POST') {
      apiResponse = await axios.post(apiCallPlan.url, apiCallPlan.body || {}, {
        headers: apiCallPlan.headers || {}
      });
    } else {
      apiResponse = await axios.get(apiCallPlan.url, {
        headers: apiCallPlan.headers || {}
      });
    }

    // Use LLM to extract answer from API response
    console.log(`   Extracting answer from API response...`);
    
    // Limit response size - only send first 10 articles/results to LLM (to avoid token limits)
    let limitedResponse = apiResponse.data;
    if (apiResponse.data.articles && Array.isArray(apiResponse.data.articles)) {
      limitedResponse = {
        ...apiResponse.data,
        articles: apiResponse.data.articles.slice(0, 10), // Only first 10 articles
        totalResults: apiResponse.data.totalResults // Keep total for context
      };
    } else if (apiResponse.data.event && Array.isArray(apiResponse.data.event)) {
      limitedResponse = {
        ...apiResponse.data,
        event: apiResponse.data.event.slice(0, 10)
      };
    }
    
    const extractResponse = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: `You are a precise data extraction assistant. Extract ONLY the most relevant answer to the user's query from the API response.

CRITICAL RULES:
1. If multiple matches exist, prioritize:
   - The MOST RECENT match (latest date/publishedAt)
   - If query mentions a specific date, prioritize that exact date
   - If query asks "did X happen" or "what did X do", check if it happened
2. Return ONLY ONE answer - be concise and direct
3. For "did X do Y" queries, answer "Yes" or "No" with brief context
4. For "what did X do" queries, return the action/event
5. Do NOT include multiple matches or explanations unless specifically asked
6. Be brief - answer the question directly without extra context

Original Query: "${query}"
API Response: ${JSON.stringify(limitedResponse, null, 2)}

Return JSON:
{
  "answer": "the single most relevant answer (concise, direct)",
  "source": "URL or source of the data",
  "confidence": "high|medium|low"
}

If the API response doesn't contain the answer, return null for answer.`
        },
        {
          role: 'user',
          content: `Extract the SINGLE most relevant answer to: "${query}"

Remember: Prioritize most recent match, be concise, return only one answer.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    // Robust JSON parsing with fallback
    let extracted;
    try {
      const content = extractResponse.choices[0].message.content;
      // Try direct parse first
      extracted = JSON.parse(content);
    } catch (parseError) {
      // If JSON mode fails, try to extract JSON from text
      const content = extractResponse.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extracted = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.log('   Could not parse LLM response as JSON');
          console.log('   LLM response:', content.substring(0, 200));
          return null;
        }
      } else {
        console.log('   Could not find JSON in LLM response');
        return null;
      }
    }
    
    if (!extracted.answer || extracted.answer === 'null' || extracted.answer === null) {
      console.log('   Could not extract answer from API response');
      const articleCount = apiResponse.data.articles?.length || 0;
      const articles = apiResponse.data.articles?.slice(0, 3).map(a => a.title) || [];
      console.log('   Response summary:', {
        status: apiResponse.data.status,
        totalResults: apiResponse.data.totalResults || articleCount,
        articlesReturned: articleCount,
        firstArticles: articles.length > 0 ? articles : ['N/A']
      });
      return null;
    }

    return {
      answer: extracted.answer,
      source: extracted.source || apiCallPlan.url,
      isPrivate: false
    };

  } catch (error) {
    console.error(`   Error in LLM-driven API call: ${error.message}`);
    return null;
  }
}

// Resolve a query
async function resolveQuery(requestId) {
  const requestIdStr = requestId.toString();
  
  // Prevent concurrent execution
  if (processingLocks.has(requestIdStr)) {
    return; // Already processing
  }
  
  // Check if already submitted
  const requestData = storage.trackedRequests[requestIdStr];
  if (!requestData) return;
  
  if (requestData.status === 'PROPOSED' || requestData.status === 'FINALIZED') {
    return; // Already handled
  }
  
  try {
    processingLocks.add(requestIdStr);
    
    // Check timing
    const now = Math.floor(Date.now() / 1000);
    if (now < requestData.validFrom) {
      console.log(`⏳ Too early - validFrom is ${new Date(requestData.validFrom * 1000).toLocaleString()}`);
      processingLocks.delete(requestIdStr);
      return;
    }
    if (now > requestData.deadline) {
      console.log(`❌ Deadline passed`);
      delete storage.trackedRequests[requestIdStr];
      saveStorage(storage);
      processingLocks.delete(requestIdStr);
      return;
    }

    // Fetch from IPFS (with backoff to avoid spam)
    const lastFetchAttempt = requestData.lastFetchAttempt || 0;
    const timeSinceLastAttempt = now - lastFetchAttempt;
    
    // Only retry IPFS every 30 seconds if it failed
    if (timeSinceLastAttempt < 30 && requestData.ipfsFetchFailed) {
      return; // Skip this attempt, will retry later
    }
    
    console.log(`📥 Fetching query from IPFS: ${requestData.ipfsCID}`);
    requestData.lastFetchAttempt = now;
    saveStorage(storage);
    
    const queryData = await fetchIPFS(requestData.ipfsCID);
    if (!queryData) {
      requestData.ipfsFetchFailed = true;
      saveStorage(storage);
      return; // Will retry in 30 seconds
    }
    
    // Success - clear failure flag
    delete requestData.ipfsFetchFailed;
    delete requestData.lastFetchAttempt;
    saveStorage(storage);

    console.log(`Query: "${queryData.query}"`);

    // Load API config
    const apiConfig = loadAPIConfig();
    
    // Fetch data using LLM-driven generic function (works for ANY category/API)
    console.log(`   Fetching data for category: ${requestData.category}`);
    const result = await fetchDataForQuery(queryData.query, requestData.category, apiConfig);

    if (!result) {
      console.log('❌ Could not fetch data');
      return;
    }

    console.log(`✅ Found answer: "${result.answer}"`);

    // Approve bond
    const bondAmount = BigInt(requestData.bondRequired);
    const balance = await token.balanceOf(wallet.address);
    if (balance < bondAmount) {
      console.error('❌ Insufficient CLAWCLE balance for bond');
      return;
    }

    console.log('💰 Approving bond...');
    const approveTx = await token.approve(registryAddress, bondAmount);
    await approveTx.wait();

    // Submit answer
    const encodedAnswer = ethers.toUtf8Bytes(result.answer);
    const agentId = process.env.YOUR_ERC8004_AGENT_ID || '12345';
    
    console.log('📝 Submitting resolution...');
    const resolveTx = await registryWithWallet.resolveRequest(
      requestId,
      agentId,
      encodedAnswer,
      result.source,
      result.isPrivate || false
    );

    console.log('⏳ Waiting for confirmation... tx:', resolveTx.hash);
    const receipt = await resolveTx.wait();

    // Get answer ID
    const answers = await registryWithWallet.getAnswers(requestId);
    const myAnswerId = answers.length - 1;

    // Update storage
    requestData.myAnswerId = myAnswerId;
    requestData.status = 'PROPOSED';
    requestData.resolvedAt = Math.floor(Date.now() / 1000);
    requestData.finalizationTime = requestData.resolvedAt + 300; // 5 minutes
    saveStorage(storage);

    console.log(`✅ Resolution submitted! Answer ID: ${myAnswerId}`);
  } catch (error) {
    console.error('Error resolving query:', error.message);
  } finally {
    processingLocks.delete(requestIdStr);
  }
}

// Event listeners
registry.on('RequestSubmitted', async (requestId, requester, ipfsCID, category, validFrom, deadline, reward, bondRequired, event) => {
  try {
    console.log(`\n🔔 New Request #${requestId}`);
    console.log(`Category: ${category}`);
    console.log(`Reward: ${ethers.formatEther(reward)} CLAWCLE`);
    console.log(`Valid From: ${new Date(Number(validFrom) * 1000).toLocaleString()}`);
    console.log(`Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`);

    // Check if we can answer (any category with configured API)
    const apiConfig = loadAPIConfig();
    const api = apiConfig.apis.find(a => a.category.toLowerCase() === category.toLowerCase());
    
    if (api) {
      console.log(`✅ I can answer this! (${api.name} API configured)`);
      console.log('   Storing for processing...');
      storage.trackedRequests[requestId.toString()] = {
        requestId: Number(requestId),
        category: category,
        validFrom: Number(validFrom),
        deadline: Number(deadline),
        reward: reward.toString(),
        bondRequired: bondRequired.toString(),
        ipfsCID: ipfsCID,
        status: 'PENDING',
        myAnswerId: null,
        resolvedAt: null,
        finalizationTime: null,
        isDisputed: false
      };
      saveStorage(storage);
    } else {
      console.log(`❌ Cannot answer - no API configured for category "${category}"`);
    }
  } catch (error) {
    console.error(`Error handling RequestSubmitted event:`, error.message);
    // Don't crash - continue listening for other events
  }
});

registry.on('AnswerProposed', async (requestId, answerId, agent, agentId, answer, bond, event) => {
  try {
    const requestData = storage.trackedRequests[requestId.toString()];
    if (!requestData) return;

    if (agent.toLowerCase() === wallet.address.toLowerCase()) {
      requestData.myAnswerId = Number(answerId);
      requestData.status = 'PROPOSED';
      requestData.resolvedAt = Math.floor(Date.now() / 1000);
      requestData.finalizationTime = requestData.resolvedAt + 300;
      saveStorage(storage);
      console.log(`✅ My answer #${answerId} proposed`);
    }
  } catch (error) {
    console.error(`Error handling AnswerProposed event:`, error.message);
    // Don't crash - continue listening
  }
});

registry.on('AnswerDisputed', async (requestId, answerId, disputer, disputerAgentId, disputedAnswer, bond, originalAnswerId, event) => {
  try {
    const requestData = storage.trackedRequests[requestId.toString()];
    if (!requestData) return;

    requestData.status = 'DISPUTED';
    requestData.isDisputed = true;
    if (requestData.resolvedAt) {
      requestData.finalizationTime = requestData.resolvedAt + 600; // 10 minutes
    }
    saveStorage(storage);
    console.log(`🔥 Request #${requestId} disputed`);
  } catch (error) {
    console.error(`Error handling AnswerDisputed event:`, error.message);
    // Don't crash - continue listening
  }
});

registry.on('RequestFinalized', async (requestId, winningAnswerId, winner, reward, event) => {
  try {
    if (winner.toLowerCase() === wallet.address.toLowerCase()) {
      console.log(`\n🎉 YOU WON Request #${requestId}!`);
      console.log(`💰 Reward: ${ethers.formatEther(reward)} CLAWCLE`);
    }
    delete storage.trackedRequests[requestId.toString()];
    saveStorage(storage);
  } catch (error) {
    console.error(`Error handling RequestFinalized event:`, error.message);
    // Don't crash - continue listening
  }
});

// Periodic check for pending requests
setInterval(async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    for (const requestId in storage.trackedRequests) {
      const requestData = storage.trackedRequests[requestId];
      
      // Only process PENDING requests that haven't been submitted yet
      if (requestData.status === 'PENDING' &&
          now >= requestData.validFrom &&
          now <= requestData.deadline &&
          (requestData.myAnswerId === null || requestData.myAnswerId === undefined) &&
          !processingLocks.has(requestId)) {
        // Don't await - let it run in background, lock prevents duplicates
        resolveQuery(Number(requestId)).catch(err => {
          console.error(`Error in resolveQuery for ${requestId}:`, err.message);
          // Release lock on error
          processingLocks.delete(requestId.toString());
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between checks
      }
    }
  } catch (error) {
    console.error('Error in periodic check:', error.message);
    // Don't crash - continue checking
  }
}, 2000); // Check every 2 seconds

// WebSocket error handling
wsProvider.on('error', (error) => {
  console.error('⚠️  WebSocket error:', error.message);
  // WebSocket provider will handle reconnection automatically
});

// Note: WebSocketProvider in ethers.js v6 handles reconnection automatically
// Events continue to work even if connection temporarily drops

console.log('\n👂 Listening for requests via WebSocket...\n');
console.log('   WebSocket URL:', WS_RPC_URL);
console.log('   (Press Ctrl+C to stop)\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing WebSocket connection...');
  try {
    wsProvider.destroy();
  } catch (error) {
    // Ignore errors during shutdown
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught error:', error.message);
  // Don't exit - continue running
});
