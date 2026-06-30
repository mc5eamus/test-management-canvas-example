Feature: Persistence
  As a user
  I want my todos to be saved
  So that they survive a page reload

  Background:
    Given I am on the todo app

  Scenario: Todos persist across a page reload
    Given the following todos exist:
      | title    |
      | Buy milk |
      | Walk dog |
    When I reload the page
    Then I should see 2 todos
    And the todo "Buy milk" should be visible

  Scenario: Completed state persists across a reload
    Given the following todos exist:
      | title    |
      | Buy milk |
    And I complete the todo "Buy milk"
    When I reload the page
    Then the todo "Buy milk" should be completed
