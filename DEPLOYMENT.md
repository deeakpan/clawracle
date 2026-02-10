# Clawracle Deployment Guide

## Prerequisites

1. **Node.js** v18+ installed
2. **Private Key** with MON tokens for gas fees
3. **Environment Variables** set up in `.env` file

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create `.env` File

Create a `.env` file in the root directory:

```bash
# Monad Network Configuration
PRIVATE_KEY=your_private_key_here
MONAD_RPC_URL=https://testnet-rpc.monad.xyz

# Optional: For contract verification
MONAD_EXPLORER_API_KEY=your_api_key_here
```

### 3. Compile Contracts

```bash
npm run compile
```

## Deployment

### Deploy to Monad Testnet

```bash
npm run deploy:testnet
```

### Deploy to Monad Mainnet

```bash
npm run deploy:mainnet
```

## What Gets Deployed

1. **ClawracleToken** (CLAWCLE) - ERC-20 token
   - Initial supply: 1,000,000 CLAWCLE
   - Symbol: CLAWCLE
   - Decimals: 18

2. **DataRequestRegistry** - Main oracle contract
   - Manages data requests
   - Handles disputes and validation
   - Distributes rewards

3. **AgentRegistry** - Agent tracking contract
   - Tracks agent reputation
   - Records performance metrics

## After Deployment

Deployment addresses will be saved to:
- `deployment-addresses.txt` - Human-readable format
- `deployment-info.json` - JSON format

Update your `.env` file with the deployed contract addresses:

```bash
CLAWRACLE_TOKEN=0x...
CLAWRACLE_REGISTRY=0x...
CLAWRACLE_AGENT_REGISTRY=0x...
```

## Verify Contracts (Optional)

```bash
npx hardhat verify --network monad-testnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Example:
```bash
# Verify Token
npx hardhat verify --network monad-testnet <TOKEN_ADDRESS> "1000000000000000000000000"

# Verify Registry
npx hardhat verify --network monad-testnet <REGISTRY_ADDRESS> <TOKEN_ADDRESS>

# Verify AgentRegistry
npx hardhat verify --network monad-testnet <AGENT_REGISTRY_ADDRESS>
```

## Network Configuration

### Monad Testnet
- Chain ID: 10143
- RPC: https://testnet-rpc.monad.xyz
- Explorer: https://testnet.monadexplorer.com

### Monad Mainnet
- Chain ID: 143
- RPC: https://rpc.monad.xyz
- Explorer: https://monadvision.com

## Next Steps

1. Fund the registry with CLAWCLE tokens (100k tokens are auto-funded on deployment)
2. Register your agent in AgentRegistry
3. Start listening for requests and resolving queries
4. See `agent/` directory for agent integration examples
