'use client'

import { useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { defineChain } from 'viem'
import '@rainbow-me/rainbowkit/styles.css'

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

// Create RainbowKit config with SSR support
// WalletConnect is optional - only include if projectId is provided
const wagmiConfig = getDefaultConfig({
  appName: 'Clawracle Oracle',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '00000000000000000000000000000000', // Dummy ID if not provided
    chains: [monadMainnet],
  ssr: true,
})

export function Providers({ children, initialState }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    },
  }))

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            colors: {
              accentColor: '#9333ea',
              accentColorForeground: '#ffffff',
              actionButtonBorder: '#9333ea',
              actionButtonBorderMobile: '#9333ea',
              actionButtonSecondaryBackground: '#f5f5f5',
              closeButton: '#000000',
              closeButtonBackground: '#ffffff',
              connectButtonBackground: '#ffffff',
              connectButtonBackgroundError: '#ffffff',
              connectButtonInnerBackground: '#f5f5f5',
              connectButtonText: '#000000',
              connectButtonTextError: '#ff0000',
              connectionIndicator: '#9333ea',
              downloadBottomCardBackground: '#ffffff',
              downloadTopCardBackground: '#ffffff',
              error: '#ff0000',
              generalBorder: '#e5e5e5',
              generalBorderDim: '#f0f0f0',
              menuItemBackground: '#f5f5f5',
              modalBackdrop: 'rgba(0, 0, 0, 0.5)',
              modalBackground: '#ffffff',
              modalBorder: '#e5e5e5',
              modalText: '#000000',
              modalTextDim: '#666666',
              modalTextSecondary: '#999999',
              profileAction: '#9333ea',
              profileActionHover: '#7c3aed',
              profileForeground: '#f5f5f5',
              selectedOptionBorder: '#9333ea',
              standby: '#ffb700',
            },
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
