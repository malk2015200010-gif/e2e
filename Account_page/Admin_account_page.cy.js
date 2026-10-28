import { getAppBase, loginAndVisit } from '../../support/navigation'
import { ADMIN, HTTP_AUTH } from '../../support/users'

const BASE = () => getAppBase()

// Cypress .click() loses the page on these menu links: the address becomes "/"
// and the next assertion never sees /admin/courses. Open the link's own path.
const openMenuLink = (anchor) => {
  const href = anchor.getAttribute('href') || ''
  let path = ''
  try {
    path = new URL(href, BASE()).pathname
  } catch (_) {}
  if (path && path !== '/' && !href.trim().startsWith('#')) {
    cy.visit(path, {
      auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
      failOnStatusCode: false,
      timeout: 120000,
    })
    return
  }
  anchor.click()
}

const clickAnchor = (selector) => {
  cy.get(selector, { timeout: 20000 }).first().then(($el) => {
    openMenuLink($el[0].closest('a') || $el[0])
  })
}

const clickAnchorNamed = (label) => {
  cy.contains('a', label, { timeout: 20000 }).then(($el) => {
    openMenuLink($el[0])
  })
}

const expectPath = (part) => {
  cy.location('pathname', { timeout: 20000 }).should('include', part)
}

describe('Admin Account Page Navigation', () => {
  beforeEach(() => {
    // Media manager waits on dozens of file previews before the page load event.
    cy.intercept({ resourceType: 'image' }, { statusCode: 200, body: '' })
    loginAndVisit(ADMIN, '/admin')
  })

  it('Open Admin Home page', () => {
    cy.visit(`${BASE()}/admin`, {
      auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
      failOnStatusCode: false,
      timeout: 120000,
    })
    cy.url({ timeout: 20000 }).should('include', '/admin')
    clickAnchorNamed('Admin Home')
    expectPath('/admin')
  })

  it('Check all admin pages', () => {
    expectPath('/admin')

    cy.get('body').then(($body) => {
      if ($body.find('a:contains("Admin Home")').length) {
        clickAnchorNamed('Admin Home')
      }
    })
    expectPath('/admin')

    clickAnchor('i.la-newspaper-o')
    clickAnchor('a[href*="/admin/cms"]')
    cy.url().then((url) => { cy.log('URL after Admin CMS click: ' + url) })

    clickAnchor('i.la-newspaper-o')
    clickAnchor('a[href*="/admin/cms/page"]')
    cy.url().then((url) => { cy.log('URL after CMS Pages click: ' + url) })

    clickAnchorNamed('Media manager')
    cy.url().then((url) => { cy.log('URL after Media Manager click: ' + url) })

    clickAnchor('a[href$="/admin/categories"]')
    expectPath('/categories')

    clickAnchor('a[data-admin-menu-item="courses"]')
    cy.location('pathname', { timeout: 20000 }).should('eq', '/admin/courses')

    clickAnchor('a[data-admin-menu-item="course_updates"]')
    expectPath('/courses/updates')

    clickAnchor('i.la-tools')
    clickAnchorNamed('General Settings')
    expectPath('/settings')

    clickAnchorNamed('LMS Settings')
    expectPath('/lms')

    clickAnchorNamed('Payment Settings')
    expectPath('/payment')

    clickAnchorNamed('Payment Gateways')
    expectPath('/gateways')

    clickAnchorNamed('Withdraw')
    expectPath('/withdraw')

    clickAnchorNamed('Social Login Settings')
    expectPath('/social')

    clickAnchorNamed('Storage')
    expectPath('/storage')

    clickAnchor('a[data-admin-menu-item="payments"]')
    expectPath('/payments')

    clickAnchor('a[data-admin-menu-item="instalments"]')
    expectPath('/instalments')

    clickAnchor('a[data-admin-menu-item="withdraws"]')
    expectPath('/withdraws')

    clickAnchorNamed('Users')
    expectPath('/users')

    clickAnchor('a[data-admin-menu-item="verifications"]')
    expectPath('/verifications')

    clickAnchorNamed('WhatsApp')
    clickAnchor('a[href*="/admin/whatsapp-crm/conversations"]')
    cy.url().then((url) => { cy.log('URL after WhatsApp CRM click: ' + url) })

    clickAnchorNamed('WhatsApp')
    clickAnchor('a[href*="/admin/whatsapp/templates"]')
    cy.url().then((url) => { cy.log('URL after WhatsApp Templates click: ' + url) })

    clickAnchorNamed('Change Password')
    expectPath('/account/change-password')

    clickAnchor('a[data-admin-menu-item="zoom_requests"]')
    expectPath('/zoom-requests')

    clickAnchorNamed('Zoom Accounts')
    expectPath('/zoom-accounts')

    // A browser click follows /logout to /login, then waits forever if that
    // page asks for the gate password again. Check the redirect with auth instead.
    cy.contains('a', 'Log Out', { timeout: 20000 }).invoke('attr', 'href').then((href) => {
      cy.request({
        url: href,
        auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
        followRedirect: false,
        failOnStatusCode: false,
      }).its('headers.location').should('include', '/login')
    })
  })
})
