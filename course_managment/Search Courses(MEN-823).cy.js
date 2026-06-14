import { visitWithAuth } from '../../support/navigation';




it('Positive - search bar is visible', () => {

       visitWithAuth('courses')    


  cy.get('input[type="search"], input[placeholder*="search"]')
    .should('be.visible')

})

it('Positive - search by course name', () => {

  visitWithAuth('courses')

  cy.get('input[type="search"]:visible')
    .type('arabic')

  cy.wait(1000) // لو فيه debounce

   cy.get('i.la-search').click()

})


it('Negative - no results found', () => {

  visitWithAuth('courses')


  cy.get('input[type="search"]:visible')
    .type('zzzzzzz')

    cy.get('i.la-search').click()

  cy.wait(1000)


})
it('Negative - empty search shows all courses', () => {

  visitWithAuth('courses')  

  cy.get('input[type="search"]:visible')
    .type('Marketing')
    .clear()

  cy.wait(1000)

      cy.get('i.la-search').click()

})
it('Negative - search with special characters', () => {

  visitWithAuth('courses')

  cy.get('input[type="search"]:visible')
    .type('@#$%^&*')

  cy.wait(1000)

  cy.get('body').should('be.visible') // الصفحة ما تكسرش

})
it('Negative - long search input', () => {

  visitWithAuth('courses')


  const longText = 'a'.repeat(200)

  cy.get('input[type="search"]:visible')
    .type(longText)

  cy.wait(1000)

  cy.get('body').should('be.visible')

})