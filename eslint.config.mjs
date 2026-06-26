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
// 从已有配置中安全查找 react-hooks 插件（不假设其在 config[0] 中）
const reactHooksPlugin = config.find(c => c.plugins?.['react-hooks'])?.plugins?.['react-hooks'];
if (reactHooksPlugin) {
  config.push({
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  });
}

export default config;
