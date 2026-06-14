import { visitWithAuth } from '../../support/navigation'
import { STUDENT } from '../../support/users'

it('Login successfully and redirect to dashboard', () => {

    visitWithAuth('login')

    cy.get('input[type="email"]:visible')
      .type(STUDENT.email)

    cy.get('input[id="password"]:visible')
      .type(STUDENT.password)


      // Submit
    cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()

    // Assertion: دخل على dashboard
    cy.url({ timeout: 10000 }).should('include', '/dashboard')

   
  })


  it('Negative - invalid password', () => {

  visitWithAuth('login')    

  cy.get('input[type="email"]:visible')
    .type('test1776813969285@mail.com')

  cy.get('input[type="password"]:visible')
    .type('Wrong@123')

  cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()


  //cy.contains(/invalid|incorrect/i).should('be.visible')

})


it('Negative - invalid email', () => {

  visitWithAuth('login')    


  cy.get('input[type="email"]:visible')
    .type('wrong@mail.com')

  cy.get('input[type="password"]:visible')
    .type('Test@1234')

  cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()


})

it('Negative - empty fields', () => {

  visitWithAuth('login')       

  cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()

  
  })

  it('Security - SQL injection attempt', () => {

  visitWithAuth('login')    


  cy.get('input[type="email"]:visible')
    .type("' OR 1=1 --")

  cy.get('input[type="password"]:visible')
    .type('anything')

  cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"]').click()

  //cy.contains(/invalid|error/i).should('be.visible')

})

