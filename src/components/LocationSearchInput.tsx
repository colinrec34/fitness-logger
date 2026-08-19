import { useEffect, useRef, useState } from "react";
import { searchPlaces, type GeocodeResult } from "../lib/geocode";

interface Props {
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
}

export default function LocationSearchInput({ onSelect, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      searchPlaces(query, controller.signal)
        .then((found) => {
          setResults(found);
          setOpen(true);
        })
        .catch((err) => {
          if (err instanceof Error && err.name !== "AbortError") {
            setError("Search failed. Try again.");
          }
        })
        .finally(() => setLoading(false));
    }, 500); // debounce keystrokes; also keeps us well under Nominatim's fair-use rate
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <input
        className="w-full p-2 rounded bg-slate-700 text-white"
        placeholder={placeholder ?? "Search for a place..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && <div className="text-xs text-gray-400 mt-1">Searching...</div>}
      {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-slate-700 rounded shadow-lg max-h-56 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-slate-600 text-sm text-white"
                onClick={() => {
                  onSelect(r);
                  setQuery(r.shortName);
                  setOpen(false);
                }}
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
