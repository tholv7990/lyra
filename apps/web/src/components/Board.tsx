import { useState, type ReactNode } from 'react';

export interface BoardColumn {
  key: string;
  /** Header content — a label, or a status icon + label. */
  header: ReactNode;
}

// A Linear/Plane-style board: items grouped into status columns of cards.
// Generic over the item type. Drag-to-move is native HTML5 DnD, enabled only
// when `onMove` is passed (otherwise the board is read-only). Token-only.
export function Board<T>({
  columns,
  items,
  columnOf,
  itemKey,
  renderCard,
  onMove,
  onAdd,
  addLabel = 'Add',
}: {
  columns: BoardColumn[];
  items: T[];
  /** Which column an item belongs to. */
  columnOf: (item: T) => string;
  itemKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /** Pass to enable drag-to-move between columns. */
  onMove?: (item: T, toColumn: string) => void;
  /** Pass to show a footer "+ Add" affordance per column. */
  onAdd?: (column: string) => void;
  addLabel?: string;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const drop = (colKey: string) => {
    setOverCol(null);
    if (!onMove || dragKey == null) return;
    const item = items.find((i) => itemKey(i) === dragKey);
    setDragKey(null);
    if (item && columnOf(item) !== colKey) onMove(item, colKey);
  };

  return (
    <div className="board">
      {columns.map((col) => {
        const cards = items.filter((i) => columnOf(i) === col.key);
        return (
          <section
            key={col.key}
            className={`board-col${overCol === col.key ? ' over' : ''}`}
            onDragOver={onMove ? (e) => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key); } : undefined}
            onDragLeave={onMove ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); } : undefined}
            onDrop={onMove ? () => drop(col.key) : undefined}
          >
            <header className="board-col-head">
              <span className="board-col-title">{col.header}</span>
              <span className="board-col-count">{cards.length}</span>
            </header>
            <div className="board-col-body">
              {cards.map((item) => (
                <article
                  key={itemKey(item)}
                  className="board-card"
                  draggable={!!onMove}
                  onDragStart={onMove ? (e) => { setDragKey(itemKey(item)); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                  onDragEnd={onMove ? () => { setDragKey(null); setOverCol(null); } : undefined}
                >
                  {renderCard(item)}
                </article>
              ))}
              {onAdd && (
                <button type="button" className="board-add" onClick={() => onAdd(col.key)}>
                  + {addLabel}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
