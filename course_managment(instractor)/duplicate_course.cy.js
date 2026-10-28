import { getAppBase } from '../../support/navigation'
import { ADMIN, INSTRUCTOR, INSTRUCTORS, STUDENTS, otherInstructorCredentials, studentCredentials } from '../../support/users'

/**
 * Instructor duplicates an owned course.
 * The Jira export did not include the steps for MEN-2954–MEN-3066,
 * so these tests follow the story acceptance criteria.
 *
 * The Duplicate Course button is on /dashboard/courses/new, under Create Course.
 * Choosing a course and submitting that form creates the copy.
 * Course cards do not show the button.
 *
 * A recorded course has no live-session attendance to copy.
 * Checkout only offers a card payment, so these tests do not place a purchase or a refund.
 * A crash in the middle of the duplicate request cannot be forced from Cypress.
 * The content test checks that one successful copy contains the section, lesson, video, file, and price together.
 * The course image and the quiz questions must be copied too. Leaving them behind is a filed product bug,
 * so those assertions stay strict.
 */
const OTHER_INSTRUCTOR = INSTRUCTORS[1]
const STUDENT = STUDENTS.find((user) => user.email === 'student5@demo.com')

const accounts = () => ({
  instructorEmail: INSTRUCTOR.email,
  instructorPassword: INSTRUCTOR.password,
  baseUrl: getAppBase(),
})

