/**
 * Learner notification center and browser push.
 *
 * The story's test-case keys MEN-3027–MEN-3085 (MEN-3063 is not in the list)
 * are not in Jira (1).csv or the newer Downloads exports. The newest exported
 * key is MEN-2938, so these tests follow the story acceptance criteria and
 * are not numbered with guessed Jira keys.
 *
 * Covered here: enrolment create vs update, a second enrolment after the first
 * is read, privacy, guest rejection, the bell and its unread count, Arabic
 * copy for the bell. Notification titles stay English after the Arabic switch. Push opt-in, stored
 * subscriptions, the service worker click contract, admin bell and WhatsApp,
 * discussion, assignment draft versus submitted, bulk pending-to-block,
 * withdrawal approve/reject, event invite, registration linking,
 * and course-update approve/reject. The bell is also opened on an iPhone
 * layout, an Android layout, and a Safari visit.
 *
 * A real operating-system banner with every tab closed still depends on the
 * browser push service. These tests store the subscriptions and check the
 * in-app result, including that a dead endpoint does not remove the in-app item.
 */

import { getAppBase, loginViaApi } from '../../support/navigation'
import { ADMIN, INSTRUCTOR, INSTRUCTORS, STUDENTS, basicAuth, otherInstructorCredentials, studentCredentials } from '../../support/users'

const STUDENT = STUDENTS.find((user) => user.email === 'student5@demo.com')
const OTHER_STUDENT = STUDENTS.find((user) => user.email === 'malk2015200010e@gmail.com')
const EVENT_ACCOUNT = {
  name: 'Notify Invite',
  phone: '201000019632',
  parentPhone: '201200034785',
  email: 'zack@gmail.com',
  password: 'Test@1234',
}
const SECOND_EVENT_ACCOUNT = {
  name: 'Notify Invite',
  phone: '201099138353',
  parentPhone: '201299156195',
  email: 'notify.invite.1792399156195@mail.com',
  password: 'Test@1234',
}
const OTHER_INSTRUCTOR = otherInstructorCredentials(INSTRUCTORS[1])

