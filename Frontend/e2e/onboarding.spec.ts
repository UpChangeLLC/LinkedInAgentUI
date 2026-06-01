import { test, expect, type Page } from '@playwright/test'
import { mockOnboardingBackend } from './fixtures/onboarding-mocks'

const NEXT = '[data-test="survey-next"]'
const SUBMIT = '[data-test="survey-submit"]'

/** Answer every required survey question and submit.
 * Steps 2/9/10 are optional; step 8's slider auto-initializes to 50. */
async function completeSurvey(page: Page) {
  // Q1 — AI tool/frequency grid: pick a real (non-"None") cell, e.g. "…: Daily".
  await page.getByRole('button', { name: /: Daily$/ }).first().click()
  await page.locator(NEXT).click() // -> Q2 (optional)
  await page.locator(NEXT).click() // -> Q3
  for (const _ of [3, 4, 5, 6, 7]) {
    // Q3/4/7 are pills, Q5/6 are Likert — both expose role="radio".
    await page.getByRole('radio').first().click()
    await page.locator(NEXT).click()
  }
  // Now on Q8 (slider auto-answers); advance through optional Q9/Q10.
  await page.locator(NEXT).click() // Q8 -> Q9
  await page.locator(NEXT).click() // Q9 -> Q10
  await page.locator(SUBMIT).click()
}

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await mockOnboardingBackend(page)
  })

  test('landing → intake → survey renders (smoke)', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get my score' }).first().click()

    await expect(page.getByText('Drop your LinkedIn URL')).toBeVisible()
    await page.locator('#linkedin-input').fill('https://linkedin.com/in/ada-lovelace')
    await page.getByRole('button', { name: 'Continue to survey' }).click()

    // Survey is up.
    await expect(page.locator(`${NEXT}, ${SUBMIT}`).first()).toBeVisible()
  })

  test('full onboarding → signup gate → free dashboard', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get my score' }).first().click()

    await page.locator('#linkedin-input').fill('https://linkedin.com/in/ada-lovelace')
    await page.getByRole('button', { name: 'Continue to survey' }).click()

    await completeSurvey(page)

    // Mid-onboarding signup gate.
    await expect(page.getByText('Your resilience score is ready.')).toBeVisible()
    await page.locator('input[type="email"]').fill('ada@example.com')
    await page.locator('input[type="password"]').fill('Password1')
    await page.locator('input[autocomplete="name"]').fill('Ada Lovelace')
    await page.getByRole('button', { name: /see my score/i }).click()

    // Score reveal then the free dashboard.
    await expect(page.getByRole('heading', { name: 'Your AI Resilience Score' })).toBeVisible({ timeout: 30_000 })
  })
})
