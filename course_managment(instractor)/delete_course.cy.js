import { getAppBase, loginAndVisit, loginViaApi, selectCourseCategory } from '../../support/navigation'
import { ADMIN, INSTRUCTOR, INSTRUCTORS, STUDENTS, basicAuth, studentCredentials } from '../../support/users'

/**
 * Instructor course deletion — MEN-2908.
 * The Delete button appears once a course is unpublished.
 * Confirming it removes the course only when that course has no enrollments.
 * A course with enrollments shows an error and stays in the list.
 * An assistant cannot delete the instructor's course.
 */
const OTHER_INSTRUCTOR = INSTRUCTORS[1]
const STUDENT = STUDENTS.find((user) => user.email === 'student5@demo.com')

// Resolve at the task call. Stage replaces student5 only when both student keys exist.
const taskStudent = () => studentCredentials(STUDENT)

const createDraftCourse = (title) => {
  loginAndVisit(INSTRUCTOR, '/dashboard/courses/new')
  cy.get('#title').clear().type(title)
  cy.get('#short_description').clear().type('Course created for delete coverage')
  cy.get('select[name="level"]').select('Beginner')
  cy.get('select[name="delivery_type"]').select('Recorded')
  cy.intercept('POST', '**/get-topic-options').as('topicOptions')
  selectCourseCategory()
  cy.wait('@topicOptions')
  cy.get('#course_topic option', { timeout: 20000 }).should(($options) => {
    expect([...$options].some((item) => item.value), 'topic for the new course').to.eq(true)
  })
  cy.get('#course_topic').then(($topic) => {
    const option = [...$topic[0].options].find((item) => item.value)
    const jq = window.jQuery || window.$
    if (jq) jq($topic[0]).val(option.value).trigger('change')
    else $topic[0].value = option.value
  })
  cy.contains('button', /create course/i).click({ force: true })
  cy.location('pathname', { timeout: 20000 }).should('match', /\/dashboard\/courses\/\d+\//)
  return cy.get('body').then(($body) => {
    const pathname = window.location.pathname
    const fromPath = (pathname.match(/\/dashboard\/courses\/(\d+)\//) || [])[1]
    const titleField = $body.find('#title')
    if (fromPath && titleField.length && titleField.val() === title) return fromPath
    return courseIdFromList(title)
  })
}

const courseIdFromList = (title) => {
  openMyCourses()
  return courseCard(title)
    .find('a[href*="/information"]')
    .first()
    .should('have.attr', 'href')
    .then((href) => {
      const id = String(href).match(/\/courses\/(\d+)\//)
      expect(id, `${title} information link`).to.not.equal(null)
      return id[1]
    })
}

const openMyCourses = () => loginAndVisit(INSTRUCTOR, '/dashboard/my-courses')

const courseCard = (title) => cy.contains('.archived-item-card', title, { timeout: 20000 })

const deleteButton = (title) => courseCard(title).find('button.course-action-btn--delete')

const csrfToken = () =>
  cy.get('meta[name="csrf-token"], input[name="_token"]').first().invoke('attr', 'content').then((content) => {
    if (content) return content
    return cy.get('input[name="_token"]').first().invoke('val')
  })

const postDelete = (courseId) =>
  csrfToken().then((token) =>
    cy
      .request({
        method: 'POST',
        url: `${getAppBase()}/dashboard/courses/${courseId}/delete`,
        auth: basicAuth(),
        form: true,
        followRedirect: false,
        failOnStatusCode: false,
        body: { _token: token, _method: 'DELETE' },
      })
      .then((response) => {
        const locationHeader = response.headers?.location
        const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader
        if (response.status < 300 || response.status >= 400 || !location) return response
        return cy
          .request({
            method: 'GET',
            url: location,
            auth: basicAuth(),
            failOnStatusCode: false,
          })
          .then((page) => ({ status: response.status, body: page.body, redirected: true }))
      }),
  )

const rejectionStatuses = [401, 403, 404, 419, 422]
const refusalText = /couldn't be deleted|could not be deleted|permission denied|not found|cannot|unable|not allowed|forbidden|enroll/i

const clickDelete = (title, accept) => {
  openMyCourses()
  deleteButton(title).scrollIntoView()
  cy.window().then((win) => {
    if (typeof win.confirm?.restore === 'function') win.confirm.restore()
    cy.stub(win, 'confirm').callsFake((message) => {
      expect(String(message), 'delete confirmation').to.match(/are you sure you want to delete this course/i)
      return accept
    })
  })
  deleteButton(title).click({ force: true })
}

const setAdminStatus = (courseId, title, statusValue) => {
  const query = new URLSearchParams({
    status: String(statusValue),
    bulk_action_btn: 'update_status',
    q: title,
    filter_status: '',
  })
  query.append('bulk_ids[]', String(courseId))
  return loginViaApi(ADMIN).then(() =>
    cy
      .request({
        method: 'GET',
        url: `${getAppBase()}/admin/courses?${query.toString()}`,
        auth: basicAuth(),
        failOnStatusCode: false,
        timeout: 60000,
      })
      .its('status')
      .should('be.lessThan', 400),
  )
}

const publishCourse = (courseId, title) => setAdminStatus(courseId, title, '1')

const unpublishCourse = (courseId, title) => {
  loginAndVisit(INSTRUCTOR, `/dashboard/courses/${courseId}/publish`)
  cy.get('body').then(($body) => {
    const button = $body.find(
      'button[name="publish_btn"][value="unpublish"], input[name="publish_btn"][value="unpublish"]',
    )
    if (button.length) {
      cy.wrap(button.first()).click({ force: true })
      return
    }
    setAdminStatus(courseId, title, '4')
  })
}

const enrollStudent = (courseId) => {
  expect(STUDENT, 'student account').to.exist
  loginAndVisit(STUDENT, '/dashboard')
  csrfToken().then((token) => {
    cy.request({
      method: 'POST',
      url: `${getAppBase()}/courses/free-enroll`,
      auth: basicAuth(),
      form: true,
      followRedirect: true,
      failOnStatusCode: false,
      body: { _token: token, course_id: courseId },
    })
  })
  loginAndVisit(INSTRUCTOR, `/dashboard/courses/${courseId}/enrollments`)
  cy.get('body').should(($body) => {
    const total = $body.text().match(/(\d+)\s*Total enrolled/i)
    expect(Number(total?.[1] || 0), 'the student is enrolled').to.be.greaterThan(0)
  })
}

const fetchMyCoursesHtml = () =>
  loginViaApi(INSTRUCTOR).then(() =>
    cy
      .request({
        method: 'GET',
        url: `${getAppBase()}/dashboard/my-courses`,
        auth: basicAuth(),
        failOnStatusCode: false,
        timeout: 120000,
      })
      .then((response) => {
        expect(response.status, 'my courses page').to.be.lessThan(400)
        return String(response.body || '')
      }),
  )

const cardSnippet = (html, title) => {
  const marker = `<strong>${title}</strong>`
  const at = html.indexOf(marker)
  expect(at, `${title} is listed for the instructor`).to.be.greaterThan(-1)
  const after = html.slice(at + marker.length)
  const nextCard = after.indexOf('archived-item-card')
  return after.slice(0, nextCard === -1 ? 5000 : nextCard)
}

const assertDeleteHidden = (title) => {
  fetchMyCoursesHtml().then((html) => {
    expect(cardSnippet(html, title), 'published course does not offer Delete').not.to.include(
      'course-action-btn--delete',
    )
  })
}

const assertEnrolledDeleteBlocked = (courseId, title) => {
  openMyCourses()
  deleteButton(title).should('exist')
  clickDelete(title, true)
  cy.get('body').should('contain.text', "this course couldn't be deleted due to enrollments")
  cy.get('body').should('not.contain.text', 'Course deleted successfully')
  cy.contains('.archived-item-card', title).should('exist')
  loginAndVisit(INSTRUCTOR, `/dashboard/courses/${courseId}/information`)
  cy.get('#title, input[name="title"]', { timeout: 20000 }).should('have.value', title)
}

const instructorGet = (path) =>
  loginViaApi(INSTRUCTOR).then(() =>
    cy.request({
      method: 'GET',
      url: path.startsWith('http') ? path : `${getAppBase()}${path}`,
      auth: basicAuth(),
      failOnStatusCode: false,
      timeout: 60000,
    }),
  )

const tokenFromHtml = (html) => {
  const match =
    String(html).match(/csrf-token" content="([^"]+)"/) ||
    String(html).match(/name="_token"\s+value="([^"]+)"/)
  return match ? match[1] : ''
}

const assertDeleteRejected = (courseId, title) =>
  instructorGet(`/dashboard/courses/${courseId}/information`).then((page) => {
    const html = String(page.body || '')
    expect(html, 'course is still available').to.include(title)
    const token = tokenFromHtml(html)
    expect(token, 'csrf token').to.have.length.greaterThan(10)
    return cy
      .request({
        method: 'POST',
        url: `${getAppBase()}/dashboard/courses/${courseId}/delete`,
        auth: basicAuth(),
        form: true,
        followRedirect: false,
        failOnStatusCode: false,
        timeout: 60000,
        body: { _token: token, _method: 'DELETE' },
      })
      .then((response) => {
        const locationHeader = response.headers?.location
        const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader
        if (response.status < 300 || response.status >= 400 || !location) return response
        return cy
          .request({
            method: 'GET',
            url: location,
            auth: basicAuth(),
            failOnStatusCode: false,
            timeout: 60000,
          })
          .then((followed) => ({ status: response.status, body: followed.body }))
      })
  }).then((response) => {
    const body = String(response.body || '')
    expect(body, 'a protected course must not be deleted').not.to.match(/course deleted successfully/i)
    const rejected = rejectionStatuses.includes(response.status) || refusalText.test(body)
    expect(rejected, `delete response ${response.status} did not refuse the course`).to.eq(true)
    return instructorGet(`/dashboard/courses/${courseId}/information`)
  }).then((page) => {
    expect(String(page.body || ''), 'course remains after the refused delete').to.include(title)
  })

const assertCourseRemoved = (courseId, title) => {
  cy.get('body').should('contain.text', 'Course deleted successfully')
  cy.contains('.archived-item-card', title).should('not.exist')
  cy.visit(`${getAppBase()}/dashboard/courses/${courseId}/information`, {
    auth: basicAuth(),
    failOnStatusCode: false,
  })
  cy.location('pathname').then((pathname) => {
    if (pathname.includes(`/courses/${courseId}/information`)) {
      cy.get('body').should('not.contain.text', title)
    }
  })
}

describe('Instructor deletes an owned course', () => {
  it('MEN-2924 | Delete an unpublished course with no enrollments', () => {
    const title = `Delete eligible ${Date.now()}`

    createDraftCourse(title).then((courseId) => {
      clickDelete(title, true)
      assertCourseRemoved(courseId, title)
    })
  })

  it('MEN-2925 | Delete asks for confirmation and does not delete before it', () => {
    const title = `Delete confirm ${Date.now()}`

    createDraftCourse(title).then(() => {
      clickDelete(title, false)
      cy.contains('.archived-item-card', title).should('exist')
      cy.get('body').should('not.contain.text', 'Course deleted successfully')
    })
  })

  it('MEN-2926 | Cancel keeps the course in the instructor list', () => {
    const title = `Delete cancel ${Date.now()}`

    createDraftCourse(title).then(() => {
      clickDelete(title, false)
      cy.contains('.archived-item-card', title).should('exist')
      courseIdFromList(title).then((courseId) => {
        loginAndVisit(INSTRUCTOR, `/dashboard/courses/${courseId}/information`)
        cy.get('#title', { timeout: 20000 }).should('have.value', title)
      })
    })
  })

  it('MEN-2927 | A published course with no enrollments cannot be deleted', () => {
    const title = `Delete published ${Date.now()}`

    cy.task(
      'publishedCourseDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 120000 },
    ).then((result) => {
      expect(result.deleteHidden, 'published course does not offer Delete').to.eq(true)
      expect(result.deleted, 'a protected course must not be deleted').to.eq(false)
      expect(result.refused, `delete response ${result.status}`).to.eq(true)
      expect(result.courseRemains, 'course remains after the refused delete').to.eq(true)
    })
  })

  it('MEN-2928 | An unpublished course with enrollments cannot be deleted', () => {
    const title = `Delete enrolled draft ${Date.now()}`

    createDraftCourse(title).then((courseId) => {
      publishCourse(courseId, title).then(() => {
        enrollStudent(courseId)
        unpublishCourse(courseId, title)
        assertEnrolledDeleteBlocked(courseId, title)
      })
    })
  })

  it('MEN-2929 | A published course with enrollments cannot be deleted', () => {
    const title = `Delete enrolled published ${Date.now()}`

    createDraftCourse(title).then((courseId) => {
      publishCourse(courseId, title).then(() => {
        enrollStudent(courseId)
        assertDeleteHidden(title)
        assertDeleteRejected(courseId, title)
      })
    })
  })

  it('MEN-2930 | An instructor cannot delete another instructor course', () => {
    const title = `Delete other owner ${Date.now()}`

    createDraftCourse(title).then((courseId) => {
      loginAndVisit(OTHER_INSTRUCTOR, '/dashboard')
      postDelete(courseId).then((response) => {
        expect(rejectionStatuses).to.include(response.status)
      })
      loginAndVisit(INSTRUCTOR, '/dashboard/my-courses')
      cy.contains('.archived-item-card', title).should('exist')
    })
  })

  it('MEN-2931 | A direct delete request cannot remove a published course', () => {
    const title = `Delete api published ${Date.now()}`

    cy.task(
      'publishedCourseDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 120000 },
    ).then((result) => {
      expect(result.deleted, 'a direct delete must not remove a published course').to.eq(false)
      expect(result.courseRemains, 'the course page stays available').to.eq(true)
      expect(result.listedAfter, 'the course stays in the instructor list').to.eq(true)
    })
  })

  it('MEN-2932 | A deleted course is not in the list and its old page is gone', () => {
    const title = `Delete missing ${Date.now()}`

    createDraftCourse(title).then((courseId) => {
      clickDelete(title, true)
      assertCourseRemoved(courseId, title)
      cy.visit(`${getAppBase()}/courses`, {
        auth: basicAuth(),
        failOnStatusCode: false,
        qs: { q: title },
      })
      cy.contains(/nothing to see here/i).should('be.visible')
    })
  })

  it('MEN-2933 | Delete is checked again if the course is published before it is deleted', () => {
    const title = `Delete recheck ${Date.now()}`

    createDraftCourse(title).then((courseId) => {
      openMyCourses()
      deleteButton(title).should('exist')
      publishCourse(courseId, title).then(() => {
        assertDeleteRejected(courseId, title)
      })
    })
  })

  it('MEN-2934 | Unpublishing a course with no enrollments makes it deletable', () => {
    const title = `Delete after unpublish ${Date.now()}`

    cy.task(
      'unpublishedDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.listedWhilePublished, 'the published course stays listed').to.eq(true)
      expect(result.deleteHidden, 'a published course does not offer Delete').to.eq(true)
      expect(result.deleteShown, 'Delete appears after the course is unpublished').to.eq(true)
      expect(result.deleted, 'the unpublished course is deleted').to.eq(true)
      expect(result.removedListed, 'the deleted course leaves the list').to.eq(false)
      expect(result.removedRemains, 'the deleted course page is gone').to.eq(false)
    })
  })

  it('MEN-2935 | Unpublishing a course that has enrollments still blocks delete', () => {
    const title = `Delete unpublish enrolled ${Date.now()}`

    const student = taskStudent()

    cy.task(
      'enrolledUnpublishDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        studentEmail: student.email,
        studentPassword: student.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.deleteShown, 'Delete stays visible after the course is unpublished').to.eq(true)
      expect(result.deleted, 'enrollments block the delete').to.eq(false)
      expect(result.enrollmentRefusal, 'the error explains the enrollments').to.eq(true)
      expect(result.courseRemains, 'the course stays after the blocked delete').to.eq(true)
      expect(result.enrollmentCount, 'enrollments stay after the blocked delete').to.be.greaterThan(0)
    })
  })

  it('MEN-2936 | Deleting one course leaves the instructor other courses in place', () => {
    const removed = `Delete one ${Date.now()}`
    const kept = `Delete keep ${Date.now()}`

    cy.task(
      'deleteOneKeepsOtherCheck',
      {
        removedTitle: removed,
        keptTitle: kept,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.deleted, 'the selected course is deleted').to.eq(true)
      expect(result.removedListed, 'the deleted course leaves the list').to.eq(false)
      expect(result.removedRemains, 'the deleted course page is gone').to.eq(false)
      expect(result.keptListed, 'the other course stays in the list').to.eq(true)
      expect(result.keptRemains, 'the other course page stays available').to.eq(true)
    })
  })

  it('MEN-2937 | A student cannot delete a course', () => {
    const title = `Delete student blocked ${Date.now()}`

    const student = taskStudent()

    cy.task(
      'studentDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        studentEmail: student.email,
        studentPassword: student.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.deleted, 'a student must not delete the course').to.eq(false)
      expect(result.refused, `student delete response ${result.status}`).to.eq(true)
      expect(result.courseRemains, 'the course stays after the student request').to.eq(true)
      expect(result.listedAfter, 'the course stays in the instructor list').to.eq(true)
    })
  })

  it('An assistant cannot delete the instructor course', () => {
    const title = `Delete assistant blocked ${Date.now()}`

    cy.task(
      'assistantDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.deleted, 'an assistant must not delete the course').to.eq(false)
      expect(result.refused, `assistant delete response ${result.status}`).to.eq(true)
      expect(result.courseRemains, 'the course stays after the assistant request').to.eq(true)
      expect(result.listedAfter, 'the course stays in the instructor list').to.eq(true)
    })
  })

  it('MEN-2938 | A second delete of the same course is rejected', () => {
    const title = `Delete twice ${Date.now()}`

    cy.task(
      'secondDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.deleted, 'the first delete removes the course').to.eq(true)
      expect(result.secondStatus, 'second delete').to.be.lessThan(500)
      expect(rejectionStatuses, `second delete response ${result.secondStatus}`).to.include(result.secondStatus)
      expect(result.removedListed, 'the deleted course leaves the list').to.eq(false)
      expect(result.removedRemains, 'the deleted course page is gone').to.eq(false)
    })
  })

  it('Ineligible courses do not offer Delete and the request explains the refusal', () => {
    const title = `Delete explanation ${Date.now()}`

    cy.task(
      'ineligibleDeleteCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.deleteHidden, 'a published course does not offer Delete').to.eq(true)
      expect(result.deleted, 'a protected course must not be deleted').to.eq(false)
      expect(result.explained, 'the refusal explains why').to.eq(true)
      expect(result.courseRemains, 'the course stays after the refused delete').to.eq(true)
      expect(result.listedAfter, 'the course stays in the instructor list').to.eq(true)
    })
  })
})
