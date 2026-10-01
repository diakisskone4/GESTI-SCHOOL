import { Loader2, SearchX } from "lucide-react";

/**
 * Table générique.
 * columns: [{ key, header, render?(row) }]
 */
export default function DataTable({ columns, rows, loading, empty = "Aucune donnée pour le moment.", onRowClick }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-slate-400">
                <Loader2 className="mx-auto mb-2 animate-spin" size={22} />
                Chargement...
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-slate-400">
                <SearchX className="mx-auto mb-2" size={22} />
                {empty}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {columns.map((col) => (
                  <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
