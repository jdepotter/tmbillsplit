import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Ensure Next uses this project directory as the Turbopack root,
  // avoiding confusion with other lockfiles higher up the filesystem.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
