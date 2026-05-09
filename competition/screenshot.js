const puppeteer = require('puppeteer');
const path = require('path');

const URL = 'https://hello-ai-accessibility.netlify.app';
const DIR = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 }); // iPhone 14 Pro Max size

  // ① 首页总览
  console.log('截图①: 首页总览...');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.mode-card', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(DIR, '01-homepage.png'), fullPage: false });

  // ⑦ 老年辅助 - 大按钮界面
  console.log('截图⑦: 老年辅助界面...');
  // 点击老年辅助卡片
  const elderlyCard = await page.evaluate(() => {
    const cards = document.querySelectorAll('.mode-card');
    for (const card of cards) {
      if (card.textContent.includes('老年') || card.textContent.includes('👴')) {
        card.click();
        return true;
      }
    }
    return false;
  });

  if (elderlyCard) {
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(DIR, '07-elderly.png'), fullPage: false });
    console.log('老年辅助截图完成');
  } else {
    console.log('未找到老年辅助卡片，尝试其他选择器...');
    // 尝试通过 onclick 属性
    await page.evaluate(() => {
      const items = document.querySelectorAll('[onclick*="elderly"], [data-module="elderly"]');
      if (items.length) items[0].click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(DIR, '07-elderly.png'), fullPage: false });
  }

  // 返回首页
  await page.evaluate(() => {
    if (window.goHome) window.goHome();
  });
  await new Promise(r => setTimeout(r, 1000));

  // ⑤ 认知辅助 - 任务引导界面
  console.log('截图⑤: 认知辅助界面...');
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.mode-card');
    for (const card of cards) {
      if (card.textContent.includes('认知') || card.textContent.includes('🧠')) {
        card.click();
        return true;
      }
    }
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(DIR, '05-cognitive.png'), fullPage: false });
  console.log('认知辅助截图完成');

  await browser.close();
  console.log('所有截图完成！');
})();
