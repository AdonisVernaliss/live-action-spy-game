<script lang="ts">
  export let disabled = false;
</script>

<button
  type="button"
  on:click
  class="main-button"
  {disabled}
>
  <slot /></button
>

<style>
  .main-button {
    position: relative;
    width: 100%;
    min-height: 52px;
    max-width: 18rem;
    padding: 12px 16px;
    border: 1px solid rgba(74, 222, 128, 0.58);
    border-radius: 15px;
    background:
      linear-gradient(180deg, rgba(34, 197, 94, 0.22), rgba(20, 83, 45, 0.2)),
      rgba(8, 16, 11, 0.94);
    color: #f0fdf4;
    font-size: clamp(15px, 4vw, 18px);
    line-height: 1.2;
    font-weight: 900;
    box-shadow:
      inset 0 1px rgba(255, 255, 255, 0.08),
      0 12px 32px rgba(0, 0, 0, 0.22);
    overflow-wrap: anywhere;
    transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
  }

  .main-button:not(:disabled):active {
    transform: translateY(1px) scale(0.995);
    border-color: rgba(134, 239, 172, 0.9);
    background:
      linear-gradient(180deg, rgba(34, 197, 94, 0.3), rgba(20, 83, 45, 0.25)),
      rgba(8, 16, 11, 0.94);
  }

  .main-button:focus-visible {
    outline: 2px solid #86efac;
    outline-offset: 3px;
  }

  .main-button:disabled {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.055);
    color: rgba(255, 255, 255, 0.42);
    box-shadow: none;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .main-button { transition: none; }
  }
</style>
