# Password policy — test audit

Policy applies to **new accounts only**. Existing demo users in `support/users.js` keep `123456` / `1234567`.

## Fixed — were using weak passwords on NEW account flows

| File | Issue | Fix |
|------|-------|-----|
| `instructor_assistants/instructor_assistants_support.js` | `buildAssistantUser()` used `123456` | Now uses `VALID_NEW_PASSWORD` (`Test@1234`) |
| `instructor_verification/instructor_verification_support.js` | `registerFreshInstructor()` used `123456` | Now uses `VALID_NEW_PASSWORD` |
| `instructor_assistants/instructor_assistants.MEN-1726.cy.js` | Duplicate-email test typed `123456` | Now uses `VALID_NEW_PASSWORD` |

## Correct — already compliant for new accounts

| File | Password used |
|------|----------------|
| `regestration/positive-negative-*-registration.cy.js` | `Test@1234` |
| `regestration/regestration&login_*.cy.js` | `Test@1234` |
| `parent_phone/parent_phone.cy.js` | `Test@1234` |
| `email_verification/email_verification.cy.js` | `Test@123456` (compliant) |
| `notifications/whatsapp_integration.cy.js` | `Test@1234` |
| `events/event_campaign.cy.js` | `Password123!` |
| `new-tests/TC-NEW-*.cy.js` | `Test@1234` |

## Correct — existing account login (grandfathered, do NOT change)

| File | Why OK |
|------|--------|
| `support/users.js` | Seed/demo accounts created before policy |
| `rbac/admin_roles_permissions.cy.js` | Logs in existing `student5@demo.com` with `123456` |
| `payment/`, `roster/`, `live_sessions/`, `Account_page/` | Use `INSTRUCTOR` / `STUDENT` from users.js for login |

## If these fail after policy deploys on dev

- **New-account specs** failing → app validation may differ from selectors/messages; update `PASSWORD_ERROR_RE` in `password_policy_support.js`.
- **Grandfather specs** failing → bug: existing users must not be forced to reset password on login.
- **MEN-1726 / MEN-231** failing on assistant/instructor create → confirm assistant create form enforces same rules server-side.

Run: `npm run cy:password-policy`
