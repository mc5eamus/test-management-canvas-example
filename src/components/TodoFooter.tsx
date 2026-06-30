interface Props {
  activeCount: number;
  completedCount: number;
  onClearCompleted: () => void;
}

export function TodoFooter({
  activeCount,
  completedCount,
  onClearCompleted,
}: Props) {
  return (
    <footer className="todo-footer" data-testid="todo-footer">
      <span className="todo-footer__count" data-testid="active-count">
        {activeCount} {activeCount === 1 ? 'item' : 'items'} left
      </span>
      {completedCount > 0 && (
        <button
          type="button"
          className="todo-footer__clear"
          data-testid="clear-completed-button"
          onClick={onClearCompleted}
        >
          Clear completed ({completedCount})
        </button>
      )}
    </footer>
  );
}
