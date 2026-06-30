import { test as base, createBdd } from 'playwright-bdd';
import { TodoPage } from '../pages/TodoPage';

type Fixtures = {
  todoPage: TodoPage;
};

export const test = base.extend<Fixtures>({
  todoPage: async ({ page }, use) => {
    await use(new TodoPage(page));
  },
});

export const { Given, When, Then } = createBdd(test);
