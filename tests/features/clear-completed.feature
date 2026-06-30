Feature: Clear completed todos
  As a user
  I want to clear completed todos in one action
  So that I can tidy up my list

  Background:
    Given I am on the todo app
    And the following todos exist:
      | title    |
      | Buy milk |
      | Walk dog |

  Scenario: Clearing removes only completed todos
    Given I complete the todo "Buy milk"
    When I clear completed todos
    Then I should see 1 todo
    And the todo "Buy milk" should not be visible
    And the todo "Walk dog" should be visible

  Scenario: The clear completed button is hidden when nothing is completed
    Then the clear completed button should not be visible
