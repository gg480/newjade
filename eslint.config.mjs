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

// React Compiler 优化提示降为 warning（不影响功能）
config.push({
  rules: {
    'react-compiler/react-compiler': 'warn',
  },
});

export default config;
