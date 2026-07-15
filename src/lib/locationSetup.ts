export const LOCATION_TEMPLATE_KEY = "protocol150LocationTemplateV3";
const RETIRED_LOCATION_TEMPLATE_KEYS = ["protocol150LocationTemplate"];

export const BASE_LOCATIONS = [
  { ru: "Контрольная точка", en: "Checkpoint" },
  { ru: "Сектор «Альфа»", en: "Alpha Sector" },
  { ru: "Сектор «Браво»", en: "Bravo Sector" },
  { ru: "Сектор «Чарли»", en: "Charlie Sector" },
  { ru: "Сектор «Дельта»", en: "Delta Sector" },
  { ru: "Узел связи", en: "Communications Hub" },
  { ru: "Аналитический центр", en: "Analysis Center" },
  { ru: "Технический блок", en: "Technical Bay" },
  { ru: "Зона брифинга", en: "Briefing Zone" },
  { ru: "Наблюдательный пост", en: "Observation Post" },
] as const;

export const ACTIVITY_POINTS = [
  { id: 1, name: "meeting", label: "Точка собрания", labelEn: "Meeting point", group: "Основное", groupEn: "Core", tag: "meeting" },
  { id: 2, name: "simonsays", label: "Повтор последовательности", labelEn: "Sequence relay", group: "Задания", groupEn: "Tasks", tag: "task:simonsays" },
  { id: 3, name: "wiretap1", label: "Точка сигнала 1", labelEn: "Signal point 1", group: "Задания", groupEn: "Tasks", tag: "task:wiretap" },
  { id: 4, name: "wiretap2", label: "Точка сигнала 2", labelEn: "Signal point 2", group: "Задания", groupEn: "Tasks", tag: "task:wiretap" },
  { id: 5, name: "wiretap3", label: "Точка сигнала 3", labelEn: "Signal point 3", group: "Задания", groupEn: "Tasks", tag: "task:wiretap" },
  { id: 6, name: "passwordcrack", label: "Взлом пароля", labelEn: "Password crack", group: "Задания", groupEn: "Tasks", tag: "task:passwordcrack" },
  { id: 7, name: "bitcoinmine", label: "Хеш-реактор", labelEn: "Hash reactor", group: "Задания", groupEn: "Tasks", tag: "task:bitcoinmine" },
  { id: 8, name: "killthevirus", label: "Уничтожение вирусов", labelEn: "Virus cleanup", group: "Задания", groupEn: "Tasks", tag: "task:killthevirus" },
  { id: 9, name: "firewallbutton1", label: "Терминал защиты 1", labelEn: "Firewall terminal 1", group: "Защита", groupEn: "Defense", tag: "firewall:0" },
  { id: 10, name: "firewallbutton2", label: "Терминал защиты 2", labelEn: "Firewall terminal 2", group: "Защита", groupEn: "Defense", tag: "firewall:1" },
  { id: 11, name: "sumtohundred", label: "Сумма до ста", labelEn: "Sum to one hundred", group: "Задания", groupEn: "Tasks", tag: "task:sumtohundred" },
  { id: 12, name: "destroyevidence", label: "Уничтожение улик", labelEn: "Evidence disposal", group: "Задания", groupEn: "Tasks", tag: "task:destroyevidence" },
  { id: 13, name: "packetrouting", label: "Маршрутизация пакетов", labelEn: "Packet routing", group: "Задания", groupEn: "Tasks", tag: "task:packetrouting" },
  { id: 14, name: "accesslog", label: "Анализ журнала", labelEn: "Access log analysis", group: "Задания", groupEn: "Tasks", tag: "task:accesslog" },
  { id: 15, name: "powergrid", label: "Энергосеть", labelEn: "Power grid", group: "Задания", groupEn: "Tasks", tag: "task:powergrid" },
] as const;

export type ActivityPointName = (typeof ACTIVITY_POINTS)[number]["name"];

export type PhysicalLocation = { id: string; name: string };

export type LocationTemplate = {
  version: 2;
  name: string;
  locations: PhysicalLocation[];
  assignments: Record<ActivityPointName, string>;
  rooms: Record<ActivityPointName, string>;
  savedAt: string;
};

export function makeBaseLocations(language: "ru" | "en" = "ru"): PhysicalLocation[] {
  return BASE_LOCATIONS.map((name, index) => ({
    id: `location-${index + 1}`,
    name: name[language],
  }));
}

export function makeDefaultAssignments(locations: PhysicalLocation[]) {
  return Object.fromEntries(
    ACTIVITY_POINTS.map((point, index) => [
      point.name,
      locations[index % Math.max(1, locations.length)]?.id || "",
    ])
  ) as Record<ActivityPointName, string>;
}

export function readLocationTemplate(): LocationTemplate | null {
  if (typeof localStorage === "undefined") return null;
  try {
    // Retire previously saved venue examples so private room names cannot
    // reappear after the public template changes.
    RETIRED_LOCATION_TEMPLATE_KEYS.forEach((key) => localStorage.removeItem(key));
    const value = JSON.parse(localStorage.getItem(LOCATION_TEMPLATE_KEY) || "null");
    if (value?.version === 2 && Array.isArray(value.locations)) {
      return value as LocationTemplate;
    }

    // Migrate templates created by the earlier fixed 12-field setup.
    if (value?.version === 1 && typeof value.rooms === "object") {
      const names = [...new Set(Object.values(value.rooms).filter((room) => typeof room === "string"))] as string[];
      const locations = names.map((name, index) => ({ id: `location-${index + 1}`, name }));
      const assignments = Object.fromEntries(
        ACTIVITY_POINTS.map((point) => [
          point.name,
          locations.find((location) => location.name === value.rooms[point.name])?.id || "",
        ])
      ) as Record<ActivityPointName, string>;
      return { ...value, version: 2, locations, assignments } as LocationTemplate;
    }

    return null;
  } catch {
    return null;
  }
}

export function saveLocationTemplate(
  name: string,
  locations: PhysicalLocation[],
  assignments: Record<ActivityPointName, string>
) {
  RETIRED_LOCATION_TEMPLATE_KEYS.forEach((key) => localStorage.removeItem(key));
  const rooms = Object.fromEntries(
    ACTIVITY_POINTS.map((point) => [
      point.name,
      locations.find((location) => location.id === assignments[point.name])?.name || "",
    ])
  ) as Record<ActivityPointName, string>;
  const template: LocationTemplate = {
    version: 2,
    name: name.trim() || "Protocol 150 Venue",
    locations,
    assignments,
    rooms,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(LOCATION_TEMPLATE_KEY, JSON.stringify(template));
  return template;
}
