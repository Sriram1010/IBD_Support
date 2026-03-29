export function useDateString(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeFromDate(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function mlToGallons(ml: number): string {
  return (ml / 3785.41).toFixed(3);
}

export function parseWaterInput(text: string): number | null {
  const lower = text.toLowerCase().trim();

  const mlMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliters?|mls)/);
  if (mlMatch) return parseFloat(mlMatch[1]);

  const lMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:liters?|litres?|l\b)/);
  if (lMatch) return parseFloat(lMatch[1]) * 1000;

  const cupMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:cups?)/);
  if (cupMatch) return parseFloat(cupMatch[1]) * 236.588;

  const ozMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:oz|ounces?|fl oz|fluid ounces?)/);
  if (ozMatch) return parseFloat(ozMatch[1]) * 29.5735;

  const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };

  for (const [word, num] of Object.entries(numberWords)) {
    if (lower.includes(word + " cup")) return num * 236.588;
    if (lower.includes(word + " ml")) return num;
  }

  const numOnly = lower.match(/^(\d+(?:\.\d+)?)$/);
  if (numOnly) return parseFloat(numOnly[1]);

  return null;
}

export function calcSleepHours(bedtime: string, wakeTime: string): string {
  if (!bedtime || !wakeTime) return "–";
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let bedMinutes = bh * 60 + bm;
  let wakeMinutes = wh * 60 + wm;
  if (wakeMinutes <= bedMinutes) wakeMinutes += 24 * 60;
  const diff = wakeMinutes - bedMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
