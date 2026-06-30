Feature: Due dates
  As a user
  I want to give todos a due date
  So that I know when they need to be done

  Background:
    Given I am on the todo app

  Scenario: Add a todo with a due date
    When I add a todo "Submit report" with priority "high" due "2999-01-01"
    Then the todo "Submit report" should show due date "2999-01-01"

  Scenario: A past due date is flagged as overdue
    When I add a todo "Renew passport" with priority "medium" due "2000-01-01"
    Then the todo "Renew passport" should be overdue
