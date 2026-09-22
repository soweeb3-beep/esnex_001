import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/courses', { waitUntil: 'networkidle' });
  const theme = await page.evaluate(() => document.body.className);
  const selectors = ['.courses-page','.courses-header h1','.courses-header p','.courses-controls','.courses-search-input','.courses-filter-select','.search-icon','.course-card','.course-title','.course-description','.instructor-name','.rating-count','.course-meta','.course-meta span','.price-original','.price-current','.courses-pagination','.pagination-info','.pagination-per-page','.pagination-btn','.per-page-select'];
  const results = [];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (!el) { results.push({ selector: sel, found: false }); continue; }
    const color = await el.evaluate(e => getComputedStyle(e).color);
    const bg = await el.evaluate(e => getComputedStyle(e).backgroundColor);
    results.push({ selector: sel, found: true, color, background: bg });
  }
  console.log(JSON.stringify({ theme, results }, null, 2));
  await browser.close();
})();
