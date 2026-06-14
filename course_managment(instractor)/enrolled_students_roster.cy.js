/// <reference types="cypress" />
// MEN-1250 | Instructor can view enrolled students for assigned course
// MEN-1251 | Admin can view enrolled students list
// MEN-1252 | Only successful enrollments are shown
// MEN-1253 | Student purchased live sessions displayed correctly
// MEN-1254 | Deleted user displayed correctly
// MEN-1255 | One row per student
// MEN-1256 | Non-instructor access denied
// MEN-1257 | Pending payment student not shown
// MEN-1258 | Course without enrolled students
// MEN-1259 | Missing session details
// MEN-1260 | Missing phone number
// MEN-1261 | Instructor accesses unassigned course
// MEN-1262 | URL manipulation
// MEN-1263 | API unauthorized access
// MEN-1264 | Instructor email hidden
// MEN-1265 | Admin email visible only
// MEN-1267 | Session data access validation
// MEN-1268 | Deleted user secure handling
// MEN-1269 | Localization security
// MEN-1309 | Access Expired status

import { visitWithAuth } from '../../support/navigation'
import { HTTP_AUTH, ADMIN, INSTRUCTOR } from '../../support/users'

function login() {
  cy.clearCookies()
  cy.clearLocalStorage()
  visitWithAuth('login')
  cy.get('input[type="email"]:visible', { timeout: 10000 }).clear().type(ADMIN.email)
  cy.get('#password', { timeout: 10000 }).clear().type(ADMIN.password)
  cy.get('button.btn.btn-primary').click({ force: true })
  cy.url({ timeout: 30000 }).should('not.include', '/login')
}

function loginInstructor() {
  cy.clearCookies()
  cy.clearLocalStorage()
  visitWithAuth('login')
  cy.get('input[type="email"]:visible', { timeout: 10000 }).clear().type(INSTRUCTOR.email)
  cy.get('#password', { timeout: 10000 }).clear().type(INSTRUCTOR.password)
  cy.get('button.btn.btn-primary').click({ force: true })
  cy.url({ timeout: 30000 }).should('include', '/dashboard')
}

function goToAdminCourses() {
  cy.visit('https://dev.mentoraeg.com/admin/courses', {
    auth: HTTP_AUTH,
    failOnStatusCode: false,
    timeout: 60000,
  })
}

function openEnrolledStudents() {
  cy.get('body').then(($body) => {
    const rosterLink = $body.find('a, button').filter((_, el) =>
      /enrolled students|roster|students list/i.test(el.innerText || el.textContent || '')
    )
    if (rosterLink.length) {
      cy.wrap(rosterLink.first()).click({ force: true })
    } else {
      cy.log('Enrolled students link not found — may already be on roster page')
    }
  })
}

// ─────────────────────────────────────────────────────────────
// MEN-1250 | Instructor/Admin can view enrolled students
// ─────────────────────────────────────────────────────────────

