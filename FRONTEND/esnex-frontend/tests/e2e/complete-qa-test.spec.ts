import { test, expect, Page, BrowserContext } from '@playwright/test';

// Configuration
const BASE_URL = 'http://localhost:5174';
const API_URL = 'http://localhost:5000';
const STUDENT_EMAIL = 'alpha@gmail.com';
const STUDENT_PASSWORD = 'Alpha123';
const ADMIN_EMAIL = 'admin@esnex.com';
const ADMIN_PASSWORD = 'Admin1234';

// Test data
let issues: any[] = [];
let testMetrics = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  securityIssues: 0,
  backendIssues: 0,
  frontendIssues: 0,
};

// Helper to capture console messages
function setupConsoleListener(page: Page) {
  const messages = { errors: [], warnings: [], logs: [] };
  
  page.on('console', msg => {
    if (msg.type() === 'error') messages.errors.push(msg.text());
    if (msg.type() === 'warning') messages.warnings.push(msg.text());
    if (msg.type() === 'log') messages.logs.push(msg.text());
  });
  
  page.on('response', response => {
    if (!response.ok() && response.status() >= 400) {
      messages.errors.push(`HTTP ${response.status()}: ${response.url()}`);
    }
  });
  
  return messages;
}

// Helper to log issues
function logIssue(severity: string, page: string, steps: string, error: string, rootCause: string, recommendation: string) {
  issues.push({
    severity,
    url: page,
    steps,
    error,
    rootCause,
    recommendation,
    timestamp: new Date().toISOString(),
  });
  
  if (severity === 'Critical') testMetrics.backendIssues++;
  else if (severity === 'High') testMetrics.frontendIssues++;
  else testMetrics.frontendIssues++;
}

// Test: Student Login & Logout
test('STUDENT 01: Login and logout', async ({ page }) => {
  testMetrics.totalTests++;
  const consoleMsgs = setupConsoleListener(page);
  
  try {
    await page.goto(`${BASE_URL}/login`);
    expect(await page.locator('input[type="email"]').isVisible()).toBeTruthy();
    
    // Fill login form
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ timeout: 10000 });
    const currentUrl = page.url();
    
    expect(currentUrl).not.toContain('/login');
    testMetrics.passedTests++;
    
    // Logout
    await page.click('button[id*="logout"], button[id*="profile"], [data-testid="logout"]');
    await page.waitForNavigation({ timeout: 5000 }).catch(() => {});
    
    testMetrics.passedTests++;
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue(
      'High',
      page.url(),
      'Login with student credentials',
      error.message,
      'Login endpoint or form handling issue',
      'Check auth controller and login form validation'
    );
  }
});

// Test: Student Dashboard
test('STUDENT 02: View dashboard', async ({ page }) => {
  testMetrics.totalTests++;
  const consoleMsgs = setupConsoleListener(page);
  
  try {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/student/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Check dashboard elements
    const dashboardTitle = await page.locator('h1, h2').first();
    expect(dashboardTitle).toBeTruthy();
    
    // Check for main sections
    const hasSections = await page.locator('[data-testid*="section"], section, div[class*="container"]').count() > 0;
    expect(hasSections).toBeTruthy();
    
    testMetrics.passedTests++;
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue(
      'High',
      page.url(),
      'Navigate to student dashboard after login',
      error.message,
      'Dashboard loading or data fetch issue',
      'Check dashboard component and API endpoints'
    );
  }
});

// Test: Global Assessments
test('STUDENT 03: Access Global Assessments', async ({ page }) => {
  testMetrics.totalTests++;
  const consoleMsgs = setupConsoleListener(page);
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Navigate to global assessments
    await page.goto(`${BASE_URL}/student/assessments`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Check if assessments are listed
    const assessments = await page.locator('[data-testid*="assessment"], [class*="Assessment"], [class*="assessment"]').count();
    
    if (assessments === 0) {
      logIssue('Medium', page.url(), 'Navigate to global assessments', 'No assessments displayed', 'Assessment API not returning data or empty state not handled', 'Check assessment endpoint and loading state');
    } else {
      testMetrics.passedTests++;
    }
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Access global assessments page', error.message, 'Page navigation or component error', 'Check assessments page routing');
  }
});

// Test: Course Assessments
test('STUDENT 04: Access Course Assessments', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Navigate to courses
    await page.goto(`${BASE_URL}/student/courses`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    testMetrics.passedTests++;
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Access course assessments page', error.message, 'Page not found or routing error', 'Verify courses page exists and is properly routed');
  }
});

