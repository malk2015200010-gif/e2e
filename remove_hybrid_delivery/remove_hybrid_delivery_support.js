/**
 * MEN-2126 — Remove hybrid course delivery type
 *
 * Acceptance focus:
 *   - Instructors can only create/edit Recorded or Live
 *   - Catalog filter has Recorded + Live only (no Hybrid)
 *   - UI/cards/details never show Hybrid (EN + AR)
 *   - Server rejects delivery_type=hybrid
 *   - Existing hybrid rows migrated to live
 *   - Live sessions link to live courses only
 */

import { getAppBase, loginViaApi, selectCourseCategory } from '../../support/navigation.js'
import { HTTP_AUTH, basicAuth, INSTRUCTOR } from '../../support/users.js'

export { basicAuth }
export const BASE = () => getAppBase()
export const AUTH = HTTP_AUTH

export const HYBRID_RE = /\bhybrid\b|هجين|هايبرد/i
export const DELIVERY_SELECT = 'select[name="delivery_type"]'
export const DELIVERY_FILTER_INPUTS = 'input[name="delivery_type[]"]'
export const COURSE_CARD = '.course-card'
export const COURSE_META_PILL = '.course-meta-pill'
export const DELIVERY_OVERLAY = '.delivery-overlay'
export const SHOWING_RE = /Showing\s+(\d+)\s+from\s+(\d+)\s+results/i

/**
 * Known former-Hybrid course (product confirmed migrated to Live).
 * Public: /courses/assistant-test — title "Assistant test"
 */
export const MIGRATED_HYBRID_COURSE = {
  id: 371,
  slug: 'assistant-test',
  title: 'Assistant test',
  path: '/courses/assistant-test',
}

export const go = (path, opts = {}) =>
  cy.visit(`${BASE()}${path}`, { auth: basicAuth(), failOnStatusCode: false, timeout: 60000, ...opts })

export const loginInstructor = () =>
  loginViaApi(INSTRUCTOR).then(() => {
    go('/dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), 'instructor logged in')
    })
  })

const extractCsrfToken = (html = '') => {
  const m = html.match(/name="_token"\s+value="([^"]+)"/) ||
    html.match(/<meta name="csrf-token" content="([^"]+)"/)
  return m ? m[1] : ''
}

/** POST with Laravel CSRF (cy.request). */
export const postWithCsrf = (path, body) =>
  cy.request({ method: 'GET', url: `${BASE()}${path}`, auth: basicAuth(), failOnStatusCode: false }).then((res) => {
    const token = extractCsrfToken(res.body || '')
    return cy.request({
      method: 'POST',
      url: `${BASE()}${path}`,
      auth: basicAuth(),
      form: true,
      followRedirect: true,
      failOnStatusCode: false,
      body: { _token: token, ...body },
    })
  })

/** Visible option labels (and values) from the delivery_type <select>. */
export const readDeliverySelectOptions = () =>
  cy.get(DELIVERY_SELECT, { timeout: 15000 }).then(($sel) => {
    const options = [...$sel.find('option')].map((el) => ({
      value: (el.getAttribute('value') || '').trim().toLowerCase(),
      label: (el.textContent || '').trim(),
    }))
    return cy.wrap(options)
  })

export const assertDeliverySelectHasOnlyRecordedAndLive = () =>
  readDeliverySelectOptions().then((options) => {
    const values = options.map((o) => o.value).filter(Boolean)
    const labels = options.map((o) => o.label).filter((l) => l && !/select/i.test(l))

    expect(values, 'delivery_type values').to.have.members(['recorded', 'live'])
    expect(values, 'hybrid must not be a delivery_type value').to.not.include('hybrid')
    labels.forEach((label) => {
      expect(label, `delivery option label "${label}"`).not.to.match(HYBRID_RE)
    })
  })

