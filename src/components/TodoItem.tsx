import { useState } from 'react';
import type { Priority, Todo } from '../types';

interface Props {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onPriorityChange: (id: string, priority: Priority) => void;
}

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.completed) return false;
  const today = new Date().toISOString().slice(0, 10);
  return todo.dueDate < today;
}

export function TodoItem({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onPriorityChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  const startEditing = () => {
    setDraft(todo.title);
    setEditing(true);
  };

  const commit = () => {
    if (!editing) return;
    onEdit(todo.id, draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(todo.title);
    setEditing(false);
  };

  const overdue = isOverdue(todo);

  return (
    <li
      className={[
        'todo-item',
        todo.completed ? 'todo-item--completed' : '',
        overdue ? 'todo-item--overdue' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="todo-item"
      data-title={todo.title}
      data-completed={todo.completed}
      data-priority={todo.priority}
      data-overdue={overdue}
    >
      <input
        type="checkbox"
        className="todo-item__toggle"
        data-testid="todo-toggle"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        aria-label={`Toggle ${todo.title}`}
      />

      {editing ? (
        <input
          type="text"
          className="todo-item__edit"
          data-testid="todo-edit-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          aria-label="Edit todo title"
        />
      ) : (
        <span
          className="todo-item__title"
          data-testid="todo-title"
          onDoubleClick={startEditing}
        >
          {todo.title}
        </span>
      )}

      <span
        className={`todo-item__priority-badge todo-item__priority-badge--${todo.priority}`}
        data-testid="todo-priority-badge"
      >
        {todo.priority}
      </span>

      <select
        className="todo-item__priority"
        data-testid="todo-priority"
        value={todo.priority}
        onChange={(e) => onPriorityChange(todo.id, e.target.value as Priority)}
        aria-label={`Priority for ${todo.title}`}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      {todo.dueDate && (
        <span className="todo-item__due" data-testid="todo-due">
          {todo.dueDate}
        </span>
      )}

      <button
        type="button"
        className="todo-item__edit-btn"
        data-testid="edit-todo-button"
        onClick={startEditing}
      >
        Edit
      </button>
      <button
        type="button"
        className="todo-item__delete"
        data-testid="delete-todo-button"
        onClick={() => onDelete(todo.id)}
        aria-label={`Delete ${todo.title}`}
      >
        ✕
      </button>
    </li>
  );
}
