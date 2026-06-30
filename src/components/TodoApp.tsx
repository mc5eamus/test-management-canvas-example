import { useTodos } from '../hooks/useTodos';
import { TodoFilters } from './TodoFilters';
import { TodoFooter } from './TodoFooter';
import { TodoInput } from './TodoInput';
import { TodoList } from './TodoList';

export function TodoApp() {
  const {
    todos,
    visibleTodos,
    filter,
    setFilter,
    activeCount,
    completedCount,
    dispatch,
  } = useTodos();

  return (
    <main className="todo-app" data-testid="todo-app">
      <h1 className="todo-app__title">Todo Playground</h1>

      <TodoInput
        onAdd={(title, priority, dueDate) =>
          dispatch({ type: 'add', title, priority, dueDate })
        }
      />

      {todos.length > 0 && (
        <TodoFilters filter={filter} onChange={setFilter} />
      )}

      <TodoList
        todos={visibleTodos}
        onToggle={(id) => dispatch({ type: 'toggle', id })}
        onDelete={(id) => dispatch({ type: 'delete', id })}
        onEdit={(id, title) => dispatch({ type: 'edit', id, title })}
        onPriorityChange={(id, priority) =>
          dispatch({ type: 'setPriority', id, priority })
        }
      />

      {todos.length > 0 && (
        <TodoFooter
          activeCount={activeCount}
          completedCount={completedCount}
          onClearCompleted={() => dispatch({ type: 'clearCompleted' })}
        />
      )}
    </main>
  );
}