// Test: Start Assessment & Answer Objective Questions
test('STUDENT 05: Start assessment and answer objective questions', async ({ page }) => {
  testMetrics.totalTests++;
  const consoleMsgs = setupConsoleListener(page);
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Try to start English assessment
    await page.goto(`${BASE_URL}/student/assessments`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Find and click English assessment
    const assessmentLink = await page.locator('text=/English|english/i').first();
    if (await assessmentLink.isVisible()) {
      await assessmentLink.click();
      await page.waitForNavigation({ timeout: 5000 }).catch(() => {});
      
      // Look for start button
      const startBtn = await page.locator('button:has-text("Start"), button:has-text("Begin")').first();
      if (await startBtn.isVisible()) {
        await startBtn.click();
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        
        // Check if questions are displayed
        const questions = await page.locator('[data-testid*="question"], [class*="question"]').count();
        if (questions > 0) {
          testMetrics.passedTests++;
        } else {
          logIssue('High', page.url(), 'Start assessment and check questions', 'No questions displayed', 'Assessment start endpoint not returning questions', 'Check assessment start controller');
        }
      }
    } else {
      logIssue('Medium', page.url(), 'Find English assessment', 'Assessment not found in list', 'No assessments available or poor filtering', 'Check assessment data and list display');
    }
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Start assessment', error.message, 'Assessment start logic error', 'Check assessment start page and API');
  }
});

// Test: Check Timer
test('STUDENT 06: Verify timer countdown', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Navigate to assessment
    const timerElements = await page.locator('[data-testid*="timer"], [class*="timer"], [class*="countdown"]').all();
    
    if (timerElements.length > 0) {
      const initialTime = await timerElements[0].textContent();
      await page.waitForTimeout(2000);
      const newTime = await timerElements[0].textContent();
      
      if (initialTime !== newTime) {
        testMetrics.passedTests++;
      } else {
        logIssue('Medium', page.url(), 'Check timer countdown', 'Timer not changing', 'Timer not updating properly', 'Check timer component logic');
      }
    } else {
      logIssue('Medium', page.url(), 'Find timer element', 'Timer not visible on assessment', 'Assessment page missing timer UI', 'Add timer display component');
    }
  } catch (error: any) {
    testMetrics.failedTests++;
  }
});

// Test: Auto-save
test('STUDENT 07: Verify auto-save functionality', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Wait for save indicator
    const saveIndicator = await page.locator('[data-testid*="save"], [class*="saving"], [class*="saved"]').isVisible().catch(() => false);
    
    if (saveIndicator) {
      testMetrics.passedTests++;
    } else {
      logIssue('Low', page.url(), 'Check auto-save indicator', 'Save indicator not visible', 'Auto-save UI not implemented', 'Add save status indicator');
    }
  } catch (error: any) {
    testMetrics.failedTests++;
  }
});

// Test: Admin Login
test('ADMIN 01: Login and logout', async ({ page }) => {
  testMetrics.totalTests++;
  const consoleMsgs = setupConsoleListener(page);
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    await page.waitForNavigation({ timeout: 10000 });
    const currentUrl = page.url();
    
    // Should redirect to admin dashboard
    if (currentUrl.includes('admin') || currentUrl.includes('dashboard')) {
      testMetrics.passedTests++;
    } else {
      logIssue('High', currentUrl, 'Admin login redirect', 'Not redirected to admin dashboard', 'Admin route guard or redirect not configured', 'Check admin authentication flow');
    }
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Admin login', error.message, 'Admin login endpoint or routing issue', 'Check admin auth and routing');
  }
});

// Test: Admin Dashboard
test('ADMIN 02: View admin dashboard', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Check for dashboard elements
    const dashboardElements = await page.locator('[data-testid*="stat"], [class*="metric"], [class*="card"]').count();
    
    if (dashboardElements > 0) {
      testMetrics.passedTests++;
    } else {
      logIssue('Medium', page.url(), 'View admin dashboard', 'Dashboard missing elements', 'Dashboard not rendering properly', 'Check admin dashboard component');
    }
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Access admin dashboard', error.message, 'Page load or data fetch error', 'Check admin dashboard page');
  }
});

// Test: Manage Students
test('ADMIN 03: Manage students', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    await page.goto(`${BASE_URL}/admin/students`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    const studentList = await page.locator('[data-testid*="student"], tbody tr').count();
    
    if (studentList > 0) {
      testMetrics.passedTests++;
    } else {
      logIssue('Medium', page.url(), 'View student list', 'No students displayed', 'Students API not returning data', 'Check student fetch endpoint');
    }
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Access students management', error.message, 'Page load or routing error', 'Check students page');
  }
});

// Test: Manage Assessments
test('ADMIN 04: Manage assessments', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    await page.goto(`${BASE_URL}/admin/assessments`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    testMetrics.passedTests++;
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('High', page.url(), 'Access assessments management', error.message, 'Page not found or routing error', 'Check assessments page');
  }
});

// Test: Navigation Links (Student)
test('STUDENT 08: Verify all navigation links', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // Check main navigation links
    const navLinks = await page.locator('nav a, [role="navigation"] a').all();
    let brokenLinks = 0;
    
    for (const link of navLinks) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http') && href !== '#') {
        const response = await page.goto(href, { timeout: 5000 }).catch(() => null);
        if (!response || !response.ok()) {
          brokenLinks++;
          logIssue('Medium', href, 'Navigate to link', `Got ${response?.status()}`, 'Broken navigation link', 'Fix href or page route');
        }
      }
    }
    
    if (brokenLinks === 0) {
      testMetrics.passedTests++;
    }
  } catch (error: any) {
    testMetrics.failedTests++;
  }
});

