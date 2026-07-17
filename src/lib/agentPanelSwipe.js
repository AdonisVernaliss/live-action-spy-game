export const AGENT_PANEL_DRAG_ACTIVATION_PX = 6;
export const AGENT_PANEL_FLICK_MIN_PX = 24;
export const AGENT_PANEL_FLICK_VELOCITY = 0.55;

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert an edge drag into a panel offset that can be rendered every frame.
 * The private panel lives directly below the task screen:
 * - swipe up at the bottom of tasks to reveal it;
 * - pull down at the top of the agent panel to return to tasks.
 *
 * @param {{
 *   deltaX: number;
 *   deltaY: number;
 *   elapsedMs: number;
 *   panelOpen: boolean;
 *   contentAtTop: boolean;
 *   contentAtBottom: boolean;
 *   viewportHeight: number;
 * }} input
 * @returns {{ offset: number; target: "abilities" | "tasks" | null } | null}
 */
export function getAgentPanelDragState({
  deltaX,
  deltaY,
  elapsedMs,
  panelOpen,
  contentAtTop,
  contentAtBottom,
  viewportHeight,
}) {
  const height = Math.max(1, viewportHeight);
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (
    absY < AGENT_PANEL_DRAG_ACTIVATION_PX ||
    absY < absX * 1.05
  ) {
    return null;
  }

  let distance;
  /** @type {"abilities" | "tasks"} */
  let target;
  if (!panelOpen) {
    if (!contentAtBottom || deltaY >= 0) return null;
    distance = clamp(-deltaY, 0, height);
    target = "abilities";
  } else {
    if (!contentAtTop || deltaY <= 0) return null;
    distance = clamp(deltaY, 0, height);
    target = "tasks";
  }

  const commitDistance = Math.min(104, Math.max(52, height * 0.12));
  const velocity = distance / Math.max(16, elapsedMs);
  const shouldCommit =
    distance >= commitDistance ||
    (distance >= AGENT_PANEL_FLICK_MIN_PX &&
      velocity >= AGENT_PANEL_FLICK_VELOCITY);

  return {
    offset: panelOpen ? -height + distance : -distance,
    target: shouldCommit ? target : null,
  };
}
