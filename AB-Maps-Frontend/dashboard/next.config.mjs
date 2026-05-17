// dashboard/next.config.mjs

import path from 'path'
import { fileURLToPath } from 'url'

// Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let userConfig
try {
  userConfig = await import('./v0-user-next.config')
} catch {
  userConfig = {}
}

// Helper function to merge configs
function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) return

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // Deaktivert midlertidig – kan gi SegmentViewNode / React Client Manifest-feil sammen med next-devtools i Next 15.5
    webpackBuildWorker: false,
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return config
  },
}

// Merge user config if it exists
mergeConfig(nextConfig, userConfig.default || userConfig)

export default nextConfig
