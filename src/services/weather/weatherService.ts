import { getDatabase } from "@/data/database";

export interface WeatherSnapshot { city: string; temperature: number; weatherCode: number; fetchedAt: number; source: "network" | "cache"; }
export interface WeatherCity { name: string; latitude: number; longitude: number; }

const DEFAULT_CITY: WeatherCity = { name: "北京", latitude: 39.9042, longitude: 116.4074 };
const CACHE_KEY = "weather:last";

export async function fetchWeather(city: WeatherCity = DEFAULT_CITY): Promise<WeatherSnapshot> {
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`);
    if (!response.ok) throw new Error(`weather http ${response.status}`);
    const body = await response.json() as { current?: { temperature_2m?: number; weather_code?: number } };
    const snapshot: WeatherSnapshot = { city: city.name, temperature: body.current?.temperature_2m ?? 0, weatherCode: body.current?.weather_code ?? -1, fetchedAt: Date.now(), source: "network" };
    const database = await getDatabase(); await database.runAsync("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)", CACHE_KEY, JSON.stringify(snapshot), Date.now());
    return snapshot;
  } catch {
    const database = await getDatabase(); const row = await database.getFirstAsync<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", CACHE_KEY);
    if (row) return { ...(JSON.parse(row.value) as WeatherSnapshot), source: "cache" };
    return { city: city.name, temperature: 0, weatherCode: -1, fetchedAt: 0, source: "cache" };
  }
}

export const weatherDescription = (code: number) => code === 0 ? "晴" : code <= 3 ? "多云" : code <= 67 ? "有雨" : code <= 77 ? "有雪" : code <= 99 ? "雷雨" : "暂无天气";
