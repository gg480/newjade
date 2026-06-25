// 初始化 OpenClaw API Key — 生成并存入 SysConfig
// 用法: npx tsx prisma/init-openclaw-key.ts
// 输出: 生成的 API Key，复制到 OpenClaw 环境变量 JADE_ERP_API_KEY

import { PrismaClient } from '@prisma/client';
import { generateOpenClawKey } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  // 检查是否已配置
  const existing = await prisma.sysConfig.findUnique({
    where: { key: 'openclaw_api_key' },
  });

  if (existing && existing.value) {
    console.log(`[SKIP] openclaw_api_key 已配置: ${existing.value.slice(0, 10)}...`);
    console.log(`       如需重新生成，先手动清空该配置项`);
    console.log(`       现有 Key: ${existing.value}`);
    return;
  }

  const key = generateOpenClawKey();
  console.log(`[GEN]  生成新 Key: ${key}`);

  await prisma.sysConfig.upsert({
    where: { key: 'openclaw_api_key' },
    update: { value: key },
    create: {
      key: 'openclaw_api_key',
      value: key,
      description: 'OpenClaw API Key（oc_ 前缀，用于外部系统调用）',
      valueType: 'string',
      groupName: 'content',
    },
  });

  console.log('[DONE] 已写入 SysConfig');
  console.log('');
  console.log('=== 复制以下内容到 OpenClaw 环境变量 ===');
  console.log(`JADE_ERP_API_KEY=${key}`);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('[ERROR]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
