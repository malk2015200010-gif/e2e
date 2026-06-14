# Admin Unified Notifications - Acceptance Scenarios
# سيناريوهات قبول النظام الموحد للإشعارات

Feature: Unified admin notifications system
  As an admin user with role-based permissions,
  I want a unified notification system for actionable items,
  so I can see what needs attention, receive timely alerts, and only view notifications I’m allowed to act on.

  Background:
    Given the admin user is authenticated
    And the admin dashboard is loaded

  Scenario: Sidebar badges are shown only for permitted queues
    Given the user has permissions for "course updates" and "payments"
    And there are pending items in "course updates" and "payments"
    When the user views the admin sidebar
    Then they see a badge for "Course Updates"
    And they see a badge for "Payments"
    And they do not see a badge for "Withdrawals"
    And they do not see a badge for "WhatsApp"

  Scenario: No badge shown when there are no pending items or no permission
    Given the user has permission for "course updates"
    And there are no pending items in "course updates"
    When the user views the admin sidebar
    Then they do not see a badge next to "Course Updates"

  Scenario: Notification bell shows correct unread count
    Given the user has permissions for "course updates" and "whatsapp"
    And there are 5 unread notifications in allowed queues
    When the user views the top navbar
    Then the bell icon displays unread count "5"

  Scenario: Bell dropdown shows queue summary and recent notifications
    Given the user has permissions for "payments" and "verifications"
    And there are recent notifications for "payments" and "verifications"
    When the user opens the notification bell dropdown
    Then the dropdown shows a summary for allowed queues
    And the dropdown lists recent notifications only from allowed queues
    And notifications from forbidden queues are not shown

  Scenario: Clicking a single notification marks it as read and updates the count
    Given there is one unread notification in an allowed queue
    And the bell count is "3"
    When the user clicks the unread notification
    Then the notification becomes read
    And the bell count updates to "2"

  Scenario: Mark all as read clears the unread count without page reload
    Given there are 4 unread notifications
    When the user clicks "Mark all as read"
    Then the unread count becomes "0"
    And no unread notifications remain in the dropdown

  Scenario: Notifications page shows feed and "Needs attention" cards
    Given the user navigates to the full notifications page
    When the notifications page loads
    Then the page displays the allowed notification feed
    And the page shows a "Needs attention" section for active queues

  Scenario: Permissions prevent leakage of forbidden queue data
    Given the user does not have permission for "whatsapp"
    When the user requests the summary/feed API
    Then the response does not include "whatsapp" data
    And no sidebar link, badge, or notification for "whatsapp" is visible

  Scenario: New work item creates the correct notification
    Given a new withdraw request is created
    When the system processes the new work item
    Then a notification is created for the "withdrawals" queue
    And allowed admin users see an updated count in the sidebar or bell

  Scenario: Resolving a work item clears or updates its notification
    Given there is an unresolved work item with a notification
    When the work item is resolved
    Then the associated notification is removed or marked resolved
    And the badge and bell count decrease accordingly
