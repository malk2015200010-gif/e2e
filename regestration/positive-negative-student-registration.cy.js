import { visitWithAuth } from '../../support/navigation'
import {
  fillRegisterForm,
  typeConfirmPassword,
  submitRegister,
  assertRegistrationSucceeded,
  REGISTER_SUBMIT,
} from './password_policy_support.js'

const assertStillOnRegister = () => {
  cy.url({ timeout: 15000 }).should('include', '/register')
}

describe('Student registration validation', () => {
  it('Valid Registration', () => {
    fillRegisterForm({ role: 'student' })
    submitRegister()
    assertRegistrationSucceeded()
  })

  it('Negative - invalid phone format', () => {
    visitWithAuth('register')

    cy.get('input[id="name"]').type('Test User')
    cy.get('input[type="email"]:visible').type(`test${Date.now()}@mail.com`)
    cy.get('input[placeholder="123456789"]').first().type('ABC123')
    cy.get('input[id="password"]').filter(':visible').first().clear({ force: true }).type('Test@1234', { force: true, delay: 15 })
    typeConfirmPassword('Test@1234')
    cy.get(REGISTER_SUBMIT).first().click({ force: true })
    assertStillOnRegister()
  })

  it('Negative - invalid email format', () => {
    visitWithAuth('register')
    cy.get('input[id="name"]').type('Test User')
    cy.get('input[id="email"]:visible').eq(0).type('test@')
    cy.get(REGISTER_SUBMIT).first().click({ force: true })
    assertStillOnRegister()
  })

  it('Negative - empty required fields', () => {
    visitWithAuth('register')
    cy.get(REGISTER_SUBMIT).first().click({ force: true })
    assertStillOnRegister()
  })

  it('Negative - password mismatch', () => {
    visitWithAuth('register')
    cy.get('input[id="name"]').type('Test User')
    cy.get('input[type="email"]:visible').type(`test${Date.now()}@mail.com`)
    cy.get('input[id="password"]').filter(':visible').first().clear({ force: true }).type('Test@1234', { force: true, delay: 15 })
    typeConfirmPassword('Wrong@123')
    cy.get(REGISTER_SUBMIT).first().click({ force: true })
    assertStillOnRegister()
  })
})
