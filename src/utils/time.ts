// time.ts
export function toLocalDateTimeString(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const pad = (n: number) => n.toString().padStart(2, "0");

  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getLocalDateTimeString(): string {
  return toLocalDateTimeString(new Date());
}
