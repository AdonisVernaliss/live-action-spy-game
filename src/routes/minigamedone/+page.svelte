<script lang="ts">
  import MainButton from "$lib/MainButton.svelte";
  import ScanButton from "$lib/ScanButton.svelte";
  import { playerStore } from "$lib/stores";
  import { gotoReplace } from "$lib/util";
  import { emitGameAction } from "$lib/websocket";
  import { language, localizeServerMessage, t } from "$lib/i18n";
  import { isTestMinigameActive, returnFromTestMinigame } from "$lib/testMinigame";
  import { onMount } from "svelte";

  let error = "";
  let testRun = false;

  onMount(() => {
    testRun = isTestMinigameActive();
  });

  function getTaskNumberFromTag(value: string): number | null {
    const numericValue = Number(value);

    if (!Number.isNaN(numericValue)) {
      return numericValue;
    }

    const taskMap: Record<string, number> = {
      simonsays: 0,

      wiretap: 1,
      wiretap1: 1,
      wiretap2: 1,
      wiretap3: 1,

      passwordcrack: 2,
      bitcoinmine: 3,
      killthevirus: 4,
      sumtohundred: 5,
      destroyevidence: 6,
      packetrouting: 7,
      accesslog: 8,
      powergrid: 9,

      secret: 1000,
      secretlongtask: 1000,
      systemoverride: 1000,
    };

    return taskMap[value] ?? null;
  }

  function getCurrentTaskNumber(): number | null {
    const storedTaskNumber = localStorage.getItem("currentTaskNumber");

    if (storedTaskNumber != null && !Number.isNaN(Number(storedTaskNumber))) {
      return Number(storedTaskNumber);
    }

    const currentlyDoing = $playerStore?.currentlyDoing as any;

    if (currentlyDoing == null) {
      return null;
    }

    if (
      typeof currentlyDoing.taskNumber === "number" &&
      !Number.isNaN(currentlyDoing.taskNumber)
    ) {
      return currentlyDoing.taskNumber;
    }

    if (
      typeof currentlyDoing.number === "number" &&
      !Number.isNaN(currentlyDoing.number)
    ) {
      return currentlyDoing.number;
    }

    if (
      typeof currentlyDoing.task === "number" &&
      !Number.isNaN(currentlyDoing.task)
    ) {
      return currentlyDoing.task;
    }

    return null;
  }

  async function confirmTaskCompletion(taskNumber: number | null = null) {
    const finalTaskNumber = taskNumber ?? getCurrentTaskNumber();

    if (finalTaskNumber == null || Number.isNaN(finalTaskNumber)) {
      error = "Не удалось определить выполненное задание. Вернитесь в игру и снова отсканируйте точку.";
      return;
    }

    const result = await emitGameAction({
      action: "taskCompleted",
      taskNumber: finalTaskNumber,
    });

    if (!result.success) {
      error = result.message;
      return;
    }

    localStorage.removeItem("currentTaskNumber");

    gotoReplace("/game");
  }

  function completeTaskFromScan(contents: string) {
    const [type, info] = contents.split(":");

    if (type !== "task") {
      error = "Это не метка задания.";
      return;
    }

    const taskNumber = getTaskNumberFromTag(info);

    if (taskNumber == null) {
      error = `Неизвестная метка задания: ${info}`;
      return;
    }

    confirmTaskCompletion(taskNumber);
  }
</script>

<main class="done-page">
  <section class="done-card">
    <p class="eyebrow">{$t("done.eyebrow")}</p>

    <h1>{$t("done.title")}</h1>

    <p class="description">
      {$t("done.text")}
    </p>

    {#if error}
      <div class="error-box">
        {localizeServerMessage(error, $language)}
      </div>
    {/if}

    {#if testRun}
      <MainButton on:click={returnFromTestMinigame}>
        {$t("done.returnTestPanel")}
      </MainButton>
    {:else}
      <MainButton on:click={() => confirmTaskCompletion()}>
        {$t("done.confirm")}
      </MainButton>

      <div class="scan-box">
        <p class="scan-title">{$t("done.nfc")}</p>
        <p class="scan-text">
          {$t("done.nfcText")}
        </p>

        <ScanButton
          on:scanned={({ detail }) => {
            console.log("Scanned", detail.result);
            completeTaskFromScan(detail.result);
          }}
        />
      </div>
    {/if}
  </section>
</main>

<style>
  :global(html),
  :global(body) {
    background: #000;
  }

  .done-page {
    min-height: var(--app-height);
    width: 100%;
    padding: 20px;
    background:
      radial-gradient(circle at top, rgba(34, 197, 94, 0.16), transparent 28rem),
      #000;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .done-card {
    width: 100%;
    max-width: 460px;
    padding: 24px;
    border-radius: 26px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(8, 8, 8, 0.94);
    box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  }

  .eyebrow {
    margin: 0;
    color: rgba(255, 255, 255, 0.55);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 8px 0 14px;
    font-size: 30px;
    line-height: 1.1;
    font-weight: 900;
  }

  .description {
    margin: 0 0 22px;
    color: rgba(255, 255, 255, 0.68);
    font-size: 15px;
    line-height: 1.45;
  }

  .error-box {
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(127, 29, 29, 0.35);
    color: rgba(254, 226, 226, 0.95);
    font-size: 13px;
    line-height: 1.4;
  }

  .scan-box {
    margin-top: 18px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.055);
  }

  .scan-title {
    margin: 0;
    font-size: 15px;
    font-weight: 900;
  }

  .scan-text {
    margin: 6px 0 14px;
    color: rgba(255, 255, 255, 0.62);
    font-size: 13px;
    line-height: 1.4;
  }
</style>
