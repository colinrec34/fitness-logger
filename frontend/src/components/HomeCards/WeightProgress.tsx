import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import Card from "../Card"

const api = import.meta.env.VITE_API_URL || "http://localhost:8000";
console.log("Using API URL:", api)

type WeightEntry = {
  id: number
  date: string
  weight: number
}

export default function WeightProgress() {
  const [logs, setLogs] = useState<WeightEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${api}/logs/weight`)
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error("Failed to fetch weight logs:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  if (loading) {
    return (
      <Card title="⚖️ Body Weight">
        <p className="text-gray-400 italic">Loading...</p>
      </Card>
    )
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    return (
      <Card title="⚖️ Body Weight">
        <p className="text-gray-400 italic">No data available.</p>
      </Card>
    )
  }

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const latestDate = latest?.date
  const relativeDate = latestDate
    ? formatDistanceToNow(new Date(latestDate), { addSuffix: true })
    : ""

  return (
    <Card
      title={`⚖️ Body Weight: ${latest?.weight} lbs`}
      subtitle={
        <span className="text-gray-400">
          {latestDate} · {relativeDate}
        </span>
      }
    >
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sorted} margin={{ top: 10, right: 20, bottom: 5, left: -24 }}>
            <XAxis dataKey="date" fontSize={12} tickMargin={6} />
            <YAxis domain={[150, "auto"]} fontSize={12} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload && payload.length ? (
                  <div className="bg-slate-600 p-3 rounded text-sm text-white shadow">
                    <p className="font-semibold">Date: {label}</p>
                    <p>Weight: {payload[0].value} lbs</p>
                  </div>
                ) : null
              }
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
