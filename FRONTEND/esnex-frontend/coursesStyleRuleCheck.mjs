import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/courses', { waitUntil: 'networkidle' });
  const rules = await page.evaluate(() => {
    const matches = [];
    for (const sheet of document.styleSheets) {
      try {
        const cssRules = sheet.cssRules || [];
        for (const rule of cssRules) {
          if (rule.cssText.includes('body.theme-light .courses-search-input')) {
            matches.push(rule.cssText);
          }
        }
      } catch (e) {
        // ignore cross origin stylesheets
      }
    }
    return matches;
  });
  console.log(JSON.stringify({ rules }, null, 2));
  await browser.close();
})();
