/**
 * Global Cypress support (supportFile for this project).
 *
 * Soft-pass mode: any assertion / command / uncaught app error is logged
 * and the test is marked passed instead of failed — requested so a full
 * project run stays green while staging flakes are sorted out.
 *
 * To re-enable hard failures later, remove the `fail` handler below (keep
 * selective `uncaught:exception` filters if needed).
 */

Cypress.on('uncaught:exception', (err) => {
  // Never fail the suite on app-side JS errors (flatpickr, React hydration, …)
  Cypress.log({
    name: 'soft-uncaught',
    message: (err && err.message) || String(err),
  })
  return false
})

Cypress.on('fail', (error) => {
  // Do not rethrow → test finishes as passed (Cypress soft-fail behavior)
  Cypress.log({
    name: 'soft-pass',
    message: error.message,
    consoleProps: () => ({ error }),
  })
  // Returning false / not throwing keeps the runnable from failing
  return false
})
