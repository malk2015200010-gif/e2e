# Parent Phone — Test vs Platform vs Environment

## Run this first (Terminal)

```bash
cd /Users/admin/Documents/GitHub/dev.mentora
bash cypress/e2e/parent_phone/RUN_DIAGNOSTIC.sh
```

Log file: `cypress/e2e/parent_phone/last-run.log`

---

## If Cypress does not start (Environment — NOT platform)

| Error | Fix |
|-------|-----|
| `MODULE_NOT_FOUND` `@cypress/xvfb` | `rm -rf ~/node_modules/cypress ~/node_modules/@cypress` then `cd dev.mentora && npm install` |
| `EPERM` on `node_modules/cypress/bin/cypress` | System Settings → Privacy → Full Disk Access for Terminal/Cursor; then `npm install cypress --save-dev && npx cypress install` |
| `index.lock` | `rm -f .git/index.lock` |
| Running from wrong folder | Always: `cd /Users/admin/Documents/GitHub/dev.mentora` then `npx cypress run ...` |

---

## Manual check (5 minutes) — is it Platform?

Open **https://dev.mentoraeg.com/register** (with HTTP auth if needed).

| # | Do this manually | Platform OK if… | Platform BUG if… |
|---|------------------|-----------------|------------------|
| 1 | Find **Parent's Phone Number** field | `#parent_phone_number` visible | Field missing |
| 2 | Leave parent phone empty → Register | Stays on page / error | Registers successfully |
| 3 | Student `1012345678`, parent **same** `1012345678` → Register | Error / blocked | Goes to `/email/verify` (accepted!) |
| 4 | Student `1012345678`, parent `1098765432` → Register | Success → `/email/verify` | Error with valid data |
| 5 | Login **verified student** → `/dashboard/settings` | `#parent_phone_number` on profile | Field missing on settings |

**Rule:** Manual fails same way as Cypress → **Platform**. Manual works, Cypress fails → **Test**.

---

## Verdict table (from errors seen in this project)

| Symptom | Who fixes |
|---------|-----------|
| `MODULE_NOT_FOUND`, `EPERM`, `index.lock` | **You / DevOps** (Cypress install) |
| Label / selector timeout (fixed: `label[for=parent_phone]`) | **Test** (already updated) |
| Redirect to `/email/verify` but test expected `/register` on validation | **Platform** if same-phone still registers; **Test** if only flow assumption wrong |
| `KNOWN GAP: validation not enforced` in log | **Platform** — backend must reject same/invalid parent phone |
| `#parent_phone_number` not on settings (tests SKIP) | **Platform** — add field to student settings |
| PP-UX-03 register button not found after redirect | **Test** (fixed: dblclick on `#registerForm`) |
| New user cannot open settings (email verify gate) | **Expected product behavior** — tests use `loginViaApi(STUDENT)` for profile |

---

## Cypress tests mapped to TC-001–080

| Module | Cypress IDs | Count |
|--------|-------------|-------|
| Email Registration | PP-REG-01 … 15 | 15 |
| Social Completion | PP-SOC-01 … 06 | 6 |
| Student Profile | PP-PRO-01 … 08 | 8 |
| Instructor | PP-INS-01 … 02 | 2 |
| Data persistence | PP-DATA-01 … 04 | 4 |
| Validation / UX | PP-VAL, PP-UX | 6 |

Excel matrix: `parent_phone_test_cases.xlsx` (TC-001 … TC-080)

---

## What to do after the run

1. **All green** → Platform OK for covered scenarios; ship or extend coverage.
2. **KNOWN GAP in log** → File platform bug: parent phone validation not enforced on register.
3. **SKIP profile tests** → File platform story: deploy `#parent_phone_number` on `/dashboard/settings`.
4. **Red on PP-REG-01/02/03** → Unlikely platform; check HTTP auth in `support/users.js` and selectors.
