/**
 * Soft-pass is DISABLED.
 *
 * Previously this file registered Cypress.on('fail') → return false, which
 * stayed active for the whole Cypress session (including other specs like
 * parent_phone) and caused false greens + cy.first() on undefined.
 *
 * Keep this file as a no-op so existing imports do not break.
 */
