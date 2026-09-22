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
  const selectors = [
    '.courses-header h1',
    '.courses-header p',
    '.courses-controls',
    '.courses-search-input',
    '.courses-search-input::placeholder',
    '.courses-filter-select',
    '.course-title',
    '.course-description',
    '.instructor-name',
    '.rating-count',
    '.course-meta',
    '.course-meta span',
    '.price-original',
    '.pagination-info',
    '.pagination-per-page',
    '.pagination-per-page label',
    '.per-page-select',
    '.per-page-select option',
    '.pagination-btn',
    '.course-card',
    '.courses-page'
  ];
  const results = [];
  for (const sel of selectors) {
    try {
      if (sel.includes('::placeholder')) {
        const input = await page.$('.courses-search-input');
        const placeholderColor = await page.evaluate(() => {
          const el = document.querySelector('.courses-search-input');
          return el ? getComputedStyle(el, '::placeholder').color : null;
        });
        results.push({ selector: sel, found: !!input, color: placeholderColor });
        continue;
      }
      const el = await page.$(sel);
      if (!el) {
        results.push({ selector: sel, found: false });
        continue;
      }
      const styles = await el.evaluate(e => ({ color: getComputedStyle(e).color, background: getComputedStyle(e).backgroundColor, fill: getComputedStyle(e).fill, '-webkit-text-fill-color': getComputedStyle(e).getPropertyValue('-webkit-text-fill-color') }));
      results.push({ selector: sel, found: true, ...styles });
    } catch (error) {
      results.push({ selector: sel, error: error.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();