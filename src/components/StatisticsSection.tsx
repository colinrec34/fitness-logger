import TimeRangeFilter, {
  filterLogsByRange,
  type TimeRange,
} from "./TimeRangeFilter";

type StatItem = { label: string; value: string | number };

type Props<T> = {
  logs: T[];
  getDate: (log: T) => string;
  computeStats: (filteredLogs: T[]) => StatItem[];
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
};

export default function StatisticsSection<T>({
  logs,
  getDate,
  computeStats,
  range,
  onRangeChange,
}: Props<T>) {
  if (logs.length === 0) return null;

  const filtered = filterLogsByRange(logs, range, getDate);
  const stats = computeStats(filtered);

  return (
    <div className="bg-slate-800 p-6 rounded-xl shadow-md">
      <TimeRangeFilter selected={range} onChange={onRangeChange} />
      <ul className="space-y-1 mt-3">
        {stats.map((item) => (
          <li key={item.label}>
            {item.label}: <span className="font-semibold">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
