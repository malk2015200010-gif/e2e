/**
 * MEN-231 — Instructor personal ID verification helpers
 *
 * Business flow (matches Mentora instructor onboarding):
 *   1. Register as instructor (email verify still required on live dig)
 *   2. Complete signed verify link from phpdebugbar mail dump
 *   3. Open Dashboard → Settings → Verification (/dashboard/settings/verification)
 *   3. Upload national ID card image
 *   4. Admin approves in /admin/verifications
 *   5. Instructor creates course and can publish
 */

import { getAppBase, loginViaApi, selectCourseCategory } from '../../support/navigation.js'
import { VALID_NEW_PASSWORD, typeConfirmPassword } from '../regestration/password_policy_support.js'
import { HTTP_AUTH, INSTRUCTOR, ADMIN } from '../../support/users.js'

export const BASE = () => getAppBase()
export const AUTH = HTTP_AUTH

const idFixture = (filename) => {
  const spec = String(Cypress.spec?.relative || '')
  const prefix = spec.startsWith('cypress/') ? 'cypress/' : ''
  return `${prefix}e2e/instructor_verification/fixtures/${filename}`
}

export const ID_SAMPLE = () => idFixture('id-sample.png')
export const ID_INVALID = () => idFixture('invalid-id.txt')

export const IDENTITY_ROUTE = '/dashboard/settings/verification'
export const ADMIN_VERIFICATIONS_ROUTE = '/admin/verifications'

export const IDENTITY_ROUTES = [
  IDENTITY_ROUTE,
  '/dashboard/settings/identity',
  '/dashboard/identity-verification',
  '/dashboard/instructor-verification',
]

/** Recorded selectors — Chrome DevTools recording 14/07/2026 */
export const ID_DOCUMENT_INPUT = '#id_document'
export const ID_UPLOAD_BTN = '#upload-btn'

export const ID_FILE_INPUT =
  '#id_document, input[type="file"][name*="id"], input[type="file"][name*="identity"], ' +
  'input[type="file"][name*="document"], input[type="file"][name*="national"], ' +
  'input[type="file"][name*="passport"], input[type="file"][name*="verification"], ' +
  'input[type="file"][accept*="image"], input[type="file"]'

export const ID_NUMBER_INPUT =
  'input[name*="national_id"], input[name*="id_number"], input[name*="identity_number"], ' +
  'input[name*="passport"], input[name*="document_number"], #national_id, #id_number'

export const IDENTITY_PAGE_RE =
  /identity verification|upload id document|upload document|personal id|national id|id card|passport|upload.*id|verify.*instructor|الهوية|البطاقة|التحقق/i

export const PENDING_STATUS_RE =
  /pending|under review|submitted|awaiting|processing|قيد المراجعة|معلق|في انتظار/i

export const APPROVED_STATUS_RE =
  /approved|verified|accepted|complete|موافق|تم التحقق|مقبول/i

export const PUBLISH_BLOCK_RE =
  /verify.*identity|identity.*verif|upload.*id|personal id|id card|national id|not verified|cannot publish|before.*publish|قبل النشر|التحقق من الهوية|ارفع.*بطاقة|البطاقة/i

export const VALIDATION_RE =
  /required|invalid|file|image|pdf|jpg|png|jpeg|document|مطلوب|غير صالح|ملف/i

/**
 * /dashboard/settings/verification has a pre-existing front-end bug: some inline
 * script calls `<el>.closest(...)` on an element that doesn't exist for certain
 * ID-status states (e.g. pending vs approved), throwing an uncaught TypeError that
 * would otherwise fail every test that visits the page — unrelated to what we're
 * actually testing (upload flow / publish gate). Swallow only this exact error.
 */
export const isIdentityPageClosestNullError = (message = '') =>
  /Cannot read propert(?:y|ies) of null \(reading 'closest'\)/i.test(message)

export const ignoreIdentityPageClosestBug = () => {
  cy.on('uncaught:exception', (err) => {
    if (isIdentityPageClosestNullError(err.message)) return false
  })
}

export const go = (path, opts = {}) =>
  cy.visit(`${BASE()}${path}`, {
    auth: AUTH,
    failOnStatusCode: false,
    timeout: 120000,
    retryOnNetworkFailure: true,
    ...opts,
  })

const extractCsrfToken = (html = '') => {
  const m = html.match(/name="_token"\s+value="([^"]+)"/) ||
    html.match(/<meta name="csrf-token" content="([^"]+)"/)
  return m ? m[1] : ''
}

