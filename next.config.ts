import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  serverExternalPackages: ['@whiskeysockets/baileys', '@hapi/boom', 'pino', 'canvas'],
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
