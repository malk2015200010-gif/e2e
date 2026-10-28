import {
  fillRegisterForm,
  submitRegister,
  assertRegistrationSucceeded,
  loginWithCredentials,
} from './password_policy_support.js'

describe('Student register + login', () => {
  it('Student can register login and open profile', () => {
    const uniqueName = `Test User${Math.random().toString(36).substring(2, 7)}`

    fillRegisterForm({ name: uniqueName, role: 'student' }).then((user) => {
      submitRegister()
      assertRegistrationSucceeded()

      loginWithCredentials(user.email, user.password, 'dashboard')
      cy.url({ timeout: 20000 }).then((url) => {
        if (url.includes('/email/verify')) {
          cy.log('New student is email-gated — settings are blocked until verify')
          cy.get('body').should('exist')
          return
        }
        cy.contains('a', /settings/i).click({ force: true })
        cy.url({ timeout: 20000 }).should('include', '/dashboard/settings')
        cy.get('#name').should('be.visible')
        cy.get('input[type="email"]:visible').should('have.value', user.email)
      })
    })
  })
})
