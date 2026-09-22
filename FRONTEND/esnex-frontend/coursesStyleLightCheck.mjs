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
  const textEls = await page.$$('[class*="course-"], .courses-header h1, .courses-header p, .courses-controls, .courses-search-input, .courses-filter-select, .search-icon, .course-description, .instructor-name, .rating-count, .course-meta, .course-meta span, .price-original, .pagination-info, .pagination-per-page, .pagination-btn, .per-page-select');
  const results = [];
  for (const el of textEls) {
    const sel = await el.evaluate(node => node.className || node.tagName);
    const color = await el.evaluate(e => getComputedStyle(e).color);
    const bg = await el.evaluate(e => getComputedStyle(e).backgroundColor);
    const text = await el.evaluate(e => e.textContent.trim().slice(0, 60));
    results.push({ className: sel, color, background: bg, text });
  }
  console.log(JSON.stringify({ results: results.slice(0, 30) }, null, 2));
  await browser.close();
})();
