<script lang="ts">
  import MainButton from "$lib/MainButton.svelte";
  import { lobbyStore, playerStore } from "$lib/stores";
  import type { NfcActivities } from "$lib/types";
  import { getSocketIO } from "$lib/websocket";
  import { gotoReplace } from "$lib/util";
  import {
    ACTIVITY_POINTS,
    makeBaseLocations,
    makeDefaultAssignments,
    readLocationTemplate,
    saveLocationTemplate,
    type ActivityPointName,
    type PhysicalLocation,
  } from "$lib/locationSetup";
  import { onMount } from "svelte";
  import type { Socket } from "socket.io-client";
  import { language, t } from "$lib/i18n";

  type Step = "locations" | "assignment" | "review";

  let socket: Socket;
  let ready = false;
  let submitting = false;
  let step: Step = "locations";
  let error: string | null = null;
  let templateName = $language === "en" ? "Primary venue" : "Основная площадка";
  let hasSavedTemplate = false;
  let locations: PhysicalLocation[] = makeBaseLocations($language);
  let assignments = makeDefaultAssignments(locations);

  $: isCreator = $lobbyStore != null && $playerStore?.name === $lobbyStore.creator;
  $: completedLocations = locations.filter((location) => location.name.trim()).length;
  $: completedAssignments = Object.values(assignments).filter(Boolean).length;

  onMount(() => {
    socket = getSocketIO();
    hasSavedTemplate = readLocationTemplate() != null;

    const redirectTimer = setTimeout(() => {
      if ($lobbyStore == null) gotoReplace("/");
    }, 2800);

    const unsubscribe = lobbyStore.subscribe((lobby) => {
      if (lobby != null) {
        ready = true;
        if ($playerStore?.name !== lobby.creator) gotoReplace("/lobby");
      }
    });

    return () => {
      clearTimeout(redirectTimer);
      unsubscribe();
    };
  });

  $: if ($lobbyStore?.status.state === "inLobby") gotoReplace("/lobby");
  $: if (ready && !isCreator) gotoReplace("/lobby");

  function loadTemplate() {
    const template = readLocationTemplate();
    if (template == null) return;
    templateName = template.name;
    locations = template.locations.map((location) => ({ ...location }));
    assignments = { ...template.assignments };
    error = null;
  }

  function clearLocations() {
    locations = makeBaseLocations($language);
    assignments = makeDefaultAssignments(locations);
    step = "locations";
    error = null;
  }

  function continueToAssignment() {
    if (locations.length < 1 || locations.some((location) => !location.name.trim())) {
      error = $t("setup.error.locations");
      return;
    }

    locations = locations.map((location) => ({ ...location, name: location.name.trim() }));
    error = null;
    step = "assignment";
  }

  function reviewSetup() {
    const missing = ACTIVITY_POINTS.filter((point) => !assignments[point.name]);
    if (missing.length > 0) {
      error = $t("setup.error.assignments");
      return;
    }

    saveLocationTemplate(templateName, locations, assignments);
    hasSavedTemplate = true;
    error = null;
    step = "review";
  }

  function openQrSheet() {
    saveLocationTemplate(templateName, locations, assignments);
    window.open("/adminlinks?from=setup", "_blank", "noopener");
  }

  function submitSetup() {
    if ($lobbyStore == null || submitting) return;
    if (!isCreator) {
      error = $t("setup.error.host");
      gotoReplace("/lobby");
      return;
    }

    const activities = {} as NfcActivities;
    for (const point of ACTIVITY_POINTS) {
      const room = locations.find((location) => location.id === assignments[point.name])?.name;
      if (!room) {
        error = $t("setup.error.point", { point: pointLabel(point) });
        return;
      }
      activities[point.name] = {
        id: point.id,
        name: point.name,
        room,
      };
    }

    submitting = true;
    error = null;
    socket.emit(
      "setActivities",
      { activities },
      ({ success, message }: { success: boolean; message?: string }) => {
        if (!success) {
          submitting = false;
          error = $language === "en"
            ? $t("setup.error.save")
            : message || $t("setup.error.save");
        }
      }
    );
  }

  function addLocation() {
    locations = [
      ...locations,
      {
        id: `location-${Date.now()}-${locations.length}`,
        name: $t("setup.newLocation", { number: locations.length + 1 }),
      },
    ];
  }

  function removeLocation(id: string) {
    if (locations.length <= 1) return;
    locations = locations.filter((location) => location.id !== id);
    for (const point of ACTIVITY_POINTS) {
      if (assignments[point.name] === id) assignments[point.name] = "";
    }
    assignments = { ...assignments };
  }

  function pointLabel(point: (typeof ACTIVITY_POINTS)[number]) {
    return $language === "en" ? point.labelEn : point.label;
  }
