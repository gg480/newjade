import nextConfig from 'eslint-config-next';

const config = Array.isArray(nextConfig) ? nextConfig : [nextConfig];

// 追加排除项
config.push({
  ignores: [
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'test-config.js',
    'test-db.js',
    'test-items.js',
    'test-prisma.js',
    'test-tags.js',
    'examples/**',
  ],
});

export default config;
