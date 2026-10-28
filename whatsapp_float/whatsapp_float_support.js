/**
 * WhatsApp Floating Button — helpers
 *
 * Story: Show a fixed WhatsApp button on all public pages. Clicking it opens
 * a chat with Mentora via the existing wa.me URL. Users can dismiss it with
 * a close button.
 *
 * Business update: icon is visible again on reload — dismiss only removes the
 * element for the current page instance (no localStorage persistence).
 *
 * Live markup (probed on dev.mentoraeg.com):
 *   <div id="mentora-whatsapp-float" class="mentora-whatsapp-float" hidden
 *        role="complementary" aria-label="Chat with Mentora on WhatsApp">
 *     <button class="mentora-whatsapp-float__dismiss" aria-label="Dismiss WhatsApp chat button">×</button>
 *     <a class="mentora-whatsapp-float__link" target="_blank" rel="noopener"
 *        href="https://wa.me/201202292768?text=...">
 *       <i class="la la-whatsapp"></i>
 *     </a>
 *   </div>
 *
 * Behavior (inline script):
 *   - Always show: floatEl.hidden = false on load
 *   - Clicking dismiss -> floatEl.remove() for this page only
 *   - Reload / new visit -> widget rendered again and shown
 */

import { getAppBase, loginViaApi } from '../../support/navigation.js'
import { STUDENT, ADMIN, basicAuth } from '../../support/users.js'

export const BASE = () => getAppBase()
export const AUTH = basicAuth


export const WHATSAPP_PHONE = '201202292768'
/** Legacy key (no longer used by product for persistence; kept for negative asserts). */
export const STORAGE_KEY = 'mentora_whatsapp_float_dismissed'

export const WIDGET_SEL = '#mentora-whatsapp-float'
export const LINK_SEL = `${WIDGET_SEL} a.mentora-whatsapp-float__link`
export const DISMISS_SEL = `${WIDGET_SEL} button.mentora-whatsapp-float__dismiss`
export const ICON_SEL = `${LINK_SEL} i.la-whatsapp`

// A representative sample of public pages the widget should appear on.
export const PUBLIC_PAGES = ['', 'courses', 'login', 'register', 'about-us', 'contact-us', 'instructors']

// The cookie-consent bar (#mentora-cookie-consent-bar) is a full-width,
// position:fixed / bottom:0 / z-index:100000 banner that the server only
// triggers ("bar.style.display = 'block'") when no consent choice has been
// recorded yet — which is exactly the fresh-guest state these tests start
// from. It visually covers the WhatsApp button's own fixed bottom-right
// corner (z-index:9999), so Cypress's actionability check correctly reports
// the WhatsApp widget as "covered by another element" and fails visibility
// assertions. This is unrelated to the WhatsApp feature under test, so we
// pre-set the consent cookie the server checks for, which suppresses the
// banner entirely (confirmed against the live server) instead of clicking
// through an unrelated widget in every test.
const suppressCookieConsentBar = () => {
  cy.setCookie('mentora_analytics_consent', 'granted', { domain: new URL(BASE()).hostname })
}

export const go = (path, opts = {}) => {
  suppressCookieConsentBar()
  // Strip any leading slash from `path` before joining — collapsing
  // duplicate slashes on the *whole* URL string (as a previous version of
  // this helper did) also corrupted the "https://" protocol separator into
  // "https:/", since it's just as much a run of 2+ slashes as an accidental
  // "//dashboard" would be.
  const cleanPath = String(path).replace(/^\/+/, '')
  const url = cleanPath ? `${BASE()}/${cleanPath}` : `${BASE()}/`
  return cy.visit(url, {
    auth: basicAuth(),
    failOnStatusCode: false,
    timeout: 60000,
    ...opts,
  })
}

/**
 * Fresh guest session on a public page (widget always shown on load).
 */
export const goFresh = (path = '') => {
  cy.clearCookies()
  go(path)
  // Clear any leftover legacy dismiss flag from older product versions.
  clearDismissedFlag()
  cy.reload()
}

export const clearDismissedFlag = () => {
  cy.window({ log: false }).then((win) => {
    try {
      win.localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      // localStorage may not be accessible before the first visit — ignore.
    }
  })
}

export const getDismissedFlag = () =>
  cy.window().then((win) => win.localStorage.getItem(STORAGE_KEY))

export const widget = () => cy.get(WIDGET_SEL, { timeout: 15000 })

export const assertWidgetVisible = () => {
  widget().should('exist').and('be.visible')
}

export const assertWidgetNotVisible = () => {
  cy.get('body').then(($body) => {
    const $w = $body.find(WIDGET_SEL)
    // After dismiss click the element is removed from the DOM.
    if ($w.length === 0) return
    cy.wrap($w).should('satisfy', ($el) => $el.is(':hidden') || $el.attr('hidden') !== undefined)
  })
}

export const dismissWidget = () => {
  // The (×) dismiss button is only visually revealed on hover/focus-within
  // (opacity/visibility CSS), which Cypress cannot simulate as a genuine
  // browser :hover state. It's still a real, always-present button in the
  // DOM, so a forced click (bypassing the visibility actionability check)
  // correctly exercises its click handler exactly as a real user click would.
  cy.get(DISMISS_SEL, { timeout: 15000 }).should('exist').click({ force: true })
}

export const assertDismissButtonAccessible = () => {
  // NOTE: the one-argument form `have.attr('aria-label')` changes the
  // yielded subject to the attribute's string value (chai-jquery behavior),
  // so the next `.should()` asserts directly on that string.
  cy.get(DISMISS_SEL, { timeout: 15000 })
    .should('exist')
    .and('have.attr', 'aria-label')
    .should('not.be.empty')
}

export const assertWaMeLink = () => {
  cy.get(LINK_SEL, { timeout: 15000 }).should(($a) => {
    const href = $a.attr('href') || ''
    expect(href, 'wa.me href').to.match(new RegExp(`^https://wa\\.me/${WHATSAPP_PHONE}(\\?|$)`))
  })
}

export const assertWaMeGreetingText = () => {
  return cy.get(LINK_SEL, { timeout: 15000 })
    .invoke('attr', 'href')
    .then((href) => {
      const url = new URL(href)
      const text = url.searchParams.get('text')
      expect(text, 'pre-filled greeting text').to.be.a('string')
      expect(text.length, 'greeting text length').to.be.greaterThan(0)
      return text
    })
}

export const loginStudent = () =>
  loginViaApi(STUDENT).then(() => {
    go('dashboard')
    return cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => !u.includes('/login'), 'student logged in')
    })
  })

export const loginAdmin = () =>
  loginViaApi(ADMIN).then(() => {
    go('admin')
    // Assert we actually landed on /admin (not just "somewhere that isn't
    // /login") — a weaker check here previously let the test silently pass
    // through to the widget assertion even when the visit didn't land on
    // the real admin layout, producing a confusing failure downstream.
    return cy.url({ timeout: 20000 }).should('include', '/admin')
  })

// Distinctive markers that only exist in the real admin panel layout
// (confirmed against the live server's rendered /admin HTML) — used to make
// sure the negative "widget is absent" assertion is checked against the
// actual admin page, not a page we were unexpectedly redirected to.
export const ADMIN_LAYOUT_MARKER_SEL = '#adminSidebarToggle, .admin-topbar'

export const assertOnAdminPanel = () => {
  cy.get(ADMIN_LAYOUT_MARKER_SEL, { timeout: 15000 }).should('exist')
}
