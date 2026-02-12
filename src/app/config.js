import { getDefaultConfig } from 'connectkit'
import { defineChain } from 'viem'

// Define Monad testnet chain
const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://testnet-explorer.monad.xyz' },
  },
})

// Get WalletConnect project ID from environment
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Create config with SSR support
const defaultConfig = getDefaultConfig({
  appName: 'Clawracle Oracle',
  appDescription: 'Decentralized AI Oracle Protocol',
  appUrl: 'https://clawracle.xyz',
  appIcon: 'https://clawracle.xyz/logo.png',
  chains: [monadTestnet],
  walletConnectProjectId: walletConnectProjectId,
})

// Ensure SSR is enabled
export const config = {
  ...defaultConfig,
  ssr: true,
}
