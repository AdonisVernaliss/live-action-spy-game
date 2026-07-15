<script>
  import { goto } from "$app/navigation";
  import MainButton from "$lib/MainButton.svelte";
  import { language } from "$lib/i18n";
</script>

<main class="minigame-menu">
  <MainButton on:click={() => goto("/minigame/0")}>0 {$language === "en" ? "Sequence" : "Последовательность"}</MainButton>
  <MainButton on:click={() => goto("/minigame/1")}>1 {$language === "en" ? "Signal interception" : "Перехват сигнала"}</MainButton>
  <MainButton on:click={() => goto("/minigame/2")}
    >2 {$language === "en" ? "Password crack" : "Взлом пароля"}</MainButton
  >
  <MainButton on:click={() => goto("/minigame/3")}>3 {$language === "en" ? "Hash reactor" : "Хеш-реактор"}</MainButton>
  <MainButton on:click={() => goto("/minigame/4")}>4 {$language === "en" ? "Viruses" : "Вирусы"}</MainButton>
  <MainButton on:click={() => goto("/minigame/5")}>5 {$language === "en" ? "Sum to one hundred" : "Сумма до ста"}</MainButton>
  <MainButton on:click={() => goto("/minigame/6")}>6 {$language === "en" ? "Evidence disposal" : "Уничтожение улик"}</MainButton
  >
  <MainButton on:click={() => goto("/minigame/7")}>7 {$language === "en" ? "Packet routing" : "Маршрутизация пакетов"}</MainButton>
  <MainButton on:click={() => goto("/minigame/8")}>8 {$language === "en" ? "Access log" : "Журнал доступа"}</MainButton>
  <MainButton on:click={() => goto("/minigame/9")}>9 {$language === "en" ? "Power grid" : "Энергосеть"}</MainButton>
</main>

<style>
  .minigame-menu {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 12px max(12px, var(--safe-right)) max(12px, var(--safe-bottom)) max(12px, var(--safe-left));
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 10px;
    overflow-y: auto;
  }

  @media (max-width: 420px) {
    .minigame-menu { grid-template-columns: 1fr; }
  }

  @media (min-width: 900px) {
    .minigame-menu { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
</style>
