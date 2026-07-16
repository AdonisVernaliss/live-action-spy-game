import assert from "node:assert/strict";
import test from "node:test";
import {
  WIRETAP_HOLD_SECONDS,
  WIRETAP_ROUNDS,
  driftWiretapTarget,
  getWiretapStation,
  isWiretapJammed,
  isWiretapLocked,
  isWiretapTargetVisible,
  shouldDriftWiretapTarget,
  wiretapSignalQuality,
} from "../src/lib/minigames/wiretapLogic.js";

test("wiretap uses three six-second interception rounds", () => {
  assert.equal(WIRETAP_ROUNDS, 3);
  assert.equal(WIRETAP_HOLD_SECONDS, 6);
});

test("wiretap station is derived only from known physical tags", () => {
  assert.equal(getWiretapStation("wiretap1"), 1);
  assert.equal(getWiretapStation("wiretap2"), 2);
  assert.equal(getWiretapStation("wiretap3"), 3);
  assert.equal(getWiretapStation("wiretap"), 1);
  assert.equal(getWiretapStation("wiretap9"), 1);
});

test("signal quality and lock require both radar axes to be aligned", () => {
  assert.equal(wiretapSignalQuality([50, 50], [50, 50]), 100);
  assert.ok(
    wiretapSignalQuality([55, 50], [50, 50]) >
      wiretapSignalQuality([70, 50], [50, 50])
  );
  assert.equal(isWiretapLocked([54, 53], [50, 50], 1), true);
  assert.equal(isWiretapLocked([54, 54], [50, 50], 2), false);
  assert.equal(isWiretapLocked([50, 50], [50, 50], 3, true), false);
});

test("station profiles add drift and jamming without moving outside the radar", () => {
  assert.equal(shouldDriftWiretapTarget(1, 10), false);
  assert.equal(shouldDriftWiretapTarget(2, 8), true);
  assert.equal(shouldDriftWiretapTarget(3, 6), true);
  assert.deepEqual(driftWiretapTarget([20, 80], 1, () => 1), [20, 80]);
  assert.deepEqual(driftWiretapTarget([92, 8], 3, () => 1), [92, 9.75]);
  assert.equal(isWiretapJammed(2, 55), false);
  assert.equal(isWiretapJammed(3, 55), true);
  assert.equal(isWiretapJammed(3, 66), false);
  assert.equal(isWiretapTargetVisible(1, 0), true);
  assert.equal(isWiretapTargetVisible(1, 8), false);
});
