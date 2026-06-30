Feature: Priority
  As a user
  I want to assign a priority to a todo
  So that I can tell which items matter most

  Background:
    Given I am on the todo app

  Scenario: Add a high priority todo
    When I add a todo "Call client" with priority "high"
    Then the todo "Call client" should have priority "high"

  Scenario: Change the priority of an existing todo
    Given the following todos exist:
      | title    |
      | Buy milk |
    When I set the priority of "Buy milk" to "low"
    Then the todo "Buy milk" should have priority "low"
