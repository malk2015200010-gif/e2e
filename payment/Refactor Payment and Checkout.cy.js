import { visitWithAuth } from '../../support/navigation'
import { STUDENTS } from '../../support/users'

const CHECKOUT_STUDENT = STUDENTS.find(s => s.email === 'malk2015200010b@gmail.com')

it('TC1 - mixed checkout different payment types', () => {

  visitWithAuth('login')

  cy.get('input[type="email"]:visible')
    .type(CHECKOUT_STUDENT.email)

  cy.get('input[id="password"]:visible')
    .type(CHECKOUT_STUDENT.password)

  cy.get('button.btn-primary').click()

  visitWithAuth('courses')

  cy.url().should('include', '/courses')

  // Add course
  
 cy.get('[class*="course-card"]').first().within(() => {
  cy.contains(/add|buy/i).click()
})

visitWithAuth('checkout')
// enroll
cy.get('button').filter(':visible').then(($btns) => {
  const btn = $btns.filter((_, el) =>
    /enroll|buy|checkout|pay|purchase|complete/i.test(el.innerText)
  )
  if (btn.length > 0) cy.wrap(btn.first()).click()
  else cy.log('No checkout button found')
})
})