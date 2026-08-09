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

// The "Live Class Schedule" widget (button.live-schedule-toggle +
// #liveScheduleCollapse) only renders on courses that actually have live
// sessions — not on every course. The catalog's first card is whatever
// course happens to sort first (often a "Recorded" one), so these tests
// target a known live-sessions course directly instead of "the first card".
const LIVE_SESSIONS_COURSE_SLUG = 'live-course-1'

it('Positive - course schedule visible', () => {

  visitWithAuth(`courses/${LIVE_SESSIONS_COURSE_SLUG}`)

  cy.contains(/session|schedule/i).should('be.visible')

})

it('Positive - open live class schedule', () => {

  visitWithAuth(`courses/${LIVE_SESSIONS_COURSE_SLUG}`)

  cy.get('button.live-schedule-toggle')
    .click({ force: true })

  cy.get('#liveScheduleCollapse')
    .should('be.visible')

})

it('Live schedule toggle works', () => {

  visitWithAuth(`courses/${LIVE_SESSIONS_COURSE_SLUG}`)

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

  // Course can be either paid ("EGP180.00") or "Free" — scope to the real
  // price element instead of a bare cy.contains(), which can match the
  // literal "EGP" hidden inside an analytics <script> tag (currency: "EGP")
  // or the Debugbar's injected debug data, neither of which is visible.
  cy.get('.course-landing-page-price-wrap, .price-html-wrap')
    .should('be.visible')
    .invoke('text')
    .should('match', /EGP|Free|\$/i)

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