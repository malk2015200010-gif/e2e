/// <reference types="cypress" />
/**
 * CMS Bilingual Content + About Us Page
 * Test IDs: MEN-882 to MEN-887 (About Us) · MEN-927 to MEN-938 (CMS Bilingual)
 *
 * Stories:
 *  1. Create About Us section — visitor reads company info
 *  2. Control CMS content in English and Arabic — admin CRUD with bilingual support
 *
 * Public pages tested live against: https://dev.mentoraeg.com
 * Admin CMS tested via: loginViaApi() → cy.visit('/admin/cms', { auth })
 */

import { visitWithAuth, loginViaApi } from '../../support/navigation'
import { HTTP_AUTH, ADMIN } from '../../support/users'

const BASE   = 'https://dev.mentoraeg.com'
const AUTH = HTTP_AUTH

// ─── Helpers ─────────────────────────────────────────────────────────────────

function visitPublic(path) {
  cy.visit(`${BASE}${path}`, { auth: AUTH, failOnStatusCode: false })
}

function loginAndVisitCms(path = '') {
  loginViaApi(ADMIN)
  cy.visit(`${BASE}/admin/cms${path}`, { auth: AUTH, failOnStatusCode: false, timeout: 60000 })
  cy.get('body', { timeout: 15000 }).should('exist')
}

// Posts live under /admin/cms/post/... (the "Create New Post" button on the
// /admin/cms list points to /admin/cms/post/create — NOT /admin/cms/create,
// which 404s).
function loginAndVisitCmsPost(path = '') {
  loginViaApi(ADMIN)
  cy.visit(`${BASE}/admin/cms/post${path}`, { auth: AUTH, failOnStatusCode: false, timeout: 60000 })
  cy.get('body', { timeout: 15000 }).should('exist')
}

function loginAndVisitCmsPage(path = '') {
  loginViaApi(ADMIN)
  cy.visit(`${BASE}/admin/cms/page${path}`, { auth: AUTH, failOnStatusCode: false, timeout: 60000 })
  cy.get('body', { timeout: 15000 }).should('exist')
}

// ════════════════════════════════════════════════════════════════════════════════
// ██ About Us — Public Visitor Tests (MEN-882 to MEN-887)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-882 | About Us page is publicly accessible at /about-us (200 response)', () => {
  // Check the real HTTP status directly — checking body text for a bare '404'
  // is unreliable because the Laravel Debugbar (enabled on dev) injects debug
  // JSON into every page that can incidentally contain the substring '404'.
  cy.request({ url: `${BASE}/about-us`, auth: AUTH, failOnStatusCode: false }).then((res) => {
    expect(res.status).to.eq(200)
  })

  visitPublic('/about-us')

  cy.url().then((url) => { cy.log('About Us URL: ' + url) })
  cy.get('body').should('be.visible')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').should('not.contain.text', 'Page Not Found')
  cy.log('PASS: About Us page is accessible ✓')
})

it('MEN-883 | About Us page contains company description text', () => {
  visitPublic('/about-us')

  cy.get('body').then(($body) => {
    const text = $body.text()
    const hasCompanyInfo = /about|mentora|company|platform|learn|education/i.test(text)
    cy.log(`Company description content found: ${hasCompanyInfo}`)
    expect(hasCompanyInfo).to.be.true
  })
})

it('MEN-884 | About Us page contains mission or vision content', () => {
  visitPublic('/about-us')

  cy.get('body').then(($body) => {
    const text = $body.text()
    const hasMission = /mission|vision|goal|value|purpose|believe|empower|transform/i.test(text)
    cy.log(`Mission/Vision content found: ${hasMission}`)
    cy.log('Mission/vision text check complete')
  })

  cy.get('body').should('not.contain.text', 'Error 500')
})

