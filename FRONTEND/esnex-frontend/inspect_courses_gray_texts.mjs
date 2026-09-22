import { chromium } from 'playwright';

const grayColors = new Set([
  'rgb(148, 163, 184)',
  'rgb(100, 116, 139)',
  'rgb(203, 213, 225)',
  'rgb(226, 232, 240)',
  'rgb(148, 163, 184)',
  'rgb(107, 114, 128)',
  'rgb(120, 113, 108)',
  'rgb(120, 113, 108)',
]);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/courses', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
  });
  await page.waitForTimeout(1000);
  const results = await page.evaluate((grays) => {
    const graySet = new Set(grays);
    const result = [];
    const root = document.querySelector('.courses-page');
    if (!root) return { error: 'no .courses-page root' };
    const elements = Array.from(root.querySelectorAll('*'));
    for (const el of elements) {
      const style = getComputedStyle(el);
      const color = style.color;
      if (graySet.has(color)) {
        result.push({
          tag: el.tagName.toLowerCase(),
          class: el.className,
          id: el.id,
          color,
          text: el.textContent?.trim().slice(0, 80) || ''
        });
      }
    }
    return result.slice(0, 200);
  }, Array.from(grayColors));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();