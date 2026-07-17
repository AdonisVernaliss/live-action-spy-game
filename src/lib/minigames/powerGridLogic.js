export const POWER_GRID_PHASES = Object.freeze([
  Object.freeze({ demands: Object.freeze([18, 24, 16, 20]), target: Object.freeze([84, 88]) }),
  Object.freeze({ demands: Object.freeze([24, 16, 22, 18]), target: Object.freeze([88, 92]) }),
  Object.freeze({ demands: Object.freeze([20, 25, 18, 22]), target: Object.freeze([93, 97]) }),
  Object.freeze({ demands: Object.freeze([23, 19, 24, 17]), target: Object.freeze([91, 95]) }),
]);

export const POWER_GRID_MAX_EXCESS = 4;
export const POWER_GRID_MAX_CIRCUIT_DELTA = 3;

/**
 * @param {number[]} allocation
 * @param {{ demands: readonly number[], target: readonly number[] }} phase
 */
export function getPowerGridState(allocation, phase) {
  const values = allocation.map(Number);
  const total = values.reduce((sum, value) => sum + value, 0);
  const sectorsOk = values.map(
    (value, index) =>
      value >= phase.demands[index] &&
      value <= phase.demands[index] + POWER_GRID_MAX_EXCESS
  );
  const circuitA = values[0] + values[1];
  const circuitB = values[2] + values[3];
  const circuitDelta = Math.abs(circuitA - circuitB);
  const loadOk = total >= phase.target[0] && total <= phase.target[1];
  const circuitsOk = circuitDelta <= POWER_GRID_MAX_CIRCUIT_DELTA;

  return {
    total,
    sectorsOk,
    circuitA,
    circuitB,
    circuitDelta,
    loadOk,
    circuitsOk,
    stable: total <= 100 && loadOk && circuitsOk && sectorsOk.every(Boolean),
  };
}