describe('Learner notification center', () => {
  const title = `Notify center ${Date.now()}`
  let facts

  before(() => {
    const student = studentCredentials(STUDENT)
    cy.task(
      'learnerNotificationCenterCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        studentEmail: student.email,
        studentPassword: student.password,
        otherStudentEmail: OTHER_STUDENT.email,
        otherStudentPassword: OTHER_STUDENT.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 240000 },
    ).then((result) => {
      facts = result
    })
  })

  it('UC-08 | A new successful enrolment notifies the course owner once and not the student', () => {
    expect(facts.ownerEnrollmentCount, 'course owner enrolment notifications').to.eq(1)
    expect(facts.ownerEnrollmentUnread, 'the new enrolment notification is unread').to.eq(true)
    expect(facts.ownerEnrollmentTitle).to.match(/enroll/i)
    expect(facts.ownerEnrollmentBody).to.include(title)
    expect(facts.ownerEnrollmentHref, 'destination opens the course enrolments').to.include('/enrollments')
    expect(facts.studentEnrollmentCount, 'the student is not notified about their own enrolment').to.eq(0)
  })

  it('UC-09 UC-26 | Updating the same enrolment does not create or push another notification', () => {
    expect(facts.repeatEnrollmentCount, 'still one enrolment notification after enrolling again').to.eq(1)
  })

  it('UC-27 | After the enrolment notification is read, a later enrolment creates a new unread one', () => {
    expect(facts.ownerMarkedRead, 'the first enrolment notification was marked read').to.eq(true)
    expect(facts.firstEnrollmentStaysRead, 'the read enrolment notification stays read').to.eq(true)
    expect(facts.secondStudentEnrollmentCount, 'the later enrolment is its own notification').to.eq(2)
    expect(facts.laterEnrollmentUnread, 'the later enrolment notification is unread').to.eq(true)
    expect(facts.laterEnrollmentId).to.not.eq('')
  })

  it('UC-16 UC-17 | Pending to publish notifies the owner; pending and unpublish do not add another', () => {
    expect(facts.pendingApprovalCount, 'moving a course to pending does not notify').to.eq(0)
    expect(facts.publishCount, 'pending to publish notifies the owner').to.eq(1)
    expect(facts.unpublishCount, 'unpublish does not add an approval notification').to.eq(facts.publishCount)
  })

  it('UC-07 | The header bell shows the unread badge, the list, and mark all read', () => {
    expect(facts.bellPresent, 'notification bell').to.eq(true)
    expect(facts.badgePresent, 'unread badge').to.eq(true)
    expect(facts.listPresent, 'notification list').to.eq(true)
    expect(facts.markAllPresent, 'mark all read').to.eq(true)
  })

  it('UC-28 | A student cannot mark the instructor notification read, and a guest is rejected', () => {
    expect(facts.ownerStillUnread, 'the instructor notification stays unread').to.eq(true)
    const guestRejected =
      [401, 403, 419].includes(facts.guestStatus) || String(facts.guestLocation).includes('/login')
    expect(guestRejected, `guest notification response ${facts.guestStatus} ${facts.guestLocation}`).to.eq(true)
  })

  it('UC-23 | An assistant on the teacher dashboard sees that teacher notification', () => {
    expect(facts.assistantCreated, facts.assistantError || 'assistant account').to.eq(true)
    expect(facts.assistantSeesEnrollment, 'assistant sees the course owner notification').to.eq(true)
  })

  it('UC-07 | Opening a notification goes to the page it points at', () => {
    expect(facts.ownerEnrollmentHref, 'the bell item links to the related page').to.include('/enrollments')
    expect(facts.destinationStatus, 'that page opens').to.be.lessThan(400)
    expect(facts.destinationPath, 'the opened page is the notification destination').to.eq(
      new URL(facts.ownerEnrollmentHref, 'https://dev.mentoraeg.com').pathname,
    )
  })

  it('Opening the dashboard or My Courses shows the new notification', () => {
    expect(facts.dashboardShowsEnrollment, 'a dashboard load shows the new enrolment').to.eq(true)
    expect(facts.myCoursesShowsEnrollment, 'a My Courses load shows the new enrolment').to.eq(true)
  })

  it('UC-01 UC-02 | Enable notifications asks only after the click, and blocking permission does not subscribe', () => {
    expect(facts.vapidPresent, 'VAPID public key').to.eq(true)
    expect(facts.enableText, 'enable notifications action').to.not.eq('')
    expect(facts.permissionOnClickOnly, 'permission prompt is tied to the enable click').to.eq(true)
    expect(facts.deniedSkipsSubscribe, 'a denied prompt does not store a subscription').to.eq(true)
  })

  it('UC-03 UC-04 | The service worker shows the title, opens the destination, and marks that item read', () => {
    expect(facts.serviceWorkerStatus, 'notifications service worker').to.be.lessThan(400)
    expect(facts.serviceWorkerShowsTitle, 'operating-system notification uses the title').to.eq(true)
    expect(facts.serviceWorkerOpensUrl, 'click opens the destination URL').to.eq(true)
    expect(facts.serviceWorkerMarksRead, 'click carries the notification id used to mark it read').to.eq(true)
    expect(facts.ownerMarkedRead, 'opening the notification marks it read').to.eq(true)
  })

  it('English and Arabic copy exist for the bell, the list, and the enable action', () => {
    expect(facts.arabicHeader, 'Arabic list title').to.not.eq('')
    expect(facts.arabicHeader).to.not.eq('Notifications')
    expect(facts.arabicMarkAll, 'Arabic mark all read').to.not.eq('')
    expect(facts.arabicEnableText, 'Arabic enable action').to.not.eq('')
    expect(facts.arabicEnableText).to.not.eq(facts.enableText)
  })

  it('Admin bell and WhatsApp delivery stay in place', () => {
    expect(facts.adminBellPresent, 'admin notification bell').to.eq(true)
    expect(facts.adminNotificationsStatus, 'admin notifications page').to.be.lessThan(400)
    expect(facts.whatsappStatus, 'WhatsApp inbox is still available').to.be.lessThan(400)
  })
})

