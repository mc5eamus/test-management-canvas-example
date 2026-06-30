Feature: Add todos
  As a user
  I want to add todos
  So that I can keep track of things I need to do

  Background:
    Given I am on the todo app

  Scenario: Add a single todo
    When I add a todo "Buy milk"
    Then I should see 1 todo
    And the todo "Buy milk" should be visible

  Scenario: Add multiple todos
    When I add a todo "Buy milk"
    And I add a todo "Walk the dog"
    And I add a todo "Write tests"
    Then I should see 3 todos

  Scenario: Whitespace-only input is ignored
    When I add a todo "   "
    Then I should see 0 todos

  Scenario: The input is cleared after adding a todo
    When I add a todo "Buy milk"
    Then the new todo input should be empty
