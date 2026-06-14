import { visitWithAuth } from '../../support/navigation';

it('Valid Registration', () => {

   visitWithAuth('register')    

    const inputs = cy.get('input:visible')

    // Name
    cy.get('input[id="name"]').eq(0).type('Test User')   

    // Email
    cy.get('input[id="email"]').eq(0).type(`test${Date.now()}@mail.com`)
    // Phone
    cy.get('input[id="phone_number"]').type('1012345678')

    // Password
    cy.get('input[id="password"]').eq(0).type('Test@1234')

    // Confirm Password
    cy.get('input[id="password-confirm"]').eq(0).type('Test@1234')

    // Student
    //cy.contains('Student').click()

    // Submit
    cy.get('button[class="btn btn-primary w-100 mb-3"]').click()
  });

  it('Negative - invalid phone format', () => {
    visitWithAuth('register') 

    cy.get('input[id="name"]').type('Test User')

    cy.get('input[type="email"]:visible')
      .type(`test${Date.now()}@mail.com`)

    cy.get('input[placeholder="123456789"]')
      .type('ABC123')   // ❌ invalid phone

     cy.get('input[id="password"]').eq(0).type('Test@1234')
     cy.get('input[id="password-confirm"]').eq(0).type('Test@1234')

    //cy.contains('Student').click()

    cy.get('button[class="btn btn-primary w-100 mb-3"]').click()

   
  })

 it('Negative - invalid email format', () => {
    
  
  visitWithAuth('register')    


    
    cy.get('input[id="name"]').type('Test User')

    cy.get('input[id="email"]:visible').eq(0).type('test@')   // ❌ invalid email

    cy.get('button[class="btn btn-primary w-100 mb-3"]').click()

    })

  

  it('Negative - empty required fields', () => {
    visitWithAuth('register')    


    cy.get('button[class="btn btn-primary w-100 mb-3"]').click()

    
  })


  it('Negative - password mismatch', () => {
    visitWithAuth('register')    


    cy.get('input[id="name"]').type('Test User')

    cy.get('input[type="email"]:visible')
      .type(`test${Date.now()}@mail.com`)

    cy.get('input[id="password"]').eq(0).type('Test@1234')
    cy.get('input[id="password-confirm"]').eq(0).type('Wrong@123')

    cy.get('button[class="btn btn-primary w-100 mb-3"]').click()

    cy.get('input[id="password"]').then(($input) => {
    expect($input[0].validationMessage).to.not.equal('input[id="password-confirm"]')
    })
  })

  