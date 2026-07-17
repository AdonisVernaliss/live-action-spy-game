<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { language } from "$lib/i18n";
  import type { MinigameBriefing } from "$lib/minigameBriefings";

  export let briefing: MinigameBriefing;

  const dispatch = createEventDispatcher<{ start: void }>();
  $: pick = (text: { ru: string; en: string }) => text[$language];
</script>

<section class="briefing-page">
  <article class="briefing-card">
    <p class="eyebrow">{$language === "en" ? "Mission briefing" : "Краткий инструктаж"}</p>
    <h1 class:long-title={pick(briefing.title).length > 20}>{pick(briefing.title)}</h1>
    <p class="objective">{pick(briefing.objective)}</p>

    {#if briefing.controls || briefing.success || briefing.warning}
      <div class="guide-grid">
        {#if briefing.controls}
          <article>
            <small>{$language === "en" ? "CONTROLS" : "УПРАВЛЕНИЕ"}</small>
            <p>{pick(briefing.controls)}</p>
          </article>
        {/if}
        {#if briefing.success}
          <article class="success-guide">
            <small>{$language === "en" ? "SUCCESS" : "ЦЕЛЬ"}</small>
            <p>{pick(briefing.success)}</p>
          </article>
        {/if}
        {#if briefing.warning}
          <article class="warning-guide">
            <small>{$language === "en" ? "WATCH OUT" : "ВАЖНО"}</small>
            <p>{pick(briefing.warning)}</p>
          </article>
        {/if}
      </div>
    {/if}

    <ol>
      {#each briefing.rules as rule, index}
        <li><span>{index + 1}</span><p>{pick(rule)}</p></li>
      {/each}
    </ol>

    <p class="timer-note">
      {$language === "en"
        ? "The game timer starts only after you press the button."
        : "Таймер игры запустится только после нажатия кнопки."}
    </p>
    <button type="button" on:click={() => dispatch("start")}>
      {$language === "en" ? "START TASK" : "НАЧАТЬ ЗАДАНИЕ"}
    </button>
  </article>
</section>

<style>
  .briefing-page{width:100%;height:100%;min-height:0;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:clamp(12px,4vw,24px) max(12px,var(--safe-right)) max(16px,var(--safe-bottom)) max(12px,var(--safe-left));background:radial-gradient(circle at 50% 0,rgba(34,197,94,.16),transparent 32rem),#020403;color:#fff}.briefing-card{width:min(620px,100%);min-width:0;margin:auto 0;padding:clamp(18px,5vw,30px);border:1px solid rgba(74,222,128,.28);border-radius:26px;background:rgba(5,9,6,.97);box-shadow:0 24px 80px rgba(0,0,0,.5)}.eyebrow{margin:0;color:#86efac;font-size:11px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}h1{margin:8px 0 11px;font-size:clamp(26px,7.2vw,46px);font-weight:950;line-height:1.04;overflow-wrap:normal;word-break:normal;text-wrap:balance;hyphens:none}h1.long-title{font-size:clamp(21px,5.8vw,39px);text-wrap:wrap}.objective{margin:0;color:rgba(255,255,255,.72);font-size:clamp(14px,3.8vw,17px);line-height:1.5}.guide-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:15px 0}.guide-grid article{min-width:0;padding:9px;border:1px solid rgba(56,189,248,.18);border-radius:11px;background:rgba(14,165,233,.07)}.guide-grid article.success-guide{border-color:rgba(74,222,128,.2);background:rgba(22,101,52,.09)}.guide-grid article.warning-guide{border-color:rgba(251,191,36,.24);background:rgba(120,53,15,.11)}.guide-grid small{display:block;margin-bottom:4px;color:#7dd3fc;font-size:8px;font-weight:950;letter-spacing:.1em}.guide-grid .success-guide small{color:#86efac}.guide-grid .warning-guide small{color:#fcd34d}.guide-grid p{margin:0;color:rgba(255,255,255,.68);font-size:10px;line-height:1.35}ol{display:grid;gap:9px;margin:16px 0;padding:0;list-style:none}li{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;align-items:center;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.035)}li>span{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:rgba(34,197,94,.18);color:#86efac;font-weight:950}li p{min-width:0;margin:0;color:rgba(255,255,255,.82);font-size:13px;line-height:1.4}.timer-note{margin:0 0 13px;color:rgba(255,255,255,.47);font-size:11px;line-height:1.4}button{width:100%;min-height:54px;padding:14px;border:1px solid #4ade80;border-radius:15px;background:#166534;color:#fff;font-size:15px;font-weight:950;letter-spacing:.04em;touch-action:manipulation}button:active{transform:scale(.99);background:#15803d}@media(max-width:520px){.guide-grid{grid-template-columns:1fr}.guide-grid article{padding:8px 10px}.guide-grid p{font-size:11px}}@media(max-height:560px) and (orientation:landscape){.briefing-page{align-items:flex-start}.briefing-card{margin:0;padding:14px}h1,h1.long-title{font-size:26px}.guide-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin:8px 0}.guide-grid article{padding:6px}.guide-grid p{font-size:9px}ol{grid-template-columns:repeat(3,minmax(0,1fr));margin:8px 0}li{grid-template-columns:24px minmax(0,1fr);padding:7px;gap:6px}li>span{width:24px;height:24px}li p{font-size:10px}.timer-note{display:none}button{min-height:42px;padding:9px}}
</style>
