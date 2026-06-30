import { useState } from 'react';
import type { Priority } from '../types';

interface Props {
  onAdd: (title: string, priority: Priority, dueDate: string | null) => void;
}

export function TodoInput({ onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title, priority, dueDate || null);
    setTitle('');
    setPriority('medium');
    setDueDate('');
  };

  return (
    <form
      className="todo-input"
      data-testid="todo-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        type="text"
        className="todo-input__title"
        data-testid="new-todo-input"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="New todo title"
      />
      <select
        className="todo-input__priority"
        data-testid="new-todo-priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        aria-label="New todo priority"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <input
        type="date"
        className="todo-input__due"
        data-testid="new-todo-due"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        aria-label="New todo due date"
      />
      <button
        type="submit"
        className="todo-input__add"
        data-testid="add-todo-button"
      >
        Add
      </button>
    </form>
  );
}
