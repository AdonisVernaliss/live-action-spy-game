import assert from "node:assert/strict";
import test from "node:test";
import {
  POWER_GRID_PHASES,
  getPowerGridState,
} from "../src/lib/minigames/powerGridLogic.js";

test("power grid requires four distinct stabilization phases", () => {
  assert.equal(POWER_GRID_PHASES.length, 4);
  assert.deepEqual(POWER_GRID_PHASES.map((phase) => phase.target), [
    [84, 88],
    [88, 92],
    [93, 97],
    [91, 95],
  ]);
});

test("power grid rejects excess allocation and circuit imbalance", () => {
  const phase = POWER_GRID_PHASES[0];
  assert.equal(getPowerGridState([18, 24, 20, 22], phase).stable, true);
  assert.equal(getPowerGridState([26, 20, 20, 20], phase).stable, false);
  assert.equal(getPowerGridState([22, 24, 16, 20], phase).circuitsOk, false);
  assert.equal(getPowerGridState([18, 24, 16, 20], phase).loadOk, false);
});
