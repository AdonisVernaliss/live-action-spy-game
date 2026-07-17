import assert from "node:assert/strict";
import test from "node:test";
import {
  getVirusSpawnDelay,
  getVirusWave,
  pickVirusDecoyCells,
  pickVirusKind,
} from "../src/lib/minigames/virusLogic.js";

test("virus cleanup starts slowly and ramps through four visible waves", () => {
  assert.deepEqual(
    [0, 4, 9, 15].map((score) => getVirusWave(score).number),
    [1, 2, 3, 4]
  );
  assert.equal(getVirusWave(0).maxActive, 1);
  assert.equal(getVirusWave(15).maxActive, 4);
  assert.equal(getVirusSpawnDelay(0, () => 0), 1200);
  assert.equal(getVirusSpawnDelay(15, () => 0), 560);
});

test("advanced virus types are introduced only after the training wave", () => {
  assert.equal(pickVirusKind(0, () => 0.99), "normal");
  assert.equal(pickVirusKind(4, () => 0.99), "armored");
  assert.equal(pickVirusKind(4, () => 0.1), "fast");
  assert.equal(pickVirusKind(15, () => 0.1), "stealth");
});

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
