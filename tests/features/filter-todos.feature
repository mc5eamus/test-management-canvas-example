Feature: Filter todos
  As a user
  I want to filter todos by status
  So that I can focus on active or completed work

  Background:
    Given I am on the todo app
    And the following todos exist:
      | title     |
      | Buy milk  |
      | Walk dog  |
      | Pay bills |
    And I complete the todo "Buy milk"

  Scenario: Show only active todos
    When I filter by "active"
    Then I should see 2 todos
    And the todo "Buy milk" should not be visible

  Scenario: Show only completed todos
    When I filter by "completed"
    Then I should see 1 todo
    And the todo "Buy milk" should be visible

  Scenario: Show all todos again
    When I filter by "completed"
    And I filter by "all"
    Then I should see 3 todos
