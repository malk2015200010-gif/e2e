/**
 * Nested-project support file (cypress/cypress.config.js).
 *
 * Soft-pass is intentionally NOT enabled — it hid real failures like
 * missing Basic Auth and empty #parent_phone_number queries.
 */

import { loadBasicAuth } from '../support/users.js'

beforeEach(() => {
  loadBasicAuth()
})

Cypress.on('uncaught:exception', (err) => {
  Cypress.log({
    name: 'uncaught',
    message: (err && err.message) || String(err),
  })
  return false
})
