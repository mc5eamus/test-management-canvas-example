import { expect, type Locator, type Page } from '@playwright/test';

export type Priority = 'low' | 'medium' | 'high';
export type FilterName = 'all' | 'active' | 'completed';

export class TodoPage {
  constructor(readonly page: Page) {}

  get newTodoInput(): Locator {
    return this.page.getByTestId('new-todo-input');
  }

  get newTodoPriority(): Locator {
    return this.page.getByTestId('new-todo-priority');
  }

  get newTodoDue(): Locator {
    return this.page.getByTestId('new-todo-due');
  }

  get addButton(): Locator {
    return this.page.getByTestId('add-todo-button');
  }

  get items(): Locator {
    return this.page.getByTestId('todo-item');
  }

  get emptyState(): Locator {
    return this.page.getByTestId('empty-state');
  }

  get activeCount(): Locator {
    return this.page.getByTestId('active-count');
  }

  get clearCompletedButton(): Locator {
    return this.page.getByTestId('clear-completed-button');
  }

  /** The single in-place edit input (only one item can be edited at a time). */
  get editInput(): Locator {
    return this.page.getByTestId('todo-edit-input');
  }

  item(title: string): Locator {
    return this.page.locator(
      `[data-testid="todo-item"][data-title="${title}"]`,
    );
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
    await expect(this.page.getByTestId('todo-app')).toBeVisible();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await expect(this.page.getByTestId('todo-app')).toBeVisible();
  }

  async addTodo(title: string): Promise<void> {
    await this.newTodoInput.fill(title);
    await this.addButton.click();
  }

  async addTodoWithDetails(
    title: string,
    priority: Priority,
    dueDate?: string,
  ): Promise<void> {
    await this.newTodoInput.fill(title);
    await this.newTodoPriority.selectOption(priority);
    if (dueDate) {
      await this.newTodoDue.fill(dueDate);
    }
    await this.addButton.click();
  }

  async completeTodo(title: string): Promise<void> {
    await this.item(title).getByTestId('todo-toggle').click();
  }

  async deleteTodo(title: string): Promise<void> {
    await this.item(title).getByTestId('delete-todo-button').click();
  }

  async startEditing(title: string): Promise<void> {
    await this.item(title).getByTestId('edit-todo-button').click();
  }

  async renameTodo(title: string, newTitle: string): Promise<void> {
    await this.startEditing(title);
    await this.editInput.fill(newTitle);
    await this.editInput.press('Enter');
  }

  async clearTodoTitleAndSave(title: string): Promise<void> {
    await this.startEditing(title);
    await this.editInput.fill('');
    await this.editInput.press('Enter');
  }

  async setPriorityOf(title: string, priority: Priority): Promise<void> {
    await this.item(title).getByTestId('todo-priority').selectOption(priority);
  }

  async filterBy(name: FilterName): Promise<void> {
    await this.page.getByTestId(`filter-${name}`).click();
  }

  async clearCompleted(): Promise<void> {
    await this.clearCompletedButton.click();
  }
}