const extractSignedEmailVerifyUrl = (html = '') => {
  const decoded = String(html)
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/&amp;/g, '&')
  const match = decoded.match(
    /https?:\/\/[^"'\\\s]+\/email\/verify\/\d+\/[a-f0-9]{20,}\?expires=\d+&signature=[a-f0-9]{20,}/i,
  )
  return match ? match[0] : null
}

/** Dig still gates new instructors on /email/verify. The signed link is in phpdebugbar mail. */
const completeEmailVerificationIfGated = () =>
  cy.url().then((url) => {
    if (!String(url).includes('/email/verify')) return cy.wrap(null)

    return cy.document().then((doc) => {
      const signed = extractSignedEmailVerifyUrl(doc.documentElement.outerHTML)
      if (!signed) {
        throw new Error(
          'New instructor is gated on /email/verify and no signed link was found in the page (phpdebugbar mail dump).',
        )
      }
      cy.log('Completing email verification via signed debug mail link')
      return cy.request({
        url: signed,
        auth: AUTH,
        failOnStatusCode: false,
        followRedirect: true,
        timeout: 60000,
      })
    }).then(() => go('/dashboard'))
  })

/** POST with Laravel CSRF */
export const postWithCsrf = (url, bodyFn) =>
  cy.request({ method: 'GET', url: `${BASE()}${url}`, auth: AUTH, failOnStatusCode: false }).then((res) => {
    const token = extractCsrfToken(res.body || '')
    return cy.request({
      method: 'POST',
      url: `${BASE()}${url}`,
      auth: AUTH,
      form: true,
      followRedirect: true,
      failOnStatusCode: false,
      body: bodyFn(token),
    })
  })

/**
 * Tracks whose session is currently active in the browser, independent of the
 * current URL. `ensureInstructorSession` used to infer "already logged in as the
 * right user" purely from `!cy.url().includes('/login')` — but that's wrong
 * whenever a *different* user (e.g. ADMIN, via adminApproveInstructorIdentity /
 * openAdminVerifications) logged in since, without ever visiting /login. That bug
 * silently left later steps running as ADMIN instead of the instructor — e.g. the
 * publish-tab check on the instructor's own course would see none of their courses
 * and report "no publish button" even though the real gate (ID approval) was fine.
 */
let activeSessionEmail = null

/** API login — returns chain (use inside .then by returning this call) */
export const postLogin = (email, password) =>
  loginViaApi({ email, password }).then((res) => {
    activeSessionEmail = email
    return res
  })

/**
 * Keep instructor session after registration.
 * Always returns a Cypress chain — safe to return from cy.then().
 */
export const ensureInstructorSession = (user, { clearSession = false } = {}) => {
  if (!user?.email) return postLogin(INSTRUCTOR.email, INSTRUCTOR.password)

  const reset = clearSession
    ? cy.clearCookies().then(() => cy.clearLocalStorage()).then(() => {
        activeSessionEmail = null
      })
    : cy.wrap(null)

  return reset.then(() =>
    cy.url().then((url) => {
      const alreadyThisUser = !clearSession && activeSessionEmail === user.email && !url.includes('/login')
      if (alreadyThisUser) return cy.wrap(null)

      return postLogin(user.email, user.password)
        .then(() => go('/dashboard'))
        .then(() => cy.url({ timeout: 25000 }))
        .then((afterUrl) => {
          if (!afterUrl.includes('/login')) return cy.wrap(null)

          return go('/login')
            .then(() => cy.get('input[type="email"]:visible', { timeout: 15000 }).clear().type(user.email))
            .then(() =>
              cy.get('input[id="password"], #password').filter(':visible').first().clear().type(user.password),
            )
            .then(() =>
              cy.get('button[class="btn btn-primary w-50 mx-auto d-block mb-3"], button.btn.btn-primary')
                .filter(':visible')
                .first()
                .click({ force: true }),
            )
        })
        .then(() =>
          cy.url({ timeout: 25000 }).should((u) => {
            expect(u).to.satisfy((current) => !current.includes('/login'), 'logged in after credentials')
          }),
        )
    }),
  )
}

/** @deprecated prefer ensureInstructorSession — kept for explicit re-auth */
export const loginViaCredentials = (email, password) =>
  ensureInstructorSession({ email, password }, { clearSession: true })

