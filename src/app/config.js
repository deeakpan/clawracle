import { getDefaultConfig } from 'connectkit'
import { defineChain } from 'viem'

// Define Monad mainnet chain
const monadMainnet = defineChain({
  id: 143,
  name: 'Monad Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://monadvision.com' },
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
  chains: [monadMainnet],
  walletConnectProjectId: walletConnectProjectId,
})

// Ensure SSR is enabled
export const config = {
  ...defaultConfig,
  ssr: true,
}
