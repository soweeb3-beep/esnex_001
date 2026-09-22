import { test, expect, Page } from '@playwright/test';

const credentials = {
  email: 'alpha@gmail.com',
  password: 'Alpha123',
};

const adminCredentials = {
  email: 'admin@esnex.com',
  password: 'Admin1234',
};

const subjectCardSlugs = ['english', 'maths', 'physics'];
const absentAssessmentCards = [
  'English Objective',
  'English Theory',
  'English Oral',
  'Physics Objective',
  'Physics Theory',
  'Physics Practical',
];

const login = async (page: Page, auth = credentials) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Log In/i })).toBeVisible();
  await page.getByLabel('Email').fill(auth.email);
  await page.locator('input[name="password"]').fill(auth.password);
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL(/\/(dashboard|admin)/);
  await expect(page.getByText(/Dashboard|Assessments|Admin Panel/)).toBeVisible();
};

const logout = async (page: Page) => {
  await page.getByRole('button', { name: /Logout/i }).first().click();
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
};

const expectNoErrors = async ({ page }: { page: Page }) => {
  const context = page.context() as any;
  const consoleErrors: string[] = context._consoleErrors || [];
  const networkErrors: string[] = context._networkErrors || [];
  expect(consoleErrors, `Console errors detected`).toEqual([]);
  expect(networkErrors, `Network errors detected`).toEqual([]);
};

const attachErrorListeners = (page: Page) => {
  const context = page.context() as any;
  context._consoleErrors = [] as string[];
  context._networkErrors = [] as string[];
  const ignoredConsoleErrorPatterns = [
    /Received NaN for the `%s` attribute/, // React warning from numeric values in children
  ];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (!ignoredConsoleErrorPatterns.some((pattern) => pattern.test(text))) {
        context._consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    context._consoleErrors.push(error.message);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      context._networkErrors.push(`${status} ${response.url()}`);
    }
  });
};

const acceptDialogs = (page: Page) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
};

test.beforeEach(async ({ page }) => {
  attachErrorListeners(page);
  acceptDialogs(page);
});

test('Suite 1: Authentication', async ({ page }) => {
  await login(page);
  await page.reload();
  await page.waitForURL(/\/dashboard/);
  await logout(page);
});

test('Admin accessibility: skip link and sidebar focus trap', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await login(page, adminCredentials);
  await page.waitForURL(/\/admin/);

  const skipLink = page.getByRole('link', { name: /Skip to main content/i });
  await expect(skipLink).toBeVisible();
  await skipLink.focus();
  await expect(skipLink).toBeFocused();

  await skipLink.press('Enter');
  await expect(page.locator('#admin-main')).toBeFocused();

  const sidebarToggle = page.locator('.admin-sidebar-toggle').first();
  await sidebarToggle.waitFor({ state: 'visible' });
  await sidebarToggle.evaluate((button) => (button as HTMLElement).click());
  await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#admin-sidebar')).toHaveClass(/admin-sidebar--open/);

  const logoutButton = page.getByRole('button', { name: /Logout/i });
  await logoutButton.focus();
  await expect(logoutButton).toBeFocused();

  await page.keyboard.press('Tab');
  const sidebarContainsActive = await page.evaluate(() => {
    const sidebar = document.querySelector('#admin-sidebar');
    return sidebar?.contains(document.activeElement);
  });
  expect(sidebarContainsActive).toBe(true);

  await page.keyboard.press('Escape');
  await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#admin-sidebar')).not.toHaveClass(/admin-sidebar--open/);

  // Re-open the admin sidebar so the logout action can be performed.
  await sidebarToggle.evaluate((button) => (button as HTMLElement).click());
  await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'true');
  await logout(page);
});

test('User navigation accessibility: skip link and mobile menu', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('/');

  const skipLink = page.getByRole('link', { name: /Skip to main content/i });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await skipLink.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const hamburger = page.getByRole('button', { name: /toggle navigation/i });
  await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
  await hamburger.click();
  await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.site-nav.nav-mobile-open')).toBeVisible();

  const overlay = page.getByRole('button', { name: /close navigation menu/i });
  await expect(overlay).toBeVisible();
  await overlay.focus();
  await expect(overlay).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
});

test('Suite 2: Assessment Listing', async ({ page }) => {
  await login(page);
  await page.goto('/assessments');
  await expect(page.getByRole('heading', { name: /Subject Assessments/i })).toBeVisible();

  for (const slug of subjectCardSlugs) {
    await expect(page.getByTestId(`assessment-card-${slug}`)).toBeVisible();
  }

  for (const absent of absentAssessmentCards) {
    await expect(page.getByText(absent)).toHaveCount(0);
  }

  await logout(page);
});

