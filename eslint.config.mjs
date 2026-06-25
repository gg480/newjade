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

// 项目中未启用 React Compiler，preserve-manual-memoization 规则仅造成假阳性 error
config.push({
  plugins: {
    'react-hooks': config[0].plugins['react-hooks'],
  },
  rules: {
    'react-hooks/preserve-manual-memoization': 'warn',
  },
});

export default config;
