import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/courses', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  });
  await page.waitForTimeout(1000);
  const rules = await page.evaluate(() => {
    const found = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          const txt = rule.cssText;
          if (txt.includes('body.theme-light .courses-search-input') || txt.includes('background: #ffffff !important;') || txt.includes('color: #0f172a !important;')) {
            found.push({ href: sheet.href, cssText: txt });
          }
        }
      } catch (e) {
      }
    }
    return found;
  });
  console.log(JSON.stringify({ rules }, null, 2));
  await browser.close();
})();
