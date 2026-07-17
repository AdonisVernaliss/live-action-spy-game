import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { vitePreprocess } from "@sveltejs/kit/vite";
import { parse, preprocess } from "svelte/compiler";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function svelteFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return svelteFiles(filename);
    return filename.endsWith(".svelte") ? [filename] : [];
  });
}

function hasAttribute(node, name) {
  return node.attributes?.some(
    (attribute) => attribute.type === "Attribute" && attribute.name === name
  );
}

function hasActionHandler(node) {
  return node.attributes?.some(
    (attribute) => attribute.type === "EventHandler"
  );
}

function sourceLocation(source, position) {
  return source.slice(0, position).split("\n").length;
}

test("every enabled UI button has an action handler", async () => {
  const missing = [];
  let nativeButtonCount = 0;
  let mainButtonCount = 0;

  for (const filename of svelteFiles(path.join(projectRoot, "src"))) {
    const source = fs.readFileSync(filename, "utf8");
    const processed = await preprocess(source, vitePreprocess(), { filename });
    const ast = parse(processed.code, { filename });

    const visit = (node) => {
      if (node == null || typeof node !== "object") return;
      const isNativeButton = node.type === "Element" && node.name === "button";
      const isMainButton =
        node.type === "InlineComponent" && node.name === "MainButton";

      if (isNativeButton || isMainButton) {
        if (isNativeButton) nativeButtonCount += 1;
        else mainButtonCount += 1;

        const intentionallyInactive =
          hasAttribute(node, "disabled") ||
          (isNativeButton && hasAttribute(node, "type") &&
            node.attributes.some(
              (attribute) =>
                attribute.type === "Attribute" &&
                attribute.name === "type" &&
                attribute.value?.[0]?.data === "submit"
            ));

        if (!intentionallyInactive && !hasActionHandler(node)) {
          missing.push(
            `${path.relative(projectRoot, filename)}:${sourceLocation(processed.code, node.start)}`
          );
        }
      }

      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) visit(child);
        } else if (value?.type) {
          visit(value);
        }
      }
    };

    visit(ast.html);
  }

  assert.ok(nativeButtonCount >= 100, "expected the full UI button set");
  assert.ok(mainButtonCount >= 30, "expected shared primary buttons");
  assert.deepEqual(missing, []);
});

test("all ten standard minigames are routed and can reach completion", () => {
  const components = [
    "SimonSays",
    "Wiretap",
    "Password",
    "Mining",
    "Virus",
    "SumToHundred",
    "DeleteEvidence",
    "PacketRouting",
    "AccessLog",
    "PowerGrid",
  ];
  const briefings = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "minigameBriefings.ts"),
    "utf8"
  );

  for (const [number, component] of components.entries()) {
    const route = fs.readFileSync(
      path.join(projectRoot, "src", "routes", "minigame", String(number), "+page.svelte"),
      "utf8"
    );
    const implementation = fs.readFileSync(
      path.join(projectRoot, "src", "lib", "minigames", `${component}.svelte`),
      "utf8"
    );

    assert.match(route, new RegExp(`\\b${component}\\b`), `minigame ${number}`);
    assert.match(
      implementation,
      /gotoReplace\(["']\/minigamedone["']\)/,
      `${component} completion route`
    );
    assert.match(
      implementation,
      /overflow-y:\s*auto/,
      `${component} must remain scrollable on short screens`
    );
    assert.match(
      briefings,
      new RegExp(`"${number}":\\s*\\{`),
      `${component} briefing`
    );
  }
});

test("agent abilities stay hidden and every sabotage is an actual button", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "src", "routes", "game", "+page.svelte"),
    "utf8"
  );
  const buttonTags = [...source.matchAll(/<button\b[\s\S]*?>/g)].map(
    ([tag]) => tag
  );

  assert.doesNotMatch(source, /class="ability-switch/);
  assert.doesNotMatch(source, /\$t\("game\.openAbilities"\)/);
  assert.match(source, /getAgentPanelDragState/);
  assert.match(source, /on:touchmove\|nonpassive=\{handleTouchMove\}/);
  assert.match(source, /event\.pointerType === "touch"/);
  assert.match(source, /cancelSwipe\("pointer"\)/);
  assert.match(source, /cancelSwipe\("touch"\)/);
  assert.match(source, /class:agent-panel-dragging=\{panelDragging\}/);
  assert.match(source, /addEventListener\("click", suppressClickAfterDrag, true\)/);
  assert.doesNotMatch(source, /button:not\(\.task-action\)/);
  assert.match(source, /--agent-panel-offset/);
  assert.match(source, /translate3d\(0, calc\(100% \+ var\(--agent-panel-offset\)\), 0\)/);
  assert.equal((source.match(/<ScanButton\b/g) || []).length, 1);
  assert.doesNotMatch(source, /class="kill-scanner"/);
  assert.doesNotMatch(source, /class="agent-panel-card kill-panel"/);
  assert.doesNotMatch(source, /game\.killReady/);
  assert.doesNotMatch(source, /game\.killHint/);

  for (const action of ["firewall", "virus", "hack"]) {
    assert.ok(
      buttonTags.some((tag) =>
        tag.includes(`data-agent-action="${action}"`)
      ),
      `${action} must be rendered as a button`
    );
  }
});

