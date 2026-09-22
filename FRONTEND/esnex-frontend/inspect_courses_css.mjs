import { chromium } from 'playwright';

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
        const href = sheet.href || 'inline';
        for (const rule of sheet.cssRules || []) {
          if (!rule.selectorText) continue;
          if (rule.selectorText.includes('.courses-search-input') || rule.selectorText.includes('.course-description') || rule.selectorText.includes('.course-title') || rule.selectorText.includes('.courses-controls') || rule.selectorText.includes('.courses-header') || rule.selectorText.includes('.pagination-btn') || rule.selectorText.includes('.per-page-select') || rule.selectorText.includes('.course-meta') || rule.selectorText.includes('.instructor-name') || rule.selectorText.includes('.rating-count') || rule.selectorText.includes('.price-original')) {
            found.push({ href, selectorText: rule.selectorText, cssText: rule.cssText });
          }
        }
      } catch (e) {
        found.push({ href: sheet.href || 'inline', error: e.message });
      }
    }
    return found;
  });
  console.log(JSON.stringify(rules, null, 2));
  await browser.close();
})();