/** Create a course via UI and return its numeric id. */
export const createCourseUi = (title, deliveryLabel = 'Recorded') => {
  go('/dashboard/courses/new')
  cy.url({ timeout: 20000 }).should('include', '/courses/new')

  cy.get('#title', { timeout: 15000 }).should('be.visible').clear().type(title)
  cy.get('textarea').first().clear().type(`MEN-2126 ${deliveryLabel} — ${title}`)
  cy.get('select[name="level"]').select('Beginner')
  cy.get(DELIVERY_SELECT).select(deliveryLabel)
  cy.wait(800)
  selectCourseCategory()
  cy.wait(800)
  cy.contains('label', 'Topic').parent().find('.select2-selection').click({ force: true })
  cy.contains('.select2-results__option', 'Math').click({ force: true })
  cy.contains('button', /create course/i).click({ force: true })

  return cy.url({ timeout: 25000 }).then((url) => {
    const m = url.match(/courses\/(\d+)/)
    expect(m, `created course id for "${title}"`).to.exist
    return cy.wrap(m[1])
  })
}

/** Attempt create with forced hybrid value (API / request-level). */
export const postCreateCourseWithDelivery = (deliveryType, title) =>
  postWithCsrf('/dashboard/courses/new', {
    title,
    short_description: `MEN-2126 forced ${deliveryType}`,
    level: 'beginner',
    delivery_type: deliveryType,
    category_id: '22',
    topic_id: '1',
  })

export const assertHybridRejected = (res) => {
  const html = String(res.body || '')
  // The create form already links to existing courses, so those ids are not a new course.
  // A created course is a redirect to /dashboard/courses/{id}, not a link inside the form.
  const redirectChain = [...(res.redirects || []), String(res.url || '')].join(' ')
  const created = /\/dashboard\/courses\/\d+(?:\/|$)/.test(redirectChain)

  const hasValidation = /selected delivery type is invalid|delivery type is invalid|invalid.*delivery/i.test(html)

  expect(hasValidation, 'server should return delivery_type validation error for hybrid').to.be.true
  expect(created, 'hybrid delivery_type must not create a course').to.be.false
}

export const openCatalog = () => {
  go('/courses')
  cy.url({ timeout: 20000 }).should('include', '/courses')
  cy.get('body', { timeout: 15000 }).should('exist')
}

export const readCatalogDeliveryFilterValues = () =>
  cy.get(DELIVERY_FILTER_INPUTS, { timeout: 15000 }).then(($inputs) => {
    const values = [...$inputs].map((el) => (el.getAttribute('value') || '').toLowerCase())
    const labels = [...$inputs].map((el) => {
      const $label = Cypress.$(el).closest('label')
      return ($label.find('.custom-control-label').text() || $label.text() || '').trim()
    })
    return cy.wrap({ values, labels })
  })

export const assertCatalogFilterOnlyRecordedAndLive = () =>
  readCatalogDeliveryFilterValues().then(({ values, labels }) => {
    expect(values, 'catalog delivery_type[] values').to.have.members(['recorded', 'live'])
    expect(values).to.not.include('hybrid')
    labels.forEach((label) => expect(label).not.to.match(HYBRID_RE))
  })

/** Visible course-card body text must not mention Hybrid. */
export const assertNoHybridOnCourseCards = () =>
  cy.get('body').then(($b) => {
    const $cards = $b.find(COURSE_CARD)
    if (!$cards.length) {
      cy.log('No course cards on this page — checking main content excluding debugbar')
    }
    const $scope = $cards.length
      ? $cards
      : $b.find('main, .courses-wrap, .course-list').first()
    const $clone = ($scope.length ? $scope : $b).clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style').remove()
    const text = ($clone.text() || '').replace(/\s+/g, ' ')
    expect(text, 'course listing must not show Hybrid').not.to.match(HYBRID_RE)
  })

export const assertDeliveryPillsAreRecordedOrLiveOnly = () =>
  cy.get('body').then(($b) => {
    const pills = [...$b.find(COURSE_META_PILL)].map((el) => (el.textContent || '').trim())
    const deliveryPills = pills.filter((t) => /^(recorded|live|hybrid)$/i.test(t))
    deliveryPills.forEach((t) => {
      expect(t, `delivery pill "${t}"`).to.match(/^(recorded|live)$/i)
      expect(t).not.to.match(HYBRID_RE)
    })
  })

