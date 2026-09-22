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
  const selectors = ['.courses-header h1', '.courses-header p', '.courses-controls', '.courses-search-input', '.courses-filter-select', '.course-title', '.course-description', '.instructor-name', '.rating-count', '.course-meta', '.course-meta span', '.price-original', '.pagination-info', '.pagination-per-page', '.pagination-btn', '.per-page-select'];
  const results = [];
  for (const sel of selectors) {
    const el = await page.$(sel);
    results.push({ selector: sel, found: Boolean(el) });
    if (!el) continue;
    const color = await el.evaluate(e => getComputedStyle(e).color);
    const bg = await el.evaluate(e => getComputedStyle(e).backgroundColor);
    results[results.length-1].color = color;
    results[results.length-1].background = bg;
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
