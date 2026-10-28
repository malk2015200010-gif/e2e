import { getAppBase, visitWithAuth } from '../../support/navigation';



it('View available courses', () => {

    visitWithAuth('courses')
      

    // تأكد إن الصفحة فتحت
    cy.url().should('include', '/courses')

    // تأكد إن في كورسات ظاهرة
    cy.get('body').should('contain.text', 'Course')

  })

  it('Each course card shows required data', () => {

  visitWithAuth('courses')

  cy.get('.course-card:visible').first().within(() => {

    // Title
    cy.get('h5, h4').should('not.be.empty')

    // Instructor
    cy.contains(/by/i).should('exist')

    // Image
    cy.get('img')
      .should('have.attr', 'src')
      .and('not.be.empty')

    // Price — course can be either paid ("EGP123.00") or "Free"; scope to the
    // real price element so we never accidentally match hidden analytics
    // script / debugbar content elsewhere on the page.
    cy.get('.price-html-wrap')
      .should('exist')
      .invoke('text')
      .should('match', /EGP|Free|\$/i)

  })

})

   it('Click on course opens course details page', () => {

        visitWithAuth('courses')
    

    cy.get('.course-card:visible').first().click()

    // تحقق إننا دخلنا صفحة التفاصيل
    cy.url().should('include', '/courses/')
  })


  it('Courses displayed in grid layout', () => {

        visitWithAuth('courses')


    cy.get('.course-card:visible')
      .its('length')
      .should('be.greaterThan', 1)

  })


  it('Negative - no courses available', () => {

      visitWithAuth('courses')

  // لو مفيش كورسات
  cy.get('body').then(($body) => {

    if ($body.find('.course-card').length === 0) {
      cy.contains(/no courses/i).should('be.visible')
    }

  })

})

it('Negative - course card missing data', () => {

  visitWithAuth('courses')
   

  cy.get('.course-card').first().within(() => {

    cy.get('img').should('have.attr', 'src').and('not.be.empty')

  })

})

it('Negative - course image not broken', () => {

      visitWithAuth('courses')


  cy.get('.course-card img').each(($img) => {
    expect($img[0].naturalWidth).to.be.greaterThan(0)
  })

})

it('Negative - course details page should open correctly', () => {

  visitWithAuth('courses')


  cy.get('.course-card').first().click()

  cy.url().should('not.eq', `${getAppBase()}/courses`)

})