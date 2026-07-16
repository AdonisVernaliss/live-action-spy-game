import assert from "node:assert/strict";
import test from "node:test";
import { pickVirusDecoyCells } from "../src/lib/minigames/virusLogic.js";

test("glowing file decoys are unique and never replace active viruses", () => {
  const occupied = new Set([1, 4, 8]);
  const decoys = pickVirusDecoyCells(12, occupied, 4, () => 0.99);

  assert.equal(decoys.length, 4);
  assert.equal(new Set(decoys).size, decoys.length);
  assert.ok(decoys.every((cell) => !occupied.has(cell)));
});

test("glowing file decoys are capped by the number of safe cells", () => {
  assert.deepEqual(
    pickVirusDecoyCells(4, new Set([0, 1, 2]), 3, () => 0),
    [3]
  );
});