describe('Instructor duplicates an owned course', () => {
  it('AC1 AC2 AC3 AC8 AC10 AC13 | Duplicating an owned course creates a separate draft', () => {
    const title = `Duplicate empty ${Date.now()}`

    cy.task('duplicateOwnedCourseCheck', { title, ...accounts() }, { timeout: 180000 }).then((result) => {
      expect(result.buttonPresent, 'Duplicate Course is on the new course page').to.eq(true)
      expect(result.listedInDuplicateForm, 'the owned course is in Select Course').to.eq(true)
      expect(result.copyId, 'the copy has its own id').to.not.eq(result.originalId)
      expect(result.originalUnchanged, 'the original course stays as it was').to.eq(true)
      expect(result.copyTitle, 'the copy name is distinguishable').to.not.eq(result.originalTitle)
      expect(result.copyTitle, 'the copy name still identifies the source').to.include(result.originalTitle)
      expect(result.titleEditable, 'the instructor can edit the copy name').to.eq(true)
      expect(result.copyDraft, 'the copy is created as a draft').to.eq(true)
      expect(result.descriptionCopied, 'the description is copied').to.eq(true)
      expect(result.categoryCopied, 'the category is copied').to.eq(true)
      expect(result.topicCopied, 'the topic is copied').to.eq(true)
      expect(result.levelCopied, 'the level is copied').to.eq(true)
      expect(result.deliveryCopied, 'the delivery type is copied').to.eq(true)
      expect(result.accessCopied, 'the access setting is copied').to.eq(true)
      expect(result.copyEnrollments, 'a course with no students still starts empty').to.eq(0)
    })
  })

  it('AC7 | Editing one course does not change the other', () => {
    const title = `Duplicate independent ${Date.now()}`

    cy.task('duplicateIndependenceCheck', { title, ...accounts() }, { timeout: 180000 }).then((result) => {
      expect(result.copyAfterCopyEdit, 'the copy accepts its own title').to.eq(result.copyTitle)
      expect(result.originalAfterCopyEdit, 'editing the copy leaves the original title').to.eq(title)
      expect(result.originalAfterOriginalEdit, 'the original accepts its own title').to.eq(result.originalTitle)
      expect(result.copyAfterOriginalEdit, 'editing the original leaves the copy title').to.eq(result.copyTitle)
    })
  })

  it('AC4 AC8 AC11 | Enrollments stay on the original course', () => {
    const title = `Duplicate enrolled ${Date.now()}`

    cy.task(
      'duplicateEnrolledCourseCheck',
      {
        title,
        ...accounts(),
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        studentEmail: studentCredentials(STUDENT).email,
        studentPassword: studentCredentials(STUDENT).password,
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.copyId, 'the enrolled course still gets a new id').to.not.eq(result.originalId)
      expect(result.copyDraft, 'the copy is not published with the original').to.eq(true)
      expect(result.descriptionCopied, 'the course content settings are copied').to.eq(true)
      expect(result.copyEnrollments, 'the copy starts with zero enrollments').to.eq(0)
      expect(result.originalEnrollments, 'the original keeps its enrollment').to.be.greaterThan(0)
    })
  })

  it('AC9 | Another instructor or a student cannot duplicate the course', () => {
    const title = `Duplicate forbidden ${Date.now()}`

    cy.task(
      'duplicateForbiddenCheck',
      {
        title,
        ...accounts(),
        otherEmail: otherInstructorCredentials(OTHER_INSTRUCTOR).email,
        otherPassword: otherInstructorCredentials(OTHER_INSTRUCTOR).password,
        studentEmail: studentCredentials(STUDENT).email,
        studentPassword: studentCredentials(STUDENT).password,
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.otherCreatedCopy, `other instructor response ${result.otherStatus}`).to.eq(false)
      expect(result.otherRefused, 'another instructor is rejected').to.eq(true)
      expect(result.studentCreatedCopy, `student response ${result.studentStatus}`).to.eq(false)
      expect(result.studentRefused, 'a student is rejected').to.eq(true)
      expect(result.originalUnchanged, 'the original course stays unchanged').to.eq(true)
    })
  })

  it('AC12 | A bad duplicate request does not create a course', () => {
    const title = `Duplicate invalid ${Date.now()}`

    cy.task('duplicateFailureCheck', { title, ...accounts() }, { timeout: 180000 }).then((result) => {
      expect(result.createdCopy, 'a bad id does not create a course').to.eq(false)
      expect(result.status, 'the failed request is not a server error').to.be.lessThan(500)
      expect(result.explained, `the failure is visible (${result.status})`).to.eq(true)
      expect(result.originalUnchanged, 'the original course stays unchanged').to.eq(true)
    })
  })

  it('AC2 AC5 | Sections, lessons, video, files, price, and the course image are copied', () => {
    const title = `Duplicate content ${Date.now()}`

    cy.task('duplicateCurriculumCheck', { title, ...accounts() }, { timeout: 180000 }).then((result) => {
      expect(result.copyId, 'the copy has its own id').to.not.eq(result.originalId)
      expect(result.sectionCopied, 'the section is copied with a new id').to.eq(true)
      expect(result.lessonCopied, 'the lesson is copied with a new id').to.eq(true)
      expect(result.videoCopied, 'the lesson video URL is copied').to.eq(true)
      expect(result.fileCopied, 'the lesson file is copied').to.eq(true)
      expect(result.priceCopied, 'the paid price is copied').to.eq(true)
      expect(result.quizCopied, 'the quiz is copied with a new id').to.eq(true)
      expect(result.assignmentCopied, 'the assignment is copied with a new id').to.eq(true)
      expect(result.copyComplete, 'the copy contains the section, lesson, video, file, and price together').to.eq(true)
      expect(result.originalLessonStays, 'editing the copy lesson leaves the original lesson').to.eq(true)
      expect(result.copyLessonEdited, 'the copy lesson accepts its own title').to.eq(true)
      expect(
        {
          questionCopied: result.questionCopied,
          imageCopied: result.imageCopied,
          copyThumbnail: result.copyThumbnail,
          originalThumbnail: result.originalThumbnail,
        },
        'the quiz question and the course image are copied',
      ).to.deep.equal({
        questionCopied: true,
        imageCopied: true,
        copyThumbnail: result.originalThumbnail,
        originalThumbnail: result.originalThumbnail,
      })
    })
  })

  it('AC4 AC6 | Progress, attempts, grades, and submissions stay on the original', () => {
    const title = `Duplicate learner ${Date.now()}`

    cy.task(
      'duplicateLearnerDataCheck',
      {
        title,
        ...accounts(),
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.password,
        studentEmail: studentCredentials(STUDENT).email,
        studentPassword: studentCredentials(STUDENT).password,
      },
      { timeout: 180000 },
    ).then((result) => {
      expect(result.originalProgress, 'the student finished the original course').to.eq(100)
      expect(result.copyProgress, 'the copy does not keep that progress').to.not.eq(100)
      expect(result.originalHasAttempt, 'the original keeps the quiz attempt').to.eq(true)
      expect(result.copyHasAttempt, 'the copy has no quiz attempt').to.eq(false)
      expect(result.originalHasSubmission, 'the original keeps the assignment submission').to.eq(true)
      expect(result.copyHasSubmission, 'the copy has no assignment submission').to.eq(false)
      expect(result.originalGradePending, 'the original submission is still pending a grade').to.eq(true)
      expect(result.copyGradePending, 'the copy has no pending grade').to.eq(false)
      expect(result.originalEnrollments, 'the original keeps the enrollment').to.be.greaterThan(0)
      expect(result.copyEnrollments, 'the copy does not receive the paid or free access').to.eq(0)
    })
  })

  it('AC14 | Deleting the copy leaves the original course', () => {
    const title = `Duplicate delete ${Date.now()}`

    cy.task('duplicateDeleteIsolationCheck', { title, ...accounts() }, { timeout: 180000 }).then((result) => {
      expect(result.copyDeleted, 'the copy can be deleted on its own').to.eq(true)
      expect(result.copyRemains, 'the copy does not stay after deletion').to.eq(false)
      expect(result.originalRemains, 'the original course and its title stay').to.eq(true)
    })
  })
})