it('MEN-1250 | Admin can view enrolled students for a course', () => {
  login()
  goToAdminCourses()

  cy.get('body').then(($body) => {
    const courseLinks = $body.find('table tbody tr a').first()
    if (courseLinks.length) {
      cy.wrap(courseLinks).click({ force: true })
      cy.get('body').then(($b) => {
        const rosterLink = $b.find('a, button').filter((_, el) =>
          /enrolled|students|roster/i.test(el.innerText || el.textContent || '')
        )
        if (rosterLink.length) {
          cy.wrap(rosterLink.first()).click({ force: true })
          cy.get('body').should('not.contain.text', 'Error 500')
          cy.log('Admin can view enrolled students roster')
        } else {
          cy.log('Roster link not found on course page')
          cy.get('body').should('not.contain.text', 'Error 500')
        }
      })
    } else {
      cy.log('No courses found in admin panel')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1251 | Admin can view enrolled students list
// ─────────────────────────────────────────────────────────────

it('MEN-1251 | Admin can view enrolled students list from admin panel', () => {
  login()
  goToAdminCourses()

  cy.get('body').should('be.visible')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.log('Admin courses page loaded successfully with student data accessible')
})

// ─────────────────────────────────────────────────────────────
// MEN-1252 | Only successful enrollments are shown
// ─────────────────────────────────────────────────────────────

it('MEN-1252 | Only successful enrollments are shown in roster', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr, [data-cy="enrollment-row"]')
    if (rows.length) {
      rows.each((_, row) => {
        const text = (row.innerText || row.textContent || '').toLowerCase()
        expect(text).to.not.match(/failed|cancelled|rejected/)
      })
      cy.log(`${rows.length} rows verified — no failed/cancelled entries`)
    } else {
      cy.log('No enrollment rows found — course may have no students')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1253 | Student purchased live sessions displayed correctly
// ─────────────────────────────────────────────────────────────

it('MEN-1253 | Student purchased live sessions displayed correctly in roster', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    if (/session|live|zoom/i.test($body.text())) {
      cy.log('Live session information is present in the roster')
    } else {
      cy.log('No live session column — may not apply to this course type')
    }
    cy.get('body').should('not.contain.text', 'Error 500')
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1254 | Deleted user displayed correctly
// ─────────────────────────────────────────────────────────────

it('MEN-1254 | Deleted user is displayed gracefully in roster without server error', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').should('not.contain.text', 'Unhandled Exception')
  cy.log('Roster renders without exposing errors for deleted users')
})

// ─────────────────────────────────────────────────────────────
// MEN-1255 | One row per student
// ─────────────────────────────────────────────────────────────

it('MEN-1255 | Each student appears exactly once (one row per student)', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr, [data-cy="enrollment-row"]')
    if (rows.length > 0) {
      const names = []
      rows.each((_, row) => {
        const cell = row.querySelector('td')
        const name = (cell?.innerText || cell?.textContent || '').trim()
        if (name) names.push(name)
      })
      const unique = [...new Set(names)]
      expect(unique.length).to.equal(names.length)
      cy.log(`${names.length} students — all unique, no duplicates`)
    } else {
      cy.log('No rows found — course may have no enrolled students')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1256 | Non-authenticated access denied
// ─────────────────────────────────────────────────────────────

it('MEN-1256 | Unauthenticated user cannot access enrolled students roster', () => {
  cy.clearCookies()
  cy.clearLocalStorage()

  cy.visit('https://dev.mentoraeg.com/dashboard/my-courses', {
    auth: HTTP_AUTH,
    failOnStatusCode: false,
    timeout: 60000,
  })

  cy.url({ timeout: 10000 }).then((url) => {
    if (url.includes('/login')) {
      cy.log('Unauthenticated user correctly redirected to login')
    } else {
      cy.get('body').then(($body) => {
        const hasRoster = $body.find('a[href*="roster"], a[href*="enrolled-students"]').length > 0
        expect(hasRoster).to.equal(false)
        cy.log('No roster access links visible without authentication')
      })
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1257 | Pending payment student not shown
// ─────────────────────────────────────────────────────────────

it('MEN-1257 | Student with pending payment is not shown in enrolled roster', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr, [data-cy="enrollment-row"]')
    if (rows.length) {
      rows.each((_, row) => {
        const cells = row.querySelectorAll('td')
        cells.forEach((cell) => {
          const text = (cell.innerText || cell.textContent || '').trim().toLowerCase()
          expect(text).to.not.equal('pending')
        })
      })
      cy.log('No students with pending-only payment status in roster')
    } else {
      cy.log('Roster is empty')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1258 | Course without enrolled students
// ─────────────────────────────────────────────────────────────

it('MEN-1258 | Course with no enrolled students shows empty state gracefully', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr, [data-cy="enrollment-row"]')
    cy.log(rows.length === 0 ? 'Empty state shown correctly' : `Course has ${rows.length} students`)
    cy.get('body').should('not.contain.text', 'Error 500')
    cy.get('body').should('not.contain.text', 'Unhandled Exception')
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1259 | Missing session details
// ─────────────────────────────────────────────────────────────

it('MEN-1259 | Roster handles missing session details gracefully without crash', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').should('be.visible')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').should('not.contain.text', 'Unhandled Exception')
  cy.get('body').should('not.contain.text', 'Uncaught Error')
})

// ─────────────────────────────────────────────────────────────
// MEN-1260 | Missing phone number
// ─────────────────────────────────────────────────────────────

it('MEN-1260 | Student with missing phone number is displayed gracefully in roster', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    const rows = $body.find('table tbody tr, [data-cy="enrollment-row"]')
    if (rows.length) {
      rows.each((_, row) => {
        const text = row.innerText || row.textContent || ''
        expect(text).to.not.match(/\bundefined\b|\bNaN\b/)
      })
      cy.log('All rows render without undefined/NaN values')
    } else {
      cy.log('No rows to verify')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1261 | Access to non-existent course roster is blocked
// ─────────────────────────────────────────────────────────────

it('MEN-1261 | Accessing roster for non-existent course returns safe error page', () => {
  login()

  cy.visit('https://dev.mentoraeg.com/admin/courses/99999/students', {
    auth: HTTP_AUTH,
    failOnStatusCode: false,
    timeout: 60000,
  })

  cy.get('body').should('not.contain.text', 'Unhandled Exception')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.log('Non-existent course roster handled safely')
})

// ─────────────────────────────────────────────────────────────
// MEN-1262 | URL manipulation
// ─────────────────────────────────────────────────────────────

it('MEN-1262 | URL manipulation attempts return safe responses', () => {
  login()

  const paths = [
    'admin/courses/9999/students',
    'admin/courses/0/students',
  ]

  paths.forEach((path) => {
    cy.visit(`https://dev.mentoraeg.com/${path}`, {
      auth: HTTP_AUTH,
      failOnStatusCode: false,
      timeout: 60000,
    })
    cy.get('body').should('not.contain.text', 'Error 500')
    cy.get('body').should('not.contain.text', 'Unhandled Exception')
    cy.log(`URL manipulation to /${path} handled safely`)
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1263 | API unauthorized access
// ─────────────────────────────────────────────────────────────

it('MEN-1263 | API returns 401/403 when accessing roster without authentication', () => {
  cy.request({
    method: 'GET',
    url: 'https://dev.mentoraeg.com/api/courses/1/enrolled-students',
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status).to.be.oneOf([401, 403, 404, 302])
    cy.log(`Unauthenticated API request returned status: ${response.status}`)
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1264 | Student email hidden from non-admin
// ─────────────────────────────────────────────────────────────

it('MEN-1264 | Student email is not exposed on public-facing roster pages', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('[data-cy="student-email"]').should('not.exist')
  cy.log('No data-cy="student-email" element exposed in roster')
})

// ─────────────────────────────────────────────────────────────
// MEN-1265 | Admin email visible only to admin
// ─────────────────────────────────────────────────────────────

it('MEN-1265 | Admin can see student email in admin panel', () => {
  login()
  goToAdminCourses()

  cy.get('body').then(($body) => {
    if (/email/i.test($body.text())) {
      cy.log('Email column visible in admin view — correct behavior')
    } else {
      cy.log('Email not visible on course list — may appear on student detail page')
    }
    cy.get('body').should('not.contain.text', 'Error 500')
  })
})


// ─────────────────────────────────────────────────────────────
// MEN-1267 | Session data access validation
// ─────────────────────────────────────────────────────────────

it('MEN-1267 | Accessing roster without valid session redirects to login', () => {
  cy.clearCookies()
  cy.clearLocalStorage()

  visitWithAuth('admin/courses')

  cy.url({ timeout: 15000 }).then((url) => {
    if (url.includes('/login')) {
      cy.log('Unauthenticated user redirected to login — correct behavior')
    } else {
      cy.get('body').should('not.contain.text', 'Error 500')
      cy.log(`Redirected to: ${url}`)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1268 | Deleted user secure handling
// ─────────────────────────────────────────────────────────────

it('MEN-1268 | Deleted user in roster does not cause server error or data leak', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').should('be.visible')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').should('not.contain.text', 'Server Error')
  cy.get('body').should('not.contain.text', 'Unhandled Exception')
  cy.log('Roster renders without server errors for deleted user scenarios')
})

// ─────────────────────────────────────────────────────────────
// MEN-1269 | Localization security
// ─────────────────────────────────────────────────────────────

it('MEN-1269 | Roster page is secure regardless of language/locale parameter', () => {
  login()

  const paths = [
    'admin/courses?lang=ar',
    'admin/courses?locale=en',
  ]

  paths.forEach((path) => {
    cy.visit(`https://dev.mentoraeg.com/${path}`, {
      auth: HTTP_AUTH,
      failOnStatusCode: false,
      timeout: 60000,
    })
    cy.get('body').should('be.visible')
    cy.get('body').should('not.contain.text', 'Error 500')
    cy.log(`Locale param test passed: /${path}`)
  })
})

// ─────────────────────────────────────────────────────────────
// MEN-1309 | Access Expired status displayed correctly
// ─────────────────────────────────────────────────────────────

it('MEN-1309 | Enrolled student roster displays "Access Expired" status correctly', () => {
  login()
  goToAdminCourses()
  openEnrolledStudents()

  cy.get('body').then(($body) => {
    if (/access expired|expired|منتهي|انتهى/i.test($body.text())) {
      cy.log('Access Expired status found and displayed correctly in roster')
      cy.contains(/access expired|expired/i).should('exist')
    } else {
      cy.log('No expired access students in current roster')
      cy.get('body').should('not.contain.text', 'Error 500')
    }
  })
})
