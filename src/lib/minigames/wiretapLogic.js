export const WIRETAP_ROUNDS = 3;
export const WIRETAP_HOLD_SECONDS = 6;

/** @typedef {1 | 2 | 3} WiretapStation */
/** @typedef {[number, number]} WiretapCoordinates */
/**
 * @typedef {Object} WiretapProfile
 * @property {number} tolerance
 * @property {number} driftEveryTicks
 * @property {number} driftStep
 * @property {number} jamPeriodTicks
 * @property {number} jamDurationTicks
 * @property {number} revealPeriodTicks
 * @property {number} revealDurationTicks
 * @property {number} minimumQuality
 */

/** @type {Readonly<Record<WiretapStation, Readonly<WiretapProfile>>>} */
export const WIRETAP_PROFILES = Object.freeze({
  1: Object.freeze({
    tolerance: 5,
    driftEveryTicks: 0,
    driftStep: 0,
    jamPeriodTicks: 0,
    jamDurationTicks: 0,
    revealPeriodTicks: 24,
    revealDurationTicks: 7,
    minimumQuality: 92,
  }),
  2: Object.freeze({
    tolerance: 4,
    driftEveryTicks: 8,
    driftStep: 1.25,
    jamPeriodTicks: 0,
    jamDurationTicks: 0,
    revealPeriodTicks: 27,
    revealDurationTicks: 6,
    minimumQuality: 93,
  }),
  3: Object.freeze({
    tolerance: 3.5,
    driftEveryTicks: 6,
    driftStep: 1.75,
    jamPeriodTicks: 55,
    jamDurationTicks: 10,
    revealPeriodTicks: 30,
    revealDurationTicks: 5,
    minimumQuality: 94,
  }),
});

/**
 * @param {unknown} tag
 * @returns {WiretapStation}
 */
export function getWiretapStation(tag) {
  const match = /^wiretap([1-3])$/.exec(String(tag || ""));
  return match ? /** @type {WiretapStation} */ (Number(match[1])) : 1;
}

/** @param {number} value */
export function clampWiretapValue(value) {
  return Math.max(8, Math.min(92, value));
}

/**
 * @param {WiretapCoordinates} controls
 * @param {WiretapCoordinates} target
 * @returns {WiretapCoordinates}
 */
export function wiretapErrors(controls, target) {
  return [
    Math.abs(Number(controls[0]) - Number(target[0])),
    Math.abs(Number(controls[1]) - Number(target[1])),
  ];
}

/**
 * @param {WiretapCoordinates} controls
 * @param {WiretapCoordinates} target
 */
export function wiretapSignalQuality(controls, target) {
  const [frequencyError, phaseError] = wiretapErrors(controls, target);
  const distance = Math.hypot(frequencyError, phaseError);
  return Math.max(0, Math.round(100 - distance * 1.35));
}

/**
 * @param {WiretapStation} station
 * @param {number} tick
 */
export function isWiretapJammed(station, tick) {
  const profile = WIRETAP_PROFILES[station] || WIRETAP_PROFILES[1];
  if (profile.jamPeriodTicks === 0) return false;
  return tick % profile.jamPeriodTicks < profile.jamDurationTicks;
}

/**
 * @param {WiretapStation} station
 * @param {number} tick
 */
export function isWiretapTargetVisible(station, tick) {
  const profile = WIRETAP_PROFILES[station] || WIRETAP_PROFILES[1];
  return tick % profile.revealPeriodTicks < profile.revealDurationTicks;
}

/**
 * @param {WiretapCoordinates} controls
 * @param {WiretapCoordinates} target
 * @param {WiretapStation} station
 * @param {boolean} [jammed]
 */
export function isWiretapLocked(controls, target, station, jammed = false) {
  if (jammed) return false;
  const profile = WIRETAP_PROFILES[station] || WIRETAP_PROFILES[1];
  return (
    wiretapErrors(controls, target).every(
      (error) => error <= profile.tolerance
    ) &&
    wiretapSignalQuality(controls, target) >= profile.minimumQuality
  );
}

/**
 * @param {WiretapStation} station
 * @param {number} tick
 */
export function shouldDriftWiretapTarget(station, tick) {
  const profile = WIRETAP_PROFILES[station] || WIRETAP_PROFILES[1];
  return (
    profile.driftEveryTicks > 0 &&
    tick > 0 &&
    tick % profile.driftEveryTicks === 0
  );
}

/**
 * @param {WiretapCoordinates} target
 * @param {WiretapStation} station
 * @param {() => number} [random]
 * @returns {WiretapCoordinates}
 */
export function driftWiretapTarget(target, station, random = Math.random) {
  const profile = WIRETAP_PROFILES[station] || WIRETAP_PROFILES[1];
  if (profile.driftStep === 0) return [...target];

  return /** @type {WiretapCoordinates} */ (target.map((value) => {
    const direction = random() >= 0.5 ? 1 : -1;
    return clampWiretapValue(value + direction * profile.driftStep);
  }));
}
