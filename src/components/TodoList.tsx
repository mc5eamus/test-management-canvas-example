import type { Priority, Todo } from '../types';
import { TodoItem } from './TodoItem';

interface Props {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
}

export function TodoList({
  todos,
  onToggle,
  onDelete,
  onEdit,
  onPriorityChange,
}: Props) {
  if (todos.length === 0) {
    return (
      <p className="todo-list__empty" data-testid="empty-state">
        Nothing here yet.
      </p>
    );
  }

  return (
    <ul className="todo-list" data-testid="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          onPriorityChange={onPriorityChange}
        />
      ))}
    </ul>
  );
}
