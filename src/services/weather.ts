import { WeatherCategory, WeatherData, WindLevel } from '../types';

export const DEFAULT_WEATHER: WeatherData = {
  cat: 'clear',
  label: 'Clear sky',
  icon: 'fa-sun',
  temp: 26,
  wind: 8,
  cloud: 15,
  isDay: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  loaded: false,
};

export const MANUAL_WX: Record<WeatherCategory, { label: string; icon: string; cloud: number }> = {
  clear: { label: 'Clear', icon: 'fa-sun', cloud: 10 },
  cloudy: { label: 'Cloudy', icon: 'fa-cloud', cloud: 75 },
  fog: { label: 'Fog', icon: 'fa-smog', cloud: 50 },
  rain: { label: 'Rain', icon: 'fa-cloud-showers-heavy', cloud: 90 },
  storm: { label: 'Thunderstorm', icon: 'fa-cloud-bolt', cloud: 95 },
  snow: { label: 'Snow', icon: 'fa-snowflake', cloud: 80 },
};

export const WIND_LEVELS: WindLevel[] = [
  { id: 'calm', name: 'Calm', speed: 0, icon: 'fa-feather' },
  { id: 'light', name: 'Light', speed: 8, icon: 'fa-leaf' },
  { id: 'breezy', name: 'Breezy', speed: 20, icon: 'fa-wind' },
  { id: 'windy', name: 'Windy', speed: 35, icon: 'fa-flag' },
  { id: 'gale', name: 'Gale', speed: 55, icon: 'fa-tornado' },
];

export function getWindIcon(speed: number): string {
  if (speed < 5) return 'fa-feather';
  if (speed < 15) return 'fa-leaf';
  if (speed < 28) return 'fa-wind';
  if (speed < 45) return 'fa-flag';
  return 'fa-tornado';
}

export function parseWeatherCode(
  code: number,
  isDay: boolean
): { cat: WeatherCategory; label: string; icon: string } {
  if (code === 0) return { cat: 'clear', label: 'Clear sky', icon: isDay ? 'fa-sun' : 'fa-moon' };
  if (code === 1) return { cat: 'clear', label: 'Mostly clear', icon: isDay ? 'fa-cloud-sun' : 'fa-cloud-moon' };
  if (code === 2) return { cat: 'cloudy', label: 'Partly cloudy', icon: isDay ? 'fa-cloud-sun' : 'fa-cloud-moon' };
  if (code === 3) return { cat: 'cloudy', label: 'Overcast', icon: 'fa-cloud' };
  if (code === 45 || code === 48) return { cat: 'fog', label: 'Foggy', icon: 'fa-smog' };
  if (code >= 51 && code <= 57) return { cat: 'rain', label: 'Drizzle', icon: 'fa-cloud-rain' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return {
      cat: 'rain',
      label: code === 65 || code === 81 || code === 82 ? 'Heavy rain' : 'Rain',
      icon: 'fa-cloud-showers-heavy',
    };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { cat: 'snow', label: 'Snow', icon: 'fa-snowflake' };
  }
  if (code >= 95) return { cat: 'storm', label: 'Thunderstorm', icon: 'fa-cloud-bolt' };
  return { cat: 'cloudy', label: 'Cloudy', icon: 'fa-cloud' };
}

export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day,cloud_cover&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch weather');
  const json = await res.json();
  const c = json.current;
  const parsed = parseWeatherCode(c.weather_code, !!c.is_day);
  const timezone = json.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  return {
    ...parsed,
    temp: Math.round(c.temperature_2m),
    wind: Math.round(c.wind_speed_10m),
    cloud: c.cloud_cover ?? 20,
    isDay: !!c.is_day,
    timezone,
    loaded: true,
  };
}