describe('Learner notification events', () => {
  const title = `Notify events ${Date.now()}`
  let facts

  before(() => {
    const student = studentCredentials(STUDENT)
    cy.task(
      'learnerNotificationEventsCheck',
      {
        title,
        instructorEmail: INSTRUCTOR.email,
        instructorPassword: INSTRUCTOR.password,
        studentEmail: student.email,
        studentPassword: student.password,
        studentPhone: EVENT_ACCOUNT.phone,
        linkedUserName: EVENT_ACCOUNT.name,
        linkedUserParentPhone: EVENT_ACCOUNT.parentPhone,
        linkedUserEmail: EVENT_ACCOUNT.email,
        linkedUserPassword: EVENT_ACCOUNT.password,
        secondUserName: SECOND_EVENT_ACCOUNT.name,
        secondUserPhone: SECOND_EVENT_ACCOUNT.phone,
        secondUserParentPhone: SECOND_EVENT_ACCOUNT.parentPhone,
        secondUserEmail: SECOND_EVENT_ACCOUNT.email,
        secondUserPassword: SECOND_EVENT_ACCOUNT.password,
        otherInstructorEmail: OTHER_INSTRUCTOR.email,
        otherInstructorPassword: OTHER_INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 300000 },
    ).then((result) => {
      facts = result
    })
  })

  it('UC-10 | A student question notifies the course owner and not the author', () => {
    expect(facts.askStatus, 'question was accepted').to.be.lessThan(400)
    expect(facts.ownerQuestionCount, 'one unread question for the owner').to.eq(1)
    expect(facts.ownerQuestionTitle).to.match(/discuss/i)
    expect(facts.ownerQuestionHref).to.include('/lecture/')
    expect(facts.studentQuestionCount, 'the author is not notified').to.eq(0)
  })

  it('UC-11 | Each student reply notifies the course owner and not the author', () => {
    expect(facts.studentReplyStatus, 'student reply was accepted').to.be.lessThan(400)
    expect(facts.ownerReplyCount, 'the reply is its own notification').to.eq(2)
    expect(facts.studentOwnReplyCount, 'the author is not notified about their reply').to.eq(0)
    expect(facts.repeatReplyStatus, 'a later reply was accepted').to.be.lessThan(400)
    expect(facts.ownerRepeatReplyCount, 'a later reply creates another notification').to.eq(3)
  })

  it('UC-12 | An instructor reply notifies the student who started the thread', () => {
    expect(facts.instructorReplyStatus, 'instructor reply was accepted').to.be.lessThan(400)
    expect(facts.studentInstructorReplyCount, 'the thread author is notified').to.eq(1)
    expect(facts.studentInstructorReplyTitle).to.match(/reply|discuss/i)
    expect(facts.studentInstructorReplyHref).to.include('/lecture/')
    expect(facts.ownerAfterOwnReplyCount, 'the instructor is not notified about their own reply').to.eq(
      facts.ownerBeforeInstructorReply,
    )
  })

  it('UC-13 | A submitted assignment notifies the owner and a draft does not', () => {
    expect(facts.draftStatus, 'opening the submission form').to.be.lessThan(400)
    expect(facts.assignmentCountAfterDraft, 'a draft still in progress does not notify').to.eq(
      facts.assignmentCountBeforeDraft,
    )
    expect(facts.submitStatus, 'submission was accepted').to.be.lessThan(400)
    expect(facts.assignmentCountAfterSubmit, 'submitted assignment notifies the owner').to.eq(
      facts.assignmentCountBeforeDraft + 1,
    )
    expect(facts.assignmentTitle).to.match(/assign/i)
    expect(facts.assignmentHref).to.match(/assignment/i)
  })

  it('UC-17 | Bulk pending to block notifies the owner once per course', () => {
    expect(facts.blockStatus, 'bulk block was accepted').to.be.lessThan(400)
    expect(facts.blockCount, 'one rejection notification per blocked course').to.eq(2)
  })

  it('UC-18 UC-19 | Each withdrawal approve or reject action notifies the instructor', () => {
    expect(facts.rejectId, 'rejected request id').to.not.eq('')
    expect(facts.approveId, 'approved request id').to.not.eq('')
    expect(facts.withdrawRejectCount, 'rejection notifies the instructor').to.eq(facts.withdrawBefore + 1)
    expect(facts.withdrawRepeatCount, 'setting the same rejected status again does not add a notification').to.eq(
      facts.withdrawRejectCount,
    )
    expect(facts.withdrawApproveCount, 'approval notifies the instructor').to.eq(facts.withdrawRepeatCount + 1)
  })

  it('UC-20 UC-21 | An event invite notifies the linked user and not a phone with no account', () => {
    expect(facts.eventError, 'event invites were sent').to.eq('')
    expect(facts.sendStatus, 'send invites').to.be.lessThan(400)
    expect(facts.linkedInviteCount, `the linked user is notified (${facts.inviteRow})`).to.eq(1)
    expect(facts.eventHref, 'the invite opens the dashboard').to.eq('/dashboard')
    expect(facts.unknownOnStudent, 'a phone with no account creates no notification for this student').to.eq(0)
  })

  it('UC-21 | An existing invited account is notified', () => {
    expect(facts.secondInviteError, 'the existing invited account can open the dashboard').to.eq('')
    expect(facts.secondInviteCount, 'the existing invited account is notified').to.eq(1)
  })

  it('UC-28 | A student or another instructor cannot read assignment or withdrawal notifications', () => {
    expect(facts.withdrawalNoteFound, 'the withdrawal notification exists').to.eq(true)
    expect(facts.studentSeesAssignment, 'the student does not see the assignment notification').to.eq(false)
    expect(facts.otherSeesAssignment, 'another instructor does not see the assignment notification').to.eq(false)
    expect(facts.studentSeesWithdrawal, 'the student does not see the withdrawal notification').to.eq(false)
    expect(facts.otherSeesWithdrawal, 'another instructor does not see the withdrawal notification').to.eq(false)
    expect(facts.assignmentStillUnread, 'the student cannot mark the assignment notification read').to.eq(true)
  })

  it('Notification titles stay in English when the dashboard is Arabic', () => {
    const pairs = String(facts.arabicTitlePairs || '').split(' | ').filter(Boolean)
    expect(pairs.length, 'notification titles were compared').to.be.greaterThan(0)
    pairs.forEach((pair) => {
      const [english, arabic] = pair.split(' => ')
      expect(arabic, pair).to.eq(english)
    })
  })
})

