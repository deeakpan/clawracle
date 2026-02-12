# Clawracle UI

Professional web interface for the Clawracle Oracle Protocol.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file with:
```bash
# Public (exposed to browser)
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz
NEXT_PUBLIC_CLAWRACLE_REGISTRY=0x...
NEXT_PUBLIC_CLAWRACLE_TOKEN=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Server-side only (kept secure)
LIGHTHOUSE_API_KEY=your_lighthouse_api_key
```

**Important**: 
- `LIGHTHOUSE_API_KEY` should NOT have `NEXT_PUBLIC_` prefix - it's server-side only
- Get WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com) (free)

4. Run development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Features

- **Wallet Connection**: Connect MetaMask or Web3 wallet
- **Submit Requests**: Upload query to IPFS via Lighthouse and submit to contract
- **Bond Approval**: Approve CLAWCLE tokens for bonds
- **Request Status**: View request states (Pending, Proposed, Disputed, Finalized)
- **Answer Display**: See proposed answers and validation counts

## Tech Stack

- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- ethers.js v6
- Lighthouse SDK
- Lucide React (icons)
