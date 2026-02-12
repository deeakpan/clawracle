import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Clawracle Oracle',
  description: 'Decentralized AI Oracle Protocol for Monad',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