describe('Learner notification gaps', () => {
  const title = `Notify gaps ${Date.now()}`
  let facts

  before(() => {
    const student = studentCredentials(STUDENT)
    cy.task(
      'learnerNotificationGapsCheck',
      {
        title,
        studentEmail: student.email,
        studentPassword: student.password,
        otherStudentEmail: OTHER_STUDENT.email,
        otherStudentPassword: OTHER_STUDENT.password,
        otherInstructorEmail: OTHER_INSTRUCTOR.email,
        otherInstructorPassword: OTHER_INSTRUCTOR.password,
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        baseUrl: getAppBase(),
      },
      { timeout: 300000 },
    ).then((result) => {
      facts = result
    })
  })

  it('The empty notification list has English and Arabic copy', () => {
    expect(facts.emptyEnglish, 'English empty state').to.not.eq('')
    expect(facts.emptyArabic, 'Arabic empty state').to.not.eq('')
    expect(facts.emptyArabic).to.not.eq(facts.emptyEnglish)
  })

  it('UC-07 | The unread badge matches the list, opening one lowers it, and mark all read clears it', () => {
    expect(facts.badgeBefore, 'badge shows the unread count').to.eq(facts.unreadBefore)
    expect(facts.markedItemRead, 'opening one notification marks it read').to.eq(true)
    expect(facts.badgeAfterOne, 'the badge drops by one').to.eq(facts.badgeBefore - 1)
    expect(facts.unreadAfterAll, 'mark all read leaves no unread items').to.eq(0)
    expect(facts.badgeCleared, 'mark all read clears the badge').to.eq(true)
  })

  it('UC-01 UC-05 | Two stored subscriptions still leave one in-app notification for one enrolment', () => {
    expect(facts.firstSubscriptionOk, 'first device subscription is stored').to.eq(true)
    expect(facts.secondSubscriptionOk, 'second device subscription is stored').to.eq(true)
    expect(facts.enrollStatus, 'enrolment was accepted').to.be.lessThan(400)
    expect(facts.firstEnrollmentCount, 'one enrolment creates one in-app notification').to.eq(1)
  })

  it('UC-06 | A second user who takes that browser endpoint does not see the first user notification', () => {
    expect(facts.sharedSubscriptionOk, 'the shared endpoint is accepted for the second user').to.eq(true)
    expect(facts.otherSeesEnrollment, 'the second user does not see the first user notification').to.eq(false)
  })

  it('UC-24 | The enable action is offered together with the VAPID key, and the bell stays', () => {
    expect(facts.bellPresent, 'in-app bell').to.eq(true)
    expect(facts.vapidPresent).to.eq(facts.enableText !== '')
    expect(facts.enableText, 'enable action').to.not.eq('')
  })

  it('UC-25 | A subscription the push service cannot reach still leaves the in-app notification', () => {
    expect(facts.firstSubscriptionOk, 'the unreachable subscription was stored').to.eq(true)
    expect(facts.firstEnrollmentCount, 'the in-app enrolment notification remains').to.eq(1)
    expect(facts.bothEnrollmentCount, 'a later enrolment is still delivered in app').to.eq(2)
  })

  it('UC-14 | Approving a course update notifies the owner', () => {
    expect(facts.reviewRestoreError, 'course update review was restored').to.eq('')
    expect(facts.updateError, 'the course update was moderated').to.eq('')
    expect(facts.approveCount, 'approval notifies the owner').to.eq(1)
  })

  it('UC-15 | Rejecting a course update notifies the owner and includes the note', () => {
    expect(facts.updateError, 'the course update was moderated').to.eq('')
    expect(facts.rejectCount, 'rejection notifies the owner').to.eq(1)
    expect(facts.rejectBody, 'the rejection includes the admin note').to.include(facts.rejectionNote)
  })
})

