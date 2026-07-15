<script lang="ts">
  import { language, t, toggleLanguage } from "$lib/i18n";
</script>

<button
  type="button"
  class="language-toggle"
  on:click={() => toggleLanguage($language)}
  aria-label={$t("language.switch")}
  title={$t("language.switch")}
>
  <span class:active={$language === "ru"}>RU</span>
  <i></i>
  <span class:active={$language === "en"}>EN</span>
</button>

<style>
  .language-toggle {
    position: fixed;
    z-index: 95;
    top: max(10px, var(--safe-top));
    left: max(10px, var(--safe-left));
    min-height: 38px;
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(10, 10, 10, 0.9);
    color: rgba(255, 255, 255, 0.45);
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.05em;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(10px);
  }

  .language-toggle i {
    width: 1px;
    height: 13px;
    background: rgba(255, 255, 255, 0.18);
  }

  .language-toggle span.active {
    color: #86efac;
  }
</style>