</script>

<main class="setup-page">
  <section class="setup-card">
    <p class="eyebrow">{$t("setup.eyebrow")}</p>
    <h1>{step === "locations" ? $t("setup.locationsTitle") : step === "assignment" ? $t("setup.assignmentTitle") : $t("setup.reviewTitle")}</h1>

    {#if !ready}
      <p class="muted">{$t("setup.loading")}</p>
    {:else if !isCreator}
      <p class="muted">{$t("setup.hostOnly")}</p>
    {:else}
      <button
        type="button"
        class="host-panel-link"
        on:click={() => gotoReplace("/admin")}
      >
        {$t("setup.hostPanel")}
      </button>

      <div class="progress-row">
        <span class:active={step === "locations"}>{$t("setup.stepLocations")}</span>
        <span class:active={step === "assignment"}>{$t("setup.stepTags")}</span>
        <span class:active={step === "review"}>{$t("setup.stepReview")}</span>
        <strong>{step === "locations" ? completedLocations : completedAssignments}/{step === "locations" ? locations.length : ACTIVITY_POINTS.length}</strong>
      </div>

      {#if step === "locations"}
        <label class="template-name">
          <span>{$t("setup.templateName")}</span>
          <input bind:value={templateName} maxlength="40" placeholder={$t("setup.templatePlaceholder")} />
        </label>

        <div class="toolbar">
          {#if hasSavedTemplate}
            <button type="button" on:click={loadTemplate}>{$t("setup.loadTemplate")}</button>
          {/if}
          <button type="button" on:click={clearLocations}>{$t("setup.resetLocations")}</button>
        </div>

        <p class="description">
          {$t("setup.locationsText")}
        </p>

        <div class="location-count">{$t("setup.locationCount", { count: locations.length })}</div>
        <div class="point-list">
          {#each locations as location, index}
            <label class="point-row">
              <span class="point-number">{index + 1}</span>
              <span class="point-info">
                <strong>{$t("setup.physicalPoint")}</strong>
                <small>{$t("setup.nfcQr")}</small>
              </span>
              <input
                bind:value={location.name}
                placeholder={$t("setup.locationPlaceholder")}
              />
              <button class="remove-button" type="button" disabled={locations.length <= 1} on:click={() => removeLocation(location.id)}>{$t("setup.remove")}</button>
            </label>
          {/each}
        </div>

        <button class="add-button" type="button" on:click={addLocation}>{$t("setup.addLocation")}</button>

        {#if error}<p class="error">{error}</p>{/if}
        <MainButton on:click={continueToAssignment}>{$t("setup.assignAction")}</MainButton>
      {:else if step === "assignment"}
        <p class="description">
          {$t("setup.assignmentText")}
        </p>
        <div class="point-list">
          {#each ACTIVITY_POINTS as point}
            <label class="point-row assignment-row">
              <span class="point-number">{point.id}</span>
              <span class="point-info"><strong>{pointLabel(point)}</strong><small>{point.tag}</small></span>
              <select bind:value={assignments[point.name]}>
                <option value="">{$t("setup.chooseLocation")}</option>
                {#each locations as location}<option value={location.id}>{location.name}</option>{/each}
              </select>
            </label>
          {/each}
        </div>
        <div class="toolbar"><button type="button" on:click={() => (step = "locations")}>{$t("setup.back")}</button></div>
        {#if error}<p class="error">{error}</p>{/if}
        <MainButton on:click={reviewSetup}>{$t("setup.reviewAction")}</MainButton>
      {:else}
        <div class="summary-header">
          <div><small>{$t("setup.template")}</small><strong>{templateName}</strong></div>
          <button type="button" on:click={() => (step = "assignment")}>{$t("setup.change")}</button>
        </div>

        <div class="review-list">
          {#each ACTIVITY_POINTS as point}
            <div><span>{point.id}. {pointLabel(point)}</span><strong>{locations.find((location) => location.id === assignments[point.name])?.name}</strong></div>
          {/each}
        </div>

        <div class="review-actions">
          <button type="button" on:click={openQrSheet}>{$t("setup.openQr")}</button>
        </div>
        {#if error}<p class="error">{error}</p>{/if}
        <MainButton disabled={submitting} on:click={submitSetup}>
          {submitting ? $t("setup.saving") : $t("setup.use")}
        </MainButton>
      {/if}
    {/if}
  </section>
</main>

<style>
  :global(html), :global(body) { background: #000; }
  .setup-page { min-height: var(--app-height); width: 100%; padding: max(18px, var(--safe-top)) max(18px, var(--safe-right)) max(18px, var(--safe-bottom)) max(18px, var(--safe-left)); overflow-y: auto; background: radial-gradient(circle at top, rgba(34,197,94,.14), transparent 32rem), #000; color: white; }
  .setup-card { width: 100%; max-width: 760px; margin: 0 auto; padding: 24px; border: 1px solid rgba(255,255,255,.12); border-radius: 26px; background: rgba(8,8,8,.96); }
  .eyebrow, small { color: rgba(255,255,255,.52); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 8px 0 20px; font-size: clamp(28px, 7vw, 42px); font-weight: 900; line-height: 1.05; }
  .host-panel-link { width: 100%; margin: 0 0 14px; border-color: rgba(96,165,250,.42); background: rgba(30,64,175,.18); color: #bfdbfe; }
  .progress-row { display: flex; gap: 10px; align-items: center; margin-bottom: 20px; }
  .progress-row span { padding: 8px 10px; border-radius: 12px; background: rgba(255,255,255,.06); color: rgba(255,255,255,.5); font-size: 12px; font-weight: 800; }
  .progress-row span.active { background: rgba(34,197,94,.16); color: #86efac; }
  .progress-row strong { margin-left: auto; color: #86efac; }
  .template-name { display: grid; gap: 7px; }
  .template-name span { font-size: 13px; font-weight: 800; }
  input, select { min-width: 0; padding: 12px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; background: #fff; color: #111; }
  .toolbar, .review-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  button { padding: 10px 12px; border: 1px solid rgba(34,197,94,.45); border-radius: 12px; background: rgba(34,197,94,.12); color: white; font-weight: 800; }
  .description, .muted { color: rgba(255,255,255,.65); font-size: 14px; line-height: 1.5; }
  .point-list { display: grid; gap: 8px; margin: 18px 0; }
  .location-count { margin: 18px 0 0; color: rgba(255,255,255,.7); }
  .point-row { display: grid; grid-template-columns: 34px minmax(130px, 1fr) minmax(150px, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border: 1px solid rgba(255,255,255,.09); border-radius: 15px; background: rgba(255,255,255,.035); }
  .assignment-row { grid-template-columns: 34px minmax(150px, 1fr) minmax(180px, 1fr); }
  .point-number { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: rgba(34,197,94,.16); color: #86efac; font-weight: 900; }
  .point-info { display: grid; gap: 3px; }
  .point-info small { text-transform: none; letter-spacing: 0; }
  .remove-button { border-color: rgba(248,113,113,.35); background: rgba(127,29,29,.2); }
  .remove-button:disabled { opacity: .35; }
  .add-button { width: 100%; margin-bottom: 14px; border-style: dashed; }
  .error { color: #fca5a5; font-weight: 800; }
  .summary-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-radius: 16px; background: rgba(34,197,94,.08); }
  .summary-header div { display: grid; gap: 4px; }
  .review-list { display: grid; gap: 6px; margin: 16px 0; }
  .review-list div { display: flex; justify-content: space-between; gap: 16px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .review-list span { color: rgba(255,255,255,.65); }
  .review-list strong { text-align: right; }
  @media (max-width: 620px) { .setup-card { padding: 18px; } .point-row, .assignment-row { grid-template-columns: 34px 1fr; } .point-row input, .point-row select { grid-column: 1 / -1; } .point-row .remove-button { grid-column: 1 / -1; } .review-list div { flex-direction: column; gap: 4px; } .review-list strong { text-align: left; } }
</style>