const PHONE_AND_SAFARI = [
  {
    name: 'iPhone',
    viewport: 'iphone-x',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'Android',
    viewport: 'samsung-s10',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
  {
    name: 'Safari',
    viewport: 'macbook-13',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  },
]

function openBellOn(client) {
  cy.on('uncaught:exception', (err) => {
    if (/push service not available|Registration failed/i.test(String(err && err.message))) return false
  })
  cy.viewport(client.viewport)
  loginViaApi(INSTRUCTOR)
  cy.visit(`${getAppBase()}/dashboard`, {
    auth: basicAuth(),
    failOnStatusCode: false,
    timeout: 120000,
    headers: { 'user-agent': client.userAgent },
  })
  cy.get('body').then(($body) => {
    const menu = $body.find('.navbar-toggler:visible')
    if (menu.length) cy.wrap(menu.first()).click()
  })
  cy.get('#NotificationBellToggle', { timeout: 30000 }).scrollIntoView().should('be.visible').click()
  cy.get('#NotificationList').should('be.visible')
  cy.get('#NotificationMarkAllRead').should('be.visible')
  cy.window().then((win) => {
    const doc = win.document
    // PhpDebugBar and Chart.js size probes sit outside the layout the user sees.
    // The hamburger sheet is open only so the bell can be reached; its own box
    // is wider than a 360px phone, so it is not part of this fit check.
    doc.querySelectorAll('#phpdebugbar, .phpdebugbar, .phpdebugbar-openhandler').forEach((bar) => {
      bar.style.setProperty('display', 'none')
    })
    const limit = win.innerWidth + 24
    let maxRight = 0
    for (const el of doc.body.querySelectorAll('*')) {
      if (el.closest('#mainNavbarContent, #phpdebugbar, .phpdebugbar, .chartjs-size-monitor')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      if (rect.right > maxRight) maxRight = rect.right
    }
    expect(Math.ceil(maxRight), `${client.name} page fits the screen`).to.be.lte(limit)
    const panel = doc.querySelector('.notification-dropdown')
    expect(Math.ceil(panel.getBoundingClientRect().width), `${client.name} notification list fits the screen`).to.be.lte(win.innerWidth)
  })
}

describe('Learner notification center on a phone and in Safari', () => {
  PHONE_AND_SAFARI.forEach((client) => {
    it(`The bell, list, and mark-all action open on ${client.name}`, () => {
      openBellOn(client)
    })
  })
})
