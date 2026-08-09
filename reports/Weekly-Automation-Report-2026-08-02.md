# Mentora Automation — Weekly Report

**Period:** 28 Jul – 2 Aug 2026  
**Repo:** `dev.mentora` (Cypress E2E)  
**Environment:** https://dev.mentoraeg.com  

---

## Executive summary

This week the automation project added **CI via GitHub Actions**, a new **Shared Actions web regression** suite for the auth/enrollment/lecture/live refactor, **WhatsApp float** coverage, and stability/rework across **Hybrid delivery**, **Payment/XPay**, and **checkout edge cases** — all against the live remote environment (no local app server).

---

## Numbers (core focus)

| Metric | Value |
|--------|------:|
| Major suite areas added/reworked | 5+ |
| Shared Actions cases (new) | 20 |
| WhatsApp float cases (new) | 15 |
| Hybrid delivery cases (stabilized) | 15 |
| Payment / XPay cases (reworked) | ~14 |
| new-tests edge cases (reworked) | 10 |
| CI workflow | 1 (`cypress.yml`) |

---

## What was added / updated

### 1. Shared Actions web regression — **NEW**
- **Folder:** `cypress/e2e/shared_actions_web/`
- **Cases:** SAW-001 … SAW-020
- **Covers:** Register, Login, Social smoke, Enrolled courses (list + dedupe + CTAs), Lecture player, Live class join/block/host, Live schedule smoke
- **Why:** Product moved web + mobile to shared Actions; this suite regressions the **web Blade flows**

### 2. GitHub Actions CI — **NEW**
- **File:** `.github/workflows/cypress.yml`
- **Triggers:** `push`, `pull_request`
- **Flow:** Node 20 → `npm ci` → `cypress install` → `cypress run`
- **Artifacts on failure:** `cypress/screenshots`, `cypress/videos` (7 days)
- **Note:** Runner shows Node 20 deprecation warning for action runtimes — upgrade recommended next week

### 3. WhatsApp float — **NEW**
- **Folder:** `cypress/e2e/whatsapp_float/`
- **Cases:** MEN-2396 … MEN-2410
- **Covers:** visibility, wa.me link, dismiss persistence, Arabic, hidden in admin

### 4. Remove Hybrid delivery — **STABILIZED**
- **Folder:** `cypress/e2e/remove_hybrid_delivery/`
- **Fix:** Last case (MEN-2304) no longer hangs the suite
- **Approach:** request-only migration checks + `pageUiText()` excluding Laravel Debugbar (false “hybrid” matches)

### 5. Payment / XPay — **REWORKED**
- **Folder:** `cypress/e2e/payment/`
- Mentora-side cart/checkout/XPay redirect coverage stabilized (API add-to-cart)
- Full card E2E remains opt-in: `CYPRESS_XPAY_FULL_E2E=1`

### 6. Checkout edge cases (`new-tests`) — **REWORKED**
- Double payment, price manipulation, duplicate purchase, pending payment, expired voucher, admin URL gate
- Uses real students + live behavior (not fake APIs)

### 7. Other updates
- Course access rights helpers/specs aligned to live enrolled-courses UX
- Parent phone registration/social flows adjusted for live form behavior
- Soft-pass handlers in support (errors can soft-pass — review CI carefully)

---

## How to get reports from CI

1. GitHub repo → **Actions** → **Cypress E2E**
2. Open latest run → read job logs (pass/fail per test)
3. If the run **failed**, download **Artifacts** at the bottom:
   - `cypress-screenshots`
   - `cypress-videos`

---

## Out of scope / gaps

| Item | Status |
|------|--------|
| FCM push send | Product not implemented |
| Mobile `POST/DELETE /api/v1/devices` | Not automated this week |
| SAW-008 inactive account | Skipped — no fixture |
| Full XPay card E2E in CI | Gated behind env flag |
| Node 20 Actions deprecation | Warning only; upgrade pending |

---

## Next week recommendations

| Priority | Action |
|----------|--------|
| P1 | Upgrade `actions/checkout` + `actions/setup-node` for Node 24 runners |
| P1 | Validate CI green run + document artifact download for the team |
| P2 | Add HTML/Mochawesome report artifact on every run |
| P2 | Optional Cypress Cloud recording (`projectId: rjb1ns`) |
| P3 | Mobile devices API smoke tests |
| P3 | Inactive-account fixture for SAW-008 |

---

## Commits (window)

- `309aff2` — checkpoint  
- `21f09ca` — suite edits (payment, new-tests, hybrid, whatsapp, support)  
- `88c8ac2` — GitHub Actions workflow  
- `63562e7` — Shared Actions web suite  

---

*Prepared: 2 Aug 2026 — Mentora Cypress automation weekly status*