test("floating language control stays translucent without increasing game height", () => {
  const notification = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "NotificationBar.svelte"),
    "utf8"
  );
  const globals = fs.readFileSync(
    path.join(projectRoot, "src", "app.postcss"),
    "utf8"
  );
  const game = fs.readFileSync(
    path.join(projectRoot, "src", "routes", "game", "+page.svelte"),
    "utf8"
  );
  const languageToggle = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "LanguageToggle.svelte"),
    "utf8"
  );

  assert.match(languageToggle, /background: rgba\(10, 10, 10, 0\.28\)/);
  assert.doesNotMatch(notification, /max\(124px/);
  assert.doesNotMatch(globals, /6\.25rem/);
  assert.match(globals, /--notification-height:/);
  assert.match(game, /var\(--notification-height\)/);
});

test("game tasks use aligned numbering and the scanner has no empty result line", () => {
  const game = fs.readFileSync(
    path.join(projectRoot, "src", "routes", "game", "+page.svelte"),
    "utf8"
  );
  const scanner = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "ScanButton.svelte"),
    "utf8"
  );

  assert.match(game, /<ol class="task-list">/);
  assert.match(game, /grid-template-columns: 24px minmax\(0, 1fr\)/);
  assert.match(game, /class="task-action"/);
  assert.doesNotMatch(game, /list-disc list-inside/);
  assert.doesNotMatch(scanner, /<br\s*\/>\s*\{msg\}/);
  assert.match(scanner, /\{#if msg\}/);
  assert.match(scanner, /HOLD_TO_SCAN_MS/);
  assert.match(scanner, /on:pointerdown=\{beginHold\}/);
  assert.match(scanner, /on:pointerup=\{finishHold\}/);
  assert.match(game, /action: "toggleAgentTask"/);
});

test("player interaction hold is neutral for every role", () => {
  const scan = fs.readFileSync(
    path.join(projectRoot, "src", "routes", "scan", "+page.svelte"),
    "utf8"
  );

  assert.match(scan, /isNeutralPlayerInteraction\(pendingAction\)/);
  assert.match(scan, /targetColor == null\s*\?\s*null/);
  assert.match(scan, /class:interaction-holding=\{interactionHolding\}/);
  assert.match(scan, /action: "beginSilentEliminationHold"/);
  assert.match(scan, /action: "silentKillPlayer"/);
});

test("minigame onboarding explains advanced mechanics without splitting long titles", () => {
  const briefingComponent = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "MinigameBriefing.svelte"),
    "utf8"
  );
  const briefings = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "minigameBriefings.ts"),
    "utf8"
  );
  const routing = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "minigames", "PacketRouting.svelte"),
    "utf8"
  );
  const virus = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "minigames", "Virus.svelte"),
    "utf8"
  );
  const powerGrid = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "minigames", "PowerGrid.svelte"),
    "utf8"
  );
  const wiretap = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "minigames", "Wiretap.svelte"),
    "utf8"
  );

  assert.match(briefingComponent, /class:long-title=/);
  assert.match(briefingComponent, /overflow-wrap:normal/);
  assert.doesNotMatch(briefingComponent, /h1\{[^}]*overflow-wrap:anywhere/);
  assert.ok((briefings.match(/controls:/g) || []).length >= 11);
  assert.ok((briefings.match(/success:/g) || []).length >= 11);
  assert.ok((briefings.match(/warning:/g) || []).length >= 11);
  assert.match(routing, /const GAME_TIME = 120/);
  assert.match(virus, /class="armor-alert"/);
  assert.match(virus, /getVirusSpawnDelay/);
  assert.match(powerGrid, /getPowerGridState/);
  assert.match(wiretap, /captureArmed/);
  assert.match(wiretap, /ВКЛЮЧИТЬ ЗАХВАТ/);
});
