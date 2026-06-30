Feature: Toggle todo completion
  As a user
  I want to mark todos as completed
  So that I can see what is left to do

  Background:
    Given I am on the todo app
    And the following todos exist:
      | title    |
      | Buy milk |
      | Walk dog |

  Scenario: Mark a todo as completed
    When I complete the todo "Buy milk"
    Then the todo "Buy milk" should be completed
    And the active count should be "1 item left"

  Scenario: Un-complete a previously completed todo
    Given I complete the todo "Buy milk"
    When I complete the todo "Buy milk"
    Then the todo "Buy milk" should not be completed
    And the active count should be "2 items left"
