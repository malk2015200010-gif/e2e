#!/bin/bash
# Parent Phone — Cypress diagnostic runner
# Usage: bash cypress/e2e/parent_phone/RUN_DIAGNOSTIC.sh

set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SPEC="cypress/e2e/parent_phone/parent_phone.cy.js"
LOG="$ROOT/cypress/e2e/parent_phone/last-run.log"

echo "=== 1) Project root ==="
echo "$ROOT"
cd "$ROOT"

echo ""
echo "=== 2) Cypress binary check ==="
if [ ! -f "$ROOT/node_modules/cypress/bin/cypress" ]; then
  echo "FAIL: Cypress not installed in project. Run: npm install"
  exit 1
fi
if [ -d "$HOME/node_modules/cypress" ] && [ ! -f "$HOME/node_modules/cypress/package.json" ]; then
  echo "WARN: Broken Cypress in ~/node_modules — remove it:"
  echo "  rm -rf ~/node_modules/cypress ~/node_modules/@cypress"
fi

echo ""
echo "=== 3) Git lock (if any) ==="
LOCK="$ROOT/.git/index.lock"
if [ -f "$LOCK" ]; then
  echo "WARN: Removing stale $LOCK"
  rm -f "$LOCK"
fi

echo ""
echo "=== 4) Run Cypress ==="
npx cypress run --spec "$SPEC" 2>&1 | tee "$LOG"
EXIT=${PIPESTATUS[0]}

echo ""
echo "=== 5) Summary ==="
if [ "$EXIT" -eq 0 ]; then
  echo "ALL PASSED — no platform bug indicated by this suite."
else
  echo "FAILURES — open: $LOG"
  echo ""
  grep -E "failing|AssertionError|TypeError|MODULE_NOT|EPERM|KNOWN GAP|SKIP" "$LOG" | tail -40 || true
  echo ""
  echo "See parent_phone/DIAGNOSIS.md for: Test vs Platform vs Environment"
fi
exit "$EXIT"
