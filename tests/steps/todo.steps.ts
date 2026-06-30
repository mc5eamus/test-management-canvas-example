import { expect } from '@playwright/test';
import { DataTable } from 'playwright-bdd';
import { Given, Then, When } from './fixtures';
import type { FilterName, Priority } from '../pages/TodoPage';

Given('I am on the todo app', async ({ todoPage }) => {
  await todoPage.open();
});

Given('the following todos exist:', async ({ todoPage }, table: DataTable) => {
  for (const row of table.hashes()) {
    await todoPage.addTodo(row.title);
  }
});

When('I add a todo {string}', async ({ todoPage }, title: string) => {
  await todoPage.addTodo(title);
});

When(
  'I add a todo {string} with priority {string}',
  async ({ todoPage }, title: string, priority: string) => {
    await todoPage.addTodoWithDetails(title, priority as Priority);
  },
);

When(
  'I add a todo {string} with priority {string} due {string}',
  async ({ todoPage }, title: string, priority: string, due: string) => {
    await todoPage.addTodoWithDetails(title, priority as Priority, due);
  },
);

When('I complete the todo {string}', async ({ todoPage }, title: string) => {
  await todoPage.completeTodo(title);
});

When('I delete the todo {string}', async ({ todoPage }, title: string) => {
  await todoPage.deleteTodo(title);
});

When(
  'I rename the todo {string} to {string}',
  async ({ todoPage }, title: string, newTitle: string) => {
    await todoPage.renameTodo(title, newTitle);
  },
);

When('I start editing the todo {string}', async ({ todoPage }, title: string) => {
  await todoPage.startEditing(title);
});

When('I type {string} in the edit field', async ({ todoPage }, text: string) => {
  await todoPage.editInput.fill(text);
});

When('I press Escape in the edit field', async ({ todoPage }) => {
  await todoPage.editInput.press('Escape');
});

When('I clear the todo {string} and save', async ({ todoPage }, title: string) => {
  await todoPage.clearTodoTitleAndSave(title);
});

When(
  'I set the priority of {string} to {string}',
  async ({ todoPage }, title: string, priority: string) => {
    await todoPage.setPriorityOf(title, priority as Priority);
  },
);

When('I filter by {string}', async ({ todoPage }, name: string) => {
  await todoPage.filterBy(name as FilterName);
});

When('I clear completed todos', async ({ todoPage }) => {
  await todoPage.clearCompleted();
});

When('I reload the page', async ({ todoPage }) => {
  await todoPage.reload();
});

Then('I should see {int} todo(s)', async ({ todoPage }, count: number) => {
  await expect(todoPage.items).toHaveCount(count);
});

Then('the todo {string} should be visible', async ({ todoPage }, title: string) => {
  await expect(todoPage.item(title)).toBeVisible();
});

Then(
  'the todo {string} should not be visible',
  async ({ todoPage }, title: string) => {
    await expect(todoPage.item(title)).toHaveCount(0);
  },
);

Then('the new todo input should be empty', async ({ todoPage }) => {
  await expect(todoPage.newTodoInput).toHaveValue('');
});

Then('I should see the empty state', async ({ todoPage }) => {
  await expect(todoPage.emptyState).toBeVisible();
});

Then('the todo {string} should be completed', async ({ todoPage }, title: string) => {
  await expect(todoPage.item(title)).toHaveAttribute('data-completed', 'true');
});

Then(
  'the todo {string} should not be completed',
  async ({ todoPage }, title: string) => {
    await expect(todoPage.item(title)).toHaveAttribute('data-completed', 'false');
  },
);

Then('the active count should be {string}', async ({ todoPage }, text: string) => {
  await expect(todoPage.activeCount).toHaveText(text);
});

Then(
  'the todo {string} should show due date {string}',
  async ({ todoPage }, title: string, due: string) => {
    await expect(todoPage.item(title).getByTestId('todo-due')).toHaveText(due);
  },
);

Then('the todo {string} should be overdue', async ({ todoPage }, title: string) => {
  await expect(todoPage.item(title)).toHaveAttribute('data-overdue', 'true');
});

Then(
  'the todo {string} should have priority {string}',
  async ({ todoPage }, title: string, priority: string) => {
    await expect(todoPage.item(title)).toHaveAttribute('data-priority', priority);
  },
);

Then('the clear completed button should not be visible', async ({ todoPage }) => {
  await expect(todoPage.clearCompletedButton).toHaveCount(0);
});
