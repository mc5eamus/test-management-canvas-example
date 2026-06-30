# Todo Playground — Canvas Extension Test Demo

A small, realistic **React + TypeScript** todo app used as a playground for demoing a
testing-focused canvas extension. It ships with a readable **Gherkin-driven Playwright**
UI test suite (via [`playwright-bdd`](https://github.com/vitalets/playwright-bdd)) so there
are many meaningful scenarios to discover, run, and visualize.

## Features

- Add, edit (rename), and delete todos
- Toggle complete / active with a live "items left" count
- Filter by **All / Active / Completed**
- **Clear completed** in one action
- **Due dates** with overdue highlighting
- **Priority** (low / medium / high) with a colored badge
- **Persistence** via `localStorage` (survives reloads)

## Tech stack

| Area        | Choice                                   |
| ----------- | ---------------------------------------- |
| Build / dev | Vite + React 19 + TypeScript             |
| Tests       | Playwright Test + `playwright-bdd`        |
| Test style  | Gherkin `.feature` files + Page Objects  |
| Lint        | oxlint                                    |

## Getting started

```bash
npm install
npx playwright install chromium   # one-time browser download
npm run dev                       # http://localhost:5173
```

## Running the tests

`playwright-bdd` compiles the `.feature` files into Playwright specs (`bddgen`), then runs
them. Playwright starts the Vite dev server automatically (see `playwright.config.ts`).

```bash
npm test            # generate specs + run headless
npm run test:headed # run with a visible browser
npm run test:ui     # open the Playwright UI runner
npm run test:report # open the last HTML report
```

## Project structure

```
src/
  types.ts                 # Todo, Priority, Filter types
  lib/storage.ts           # localStorage load/save
  hooks/useTodos.ts        # reducer + persistence + filtering
  components/              # TodoApp, TodoInput, TodoList, TodoItem, TodoFilters, TodoFooter
tests/
  features/*.feature       # Gherkin scenarios (add, edit, delete, toggle, filter, ...)
  steps/                   # fixtures.ts + todo.steps.ts (step definitions)
  pages/TodoPage.ts        # Page Object Model
playwright.config.ts       # defineBddConfig + webServer
```

## How the tests are wired

- **Feature files** (`tests/features`) describe behavior in plain Gherkin.
- **Step definitions** (`tests/steps/todo.steps.ts`) map each Gherkin step to actions on the
  Page Object, using a `todoPage` fixture from `tests/steps/fixtures.ts`.
- **Page Object** (`tests/pages/TodoPage.ts`) encapsulates locators and interactions.
- Selectors use stable **`data-testid`** attributes so scenarios stay resilient to markup and
  styling changes — and so a testing canvas extension can reason about them easily.

### Adding a scenario

1. Add a `Scenario:` to a file in `tests/features/` (reuse existing steps where possible).
2. If you need a new step, add it to `tests/steps/todo.steps.ts` and back it with a method on
   `TodoPage`.
3. Run `npm test`.

## Notes

- Generated specs land in `.features-gen/` (git-ignored); never edit them by hand.
- The app intentionally has no backend — state lives entirely in `localStorage`.
