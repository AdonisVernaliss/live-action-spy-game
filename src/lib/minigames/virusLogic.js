export const VIRUS_WAVES = Object.freeze([
  Object.freeze({ number: 1, startsAt: 0, maxActive: 1, minDelay: 1200, delayJitter: 350 }),
  Object.freeze({ number: 2, startsAt: 4, maxActive: 2, minDelay: 950, delayJitter: 300 }),
  Object.freeze({ number: 3, startsAt: 9, maxActive: 3, minDelay: 740, delayJitter: 260 }),
  Object.freeze({ number: 4, startsAt: 15, maxActive: 4, minDelay: 560, delayJitter: 220 }),
]);

/**
 * Returns the gradual difficulty profile for the current cleanup score.
 * The opening wave intentionally contains one slow threat at a time.
 *
 * @param {number} score
 */
export function getVirusWave(score) {
  return [...VIRUS_WAVES]
    .reverse()
    .find((wave) => score >= wave.startsAt) || VIRUS_WAVES[0];
}

/**
 * @param {number} score
 * @param {() => number} [random]
 */
export function getVirusSpawnDelay(score, random = Math.random) {
  const wave = getVirusWave(score);
  return wave.minDelay + random() * wave.delayJitter;
}

/**
 * @param {number} score
 * @param {() => number} [random]
 * @returns {"normal" | "fast" | "armored" | "stealth"}
 */
export function pickVirusKind(score, random = Math.random) {
  const wave = getVirusWave(score).number;
  const roll = random();
  if (wave === 1) return "normal";
  if (wave === 2) {
    if (roll >= 0.78) return "armored";
    if (roll < 0.25) return "fast";
    return "normal";
  }
  if (roll < (wave === 4 ? 0.22 : 0.16)) return "stealth";
  if (roll < (wave === 4 ? 0.5 : 0.43)) return "fast";
  if (roll >= (wave === 4 ? 0.72 : 0.76)) return "armored";
  return "normal";
}

/**
 * Selects unique safe cells that can imitate an alert without becoming threats.
 *
 * @param {number} cellCount
 * @param {Iterable<number>} occupiedCells
 * @param {number} requestedCount
 * @param {() => number} [random]
 * @returns {number[]}
 */
export function pickVirusDecoyCells(
  cellCount,
  occupiedCells,
  requestedCount,
  random = Math.random
) {
  const occupied = new Set(occupiedCells);
  const available = Array.from({ length: cellCount }, (_, cell) => cell).filter(
    (cell) => !occupied.has(cell)
  );
  const result = [];

  while (result.length < requestedCount && available.length > 0) {
    const index = Math.min(
      available.length - 1,
      Math.floor(random() * available.length)
    );
    const [cell] = available.splice(index, 1);
    result.push(cell);
  }

  return result;
}
