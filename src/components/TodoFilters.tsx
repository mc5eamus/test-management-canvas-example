import type { Filter } from '../types';

interface Props {
  filter: Filter;
  onChange: (filter: Filter) => void;
}

const options: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export function TodoFilters({ filter, onChange }: Props) {
  return (
    <div className="todo-filters" data-testid="todo-filters">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`todo-filters__btn${
            filter === option.value ? ' todo-filters__btn--active' : ''
          }`}
          data-testid={`filter-${option.value}`}
          data-active={filter === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
