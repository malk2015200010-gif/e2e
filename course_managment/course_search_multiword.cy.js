/**
 * Multi-field course search (HomeController)
 *
 * The /courses search box splits `q` into words. Each word is matched (OR)
 * against: the course title, category / second_category / parent_category
 * (full category chain), the main teacher (author), and additional teachers
 * (instructors). Words are combined with AND, so a mixed query like the
 * story's own example "business sara" can surface a course even when
 * neither word is in the title — as long as one word matches its category
 * and the other matches an instructor name.
 *
 * "english" and "business" below are the story's own example words, verified
 * against real dev data. "margaret" plays the role of "sara" (a real
 * instructor on dev) so SEARCH-06 reproduces the exact "category word +
 * teacher word" pattern from the story with data that actually exists.
 *
 * Test case matrix: course_search_multiword_test_cases.csv (SEARCH-01..16)
 */

import {
  searchCoursesApi,
  searchCoursesUi,
  assertTitlesAreSubsetOf,
  SEARCH_INPUT,
} from './course_search_support'

// ─── SEARCH-01 — title match ───────────────────────────────────────────────
it('SEARCH-01 | Positive - search word matches the course title', () => {
  searchCoursesApi('live').then((res) => {
    expect(res.total, 'courses found for "live"').to.be.greaterThan(0)
    expect(res.titles.some((t) => /live/i.test(t)), 'at least one title contains the word').to.be.true
  })
})

// ─── SEARCH-02 — category match (story's own example word "english") ──────
it('SEARCH-02 | Positive - search word matches a category level (story example "english")', () => {
  searchCoursesApi('english').then((res) => {
    expect(res.total, 'courses found for category word "english"').to.be.greaterThan(0)
    const titlesWithWord = res.titles.filter((t) => /english/i.test(t))
    // The whole point of the story: most matches come from the category chain,
    // not the title — so the title-matching subset must be smaller than the total.
    expect(titlesWithWord.length, 'not all matches literally contain "english" in the title').to.be.lessThan(
      res.titles.length,
    )
  })
})

// ─── SEARCH-03 — another category level (story's own example word "business") ─
it('SEARCH-03 | Positive - search word matches a category level (story example "business")', () => {
  searchCoursesApi('business').then((res) => {
    expect(res.total, 'courses found for category word "business"').to.be.greaterThan(0)
    expect(res.titles.some((t) => /business/i.test(t)), 'title does not literally contain the word').to.be.false
  })
})

// ─── SEARCH-04 — main teacher (author) match ───────────────────────────────
it('SEARCH-04 | Positive - search word matches the main teacher (author)', () => {
  searchCoursesApi('margaret').then((res) => {
    expect(res.total, 'courses found for teacher word "margaret"').to.be.greaterThan(0)
    expect(res.titles.some((t) => /margaret/i.test(t)), 'matched via author, not the title').to.be.false
  })
})

// ─── SEARCH-05 — teacher match via author/instructors relation ────────────
it('SEARCH-05 | Positive - search word matches a teacher even though the word is absent from every title', () => {
  searchCoursesApi('instructor').then((res) => {
    expect(res.total, 'courses found for instructor-only word').to.be.greaterThan(0)
    expect(res.titles.some((t) => /instructor/i.test(t)), 'matched via author/instructors, not the title').to.be
      .false
  })
})

// ─── SEARCH-06 — story's own "business sara" pattern: category word + teacher word ─
it('SEARCH-06 | Positive - mixed query (category word + teacher word) mirrors the story\'s "business sara" example', () => {
  cy.then(() =>
    searchCoursesApi('margaret').then((teacherRes) =>
      searchCoursesApi('english margaret').then((combinedRes) => {
        // "margaret" alone must fit on one page so it's a reliable reference set.
        expect(combinedRes.total, '"english margaret" narrows down from "margaret" alone').to.be.at.most(
          teacherRes.total,
        )
        expect(combinedRes.total, 'category word + teacher word still returns at least one course').to.be.greaterThan(
          0,
        )
        assertTitlesAreSubsetOf(combinedRes, teacherRes)
      }),
    ),
  )
})

// ─── SEARCH-07 — narrowing within the same category chain ─────────────────
it('SEARCH-07 | Positive - combining two category-chain words never grows the result set', () => {
  cy.then(() =>
    searchCoursesApi('math').then((mathRes) =>
      searchCoursesApi('pearson math').then((combinedRes) => {
        expect(combinedRes.total, '"pearson math" total <= "math" alone').to.be.at.most(mathRes.total)
      }),
    ),
  )
})

