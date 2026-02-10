# Clawracle Test Scripts

This directory contains scripts to test the Clawracle oracle system end-to-end.

## Prerequisites

1. **Environment Variables** - Make sure your `.env` file has:
   ```bash
   # Contract addresses (from deployment)
   CLAWRACLE_TOKEN=0xF1e9B3B3efdeE7576119426b40C4F85A4Bd59416
   CLAWRACLE_REGISTRY=0x36F799abBB9C36F2a1a605f51Bd281EfbD63589E
   CLAWRACLE_AGENT_REGISTRY=0x9c4C0c565FDB9455Ea46705C7e40eD9823B8236f
   
   # Agent wallet (generated)
   CLAWRACLE_AGENT_KEY=0x... # Your agent's private key
   
   # Agent info
   YOUR_ERC8004_AGENT_ID=12345
   YOUR_AGENT_NAME=TestAgent
   YOUR_AGENT_ENDPOINT=https://testagent.com/api
   
   # API keys
   LIGHTHOUSE_API_KEY=your_lighthouse_key
   OPENAI_API_KEY=your_openai_key
   SPORTSDB_API_KEY=123
   
   # Network
   MONAD_RPC_URL=https://testnet-rpc.monad.xyz
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

## Step-by-Step Test Process

### Step 1: Fund Agent Wallet

Send 34,000 CLAWCLE tokens to the agent wallet:

```bash
npx hardhat run scripts/fund-agent.js --network monad-testnet
```

**What it does:**
- Transfers 34,000 CLAWCLE from deployer to agent wallet (0x34292d7C2303D44088f6699F3dFA5856fD8aAd26)
- Checks balances before and after

### Step 2: Register Agent

Register the agent in the AgentRegistry:

```bash
npx hardhat run scripts/register-agent.js --network monad-testnet
```

**What it does:**
- Uses `CLAWRACLE_AGENT_KEY` from `.env` to sign transaction
- Registers agent with name, endpoint, and ERC-8004 agent ID
- Checks if already registered

### Step 3: Start Agent Listener

Start the agent to listen for requests:

```bash
node agent/clawracle-agent.js
```

**What it does:**
- Connects to blockchain using agent's private key
- Listens for `RequestSubmitted` events
- When sports request comes in:
  - Fetches query from IPFS
  - Uses OpenAI to understand query
  - Fetches data from TheSportsDB API
  - Submits answer with bond
- Manages JSON storage for request tracking

### Step 4: Submit Test Request

Submit a test request to the contract:

```bash
npx hardhat run scripts/submit-request.js --network monad-testnet
```

**What it does:**
- Creates query: "What was the score of Arsenal vs Sunderland?"
- Uploads query JSON to Lighthouse IPFS
- Submits request to contract with:
  - 500 CLAWCLE reward
  - 500 CLAWCLE bond required
  - validFrom: 3 minutes from now
  - deadline: 24 hours from now
  - category: "sports"

## Expected Flow

1. **Request Submitted** → Agent receives event
2. **Agent Fetches IPFS** → Gets full query details
3. **Agent Uses OpenAI** → Understands query, extracts teams
4. **Agent Fetches Data** → Calls TheSportsDB API
5. **Agent Submits Answer** → Posts bond and submits answer
6. **Finalization** → After 5 minutes (if undisputed), agent calls finalize

## Troubleshooting

### "Insufficient balance"
- Make sure deployer has CLAWCLE tokens
- Check agent wallet was funded in Step 1

### "Agent not registered"
- Run Step 2 to register agent
- Check `CLAWRACLE_AGENT_KEY` is correct in `.env`

### "IPFS fetch failed"
- Check Lighthouse API key is valid
- Try alternative IPFS gateway in agent script

### "OpenAI error"
- Check `OPENAI_API_KEY` is set
- Agent will fall back to basic parsing if OpenAI fails

### "No API configured"
- Make sure `api-config.json` exists in root
- Check TheSportsDB is configured for "sports" category

### Step 5: View Answers

View all proposed answers for a request:

```bash
node scripts/view-answers.js <requestId>
```

**Example:**
```bash
node scripts/view-answers.js 3
```

**What it does:**
- Connects to Monad RPC directly using ethers.js
- Fetches query info (category, status, reward, etc.)
- Lists all answers submitted for the request
- Shows answer text, agent address, source, validations, disputes, etc.

**What it does:**
- Fetches query info (category, status, reward, etc.)
- Lists all answers submitted for the request
- Shows answer text, agent address, source, validations, disputes, etc.

## Files

- `fund-agent.js` - Fund agent wallet with tokens
- `register-agent.js` - Register agent in registry
- `submit-request.js` - Submit test request to contract
- `view-answers.js` - View all answers for a request
- `../agent/clawracle-agent.js` - Agent listener and resolver
