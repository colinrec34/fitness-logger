import { useState, useEffect } from "react"
import WeightProgress from "./WeightProgress"

const api = import.meta.env.VITE_API_URL || "http://localhost:8000"

type WeightEntry = {
  id: number
  date: string
  weight: number
}

export default function Weight() {
  // Default datetime-local string for now, trimmed to "YYYY-MM-DDTHH:mm"
  const [date, setDate] = useState(() => {
    const now = new Date()
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    return localISO
  })

  const [weight, setWeight] = useState<number | "">("")
  const [logs, setLogs] = useState<WeightEntry[]>([])

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`${api}/logs/weight`)
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error("❌ Error fetching weight logs:", err)
      }
    }
    fetchLogs()
  }, [])

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === "") {
      setWeight("")
    } else {
      const num = parseFloat(value)
      if (!isNaN(num)) setWeight(num)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (weight === "") {
      alert("Please enter a weight.")
      return
    }

    const payload = { date, weight }

    try {
      const res = await fetch(`${api}/logs/weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to save weight log")

      alert("✅ Weight logged successfully!")
      setWeight("")
      // Reset date to now after successful submit
      const now = new Date()
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setDate(localISO)
    } catch (err) {
      console.error("❌ Error logging weight:", err)
      alert("Error saving weight.")
    }
  }

  return (
    <div className="flex justify-center px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* LEFT: Logging Form */}
        <div className="max-w-md w-full">
          <h1 className="text-3xl font-bold mb-6">Log Weight</h1>
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <div>
              <label className="block mb-1 font-medium">Date & Time</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1 font-medium">Weight (lbs)</label>
              <input
                type="number"
                value={weight}
                onChange={handleWeightChange}
                className="w-full border px-3 py-2 rounded"
                step="0.1"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
            >
              Save
            </button>
          </form>
        </div>

        {/* RIGHT: Progress Chart */}
        <div className="w-full">
          <h2 className="text-xl font-semibold text-white mb-4">Weight Progress</h2>
          {logs.length > 0 ? (
            <WeightProgress />
          ) : (
            <p className="text-gray-400 italic">No weight data yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