export const loginInstructor = () => postLogin(INSTRUCTOR.email, INSTRUCTOR.password)

const randomLetterId = (len = 12) =>
  Cypress._.times(len, () => String.fromCharCode(97 + Cypress._.random(0, 25))).join('')

export const registerFreshInstructor = (suffix = '') => {
  const letterId = randomLetterId(12)
  const tag = String(suffix).replace(/[^a-zA-Z]/g, '') || 'Instr'
  const email = `men231.${tag}.${letterId}@mail.com`
  const password = VALID_NEW_PASSWORD
  // Dev validation: English letters only, at least first + last name (no digits)
  const name = `Test ${tag} ${letterId}`
  const phone = `10${String(Date.now()).slice(-8)}`

  cy.clearCookies()
  cy.clearLocalStorage()

  go('/register')
  cy.get('body', { timeout: 15000 }).should('exist')
  cy.get('#registerForm, form[action*="register"]', { timeout: 15000 }).should('exist')

  cy.get('input[name="name"], input[id="name"]').first().clear().type(name)
  cy.get('input[name="email"], input[id="email"]').first().clear({ force: true }).type(email, { force: true })

  cy.get('#registerForm').then(($form) => {
    const $instructor = $form.find('input[name="user_as"][value="instructor"], label:nth-of-type(2) > input')
    if ($instructor.length) return cy.wrap($instructor.first()).check({ force: true })
    return cy.wrap($form).contains('label', /^Instructor$/i).click({ force: true })
  })

  cy.get('#phone_code').then(($code) => {
    if ($code.length) return cy.wrap($code).select('20', { force: true })
    return cy.wrap(null)
  })

  cy.get('#phone_number, input[name="phone_number"]').first()
    .clear({ force: true }).type(phone, { force: true })

  // Parent phone is required in HTML even when the instructor radio hides the group.
  cy.get('body').then(($b) => {
    const $parent = $b.find('#parent_phone_number, input[name="parent_phone_number"]')
    if (!$parent.length) return cy.wrap(null)
    return cy.get('#parent_phone_code').then(($code) => {
      if ($code.length) cy.wrap($code).select('20', { force: true })
    }).then(() =>
      cy.wrap($parent.first()).clear({ force: true }).type('1098765432', { force: true }),
    )
  })

  cy.get('#registerForm input#password, input[name="password"]').filter(':visible').first()
    .clear({ force: true })
    .type(password, { force: true, delay: 15 })
  typeConfirmPassword(password)

  cy.get('#registerForm').then(($form) => {
    const formEl = $form[0]
    if (formEl && typeof formEl.requestSubmit === 'function') {
      formEl.requestSubmit()
      return
    }
    cy.wrap($form).find('button[type="submit"], button').filter(':visible').first().click({ force: true })
  })

  // Native form POST is a document navigation, not XHR — do not cy.wait('@registerPost').
  cy.url({ timeout: 25000 }).should('not.include', '/register')

  // Live dig still sends new instructors to /email/verify (soft gate).
  completeEmailVerificationIfGated()

  cy.url({ timeout: 20000 }).should((url) => {
    expect(url, 'instructor reaches dashboard after email verify').to.include('/dashboard')
    expect(url, 'email verification gate cleared').not.to.include('/email/verify')
  })

  activeSessionEmail = email
  return cy.wrap({ email, password, name })
}

/** Register a fresh instructor and keep the session ready for ID upload. */
export const registerFreshInstructorReady = (suffix = Date.now()) =>
  registerFreshInstructor(suffix)
    .then((user) => ensureInstructorSession(user).then(() => cy.wrap(user)))

/** @deprecated alias — email verify step removed; use registerFreshInstructorReady */
export const registerAndVerifyFreshInstructor = registerFreshInstructorReady

/**
 * Open instructor identity verification page (Settings → Verification).
 * Primary route on dev: /dashboard/settings/verification
 */
export const openIdentityVerificationPage = (user = null) => {
  const sessionStart = user?.email
    ? ensureInstructorSession(user)
    : postLogin(INSTRUCTOR.email, INSTRUCTOR.password)

  ignoreIdentityPageClosestBug()

  return sessionStart
    .then(() => go(IDENTITY_ROUTE))
    .then(() => cy.url({ timeout: 20000 }).should('include', IDENTITY_ROUTE))
}

/** @deprecated alias — use openIdentityVerificationPage */
export const discoverAndOpenIdentityPage = openIdentityVerificationPage

