import { visitWithAuth } from '../../support/navigation';

it('Positive - open course details page', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.url().should('match', /\/courses\/.+/)

})


it('Positive - instructor info visible', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.contains(/instructor/i).should('be.visible')

})

it('Positive - course schedule visible', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.contains(/session|schedule/i).should('be.visible')

})

it('Positive - open live class schedule', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })
  cy.get('button.live-schedule-toggle')
    .click({ force: true })

  cy.get('#liveScheduleCollapse')
    .should('be.visible')

})

it('Live schedule toggle works', () => {

  visitWithAuth('courses')
cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })
  cy.get('button.live-schedule-toggle')
    .click({ force: true })

  cy.get('#liveScheduleCollapse')
    .should('have.class', 'show')

  cy.get('button.live-schedule-toggle')
    .click({ force: true })

  cy.get('#liveScheduleCollapse')
    .should('not.have.class', 'show')

})

it('Positive - course price visible', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.contains(/EGP|\$/).should('be.visible')

})

it('Positive - enroll button visible', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.contains(/enroll|buy/i).should('be.visible')

})

it('Negative - page stability check', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.get('body').should('be.visible')

})

it('Negative - UI should remain stable', () => {

  visitWithAuth('courses')

  cy.get('[class*="course-card mb-4"]').first().within(() => {
    cy.get('a, button').first().click({ force: true })
  })

  cy.wait(1000)

  cy.get('body').should('not.be.empty')

})