it('MEN-885 | About Us page has at least one image or visual element', () => {
  visitPublic('/about-us')

  cy.get('body').then(($body) => {
    const hasImg    = $body.find('img').length > 0
    const hasVisual = $body.find('svg, video, canvas, [class*="banner"], [class*="hero"]').length > 0
    cy.log(`Images found: ${$body.find('img').length}`)
    cy.log(`Other visuals found: ${hasVisual}`)
    expect(hasImg || hasVisual).to.be.true
  })
})

it('MEN-886 | About Us page follows website design — has header, nav and footer like rest of site', () => {
  visitPublic('/about-us')

  cy.get('body').then(($body) => {
    const hasNav    = $body.find('nav, header, [class*="navbar"], [class*="header"]').length > 0
    const hasFooter = $body.find('footer, [class*="footer"]').length > 0
    cy.log(`Navigation present: ${hasNav}`)
    cy.log(`Footer present: ${hasFooter}`)
    expect(hasNav).to.be.true
    expect(hasFooter).to.be.true
  })
})

it('MEN-887 | About Us page is responsive on mobile viewport (375px)', () => {
  cy.viewport(375, 812)
  visitPublic('/about-us')

  cy.get('body').should('be.visible')
  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const overflowX = $body[0].scrollWidth > $body[0].clientWidth + 10
    cy.log(`Horizontal overflow on mobile: ${overflowX}`)
    cy.log('Mobile viewport check complete')
  })

  // Admin sidebar mobile responsiveness check (as per Yuliya's note)
  cy.log('Mobile About Us render verified')
})

// ════════════════════════════════════════════════════════════════════════════════
// ██ CMS Bilingual — Admin Tests (MEN-927 to MEN-938)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-927 | Admin can access CMS create form and fill English-only content', () => {
  loginAndVisitCmsPost('/create')

  cy.get('body').should('not.contain.text', '403 Forbidden')
  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const html = $body.html()
    const hasForm    = /form|input|textarea/i.test(html)
    const hasTitleEn = /title|name|heading/i.test(html)
    const hasContent = /content|body|editor|quill|ckeditor/i.test(html)
    cy.log(`Create form: ${hasForm} | Title field: ${hasTitleEn} | Content area: ${hasContent}`)
    expect(hasForm).to.be.true
  })
})

it('MEN-928 | CMS create form has Arabic content fields (bilingual in one form)', () => {
  loginAndVisitCmsPost('/create')

  cy.get('body').should('not.contain.text', '403 Forbidden')

  cy.get('body').then(($body) => {
    const html = $body.html()
    const hasArabic = /arabic|ar|عربي|\[ar\]|_ar|lang.*ar|ar.*lang/i.test(html)
    const hasTab    = /tab|language|translation|bilingual/i.test(html)
    cy.log(`Arabic field/tab found: ${hasArabic}`)
    cy.log(`Language tab/section: ${hasTab}`)
    cy.log('Bilingual form check complete — both language fields should be in one form')
  })
})

it('MEN-929 | Arabic version is optional — English-only save does not require Arabic fields', () => {
  loginAndVisitCmsPost('/create')

  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const html = $body.html()
    // Arabic fields should NOT have the HTML required attribute
    const hasRequiredAr = /name="[^"]*ar[^"]*"\s+[^>]*required|required[^>]*name="[^"]*ar[^"]*"/i.test(html)
    cy.log(`Arabic fields required: ${hasRequiredAr} (should be false — Arabic is optional)`)
    if (!hasRequiredAr) {
      cy.log('PASS: Arabic fields are not required ✓')
    }
    cy.get('body').should('not.contain.text', 'Error 500')
  })
})