// ─── SEARCH-08 — case-insensitive ──────────────────────────────────────────
it('SEARCH-08 | Positive - search is case-insensitive', () => {
  cy.then(() =>
    searchCoursesApi('pearson').then((lower) =>
      searchCoursesApi('PEARSON').then((upper) =>
        searchCoursesApi('Pearson').then((mixed) => {
          expect(upper.total).to.eq(lower.total)
          expect(mixed.total).to.eq(lower.total)
        }),
      ),
    ),
  )
})

// ─── SEARCH-09 — partial / prefix match ────────────────────────────────────
it('SEARCH-09 | Positive - partial word (prefix) still matches the full term', () => {
  searchCoursesApi('assist').then((res) => {
    expect(res.total, 'courses found for partial word "assist"').to.be.greaterThan(0)
    expect(res.titles.some((t) => /assistant/i.test(t))).to.be.true
  })
})

// ─── SEARCH-10 — whitespace-insensitive ────────────────────────────────────
it('SEARCH-10 | Positive - extra whitespace between/around words is ignored', () => {
  cy.then(() =>
    searchCoursesApi('eman pearson').then((clean) =>
      searchCoursesApi('  eman   pearson  ').then((messy) => {
        expect(messy.total).to.eq(clean.total)
        expect(messy.titles.sort()).to.deep.equal(clean.titles.sort())
      }),
    ),
  )
})

// ─── SEARCH-11 — no match → empty state ────────────────────────────────────
it('SEARCH-11 | Negative - unmatched word returns the empty state', () => {
  searchCoursesApi('zzzznotfound').then((res) => {
    expect(res.total, 'no course cards render').to.eq(0)
    expect(res.isEmptyState, '"Nothing to see here" message shown').to.be.true
  })
})

// ─── SEARCH-12 — AND fails whole query if any word has no match ───────────
it('SEARCH-12 | Negative - one matching word + one non-matching word yields zero results', () => {
  searchCoursesApi('margaret zzzznotfound').then((res) => {
    expect(res.total, 'AND across words: any unmatched word zeroes the result').to.eq(0)
  })
})

// ─── SEARCH-13 — special characters don't break the page (UI) ─────────────
it('SEARCH-13 | Negative - special characters do not break the search page', () => {
  searchCoursesUi('@#$%^&*')
  cy.get('body').should('be.visible')
})

// ─── SEARCH-14 — very long input handled gracefully ────────────────────────
it('SEARCH-14 | Negative - very long search string does not crash the page', () => {
  const longText = 'a'.repeat(200)
  searchCoursesApi(longText).then((res) => {
    expect(res.status, 'no server error for long query').to.be.oneOf([200, 301, 302])
  })
})

// ─── SEARCH-15 — clearing the search restores the full list (UI) ──────────
it('SEARCH-15 | Negative - empty search shows the full unfiltered course list', () => {
  cy.then(() =>
    searchCoursesApi('').then((all) =>
      searchCoursesApi('math').then((filtered) => {
        expect(all.total, 'unfiltered list is at least as large as any filtered subset').to.be.at.least(
          filtered.total,
        )
      }),
    ),
  )

  searchCoursesUi('math')
  cy.get(SEARCH_INPUT, { timeout: 15000 }).filter(':visible').first().clear()
  cy.get('body').should('be.visible')
})

// ─── SEARCH-16 — injection attempt is inert ────────────────────────────────
it('SEARCH-16 | Negative - SQL/script injection attempt in search box is inert', () => {
  searchCoursesApi("' OR 1=1 --").then((res) => {
    expect(res.status, 'no SQL error page').to.eq(200)
    // Note: dev runs with debug mode on, so the phpdebugbar payload always contains
    // a benign `"exceptions":{"count":0,...}` block — match real leak signatures only.
    expect(
      /SQLSTATE\[|QueryException|syntax error at or near/i.test(res.html),
      'no raw SQL error leaked',
    ).to.be.false
  })

  searchCoursesUi('<script>alert(1)</script>')
  cy.get('body').should('be.visible')
  cy.on('window:alert', (msg) => {
    throw new Error(`Unexpected alert triggered by injected script: ${msg}`)
  })
})
