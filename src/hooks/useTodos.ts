import { useEffect, useMemo, useReducer, useState } from 'react';
import type { Filter, Priority, Todo } from '../types';
import { loadTodos, saveTodos } from '../lib/storage';

export type TodoAction =
  | { type: 'add'; title: string; priority: Priority; dueDate: string | null }
  | { type: 'edit'; id: string; title: string }
  | { type: 'toggle'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'clearCompleted' }
  | { type: 'setPriority'; id: string; priority: Priority }
  | { type: 'setDueDate'; id: string; dueDate: string | null };

function reducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add': {
      const title = action.title.trim();
      if (!title) return state;
      const todo: Todo = {
        id: crypto.randomUUID(),
        title,
        completed: false,
        priority: action.priority,
        dueDate: action.dueDate,
        createdAt: Date.now(),
      };
      return [...state, todo];
    }
    case 'edit': {
      const title = action.title.trim();
      if (!title) return state;
      return state.map((t) => (t.id === action.id ? { ...t, title } : t));
    }
    case 'toggle':
      return state.map((t) =>
        t.id === action.id ? { ...t, completed: !t.completed } : t,
      );
    case 'delete':
      return state.filter((t) => t.id !== action.id);
    case 'clearCompleted':
      return state.filter((t) => !t.completed);
    case 'setPriority':
      return state.map((t) =>
        t.id === action.id ? { ...t, priority: action.priority } : t,
      );
    case 'setDueDate':
      return state.map((t) =>
        t.id === action.id ? { ...t, dueDate: action.dueDate } : t,
      );
    default:
      return state;
  }
}

export function useTodos() {
  const [todos, dispatch] = useReducer(reducer, undefined, loadTodos);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    saveTodos(todos);
  }, [todos]);

  const visibleTodos = useMemo(() => {
    switch (filter) {
      case 'active':
        return todos.filter((t) => !t.completed);
      case 'completed':
        return todos.filter((t) => t.completed);
      default:
        return todos;
    }
  }, [todos, filter]);

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.length - activeCount;

  return {
    todos,
    visibleTodos,
    filter,
    setFilter,
    activeCount,
    completedCount,
    dispatch,
  };
}