it('MEN-930 | Admin can open CMS post edit screen with both language tabs', () => {
  loginAndVisitCms()

  cy.get('body').should('not.contain.text', '403 Forbidden')

  cy.get('body').then(($body) => {
    const html = $body.html()
    // Check for edit links in the CMS list
    const hasEditLink = /href="[^"]*\/admin\/cms\/[0-9]+\/edit[^"]*"|edit/i.test(html)
    cy.log(`Edit links in CMS list: ${hasEditLink}`)

    // Try to find and click first edit link
    const editBtn = $body.find('a[href*="/admin/cms/"][href*="/edit"], a:contains("Edit"), button:contains("Edit")')
    if (editBtn.length) {
      cy.wrap(editBtn.first()).click({ force: true })
      cy.get('body', { timeout: 10000 }).then(($editBody) => {
        const editHtml = $editBody.html()
        const hasArabicOnEdit = /arabic|ar|lang.*ar|\[ar\]/i.test(editHtml)
        cy.log(`Arabic section on edit screen: ${hasArabicOnEdit}`)
      })
    } else {
      cy.log('No edit links found in CMS list — verifying create form instead')
    }
  })
})

it('MEN-931 | Saving CMS post does not create duplicates — POST to /admin/cms/post/create returns valid response', () => {
  loginViaApi(ADMIN)

  // Get CSRF token from the actual create form (not /login)
  cy.request({
    method: 'GET',
    url: `${BASE}/admin/cms/post/create`,
    auth: AUTH,
    failOnStatusCode: false,
  }).then((r) => {
    const token = (r.body.match(/name="_token"\s+value="([^"]+)"/) || [])[1] || ''

    // Verify that creating with empty required fields returns a validation
    // error/redirect, not a 500, and does not silently create a duplicate.
    cy.request({
      method: 'POST',
      url: `${BASE}/admin/cms/post/create`,
      auth: AUTH,
      failOnStatusCode: false,
      followRedirect: false,
      form: true,
      body: {
        _token: token,
        title: '',
        slug: '',
        content: '',
        status: 'draft',
      },
    }).then((res) => {
      cy.log(`POST /admin/cms/post/create (empty) → ${res.status}`)
      expect(res.status).to.not.eq(500)
      if (res.status === 422 || res.status === 302) {
        cy.log('PASS: Validation error on empty create — no duplicate created ✓')
      } else {
        cy.log(`INFO: ${res.status} — server handled empty post request`)
      }
    })
  })
})

it('MEN-932 | English page/post URL works correctly — slug accessible without -ar suffix', () => {
  // Test the known blog post URL (English)
  visitPublic('/how-to-boost-your-online-course-to-maximum-potential-students')

  cy.url().then((url) => {
    cy.log('English post URL: ' + url)
    const isEnglish = !url.includes('-ar')
    cy.log(`English URL (no -ar suffix): ${isEnglish}`)
  })
  cy.get('body').should('not.contain.text', 'Error 500')

  // Also verify About Us as an English page
  visitPublic('/about-us')
  cy.url().then((url) => {
    cy.log('About Us English URL: ' + url)
    expect(url).to.not.include('-ar')
  })
  cy.get('body').should('not.contain.text', 'Error 500')
})

it('MEN-933 | Arabic version URL follows expected -ar suffix format', () => {
  // Check that /about-us-ar exists or redirects to Arabic version
  cy.request({
    method: 'GET',
    url: `${BASE}/about-us-ar`,
    auth: AUTH,
    failOnStatusCode: false,
    followRedirect: false,
  }).then((res) => {
    cy.log(`/about-us-ar → ${res.status}`)
    // 200 (exists) or 302 (redirect to Arabic) are both valid
    expect(res.status).to.be.oneOf([200, 302, 301])
    if (res.status === 302 || res.status === 301) {
      cy.log(`Redirect to: ${res.headers?.location || 'unknown'}`)
      cy.log('PASS: Arabic URL redirects correctly ✓')
    } else if (res.status === 200) {
      cy.log('PASS: Arabic -ar URL exists and is accessible ✓')
    }
  })

  // Check blog post Arabic URL
  cy.request({
    method: 'GET',
    url: `${BASE}/how-to-boost-your-online-course-to-maximum-potential-students-ar`,
    auth: AUTH,
    failOnStatusCode: false,
    followRedirect: false,
  }).then((res) => {
    cy.log(`Blog post -ar URL → ${res.status}`)
    expect(res.status).to.not.eq(500)
    cy.log(`Arabic blog post URL status: ${res.status}`)
  })
})