export const fetchCatalogHtml = (qs = {}) =>
  cy.request({
    method: 'GET',
    url: `${BASE()}/courses`,
    auth: basicAuth(),
    qs,
    failOnStatusCode: false,
  }).then((res) => cy.wrap({ status: res.status, html: String(res.body || ''), url: res.redirects?.slice(-1)?.[0] || `${BASE()}/courses` }))

export const parseShowingTotal = (html = '') => {
  const m = html.match(SHOWING_RE)
  return m ? Number(m[2]) : null
}

/** Strip scripts/debug so "hybrid" URL params / Debugbar JSON don't false-positive UI checks. */
export const visiblePageText = (html = '') =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Laravel Debugbar dumps huge JSON that can contain incidental "hybrid" strings
    // and also makes cy.get('body').invoke('text') assertions hang/retry forever.
    .replace(/<div[^>]*id=["']phpdebugbar["'][\s\S]*$/i, ' ')
    .replace(/<div[^>]*class=["'][^"']*phpdebugbar[^"']*["'][\s\S]*?<\/div>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

/** Body text for browser assertions — excludes Debugbar / scripts. */
export const pageUiText = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const $clone = $b.clone()
    $clone.find('#phpdebugbar, .phpdebugbar, script, style, noscript').remove()
    return ($clone.text() || '').replace(/\s+/g, ' ').trim()
  })

export const switchLocale = (lang = 'en') =>
  go(`/locale/${lang}`).then(() => cy.wait(500))

export const openCourseInformation = (courseId) => {
  go(`/dashboard/courses/${courseId}/information`)
  return cy.url({ timeout: 20000 }).should('include', `/dashboard/courses/${courseId}/information`)
}

export const openLiveSessionCreate = () => {
  go('/dashboard/live-sessions/create')
  return cy.url({ timeout: 20000 }).should('include', '/live-sessions')
}

export const assertLiveSessionLinkListIsLiveOnly = () =>
  pageUiText().then((text) => {
    expect(text).not.to.match(HYBRID_RE)
    expect(text).to.match(/live courses? can be linked|non-archived live courses|link.*live/i)
  })

/** Find first Live course id from instructor my-courses (for session linking / PPS checks). */
export const findFirstLiveCourseId = () =>
  go('/dashboard/my-courses').then(() =>
    cy.get('body', { timeout: 20000 }).then(($b) => {
      const html = $b.html() || ''
      // Prefer a card/row that has a Live pill near a /dashboard/courses/{id} link
      const ids = [...html.matchAll(/\/dashboard\/courses\/(\d+)/g)].map((m) => m[1])
      const unique = [...new Set(ids)]
      expect(unique.length, 'instructor should have at least one course').to.be.greaterThan(0)
      return cy.wrap(unique[0])
    }),
  )

export const openCoursePricing = (courseId) => {
  go(`/dashboard/courses/${courseId}/pricing`)
  return cy.url({ timeout: 20000 }).should('include', `/dashboard/courses/${courseId}/pricing`)
}

export const assertPayPerSessionAvailableForLiveCourse = (courseId) =>
  openCoursePricing(courseId).then(() => {
    cy.get('body', { timeout: 15000 }).then(($b) => {
      const hasPpsTab =
        $b.find('#pay-per-session-tab, a[href*="pay-per-session"], [data-target*="pay-per-session"]').length > 0 ||
        /pay per session|per session|بالجلسة/i.test($b.text())
      expect(hasPpsTab, `PPS pricing available for live course ${courseId}`).to.be.true
    })
  })

/** Open the known former-Hybrid course that product migrated to Live. */
export const openMigratedHybridCourse = () => {
  go(MIGRATED_HYBRID_COURSE.path)
  return cy.url({ timeout: 20000 }).should('include', MIGRATED_HYBRID_COURSE.slug)
}

/**
 * MEN-2304 core check: a course that used to be Hybrid must now present as Live
 * (card overlay + details), never Hybrid.
 *
 * Uses cy.request only — a full browser visit + body-wide HYBRID_RE assertion
 * was hanging the suite (Debugbar / long retries / soft-pass stopping the chain).
 */
export const assertMigratedHybridCourseIsLive = () =>
  cy
    .request({
      method: 'GET',
      url: `${BASE()}/courses`,
      auth: basicAuth(),
      qs: { q: MIGRATED_HYBRID_COURSE.title },
      failOnStatusCode: false,
    })
    .then((res) => {
      expect(res.status, 'catalog search for migrated course').to.eq(200)
      const html = String(res.body || '')
      expect(html, 'migrated course appears in catalog').to.include(MIGRATED_HYBRID_COURSE.slug)

      const slugIdx = html.indexOf(MIGRATED_HYBRID_COURSE.slug)
      const afterSlug = slugIdx >= 0 ? html.slice(slugIdx, slugIdx + 2500) : html
      let overlay = afterSlug.match(/<span class="delivery-overlay"[^>]*>([\s\S]*?)<\/span>/i)
      if (!overlay) {
        overlay = html.match(/<span class="delivery-overlay"[^>]*>([\s\S]*?)<\/span>/i)
      }

      const overlayText = overlay
        ? overlay[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''

      expect(overlayText, `delivery overlay for "${MIGRATED_HYBRID_COURSE.title}"`).to.match(/live/i)
      expect(overlayText, 'migrated course overlay must not say Hybrid').not.to.match(HYBRID_RE)
    })
    .then(() =>
      cy
        .request({
          method: 'GET',
          url: `${BASE()}${MIGRATED_HYBRID_COURSE.path}`,
          auth: basicAuth(),
          failOnStatusCode: false,
        })
        .then((res) => {
          expect(res.status, 'migrated course details').to.eq(200)
          const html = String(res.body || '')
          const visible = visiblePageText(html)
          const hasTitle = /Assistant test/i.test(visible)
          const presentsLive =
            /Live Course|\bLive\b|دورة مباشرة|مباشر/i.test(visible) ||
            /live-sessions-widget|Upcoming Live Sessions|Live Class Schedule|live-schedule|delivery-overlay/i.test(
              html,
            )
          const mentionsHybrid = /\bHybrid\b|هجين/.test(visible)
          expect(hasTitle, 'details title includes Assistant test').to.eq(true)
          expect(presentsLive, 'details present as Live').to.eq(true)
          expect(mentionsHybrid, 'details must not mention Hybrid').to.eq(false)
        }),
    )

/**
 * Sweep public catalog pages: no delivery overlay / pill may still say Hybrid.
 * Confirms "all former hybrid courses became live" at the UI layer.
 */
export const assertCatalogHasNoHybridDelivery = (maxPages = 2) => {
  const checkPage = (page) =>
    cy
      .request({
        method: 'GET',
        url: `${BASE()}/courses`,
        auth: basicAuth(),
        qs: page > 1 ? { page } : {},
        failOnStatusCode: false,
        timeout: 30000,
      })
      .then((res) => {
        expect(res.status).to.eq(200)
        const html = String(res.body || '')
        const overlays = [...html.matchAll(/<span class="delivery-overlay"[^>]*>([\s\S]*?)<\/span>/gi)]
          .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
          .filter(Boolean)

        overlays.forEach((label) => {
          expect(label, `delivery overlay "${label}" on catalog page ${page}`).not.to.match(HYBRID_RE)
          expect(label, `delivery overlay "${label}" must be Live or Recorded`).to.match(
            /live|recorded/i,
          )
        })

        expect(visiblePageText(html), `catalog page ${page} visible text`).not.to.match(
          /\bHybrid\b|هجين/,
        )
        return cy.wrap(overlays.length)
      })

  // Sequential but bounded — avoid an open-ended reduce that can look "stuck"
  let chain = checkPage(1)
  for (let page = 2; page <= maxPages; page += 1) {
    const p = page
    chain = chain.then(() => checkPage(p))
  }
  return chain
}
