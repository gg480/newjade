// 检查 PWA 在移动端 Chrome 模拟下的行为
import { chromium } from 'playwright';

const URL = 'https://7cr963fn3158.vicp.fun/';

async function main() {
  const browser = await chromium.launch({ headless: false });
  
  // 模拟 Pixel 5 (Android Chrome)
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // 监听控制台
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // 监听 beforeinstallprompt
  let installPromptFired = false;
  page.on('pageerror', err => console.log(`[PAGE_ERROR] ${err.message}`));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('=== 页面加载完成 ===');

  // 1. 检查 manifest 链接
  const manifestLink = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]');
    return link ? link.getAttribute('href') : 'MISSING';
  });
  console.log(`[manifest-link] ${manifestLink}`);

  // 2. 检查 meta tags
  const metaTags = await page.evaluate(() => {
    return {
      mobileWebAppCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute('content') || 'MISSING',
      appleMobileWebAppCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content') || 'MISSING',
      appleMobileWebAppTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content') || 'MISSING',
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || 'MISSING',
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || 'MISSING',
    };
  });
  console.log(`[meta-tags] ${JSON.stringify(metaTags, null, 2)}`);

  // 3. 检查 apple-touch-icon
  const appleIcons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('link[rel="apple-touch-icon"]')).map(l => ({
      href: l.getAttribute('href'),
      sizes: l.getAttribute('sizes'),
    }));
  });
  console.log(`[apple-touch-icons] ${JSON.stringify(appleIcons, null, 2)}`);

  // 4. 检查 Service Worker
  const swStatus = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false, reason: 'SW not supported' };
    
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) return { supported: true, registered: false, reason: 'No SW registered' };
      
      const reg = regs[0];
      return {
        supported: true,
        registered: true,
        scope: reg.scope,
        activeState: reg.active?.state || 'no_active',
        scriptURL: reg.active?.scriptURL || 'no_script',
        installing: !!reg.installing,
        waiting: !!reg.waiting,
      };
    } catch (e) {
      return { supported: true, registered: false, error: e.message };
    }
  });
  console.log(`[sw-status] ${JSON.stringify(swStatus, null, 2)}`);

  // 5. 尝试触发 beforeinstallprompt
  const installCheck = await page.evaluate(async () => {
    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve({ fired: false, reason: 'timeout' }), 5000);
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        clearTimeout(timeout);
        resolve({ fired: true, platforms: e.platforms });
      });
      // 部分浏览器在 dispatchEvent 后触发
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
  });
  console.log(`[beforeinstallprompt] ${JSON.stringify(installCheck, null, 2)}`);

  // 6. 检查 manifest.json 内容
  const manifestData = await page.evaluate(async () => {
    try {
      const resp = await fetch('/manifest.json');
      if (!resp.ok) return { error: `HTTP ${resp.status}` };
      const contentType = resp.headers.get('content-type');
      const data = await resp.json();
      return { contentType, data };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log(`[manifest-content] ${JSON.stringify(manifestData, null, 2)}`);

  // 7. 检查 Chrome 的 installability 输出
  // 通过检查是否有可能的 console 警告
  console.log('=== 检查完毕 ===');

  await page.waitForTimeout(2000);
  await browser.close();
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
