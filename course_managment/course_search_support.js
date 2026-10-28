/**
 * Multi-field course search — HomeController
 *
 * Feature under test: the /courses search box (`q` param) splits the query into
 * words. Each word is matched (OR) against:
 *   - the course title
 *   - any category level: category, second_category, or parent_category
 *   - the main teacher (author)
 *   - additional teachers (instructors)
 * Words are combined with AND — a course must satisfy every word (in any
 * field, not necessarily the same field) to be returned. That is why mixed
 * queries such as "business sara" can surface a course even though neither
 * word is in the title — "business" comes from the category chain and
 * "sara" from an instructor's name.
 *
 * Route: GET /courses?q=...  (plain HTML form, method="get", no AJAX)
 * Results are paginated (12 per page) with a "Showing X from Y results" line,
 * so all assertions below rely on that TOTAL count, not on how many course
 * cards happen to render on page 1.
 */

import { getAppBase } from '../../support/navigation.js'
import { HTTP_AUTH } from '../../support/users'

export const BASE = () => getAppBase()
export const AUTH = HTTP_AUTH

export const SEARCH_INPUT = 'input[name="q"]'
export const SEARCH_FORM = 'form.header-search-wrap, .header-search-wrap form'
export const SEARCH_SUBMIT_BTN = 'button.header-search-btn'
export const COURSE_CARD = '.course-card'
export const COURSE_TITLE = '.course-card-title'
export const NO_RESULTS_RE = /nothing to see here|no courses|no results/i

const TITLE_RE = /course-card-title"[^>]*>\s*([^<]+?)\s*<\/h4>/g
const SHOWING_RE = /Showing\s+(\d+)\s+from\s+(\d+)\s+results/i

/**
 * Query /courses?q=<term> via cy.request and parse both the visible (page 1)
 * course titles and the TRUE total match count from the "Showing X from Y
 * results" line. Using `total` (not `titles.length`) keeps every count-based
 * assertion correct even when a query matches more than one page of courses.
 */
export const searchCoursesApi = (q, page) =>
  cy
    .request({
      method: 'GET',
      url: `${BASE()}/courses`,
      auth: AUTH,
      qs: page ? { q, page } : { q },
      failOnStatusCode: false,
    })
    .then((res) => {
      const html = res.body || ''
      const titles = [...html.matchAll(TITLE_RE)].map((m) => m[1].trim())
      const isEmptyState = NO_RESULTS_RE.test(html)
      const showingMatch = html.match(SHOWING_RE)
      const total = showingMatch ? Number(showingMatch[2]) : titles.length
      return cy.wrap({ status: res.status, titles, total, isEmptyState, html })
    })

/** Real UI flow — type into the header search box and submit the form (full GET reload with ?q=). */
export const searchCoursesUi = (term) => {
  cy.visit(`${BASE()}/courses`, { auth: AUTH, failOnStatusCode: false })
  cy.get(SEARCH_INPUT, { timeout: 15000 }).filter(':visible').first().clear().type(term)
  cy.get(SEARCH_SUBMIT_BTN).filter(':visible').first().click({ force: true })
}

/** True only when `superset.total` guarantees the scraped `titles` list is complete (no next page). */
export const isFullyOnPage1 = (res) => res.total <= res.titles.length

/** Every title in `subsetRes` must also appear in `fullRes.titles` (fullRes must be fully on page 1). */
export const assertTitlesAreSubsetOf = (subsetRes, fullRes) => {
  expect(isFullyOnPage1(fullRes), 'reference set must fit on a single page to compare reliably').to.be.true
  subsetRes.titles.forEach((title) => {
    expect(fullRes.titles, `"${title}" should also match the single-field search`).to.include(title)
  })
}
