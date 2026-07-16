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
