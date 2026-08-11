import type { ApiCategory } from '../../types/api';

export interface CategoryFilterProps {
  categories: ApiCategory[];
  selectedId?: number;
  onSelect: (categoryId?: number) => void;
}

export function CategoryFilter({
  categories,
  selectedId,
  onSelect,
}: Readonly<CategoryFilterProps>) {
  const rowClass = (active: boolean) =>
    `w-full rounded-control px-2.5 py-1.5 text-left text-sm transition-colors duration-[160ms] ${
      active ? 'bg-accent-soft font-semibold text-accent' : 'hover:bg-sunken'
    }`;

  return (
    <nav aria-label="Lọc theo danh mục" className="space-y-1">
      <button type="button" onClick={() => onSelect(undefined)} className={rowClass(selectedId === undefined)}>
        Tất cả sản phẩm
      </button>

      {categories.map((parent) => {
        const total = parent.children.reduce(
          (sum, child) => sum + child.productCount,
          parent.productCount,
        );

        return (
          <div key={parent.id}>
            <button
              type="button"
              onClick={() => onSelect(parent.id)}
              className={rowClass(selectedId === parent.id)}
            >
              {parent.name}
              <span className="ml-1 text-xs font-normal text-ink-muted">({total})</span>
            </button>

            {parent.children.length > 0 ? (
              <div className="ml-3 border-l border-line pl-2">
                {parent.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onSelect(child.id)}
                    className={rowClass(selectedId === child.id)}
                  >
                    {child.name}
                    <span className="ml-1 text-xs font-normal text-ink-muted">
                      ({child.productCount})
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
