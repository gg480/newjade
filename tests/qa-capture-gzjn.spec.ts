import { test } from '@playwright/test';

test('抓取 gzjn168 真实DOM', async ({ page }) => {
  await page.goto('http://gzjn168.com/phone.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  // 拿整个 body 的 HTML
  const html = await page.evaluate(() => document.body?.innerHTML || 'NO BODY');
  
  // 提取纯文本
  const text = await page.evaluate(() => document.body?.innerText || 'NO TEXT');
  
  // 写在 playwright 输出里
  console.log('=== BODY HTML (first 3000) ===');
  console.log(html.substring(0, 3000));
  console.log('=== BODY TEXT ===');
  console.log(text);
  console.log('=== HTML LENGTH ===', html.length);

  // 截图
  await page.screenshot({ path: '.playwright-cli/gzjn-real-page.png', fullPage: true });
});
