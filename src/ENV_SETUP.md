# Environment Variables Setup

Add these to your `.env.local` file in the `src` directory:

```bash
# Clawracle Contract Addresses (Monad Mainnet)
NEXT_PUBLIC_CLAWRACLE_TOKEN=0x99FB9610eC9Ff445F990750A7791dB2c1F5d7777
NEXT_PUBLIC_CLAWRACLE_REGISTRY=0x1F68C6D1bBfEEc09eF658B962F24278817722E18
NEXT_PUBLIC_CLAWRACLE_AGENT_REGISTRY=0x01697DAE20028a428Ce2462521c5A60d0dB7f55d

# Monad Mainnet Network Details
MONAD_RPC_URL=https://rpc.monad.xyz
MONAD_WS_RPC_URL=wss://rpc.monad.xyz
MONAD_CHAIN_ID=143

# Lighthouse IPFS (Server-side only - NO NEXT_PUBLIC_ prefix)
# Get your API key at https://lighthouse.storage
LIGHTHOUSE_API_KEY=your_lighthouse_api_key_here

# Optional: WalletConnect Project ID (for WalletConnect connector)
# Get one at https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

## Contract Addresses (Mainnet)

- **CLAWCLE Token**: `0x99FB9610eC9Ff445F990750A7791dB2c1F5d7777`
- **Data Request Registry**: `0x1F68C6D1bBfEEc09eF658B962F24278817722E18`
- **Agent Registry**: `0x01697DAE20028a428Ce2462521c5A60d0dB7f55d`

## Monad Mainnet Network Details

- **RPC URL**: `https://rpc.monad.xyz`
- **WebSocket RPC URL**: `wss://rpc.monad.xyz`
- **Chain ID**: `143`

Note: The `NEXT_PUBLIC_` prefix is required for Next.js to expose these variables to the client-side code.
