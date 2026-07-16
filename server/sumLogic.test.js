import assert from "node:assert/strict";
import test from "node:test";
import { SUM_ROUND_PATTERN } from "../src/lib/minigames/sumLogic.js";

test("sum to one hundred stops after pairs and triples", () => {
  assert.deepEqual(SUM_ROUND_PATTERN, [2, 2, 3, 3, 3]);
  assert.equal(SUM_ROUND_PATTERN.includes(4), false);
});
