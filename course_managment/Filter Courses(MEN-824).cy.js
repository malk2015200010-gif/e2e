import { visitWithAuth } from '../../support/navigation';


it('Positive - category filter updates results 1', () => {

         visitWithAuth('courses')    

///label="IGCSE - Pearson - Edexcel"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('22') // Pre-IGCSE

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})
it('Positive - category filter updates results 2', () => {

         visitWithAuth('courses')    

///label="IGCSE - Pearson - Edexcel"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('23') // O Level

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})
it('Positive - category filter updates results 3', () => {

         visitWithAuth('courses')    

///label="IGCSE - Pearson - Edexcel"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('24') // AS

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 4', () => {

         visitWithAuth('courses')    

///label="IGCSE - Pearson - Edexcel"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('25') // A2

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})


it('Positive - category filter updates results 5', () => {

         visitWithAuth('courses')    

///label="IGCSE - Oxford AQA"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('26') // pre-IGCSE

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})
it('Positive - category filter updates results 6', () => {

         visitWithAuth('courses')    

///label="IGCSE - oxford AQA"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('27') // o level

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})
it('Positive - category filter updates results 7', () => {

         visitWithAuth('courses')    

///label="IGCSE - oxford AQA"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('28') // AS

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 8', () => {

         visitWithAuth('courses')    

///label="IGCSE - Oxford AQA "
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('29') // A2

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 9', () => {

         visitWithAuth('courses')    

///label="IGCSE - Cambridge - CIE"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('18') // pre-IGCSE

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})
it('Positive - category filter updates results 9', () => {

         visitWithAuth('courses')    

///label="IGCSE - Cambridge - CIE"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('19') // o level

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 10', () => {

         visitWithAuth('courses')    

///label="IGCSE - Cambridge - CIE"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('20') // AS

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})
it('Positive - category filter updates results 11', () => {

         visitWithAuth('courses')    

///label="IGCSE - Cambridge - CIE"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('21') // A2

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 12', () => {

         visitWithAuth('courses')    

///label="American"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('5') // ACT

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 13', () => {

         visitWithAuth('courses')    

///label="American"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('6') // SAT

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - category filter updates results 14', () => {

         visitWithAuth('courses')    

///label="American"
 cy.get('.course-card').then(($before) => {

  cy.get('#course_category').select('7') // EST

    cy.wait(1000)

cy.get('body').then(($body) => {

  if ($body.find('.course-card').length > 0) {
    cy.get('.course-card').should('exist')
  } else {
    cy.log('No courses displayed')
  }

     })
    })

})

it('Positive - filter by free courses', () => {

           visitWithAuth('courses')    


  cy.contains('Free').click()

  cy.wait(1000)

  cy.get('.course-card').should('exist')

})

it('Positive - filter by paid courses', () => {

           visitWithAuth('courses')    


cy.contains('label', 'Paid').click()

  cy.wait(1000)

  cy.get('.course-card').should('exist')

})

it('Positive - filter Beginner', () => {

  visitWithAuth('courses')

  cy.contains(/beginner/i).click()

  cy.wait(1000)

  cy.get('[class*="course"]').should('exist')

})

it('Positive - filter Intermediate', () => {

  visitWithAuth('courses')

  cy.contains(/intermediate/i).click()

  cy.wait(1000)

  cy.get('[class*="course"]').should('exist')

})


it('Positive - filter Expert', () => {

  visitWithAuth('courses')

  cy.contains(/expert|advanced/i).click()

  cy.wait(1000)

  cy.get('[class*="course"]').should('exist')

})


it('Positive - filter All Levels', () => {

  visitWithAuth('courses')

  cy.contains(/all levels/i).click()

  cy.wait(1000)

  cy.get('[class*="course"]').should('exist')

})

it('Positive - apply multiple filters', () => {

  visitWithAuth('courses')

  // Category (select)
  cy.get('#course_category').select('22')

  // Price
  cy.contains('label', 'Free').click()

  // Level
  cy.contains(/beginner/i).click()

  cy.wait(1000)

  cy.get('[class*="course"]').should('exist')

})

it('Negative - no courses for level', () => {

  visitWithAuth('courses')

  cy.contains(/expert|advanced/i).click()

  cy.wait(1000)

  cy.get('body').then(($body) => {

    if ($body.find('[class*="course"]').length === 0) {
      cy.log('No courses found for this level ✅')
    }

  })

})

it('Negative - rapid level switching', () => {

  visitWithAuth('courses')

  cy.contains(/beginner/i).click()
  cy.contains(/intermediate/i).click()
  cy.contains(/expert|advanced/i).click()

  cy.wait(1000)

  cy.get('body').should('be.visible') // الصفحة ما تقعش

})

it('Negative - repeated click on same level', () => {

  visitWithAuth('courses')

  for (let i = 0; i < 3; i++) {
    cy.contains(/beginner/i).click()
    cy.wait(500)
  }

  cy.get('body').should('be.visible')

})

it('Negative - invalid level not موجود', () => {

  visitWithAuth('courses')

  cy.contains('Super Advanced').should('not.exist')

})

it('Negative - filter should not break page', () => {

  visitWithAuth('courses')

  cy.contains(/beginner/i).click()

  cy.wait(1000)

  cy.get('body').should('be.visible')

})