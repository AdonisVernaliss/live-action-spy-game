import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_PANEL_DRAG_ACTIVATION_PX,
  getAgentPanelDragState,
} from "../src/lib/agentPanelSwipe.js";

const viewportHeight = 700;

test("the agent panel follows an upward drag from the bottom of tasks", () => {
  const state = getAgentPanelDragState({
    deltaX: 3,
    deltaY: -90,
    elapsedMs: 240,
    panelOpen: false,
    contentAtTop: false,
    contentAtBottom: true,
    viewportHeight,
  });

  assert.deepEqual(state, { offset: -90, target: "abilities" });
});

test("the task screen follows a downward drag from the panel top", () => {
  const state = getAgentPanelDragState({
    deltaX: 2,
    deltaY: 100,
    elapsedMs: 260,
    panelOpen: true,
    contentAtTop: true,
    contentAtBottom: false,
    viewportHeight,
  });

  assert.deepEqual(state, { offset: -600, target: "tasks" });
});

test("a short drag follows the finger but snaps back on release", () => {
  assert.deepEqual(
    getAgentPanelDragState({
      deltaX: 0,
      deltaY: -30,
      elapsedMs: 400,
      panelOpen: false,
      contentAtTop: false,
      contentAtBottom: true,
      viewportHeight,
    }),
    { offset: -30, target: null }
  );
});

test("a short fast flick commits without requiring a long drag", () => {
  assert.equal(
    getAgentPanelDragState({
      deltaX: 0,
      deltaY: -32,
      elapsedMs: 40,
      panelOpen: false,
      contentAtTop: false,
      contentAtBottom: true,
      viewportHeight,
    })?.target,
    "abilities"
  );
});

test("normal scrolling, horizontal movement, and tiny movement are ignored", () => {
  const common = {
    elapsedMs: 100,
    viewportHeight,
  };

  assert.equal(
    getAgentPanelDragState({
      ...common,
      deltaX: 0,
      deltaY: -90,
      panelOpen: false,
      contentAtTop: true,
      contentAtBottom: false,
    }),
    null
  );
  assert.equal(
    getAgentPanelDragState({
      ...common,
      deltaX: 0,
      deltaY: 90,
      panelOpen: true,
      contentAtTop: false,
      contentAtBottom: true,
    }),
    null
  );
  assert.equal(
    getAgentPanelDragState({
      ...common,
      deltaX: 100,
      deltaY: 30,
      panelOpen: false,
      contentAtTop: true,
      contentAtBottom: false,
    }),
    null
  );
  assert.equal(
    getAgentPanelDragState({
      ...common,
      deltaX: 0,
      deltaY: -(AGENT_PANEL_DRAG_ACTIVATION_PX - 1),
      panelOpen: false,
      contentAtTop: false,
      contentAtBottom: true,
    }),
    null
  );
});
