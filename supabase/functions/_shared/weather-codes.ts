// WMO weather code → Nederlandse label + Lucide-icoonnaam
// Bron: https://open-meteo.com/en/docs (WMO Weather interpretation codes)

export type WeatherInterp = {
  label_nl: string;
  icon: string; // lucide-react icon name
};

export function interpretWeatherCode(code: number | null | undefined): WeatherInterp {
  if (code === null || code === undefined) return { label_nl: "Onbekend", icon: "CloudOff" };
  if (code === 0) return { label_nl: "Helder", icon: "Sun" };
  if (code === 1) return { label_nl: "Vooral helder", icon: "Sun" };
  if (code === 2) return { label_nl: "Half bewolkt", icon: "CloudSun" };
  if (code === 3) return { label_nl: "Bewolkt", icon: "Cloud" };
  if (code === 45 || code === 48) return { label_nl: "Mist", icon: "CloudFog" };
  if (code >= 51 && code <= 57) return { label_nl: "Motregen", icon: "CloudDrizzle" };
  if (code >= 61 && code <= 67) return { label_nl: "Regen", icon: "CloudRain" };
  if (code >= 71 && code <= 77) return { label_nl: "Sneeuw", icon: "CloudSnow" };
  if (code >= 80 && code <= 82) return { label_nl: "Buien", icon: "CloudRain" };
  if (code >= 85 && code <= 86) return { label_nl: "Sneeuwbuien", icon: "CloudSnow" };
  if (code >= 95) return { label_nl: "Onweer", icon: "CloudLightning" };
  return { label_nl: "Wisselend", icon: "Cloud" };
}
