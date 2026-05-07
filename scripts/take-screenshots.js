const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

function startServer(rootDir, port) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let urlPath = req.url.split('?')[0]; // 去掉查询参数
            let filePath = path.join(rootDir, urlPath);
            // 如果是目录，自动找 index.html
            if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            } else if (urlPath === '/') {
                filePath = path.join(rootDir, 'index.html');
            }
            if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
                '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
                '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
                '.task': 'application/octet-stream',
            };
            fs.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found'); return; }
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        server.listen(port, () => resolve(server));
    });
}

async function main() {
    const rootDir = path.resolve(__dirname, '..');
    const port = 8899;
    const screenshotsDir = path.join(rootDir, 'docs', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    console.log('启动本地服务器...');
    const server = await startServer(rootDir, port);

    console.log('启动浏览器...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('  [浏览器错误]', msg.text());
    });
    page.on('pageerror', err => console.log('  [页面错误]', err.message));

    async function screenshot(url, filename, opts = {}) {
        const { width = 1280, height = 900, fullPage = false, waitForSelector = null, waitTime = 0 } = opts;
        await page.setViewport({ width, height });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        if (waitForSelector) {
            try { await page.waitForSelector(waitForSelector, { timeout: 10000 }); }
            catch (e) { console.log(`  等待选择器 ${waitForSelector} 超时`); }
        }
        if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
        const filepath = path.join(screenshotsDir, filename);
        await page.screenshot({ path: filepath, fullPage });
        console.log(`  截图完成: ${filename}`);
    }

    // 滚动页面以触发 IntersectionObserver
    async function scrollPage() {
        await page.evaluate(async () => {
            const delay = ms => new Promise(r => setTimeout(r, ms));
            const height = document.body.scrollHeight;
            for (let i = 0; i < height; i += 400) {
                window.scrollTo(0, i);
                await delay(100);
            }
            window.scrollTo(0, 0);
            await delay(500);
        });
    }

    try {
        // 1. 主页 - 桌面端全页
        console.log('截取主页(桌面端)...');
        await screenshot(`http://localhost:${port}/`, '01-homepage-desktop.png', {
            fullPage: true, waitForSelector: '.mode-card', waitTime: 2000
        });

        // 2. 主页 - 手机端
        console.log('截取主页(手机端)...');
        await screenshot(`http://localhost:${port}/`, '02-homepage-mobile.png', {
            width: 390, height: 844, fullPage: true, waitForSelector: '.mode-card', waitTime: 1000
        });

        // 3. 落地页 - 桌面端（强制显示所有元素）
        console.log('截取落地页(桌面端)...');
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(`http://localhost:${port}/landing/`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        // 强制添加 visible 类，让所有动画元素显示
        await page.evaluate(() => {
            document.querySelectorAll('.fade-in, .tech-item, .stat-item, .timeline-item').forEach(el => {
                el.classList.add('visible');
            });
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(screenshotsDir, '03-landing-desktop.png'), fullPage: true });
        console.log('  截图完成: 03-landing-desktop.png');

        // 4. 落地页 - 手机端
        console.log('截取落地页(手机端)...');
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(`http://localhost:${port}/landing/`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        await page.evaluate(() => {
            document.querySelectorAll('.fade-in, .tech-item, .stat-item, .timeline-item').forEach(el => {
                el.classList.add('visible');
            });
        });
        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: path.join(screenshotsDir, '04-landing-mobile.png'), fullPage: true });
        console.log('  截图完成: 04-landing-mobile.png');

        // 5. 主页 - 卡片区域 viewport
        console.log('截取主页卡片区域...');
        await screenshot(`http://localhost:${port}/`, '05-mode-cards.png', {
            waitForSelector: '.mode-card', waitTime: 1000
        });

        // 6. 设置页面
        console.log('截取设置页面...');
        await page.setViewport({ width: 1280, height: 900 });
        await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle2', timeout: 30000 });
        try {
            await page.waitForSelector('.mode-card', { timeout: 10000 });
            await new Promise(r => setTimeout(r, 1000));
            const settingsCard = await page.$('[data-mode="settings"]');
            if (settingsCard) {
                await settingsCard.click();
                await new Promise(r => setTimeout(r, 2000));
                await page.screenshot({ path: path.join(screenshotsDir, '06-settings.png'), fullPage: true });
                console.log('  截图完成: 06-settings.png');
            }
        } catch (e) { console.log('  设置页面截图失败:', e.message); }

        console.log('\n所有截图完成！');
    } catch (e) {
        console.error('截图出错:', e.message);
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch(console.error);