export const getIdDocumentInput = () => cy.get(ID_DOCUMENT_INPUT, { timeout: 15000 })

export const getVisibleFileInput = () =>
  cy.get('body', { timeout: 15000 }).then(($b) => {
    const $idDoc = $b.find(ID_DOCUMENT_INPUT)
    if ($idDoc.length) return cy.wrap($idDoc.first())

    const $file = $b.find(ID_FILE_INPUT).filter(':visible').first()
    if ($file.length) return cy.wrap($file)

    const $hidden = $b.find('input[type="file"]').first()
    expect($hidden.length, 'identity file input').to.be.greaterThan(0)
    return cy.wrap($hidden)
  })

export const clickUploadDocumentBtn = () =>
  cy.get(ID_UPLOAD_BTN, { timeout: 15000 }).click({ force: true })

export const fillOptionalIdNumber = (value = '29912345678901') =>
  cy.get('body').then(($b) => {
    const $num = $b.find(ID_NUMBER_INPUT).filter(':visible').first()
    if ($num.length) return cy.wrap($num).clear({ force: true }).type(value, { force: true })
    return cy.wrap(null)
  })

export const submitIdentityForm = () => clickUploadDocumentBtn()

/**
 * Upload ID per recorded flow:
 *   1. Click "Upload Document" (#upload-btn)
 *   2. Choose file on #id_document
 *   3. Click "Upload Document" again to submit
 */
export const uploadInstructorIdCard = () =>
  clickUploadDocumentBtn()
    .then(() => getIdDocumentInput().selectFile(ID_SAMPLE(), { force: true }))
    .then(() => clickUploadDocumentBtn())

export const createDraftCourse = (title, user = null) => {
  const sessionStart = user?.email
    ? ensureInstructorSession(user)
    : postLogin(INSTRUCTOR.email, INSTRUCTOR.password)

  return sessionStart
    .then(() => go('/dashboard'))
    .then(() => cy.url({ timeout: 20000 }).should('include', '/dashboard'))
    .then(() => cy.contains(/create new course/i).click({ force: true }))
    .then(() => cy.url({ timeout: 20000 }).should('include', '/courses/new'))
    .then(() => cy.get('#title', { timeout: 20000 }).should('be.visible').clear().type(title))
    .then(() => cy.get('textarea').first().clear().type(`MEN-231 draft ${title}`))
    .then(() => cy.get('select[name="level"]').select('Beginner'))
    .then(() => cy.get('select[name="delivery_type"]').select('Live'))
    .then(() => cy.wait(800))
    .then(() => selectCourseCategory())
    .then(() => cy.wait(800))
    .then(() => cy.contains('label', 'Topic').parent().find('.select2-selection').click({ force: true }))
    .then(() => cy.contains('.select2-results__option', 'Math').click({ force: true }))
    .then(() => cy.contains('button', /create course/i).click({ force: true }))
    .then(() => cy.url({ timeout: 25000 }))
    .then((url) => {
      const m = url.match(/courses\/(\d+)/)
      expect(m, 'course id').to.exist
      return cy.wrap(m[1])
    })
}

export const openCoursePublishTab = (courseId) =>
  go(`/dashboard/courses/${courseId}/publish`).then(() =>
    cy.url({ timeout: 15000 }).should('include', `/dashboard/courses/${courseId}/publish`),
  )

export const readPublishGateState = ($b) => {
  const text = $b.text()
  const publishBtn = $b.find('button[name="publish_btn"][value="publish"], input[name="publish_btn"][value="publish"]')
  const alreadyPending = /Your course is in pending state|course is in pending/i.test(text)
  const blockedCopy = PUBLISH_BLOCK_RE.test(text)
  const disabledBtn = publishBtn.length && (publishBtn.is(':disabled') || publishBtn.hasClass('disabled'))
  const noPublishBtn = !publishBtn.length

  return { text, publishBtn, alreadyPending, blockedCopy, disabledBtn, noPublishBtn, canPublish: publishBtn.length && !disabledBtn }
}

export const assertPublishBlocked = (courseId, reason = 'identity not verified') =>
  openCoursePublishTab(courseId).then(() =>
    cy.get('body').then(($b) => {
      const state = readPublishGateState($b)
      expect(
        state.blockedCopy || state.disabledBtn || state.noPublishBtn,
        `publish blocked — ${reason}`,
      ).to.be.true
    }),
  )

