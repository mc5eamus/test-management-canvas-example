Feature: Edit todos
  As a user
  I want to edit an existing todo
  So that I can correct or refine it

  Background:
    Given I am on the todo app
    And the following todos exist:
      | title    |
      | Buy milk |

  Scenario: Rename a todo
    When I rename the todo "Buy milk" to "Buy oat milk"
    Then the todo "Buy oat milk" should be visible
    And the todo "Buy milk" should not be visible

  Scenario: Cancelling with Escape keeps the original title
    When I start editing the todo "Buy milk"
    And I type "Something else" in the edit field
    And I press Escape in the edit field
    Then the todo "Buy milk" should be visible

  Scenario: Saving an empty title keeps the original title
    When I clear the todo "Buy milk" and save
    Then the todo "Buy milk" should be visible
