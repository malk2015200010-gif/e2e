import { visitWithAuth } from '../../support/navigation'
import { STUDENT } from '../../support/users'

const assertStillOnLogin = () => {
  cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
  cy.get('input[type="email"]:visible').should('exist')
}

describe('Student login', () => {
  it('Login successfully and can open dashboard', () => {
    visitWithAuth('login')

    cy.get('input[type="email"]:visible').type(STUDENT.email)
    cy.get('input[id="password"]:visible').type(STUDENT.password)
    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()

    // Live student redirect is `/` (catalog home), not always `/dashboard`.
    cy.location('pathname', { timeout: 20000 }).should((path) => {
      expect(path, 'left the login page').to.not.eq('/login')
    })

    visitWithAuth('dashboard')
    cy.url({ timeout: 20000 }).should('include', '/dashboard')
  })

  it('Negative - invalid password', () => {
    visitWithAuth('login')

    cy.get('input[type="email"]:visible').type('test1776813969285@mail.com')
    cy.get('input[type="password"]:visible').type('Wrong@123')
    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()
    assertStillOnLogin()
  })

  it('Negative - invalid email', () => {
    visitWithAuth('login')

    cy.get('input[type="email"]:visible').type('wrong@mail.com')
    cy.get('input[type="password"]:visible').type('Test@1234')
    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()
    assertStillOnLogin()
  })

  it('Negative - empty fields', () => {
    visitWithAuth('login')
    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()
    assertStillOnLogin()
  })

  it('Security - SQL injection attempt', () => {
    visitWithAuth('login')

    cy.get('input[type="email"]:visible').type("' OR 1=1 --")
    cy.get('input[type="password"]:visible').type('anything')
    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()
    assertStillOnLogin()
  })
})
