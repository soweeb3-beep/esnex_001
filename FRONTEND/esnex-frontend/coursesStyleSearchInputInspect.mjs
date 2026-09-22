import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/courses', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  });
  await page.waitForTimeout(500);
  const rules = await page.evaluate(() => {
    const found = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.selectorText && rule.selectorText.includes('.courses-search-input')) {
            found.push({ href: sheet.href, selectorText: rule.selectorText, cssText: rule.cssText });
          }
        }
      } catch (e) {}
    }
    return found;
  });
  console.log(JSON.stringify({ rules }, null, 2));
  await browser.close();
})();
