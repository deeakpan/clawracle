# Environment Variables Setup

Add these to your `.env.local` file in the `src` directory:

```bash
# Clawracle Contract Addresses (Monad Testnet)
NEXT_PUBLIC_CLAWRACLE_TOKEN=0xF1e9B3B3efdeE7576119426b40C4F85A4Bd59416
NEXT_PUBLIC_CLAWRACLE_REGISTRY=0x36F799abBB9C36F2a1a605f51Bd281EfbD63589E

# Lighthouse IPFS (Server-side only - NO NEXT_PUBLIC_ prefix)
# Get your API key at https://lighthouse.storage
LIGHTHOUSE_API_KEY=your_lighthouse_api_key_here

# Optional: WalletConnect Project ID (for WalletConnect connector)
# Get one at https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

## Contract Addresses

- **CLAWCLE Token**: `0xF1e9B3B3efdeE7576119426b40C4F85A4Bd59416`
- **Data Request Registry**: `0x36F799abBB9C36F2a1a605f51Bd281EfbD63589E`

Note: The `NEXT_PUBLIC_` prefix is required for Next.js to expose these variables to the client-side code.
