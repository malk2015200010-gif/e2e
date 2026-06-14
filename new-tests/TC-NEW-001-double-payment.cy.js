import { visitWithAuth } from '../../support/navigation'
import { STUDENTS } from '../../support/users'

const TEST_STUDENT = STUDENTS.find(s => s.email === 'malk2015200010q@gmail.com')

describe('TC-NEW-001: Prevent Duplicate Payment When Pending Payment Exists', () => {

  beforeEach(() => {

    visitWithAuth('login')

    cy.get('input[type="email"]:visible')
      .type(TEST_STUDENT.email)

    cy.get('#password')
      .type(TEST_STUDENT.password)

    cy.get('button.btn-primary')
      .click()

    cy.url().should('include', '/dashboard')
  })

  it('Should prevent creating a second payment while another payment is pending', () => {

    // Add course
    visitWithAuth('courses')

    cy.get('.add-to-cart-btn')
      .first()
      .should('be.visible')
      .click()

    cy.get('.badge.badge-pill')
      .should('contain.text', '1')

    // Go to checkout
    visitWithAuth('checkout')

    cy.url().should('include', '/checkout')

    const clickEnrollBtn = () => {
      cy.get('button').filter(':visible').then(($btns) => {
        const btn = $btns.filter((_, el) =>
          /enroll|buy|checkout|pay|purchase|complete/i.test(el.innerText)
        )
        if (btn.length > 0) cy.wrap(btn.first()).click()
        else cy.log('No enroll button found on this visit')
      })
    }

    // First payment attempt
    clickEnrollBtn()

    // Go back to checkout
    visitWithAuth('checkout')
    cy.url().should('include', '/checkout')

    // Second payment attempt
    clickEnrollBtn()

    // Verify pending payment warning message
    cy.contains('You already have a pending payment')
      .should('be.visible')

    cy.contains('Please wait')
      .should('be.visible')

  })

})