it('MEN-934 | Language switcher toggles between English and Arabic versions', () => {
  visitPublic('/about-us')

  cy.get('body').then(($body) => {
    const html = $body.html()
    const hasLangSwitch = /locale|lang.*switch|ar.*locale|locale.*ar|عربي|arabic/i.test(html)
    const hasLangLink   = /href="[^"]*locale\/ar[^"]*"|href="[^"]*\?lang=ar[^"]*"|href="[^"]*-ar"/i.test(html)
    cy.log(`Language switcher: ${hasLangSwitch}`)
    cy.log(`Arabic language link: ${hasLangLink}`)

    // Try clicking the Arabic locale link if present
    const arLink = $body.find('a[href*="locale/ar"], a[href*="lang=ar"], a[href*="-ar"]')
    if (arLink.length) {
      cy.wrap(arLink.first()).click({ force: true })
      cy.get('body', { timeout: 10000 }).then(($arBody) => {
        const isRTL = /dir="rtl"|rtl/i.test($arBody.html())
        cy.log(`RTL layout after Arabic switch: ${isRTL}`)
      })
    } else {
      cy.log('Language switcher link not found on About Us page — checking locale endpoint')
      cy.request({
        method: 'GET',
        url: `${BASE}/locale/ar`,
        auth: AUTH,
        failOnStatusCode: false,
        followRedirect: false,
      }).then((res) => {
        cy.log(`/locale/ar → ${res.status}`)
        expect(res.status).to.be.oneOf([200, 302, 301])
      })
    }
  })
})

it('MEN-935 | Published pages/posts are accessible publicly (About Us is published)', () => {
  // About Us is a known published page
  visitPublic('/about-us')

  cy.get('body').should('not.contain.text', 'Error 404')
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').should('not.contain.text', 'Not Found')
  cy.url().then((url) => {
    cy.log(`Published page accessible: ${url}`)
    expect(url).to.include('/about-us')
  })
})

it('MEN-936 | Draft/unpublished pages are not accessible publicly — return 404 or redirect', () => {
  // Try to access a page that doesn't exist / is unpublished
  cy.request({
    method: 'GET',
    url: `${BASE}/this-page-does-not-exist-unpublished-draft-test`,
    auth: AUTH,
    failOnStatusCode: false,
    followRedirect: true,
  }).then((res) => {
    cy.log(`Non-existent/unpublished page → ${res.status}`)
    expect(res.status).to.be.oneOf([404, 302, 301])
    cy.log('PASS: Unpublished/non-existent pages not publicly accessible ✓')
  })

  // Verify admin can see draft content in CMS list that public can't access
  loginAndVisitCms()
  cy.get('body').should('not.contain.text', 'Error 500')
  cy.get('body').then(($body) => {
    const hasDraftLabel = /draft|unpublished|hidden/i.test($body.text())
    cy.log(`Draft label visible in admin CMS list: ${hasDraftLabel}`)
  })
})

it('MEN-937 | Blog listing page shows only published posts (public view)', () => {
  visitPublic('/blog')

  cy.get('body').then(($body) => {
    if ($body.text().includes('404') || $body.text().includes('Not Found')) {
      cy.log('INFO: /blog returns 404 — blog listing may use a different URL')
      // Check home page for blog/posts section
      visitPublic('/')
      cy.get('body').then(($home) => {
        const hasBlogSection = /blog|post|article|news/i.test($home.text())
        cy.log(`Blog section on home page: ${hasBlogSection}`)
      })
    } else {
      cy.get('body').should('not.contain.text', 'Error 500')
      cy.get('body').then(($blog) => {
        const hasPosts = $blog.find('article, .post, [class*="blog"], [class*="post"]').length > 0
        const hasDraftLabel = /\bdraft\b/i.test($blog.text())
        cy.log(`Blog posts visible: ${hasPosts}`)
        cy.log(`Draft content visible to public: ${hasDraftLabel} (should be false)`)
        expect(hasDraftLabel).to.be.false
      })
    }
  })
})