export const assertCanSubmitCourseForPublish = (courseId) =>
  openCoursePublishTab(courseId).then(() =>
    cy.get('body').then(($b) => {
      const state = readPublishGateState($b)
      if (state.alreadyPending) return cy.wrap(null)

      expect(state.canPublish, 'publish button available after ID approval').to.be.true
      return cy.wrap(state.publishBtn).scrollIntoView().click({ force: true })
    }).then(() =>
      cy.wait(1500).then(() =>
        cy.get('body').invoke('text').should('match', /pending|submitted|review|قيد|مراجعة/i),
      ),
    ),
  )

// Routed through the local postLogin (not the imported loginViaApi) so that
// activeSessionEmail stays accurate — see the note above ensureInstructorSession.
export const loginAdmin = () =>
  cy.clearCookies().then(() => cy.clearLocalStorage()).then(() => {
    activeSessionEmail = null
    return postLogin(ADMIN.email, ADMIN.password)
  })

export const openAdminVerifications = () =>
  loginAdmin()
    .then(() => go('/admin/verifications'))
    .then(() =>
      cy.url({ timeout: 20000 }).should((url) => {
        expect(url, 'admin session must reach verifications queue').to.include('/admin/verifications')
        expect(url, 'admin must not bounce to /login').not.to.include('/login')
      }),
    )
    .then(() => cy.get('body', { timeout: 15000 }).should('exist'))

/** Decode Cloudflare email-obfuscation hex (same XOR cipher as email-decode.min.js). */
const cfDecodeEmail = (hex = '') => {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4) return ''
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  }
  return out
}

/**
 * Admin flow:
 *   clear session → login as admin → /admin/verifications → open matching
 *   /admin/verifications/{id} → Approve Verification
 *
 * Emails in the queue table are Cloudflare-obfuscated (`data-cfemail`), so we
 * match by instructor name and/or decoded cf-email — never rely on plaintext
 * email in the DOM. We also navigate by href (go) instead of clicking Review,
 * which was landing on /login when the session/click raced.
 */
export const adminApproveInstructorIdentity = (instructor) => {
  const email = (instructor?.email || '').toLowerCase()
  const name = instructor?.name || ''

  return openAdminVerifications().then(() =>
    cy.get('table tbody tr', { timeout: 15000 }).then(($rows) => {
      let detailPath = null

      $rows.each((_, el) => {
        if (detailPath) return
        const $row = Cypress.$(el)
        const text = ($row.text() || '').toLowerCase()
        const cfEmails = [...$row.find('[data-cfemail]')].map((node) =>
          cfDecodeEmail(node.getAttribute('data-cfemail') || '').toLowerCase(),
        )
        const href =
          $row.find('a[href*="/admin/verifications/"]').attr('href') ||
          $row.find('a').filter((_, a) => /review/i.test(a.textContent || '')).attr('href') ||
          ''
        const idMatch = href.match(/\/admin\/verifications\/(\d+)/)
        if (!idMatch) return

        const matchesEmail = email && (text.includes(email) || cfEmails.includes(email))
        const matchesName = name && text.includes(name.toLowerCase())
        if (matchesEmail || matchesName) {
          detailPath = `/admin/verifications/${idMatch[1]}`
        }
      })

      // Fallback: newest pending Review link if exact match not found yet
      if (!detailPath) {
        const href =
          $rows.find('a[href*="/admin/verifications/"]').first().attr('href') || ''
        const idMatch = href.match(/\/admin\/verifications\/(\d+)/)
        if (idMatch) detailPath = `/admin/verifications/${idMatch[1]}`
      }

      expect(detailPath, `pending verification row for ${email || name}`).to.be.a('string')
      return go(detailPath)
    }).then(() =>
      cy.url({ timeout: 20000 }).should((url) => {
        expect(url, 'opened verification detail as admin').to.match(/\/admin\/verifications\/\d+/)
        expect(url, 'detail must not bounce to /login').not.to.include('/login')
      }),
    ).then(() =>
      cy.contains('button, a', /approve verification/i, { timeout: 15000 }).first().click({ force: true }),
    ).then(() =>
      cy.url({ timeout: 20000 }).should('include', ADMIN_VERIFICATIONS_ROUTE),
    ),
  )
}

export const assertIdentityStatus = (pattern = PENDING_STATUS_RE) => {
  cy.get('body', { timeout: 15000 }).invoke('text').should('match', pattern)
}
