import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    return [
      { source: '/api/whatsapp-status',    destination: `${backendUrl}/api/whatsapp-status`    },
      { source: '/api/whatsapp-qr',        destination: `${backendUrl}/api/whatsapp-qr`        },
      { source: '/api/whatsapp-teste',     destination: `${backendUrl}/api/whatsapp-teste`     },
      { source: '/api/whatsapp-reiniciar', destination: `${backendUrl}/api/whatsapp-reiniciar` },
      { source: '/api/executar',           destination: `${backendUrl}/api/executar`           },
    ]
  },
}

export default nextConfig
