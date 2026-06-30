Feature: Delete todos
  As a user
  I want to delete todos
  So that I can remove things I no longer need

  Background:
    Given I am on the todo app
    And the following todos exist:
      | title    |
      | Buy milk |
      | Walk dog |

  Scenario: Delete a single todo
    When I delete the todo "Buy milk"
    Then I should see 1 todo
    And the todo "Buy milk" should not be visible

  Scenario: Delete every todo shows the empty state
    When I delete the todo "Buy milk"
    And I delete the todo "Walk dog"
    Then I should see 0 todos
    And I should see the empty state