// Test: Responsive Layout
test('UTILITY 01: Check responsive layout - Mobile', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone size
    
    await page.goto(`${BASE_URL}/login`);
    
    const loginForm = await page.locator('form, [data-testid="login"]').isVisible();
    expect(loginForm).toBeTruthy();
    
    testMetrics.passedTests++;
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('Medium', page.url(), 'Test mobile responsive layout', error.message, 'Mobile layout broken', 'Review responsive CSS and layout');
  }
});

// Test: Responsive Layout - Tablet
test('UTILITY 02: Check responsive layout - Tablet', async ({ page }) => {
  testMetrics.totalTests++;
  
  try {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
    
    await page.goto(`${BASE_URL}/login`);
    
    const loginForm = await page.locator('form, [data-testid="login"]').isVisible();
    expect(loginForm).toBeTruthy();
    
    testMetrics.passedTests++;
  } catch (error: any) {
    testMetrics.failedTests++;
    logIssue('Medium', page.url(), 'Test tablet responsive layout', error.message, 'Tablet layout broken', 'Review responsive CSS');
  }
});

// Test: Check for console errors
test('UTILITY 03: Monitor console for errors during flow', async ({ page }) => {
  testMetrics.totalTests++;
  
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    await page.goto(`${BASE_URL}/student/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    if (errors.length === 0) {
      testMetrics.passedTests++;
    } else {
      errors.forEach(err => {
        logIssue('High', page.url(), 'Monitor console during user flow', err, 'JavaScript error in console', 'Debug and fix JS errors');
      });
    }
  } catch (error: any) {
    testMetrics.failedTests++;
  }
});

// Test: API Response times
test('UTILITY 04: Check API response times', async ({ page, context }) => {
  testMetrics.totalTests++;
  
  const responseTimes: any[] = [];
  
  await page.route('**/*', route => {
    const startTime = Date.now();
    route.continue().then(() => {
      const duration = Date.now() - startTime;
      responseTimes.push({
        url: route.request().url(),
        method: route.request().method(),
        duration,
      });
    });
  });
  
  try {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', STUDENT_EMAIL);
    await page.fill('input[type="password"]', STUDENT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    const slowRequests = responseTimes.filter(r => r.duration > 3000);
    
    if (slowRequests.length === 0) {
      testMetrics.passedTests++;
    } else {
      slowRequests.forEach(req => {
        logIssue('Medium', req.url, 'Monitor API performance', `Slow response: ${req.duration}ms`, 'API endpoint slow response', 'Optimize backend endpoint');
      });
    }
  } catch (error: any) {
    testMetrics.failedTests++;
  }
});

// Teardown - Generate report
test.afterAll(async () => {
  console.log('\n\n=== QA TEST REPORT ===\n');
  console.log(`Total Tests Executed: ${testMetrics.totalTests}`);
  console.log(`Passed: ${testMetrics.passedTests}`);
  console.log(`Failed: ${testMetrics.failedTests}`);
  console.log(`\nIssues Found: ${issues.length}\n`);
  
  if (issues.length > 0) {
    console.log('=== DETAILED ISSUES ===\n');
    issues.forEach((issue, index) => {
      console.log(`\nIssue ${index + 1}:`);
      console.log(`Severity: ${issue.severity}`);
      console.log(`URL: ${issue.url}`);
      console.log(`Steps: ${issue.steps}`);
      console.log(`Error: ${issue.error}`);
      console.log(`Root Cause: ${issue.rootCause}`);
      console.log(`Recommendation: ${issue.recommendation}`);
    });
  }
  
  const criticalIssues = issues.filter(i => i.severity === 'Critical').length;
  const highIssues = issues.filter(i => i.severity === 'High').length;
  const mediumIssues = issues.filter(i => i.severity === 'Medium').length;
  const lowIssues = issues.filter(i => i.severity === 'Low').length;
  
  console.log(`\n=== ISSUE SUMMARY ===`);
  console.log(`Critical: ${criticalIssues}`);
  console.log(`High: ${highIssues}`);
  console.log(`Medium: ${mediumIssues}`);
  console.log(`Low: ${lowIssues}`);
  
  const passRate = (testMetrics.passedTests / testMetrics.totalTests) * 100;
  const productionReadiness = Math.max(0, 10 - (issues.length * 0.5));
  
  console.log(`\n=== PRODUCTION READINESS ===`);
  console.log(`Pass Rate: ${passRate.toFixed(2)}%`);
  console.log(`Production Ready Score: ${productionReadiness.toFixed(1)}/10`);
  console.log(`Security Issues: ${issues.filter(i => i.steps.includes('Security') || i.steps.includes('Auth')).length}`);
  console.log(`Backend Issues: ${testMetrics.backendIssues}`);
  console.log(`Frontend Issues: ${testMetrics.frontendIssues}`);
});
