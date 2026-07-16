import {
  BASE_LOCATIONS as SHARED_BASE_LOCATIONS,
  NFC_ACTIVITY_TAGS,
  localizeLocationName as localizeSharedLocationName,
} from "$lib/consts";

export const LOCATION_TEMPLATE_KEY = "protocol150LocationTemplateV3";
const RETIRED_LOCATION_TEMPLATE_KEYS = ["protocol150LocationTemplate"];

export const BASE_LOCATIONS = SHARED_BASE_LOCATIONS;

export function localizeLocationName(name: string, language: "ru" | "en") {
  return localizeSharedLocationName(name, language) as string;
}

export function localizeVenueName(name: string, language: "ru" | "en") {
  if (name === "Основная площадка" || name === "Primary venue") {
    return language === "en" ? "Primary venue" : "Основная площадка";
  }
  const generatedRu = name.match(/^Площадка (.+)$/);
  if (generatedRu) return language === "en" ? `Venue ${generatedRu[1]}` : name;
  const generatedEn = name.match(/^Venue (.+)$/);
  if (generatedEn) return language === "ru" ? `Площадка ${generatedEn[1]}` : name;
  return name;
}

export const ACTIVITY_POINTS = [
  { id: 1, name: "meeting", label: "Точка собрания", labelEn: "Meeting point", group: "Основное", groupEn: "Core", tag: NFC_ACTIVITY_TAGS.meeting },
  { id: 2, name: "simonsays", label: "Повтор последовательности", labelEn: "Sequence relay", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.simonsays },
  { id: 3, name: "wiretap1", label: "Точка сигнала 1", labelEn: "Signal point 1", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.wiretap1 },
  { id: 4, name: "wiretap2", label: "Точка сигнала 2", labelEn: "Signal point 2", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.wiretap2 },
  { id: 5, name: "wiretap3", label: "Точка сигнала 3", labelEn: "Signal point 3", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.wiretap3 },
  { id: 6, name: "passwordcrack", label: "Взлом пароля", labelEn: "Password crack", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.passwordcrack },
  { id: 7, name: "bitcoinmine", label: "Хеш-реактор", labelEn: "Hash reactor", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.bitcoinmine },
  { id: 8, name: "killthevirus", label: "Уничтожение вирусов", labelEn: "Virus cleanup", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.killthevirus },
  { id: 9, name: "firewallbutton1", label: "Терминал защиты 1", labelEn: "Firewall terminal 1", group: "Защита", groupEn: "Defense", tag: NFC_ACTIVITY_TAGS.firewallbutton1 },
  { id: 10, name: "firewallbutton2", label: "Терминал защиты 2", labelEn: "Firewall terminal 2", group: "Защита", groupEn: "Defense", tag: NFC_ACTIVITY_TAGS.firewallbutton2 },
  { id: 11, name: "sumtohundred", label: "Сумма до ста", labelEn: "Sum to one hundred", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.sumtohundred },
  { id: 12, name: "destroyevidence", label: "Уничтожение улик", labelEn: "Evidence disposal", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.destroyevidence },
  { id: 13, name: "packetrouting", label: "Маршрутизация пакетов", labelEn: "Packet routing", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.packetrouting },
  { id: 14, name: "accesslog", label: "Анализ журнала", labelEn: "Access log analysis", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.accesslog },
  { id: 15, name: "powergrid", label: "Энергосеть", labelEn: "Power grid", group: "Задания", groupEn: "Tasks", tag: NFC_ACTIVITY_TAGS.powergrid },
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

export function validateLocationTemplate(value: unknown): LocationTemplate | null {
  if (value == null || typeof value !== "object") return null;
  const candidate = value as Partial<LocationTemplate>;
  if (
    candidate.version !== 2 ||
    typeof candidate.name !== "string" ||
    candidate.name.trim().length < 1 ||
    candidate.name.trim().length > 80 ||
    !Array.isArray(candidate.locations) ||
    candidate.locations.length < 1 ||
    candidate.locations.length > 100 ||
    candidate.assignments == null ||
    typeof candidate.assignments !== "object"
  ) {
    return null;
  }

  const locations: PhysicalLocation[] = [];
  const locationIds = new Set<string>();
  for (const rawLocation of candidate.locations) {
    const id = typeof rawLocation?.id === "string" ? rawLocation.id.trim() : "";
    const name = typeof rawLocation?.name === "string" ? rawLocation.name.trim() : "";
    if (!id || id.length > 100 || !name || name.length > 80 || locationIds.has(id)) {
      return null;
    }
    locationIds.add(id);
    locations.push({ id, name });
  }

  const assignments = {} as Record<ActivityPointName, string>;
  const rooms = {} as Record<ActivityPointName, string>;
  for (const point of ACTIVITY_POINTS) {
    const locationId = candidate.assignments[point.name];
    if (typeof locationId !== "string" || !locationIds.has(locationId)) return null;
    const room = locations.find((location) => location.id === locationId)?.name;
    if (!room) return null;
    assignments[point.name] = locationId;
    rooms[point.name] = room;
  }

  const savedAt =
    typeof candidate.savedAt === "string" && !Number.isNaN(Date.parse(candidate.savedAt))
      ? candidate.savedAt
      : new Date().toISOString();

  return {
    version: 2,
    name: candidate.name.trim(),
    locations,
    assignments,
    rooms,
    savedAt,
  };
}

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
    if (value?.version === 2) return validateLocationTemplate(value);

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
      return validateLocationTemplate({ ...value, version: 2, locations, assignments });
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

export function storeLocationTemplate(template: LocationTemplate) {
  const validated = validateLocationTemplate(template);
  if (validated == null) return null;
  RETIRED_LOCATION_TEMPLATE_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(LOCATION_TEMPLATE_KEY, JSON.stringify(validated));
  return validated;
}

export function parseLocationTemplate(contents: string) {
  try {
    return validateLocationTemplate(JSON.parse(contents));
  } catch {
    return null;
  }
}
