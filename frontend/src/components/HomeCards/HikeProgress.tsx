import { useEffect, useState } from "react"
import { MapContainer, TileLayer, Polyline, Tooltip, useMap } from "react-leaflet"
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet"
import { formatDistanceToNow } from "date-fns"
import Card from "../Card"

type HikeApiResponse = {
  id: number
  date: string
  name: string
  distance_miles: number
  elevation_gain_ft: number
  duration_minutes?: number
  notes?: string
  route_json: string
}

type HikeLog = {
  id: number
  date: string
  name: string
  mileage: number
  elevation_gain_ft: number
  duration_minutes?: number
  notes?: string
  route: [number, number][]
}

function formatDuration(durationMinutes: number): string {
  const totalSeconds = Math.round(durationMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
}

function formatPace(durationMinutes?: number, mileage?: number): string {
  if (!durationMinutes || !mileage || mileage === 0) return "Pace N/A"
  const totalSecondsPerMile = (durationMinutes / mileage) * 60
  const minutes = Math.floor(totalSecondsPerMile / 60)
  const seconds = Math.round(totalSecondsPerMile % 60)
  return `${minutes}:${seconds.toString().padStart(2, "0")} / mi`
}

function FitBounds({ route }: { route: LatLngExpression[] }) {
  const map = useMap()
  useEffect(() => {
    if (route.length > 1) {
      map.fitBounds(route as LatLngBoundsExpression, { padding: [20, 20] })
    }
  }, [route, map])
  return null
}

export default function HikeProgress() {
  const [logs, setLogs] = useState<HikeLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("http://localhost:8000/logs/hikes")
        const data: HikeApiResponse[] = await res.json()
        const parsed = data.map((hike) => ({
          ...hike,
          mileage: hike.distance_miles,
          route: hike.route_json ? JSON.parse(hike.route_json) : [],
        }))
        setLogs(parsed)
      } catch (err) {
        console.error("Failed to fetch hike logs:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  if (loading) {
    return (
      <Card title="🥾 Latest Hike">
        <p className="text-gray-400 italic">Loading...</p>
      </Card>
    )
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    return (
      <Card title="🥾 Latest Hike">
        <p className="text-gray-400 italic">No hikes recorded yet.</p>
      </Card>
    )
  }

  const latest = [...logs].sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <Card
      title={`🥾 ${latest.name}`}
      subtitle={
        <span className="text-gray-400">
          {latest.date} · {formatDistanceToNow(new Date(latest.date), { addSuffix: true })}
        </span>
      }
    >
      <div className="h-[300px] rounded-lg overflow-hidden mb-4">
        {latest.route?.length > 1 ? (
          <MapContainer
            center={latest.route[0] as LatLngExpression}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={latest.route} color="#1e293b" weight={8} />
            <Polyline positions={latest.route} color="#32CD32" weight={4}>
              <Tooltip sticky>{latest.name}</Tooltip>
            </Polyline>
            <FitBounds route={latest.route} />
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 italic bg-slate-700">
            Route data not available
          </div>
        )}
      </div>

      <div className="text-sm text-gray-200 space-y-1">
        <p><strong>Distance:</strong> {latest.mileage.toFixed(2)} mi</p>
        <p><strong>Elevation Gain:</strong> {latest.elevation_gain_ft.toFixed(0)} ft</p>
        <p>
          <strong>Duration:</strong>{" "}
          {latest.duration_minutes != null ? formatDuration(latest.duration_minutes) : "Time N/A"}
        </p>
        <p><strong>Pace:</strong> {formatPace(latest.duration_minutes, latest.mileage)}</p>
        {latest.notes && (
          <p className="mt-2 italic text-gray-400 whitespace-pre-line">"{latest.notes}"</p>
        )}
      </div>
    </Card>
  )
}