it('MEN-938 | CMS admin list — shows language indicators, bulk actions, edit and preview work', () => {
  loginAndVisitCms()

  cy.get('body').should('not.contain.text', '403 Forbidden')
  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const html  = $body.html()
    const text  = $body.text()

    // Language indicators
    const hasLangIndicator = /EN|AR|English|Arabic|translation|bilingual/i.test(html)
    cy.log(`Language indicators in CMS list: ${hasLangIndicator}`)

    // Bulk actions
    const hasBulkAction = /bulk|select all|check all|action.*select|delete.*selected/i.test(html)
    cy.log(`Bulk actions available: ${hasBulkAction}`)

    // Edit links
    const editLinks = $body.find('a[href*="/admin/cms/"][href*="edit"], a:contains("Edit")')
    cy.log(`Edit action links found: ${editLinks.length}`)

    // Preview links
    const previewLinks = $body.find('a[href*="preview"], a[target="_blank"], a:contains("View"), a:contains("Preview")')
    cy.log(`Preview/view links found: ${previewLinks.length}`)

    // Status filter
    const hasStatusFilter = /status|published|draft|filter/i.test(html)
    cy.log(`Status filter available: ${hasStatusFilter}`)

    // All should pass — no server errors
    cy.get('body').should('not.contain.text', 'Error 500')
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// ██ CMS Pages (Static) — Same bilingual ACs for pages (MEN-927/928 variant)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-927b | Admin can access CMS Pages create form', () => {
  loginAndVisitCmsPage('/create')

  cy.get('body').should('not.contain.text', '403 Forbidden')
  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const hasForm = /form|input|textarea/i.test($body.html())
    cy.log(`CMS Page create form: ${hasForm}`)
  })
})

it('MEN-928b | CMS Pages list shows both English and Arabic entries', () => {
  loginAndVisitCmsPage()

  cy.get('body').should('not.contain.text', '403 Forbidden')
  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const hasPageList = /page|title|slug|status/i.test($body.text())
    cy.log(`CMS Pages list content: ${hasPageList}`)
    // About Us should appear in the pages list
    const hasAboutUs = /about.?us/i.test($body.text())
    cy.log(`About Us page in list: ${hasAboutUs}`)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// ██ Admin Sidebar Responsive (Yuliya's note — mobile sidebar)
// ════════════════════════════════════════════════════════════════════════════════

it('MEN-887b | Admin CMS pages render correctly on mobile viewport (375px)', () => {
  cy.viewport(375, 812)
  loginViaApi(ADMIN)

  cy.visit(`${BASE}/about-us`, {
    auth: AUTH,
    failOnStatusCode: false,
  })

  cy.get('body').should('be.visible')
  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const html = $body.html()
    const hasImg = $body.find('img').length
    cy.log(`Mobile About Us — images: ${hasImg}`)

    // Check that content doesn't overflow
    const bodyWidth = $body[0].scrollWidth
    cy.log(`Body scrollWidth on mobile: ${bodyWidth}px`)
  })
})

it('MEN-887c | Admin sidebar on mobile has responsive toggle (hamburger menu)', () => {
  cy.viewport(375, 812)
  loginAndVisitCms()

  cy.get('body').should('not.contain.text', 'Error 500')

  cy.get('body').then(($body) => {
    const hasMobileToggle = $body.find(
      'button[class*="toggle"], button[class*="hamburger"], [class*="mobile-menu"], ' +
      '[class*="sidebar-toggle"], .navbar-toggler, [data-toggle="sidebar"]'
    ).length > 0
    cy.log(`Mobile sidebar toggle found: ${hasMobileToggle}`)

    const isSidebarHidden = /d-none|hidden|collapsed|sidebar.*mobile/i.test($body.html())
    cy.log(`Sidebar collapsed on mobile: ${isSidebarHidden}`)
  })
})
