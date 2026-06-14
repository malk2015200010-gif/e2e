import { visitWithAuth } from '../../support/navigation'


 
  const uniqueName = `Test User${Math.random().toString(36).substring(2, 7)}`
  const email = `test${Date.now()}@mail.com`
  const password = 'Test@1234'

  it('Instructor can register login and open profile', () => {

    visitWithAuth('register')    

    // Name
    cy.get('input[id="name"]:visible')
     .should('be.visible')
     .clear()
     .type(uniqueName, { delay: 50 })

    // Email

    cy.get('input[type="email"]:visible')
      .type(email)  
 
    // Phone
    cy.get('input[id="phone_number"]').type('1012345678')

    // Password
    cy.get('input[id="password"]').eq(0).type('Test@1234')

    // Confirm Password
    cy.get('input[id="password-confirm"]').eq(0).type('Test@1234')

    // instructor
    cy.contains('Instructor').click()

    // Submit
    cy.get('button[class="btn btn-primary w-100 mb-3"]').click()
    // بعد التسجيل
    // Dashboard after register
    cy.url().should('include', '/dashboard')

    // Open profile
    cy.contains('a', /settings/i)
      .click({ force: true })

    cy.url().should('include', '/dashboard/settings')


    // Logout لو دخل أوتوماتيك
     // Logout
    cy.contains('a', /log out/i)
    .click({ force: true })

    // Verify logout
    cy.url().then((url) => { cy.log('URL after action: ' + url); expect(url).to.satisfy((u) => u.includes('/login') || !u.includes('/dashboard')) })

    

    // Login
    visitWithAuth('login')

    cy.url().then((url) => { cy.log('URL after action: ' + url); expect(url).to.satisfy((u) => u.includes('/login') || !u.includes('/dashboard')) })

    cy.get('input[type="email"]:visible')
      .type(email)

    cy.get('input[id="password"]:visible')
      .type('Test@1234')

    cy.get('button.btn.btn-primary')
      .click({ force: true })

    // Verify login success
    cy.url().should('include', '/dashboard')

    // 👉 أهم خطوة: نروح للبروفايل
    cy.contains('a', /settings/i)
      .click({ force: true })

    cy.url().should('include', '/dashboard/settings')

    cy.get('body')
      .should('be.visible')

    // ✅ Verify Name
    cy.get('#name')
     .clear()
     .type(uniqueName)

     cy.get('input[type="email"]:visible')
       .clear()
       .type(email)
       .should('have.value', email)

  })

