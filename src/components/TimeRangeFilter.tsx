import { subDays, subMonths, subYears, startOfYear } from "date-fns";

const RANGES = ["1d", "5d", "1m", "6m", "YTD", "1y", "5y", "Max"] as const;
export type TimeRange = (typeof RANGES)[number];

type Props = {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
};

export default function TimeRangeFilter({ selected, onChange }: Props) {
  return (
    <div className="flex">
      {RANGES.map((range, i) => {
        const isActive = range === selected;
        const rounded =
          i === 0
            ? "rounded-l"
            : i === RANGES.length - 1
              ? "rounded-r"
              : "";
        return (
          <button
            key={range}
            onClick={() => onChange(range)}
            className={`px-3 py-1 text-xs font-medium ${rounded} ${
              isActive
                ? "bg-blue-600 text-white"
                : "bg-slate-700 text-gray-300 hover:bg-slate-600"
            }`}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}

export function filterLogsByRange<T>(
  logs: T[],
  range: TimeRange,
  getDate: (log: T) => string
): T[] {
  if (range === "Max") return logs;

  const now = new Date();
  let cutoff: Date;

  switch (range) {
    case "1d":
      cutoff = subDays(now, 1);
      break;
    case "5d":
      cutoff = subDays(now, 5);
      break;
    case "1m":
      cutoff = subMonths(now, 1);
      break;
    case "6m":
      cutoff = subMonths(now, 6);
      break;
    case "YTD":
      cutoff = startOfYear(now);
      break;
    case "1y":
      cutoff = subYears(now, 1);
      break;
    case "5y":
      cutoff = subYears(now, 5);
      break;
  }

  return logs.filter((log) => new Date(getDate(log)) >= cutoff);
}
