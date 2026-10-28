import { getAppBase, loginAndVisit } from '../../support/navigation'
import { HTTP_AUTH, INSTRUCTOR } from '../../support/users'

const exposed = (key) => {
  try {
    return String(Cypress.expose(key) || '')
  } catch (_) {
    return ''
  }
}

const instructorAccount = () => {
  const email = exposed('instructor_email')
  const password = exposed('instructor_password')
  if (email && password) return { email, password }
  return INSTRUCTOR
}

const openPath = (hrefSuffix) => {
  cy.get(`a[href$="${hrefSuffix}"]`, { timeout: 20000 }).first().then(($a) => {
    const path = new URL($a.attr('href'), getAppBase()).pathname
    cy.visit(path, {
      auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
      failOnStatusCode: false,
      timeout: 120000,
    })
  })
  cy.location('pathname', { timeout: 20000 }).should('include', hrefSuffix)
}

const logout = () => {
  cy.get('a[href$="/logout"]', { timeout: 20000 }).invoke('attr', 'href').then((href) => {
    cy.request({
      url: href,
      auth: { username: HTTP_AUTH.username, password: HTTP_AUTH.password },
      followRedirect: false,
      failOnStatusCode: false,
    }).its('headers.location').should('include', '/login')
  })
}

describe('Instructor Account Page Navigation', () => {
  beforeEach(() => {
    loginAndVisit(instructorAccount(), '/dashboard')
    cy.url().should('include', '/dashboard')
  })

  it('Open Dashboard page', () => {
    openPath('/dashboard')
    openPath('/dashboard/courses/new')
    openPath('/dashboard/my-courses')
    openPath('/dashboard/earning')
    openPath('/dashboard/withdraw')
    openPath('/dashboard/my-courses-reviews')
    openPath('/dashboard/courses-has-quiz')
    openPath('/dashboard/assignments')
    openPath('/dashboard/discussions')
    openPath('/dashboard/enrolled-courses')
    openPath('/my-instalments')
    openPath('/dashboard/wishlist')
    openPath('/dashboard/reviews-i-wrote')
    openPath('/dashboard/my-quiz-attempts')
    openPath('/dashboard/purchases')
    openPath('/dashboard/settings')
    logout()
  })

  it('Open Create New Course page', () => {
    openPath('/dashboard/courses/new')
  })

  it('Open My Courses page', () => {
    openPath('/dashboard/my-courses')
  })

  it('Open Earnings page', () => {
    openPath('/dashboard/earning')
  })

  it('Open Withdraw page', () => {
    openPath('/dashboard/withdraw')
  })

  it('Open My Courses Reviews page', () => {
    openPath('/dashboard/my-courses-reviews')
  })

  it('Open Quiz Attempts page', () => {
    openPath('/dashboard/courses-has-quiz')
  })

  it('Open Assignments page', () => {
    openPath('/dashboard/assignments')
  })

  it('Open Discussions page', () => {
    openPath('/dashboard/discussions')
  })

  it('Open Enrolled Courses page', () => {
    openPath('/dashboard/enrolled-courses')
  })

  it('Open My Instalments page', () => {
    openPath('/my-instalments')
  })

  it('Open Wishlist page', () => {
    openPath('/dashboard/wishlist')
  })

  it('Open Reviews page', () => {
    openPath('/dashboard/reviews-i-wrote')
  })

  it('Open My Quiz Attempts page', () => {
    openPath('/dashboard/my-quiz-attempts')
  })

  it('Open Purchase History page', () => {
    openPath('/dashboard/purchases')
  })

  it('Open Settings page', () => {
    openPath('/dashboard/settings')
  })

  it('Logout successfully', () => {
    logout()
  })
})
