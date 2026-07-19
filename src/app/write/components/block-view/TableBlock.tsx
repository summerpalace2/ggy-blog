import { useState, type FC } from "react";
import { escapeHtml } from "../../utils";

interface TableBlockProps {
  block: any;
  onChange: (b: any) => void;
  onDelete: () => void;
}

function decodeHtml(s: string): string {
  if (!s) return "";
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");
}

interface TableData {
  headers: string[];
  aligns: string[];
  rows: string[][];
}

function parseMarkdown(md: string): TableData {
  if (!md) return { headers: [""], aligns: ["left"], rows: [[""]] };
  const lines = md.split("\n").filter((l: string) => l.trim().startsWith("|"));
  if (!lines.length) return { headers: [""], aligns: ["left"], rows: [[""]] };
  const cells = lines.map((r: string) => r.split("|").filter((c: string, i: number, a: string[]) => i > 0 && i < a.length - 1).map((c: string) => c.trim()));
  const headers = cells[0] || [""];
  const hasSep = cells.length > 1 && cells[1].length > 0 && cells[1].every((c: string) => /^[-:]+$/.test(c));
  const aligns: string[] = hasSep
    ? cells[1].map((c: string) => c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left")
    : headers.map(() => "left");
  const dataRows = (hasSep ? cells.slice(2) : cells.slice(1));
  const padded = dataRows.map((r: string[]) => {
    const nr = r.map((c: string) => decodeHtml(c));
    while (nr.length < headers.length) nr.push("");
    return nr.slice(0, headers.length);
  });
  return { headers: headers.map((c: string) => decodeHtml(c)), aligns, rows: padded };
}

function buildMarkdown(h: string[], aligns: string[], rows: string[][]): string {
  const hStr = "| " + h.join(" | ") + " |";
  const sep = "|" + h.map((_, i) => {
    const al = aligns[i] || "left";
    return al === "center" ? " :---: " : al === "right" ? " ---: " : " --- ";
  }).join("|") + "|";
  const data = rows.map((r: string[]) => "| " + r.join(" | ") + " |").join("\n");
  return data ? hStr + "\n" + sep + "\n" + data : hStr + "\n" + sep;
}

export const TableBlock: FC<TableBlockProps> = ({ block, onChange, onDelete }) => {
  const initial = parseMarkdown(block.html);
  const [headers, setHeaders] = useState<string[]>(initial.headers);
  const [aligns, setAligns] = useState<string[]>(initial.aligns);
  const [rows, setRows] = useState<string[][]>(initial.rows);
  const [hoverCol, setHoverCol] = useState(-1);
  const [hoverRow, setHoverRow] = useState(-1);
  const colCount = headers.length || 1;
  const effectiveRows = rows.length > 0 ? rows : [Array(colCount).fill("")];

  const syncToStore = () => {
    const padded = rows.map((r: string[]) => { const nr = [...r]; while (nr.length < colCount) nr.push(""); return nr.slice(0, colCount); });
    onChange({ ...block, html: escapeHtml(buildMarkdown(headers, aligns, padded)) });
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr>
                <th style={{ width: 32 }} className="!p-0 !border-0"></th>
                {headers.map((cell: string, ci: number) => (
                  <th key={ci} onMouseEnter={() => setHoverCol(ci)} onMouseLeave={() => setHoverCol(-1)}
                    className="px-3 py-2 text-left font-semibold border-b outline-none relative"
                    style={{ borderColor: "var(--border)", color: "var(--text)", backgroundColor: "var(--bg-subtle)", textAlign: (aligns[ci] || "left") as "left" | "center" | "right" }}>
                    <input value={cell} onChange={(e: any) => { setHeaders((p: string[]) => { const n = [...p]; n[ci] = e.target.value; return n; }); }} onFocus={() => setHoverCol(ci)} onBlur={() => { syncToStore(); setHoverCol(-1); }}
                      className="w-full bg-transparent outline-none" style={{ textAlign: (aligns[ci] || "left") as "left" | "center" | "right", fontWeight: 600 }} />
                    {hoverCol === ci && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-0.5 z-20">
                        <button onClick={() => { setHeaders((p: string[]) => { const n = [...p]; n.splice(ci, 0, ""); return n; }); setAligns((q: string[]) => { const m = [...q]; m.splice(ci, 0, "left"); return m; }); setRows((r: string[][]) => r.map((x: string[]) => { const n = [...x]; n.splice(ci, 0, ""); return n; })); }} title="Add column left"
                          className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: "var(--accent)", color: "white" }}>+</button>
                        {colCount > 1 && (
                          <button onClick={() => { if (colCount <= 1) return; setHeaders((p: string[]) => { const n = [...p]; n.splice(ci, 1); return n; }); setAligns((q: string[]) => { const m = [...q]; m.splice(ci, 1); return m; }); setRows((r: string[][]) => r.map((x: string[]) => { const n = [...x]; n.splice(ci, 1); return n; })); }} title="Delete column"
                            className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                            style={{ backgroundColor: "var(--text-muted)", color: "white" }}>x</button>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((row: string[], ri: number) => (
                <tr key={ri}
                  onMouseEnter={() => setHoverRow(ri)} onMouseLeave={() => setHoverRow(-1)}
                  style={{ backgroundColor: ri % 2 === 0 ? "transparent" : "var(--bg-subtle)" }}>
                  <td className="!p-0 !border-0 relative" style={{ width: 32 }}>
                    {hoverRow === ri && (
                      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 z-20">
                        <button onClick={() => { setRows((prev: string[][]) => { const n = [...prev]; n.splice(ri, 0, Array(colCount).fill("")); return n; }); }} title="Add row above"
                          className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: "var(--accent)", color: "white" }}>+</button>
                        {rows.length > 1 && (
                          <button onClick={() => { if (rows.length <= 1) return; setRows((prev: string[][]) => { const n = [...prev]; n.splice(ri, 1); return n; }); }} title="Delete row"
                            className="w-4 h-4 rounded text-[10px] flex items-center justify-center shadow-sm"
                            style={{ backgroundColor: "var(--text-muted)", color: "white" }}>x</button>
                        )}
                      </div>
                    )}
                  </td>
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} className="px-3 py-2 border-b outline-none"
                      style={{ borderColor: "var(--border-light)", color: "var(--text)", textAlign: (aligns[ci] || "left") as "left" | "center" | "right" }}>
                      <input value={cell} onChange={(e: any) => { setRows((prev: string[][]) => { const n = prev.map((r: string[]) => [...r]); while (n[ri].length < colCount) n[ri].push(""); n[ri][ci] = e.target.value; return n; }); }} onBlur={syncToStore}
                        className="w-full bg-transparent outline-none" style={{ textAlign: (aligns[ci] || "left") as "left" | "center" | "right" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 border-t"
          style={{ borderColor: "var(--border-light)", backgroundColor: "var(--bg-subtle)" }}>
          <button onClick={() => { setRows((prev: string[][]) => [...prev, Array(colCount).fill("")]); }}
            className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
            style={{ color: "var(--text-muted)" }}>+ Row</button>
          <div className="flex items-center gap-2">
            <button onClick={() => { setHeaders((p: string[]) => [...p, ""]); setAligns((q: string[]) => [...q, "left"]); setRows((r: string[][]) => r.map((x: string[]) => [...x, ""])); }}
              className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
              style={{ color: "var(--text-muted)" }}>+ Column</button>
            <button onClick={onDelete}
              className="text-xs px-2 py-0.5 rounded hover:bg-[var(--bg-card)]"
              style={{ color: "var(--text-muted)" }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
};