const startEnglishAssessment = async (page: Page) => {
  await login(page);
  await page.goto('/assessments');
  await expect(page.getByTestId('assessment-card-english')).toBeVisible();
  await page.getByTestId('assessment-card-button-english').click();
  await page.waitForURL(/\/assessment\/subject\/english/);
  await expect(page.getByText(/Part A/i)).toBeVisible();
  await expect(page.getByText(/Part B/i)).toBeVisible();
  await expect(page.getByText(/Part C/i)).toBeVisible();
};

test('Suite 3: English Assessment Objective', async ({ page }) => {
  await startEnglishAssessment(page);
  await page.locator('button', { hasText: /Part A/i }).click();
  await page.getByLabel('I have read and accept the assessment rules.').check();
  await page.getByRole('button', { name: /Start Assessment/i }).click();

  await expect(page.getByText(/Time Left/i)).toBeVisible();
  const radioCount = await page.locator('input[type="radio"]').count();
  expect(radioCount).toBeGreaterThan(0);

  const firstRadio = page.locator('input[type="radio"]').first();
  await expect(firstRadio).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/answer') && response.status() === 200, { timeout: 30000 }),
    firstRadio.check(),
  ]);
  await expect(firstRadio).toBeChecked();

  await page.getByRole('button', { name: /Submit Assessment/i }).click();
  await expect(page.getByText(/Assessment Submitted|Results/i)).toBeVisible();
  await logout(page);
});

test('Suite 3: English Assessment Theory Passage Grouping', async ({ page }) => {
  await startEnglishAssessment(page);
  await page.locator('button', { hasText: /Part B/i }).click();
  await page.getByLabel('I have read and accept the assessment rules.').check();
  await page.getByRole('button', { name: /Start Assessment/i }).click();

  await expect(page.getByText(/Choose Essay Type/i)).toBeVisible();
  await page.getByRole('button', { name: /Letter|Article|Debate|Story/i }).first().click();
  await page.getByRole('button', { name: /Start Essay/i }).click();

  await expect(page.locator('textarea').first()).toBeVisible();
  await expect(page.getByText(/Your answer/i).first()).toBeVisible();

  await logout(page);
});

test('Suite 3: English Assessment Oral', async ({ page }) => {
  await startEnglishAssessment(page);
  await page.locator('button', { hasText: /Part C/i }).click();
  await page.getByLabel('I have read and accept the assessment rules.').check();
  await page.getByRole('button', { name: /Start Assessment/i }).click();

  await expect(page.getByText(/Type your answer below/i).first()).toBeVisible();
  await expect(page.getByText(/Audio is enabled for this section/i).first()).toBeVisible();
  await logout(page);
});

test('Suite 4/5/6: Subject Availability', async ({ page }) => {
  await login(page);
  await page.goto('/assessments');

  for (const slug of subjectCardSlugs) {
    const card = page.getByTestId(`assessment-card-${slug}`);
    await expect(card).toBeVisible();
  }

  await logout(page);
});

test('Suite 7: Resume & Autosave', async ({ page }) => {
  await startEnglishAssessment(page);
  await page.getByRole('button', { name: /Part A/i }).click();
  await page.getByLabel(/I have read and accept the assessment rules/i).check();
  await page.getByRole('button', { name: /Start Assessment/i }).click();

  const radio = page.locator('input[type="radio"]').first();
  await radio.check();
  await expect(radio).toBeChecked();

  await page.reload();
  await page.waitForURL(/\/assessment\/subject\/english/);
  await expect(page.getByRole('heading', { name: /You have an unfinished assessment/i })).toBeVisible();
  await page.getByRole('button', { name: /Resume Assessment/i }).click();
  await page.waitForSelector('input[type="radio"]', { timeout: 20000 });
  const checkedCount = await page.locator('input[type="radio"]:checked').count();
  expect(checkedCount).toBeGreaterThan(0);

  await logout(page);
});

test('Suite 8/9: Submission & Results', async ({ page }) => {
  await startEnglishAssessment(page);
  await page.getByRole('button', { name: /Part A — Objective/i }).click();
  await page.getByLabel('I have read and accept the assessment rules.').check();
  await page.getByRole('button', { name: /Start Assessment/i }).click();

  const radio = page.locator('input[type="radio"]').first();
  await radio.check();
  await page.waitForResponse((response) => response.url().includes('/answer') && response.status() === 200);

  await page.getByRole('button', { name: /Submit Assessment/i }).click();
  await expect(page.getByText(/Assessment Submitted|Results/i)).toBeVisible();
  await expect(page.getByText(/Score|Percentage|Pass|Fail/i)).toBeVisible();

  await logout(page);
});

test.afterEach(async ({ page }) => {
  await expectNoErrors({ page });
});
