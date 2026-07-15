<script lang="ts">
  import { gotoReplace } from "$lib/util";
  import { onDestroy, onMount } from "svelte";
  import { language } from "$lib/i18n";

  const GOAL = 12;
  const rules = [
    { title: ["Внешние адреса запрещены", "External addresses are forbidden"], hint: ["Разрешайте только IP 10.x.x.x", "Allow only 10.x.x.x IPs"], check: (log: Log) => log.internal },
    { title: ["Опасные операции запрещены", "Dangerous operations are forbidden"], hint: ["DELETE и EXPORT нужно блокировать", "Block DELETE and EXPORT"], check: (log: Log) => !["DELETE","EXPORT"].includes(log.action) },
    { title: ["Только доверенные устройства", "Trusted devices only"], hint: ["Проверяйте статус устройства", "Check the device status"], check: (log: Log) => log.trusted },
  ];
  type Log = { ip:string; internal:boolean; action:string; trusted:boolean; user:string; time:string };
  let current: Log;
  let ruleIndex = 0;
  let correct = 0;
  let strikes = 0;
  let combo = 0;
  let timeLeft = 55;
  let feedback = "";
  let locked = false;
  let failed = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  const bi = (ru: string, en: string) => ($language === "en" ? en : ru);
  const ruleText = (text: string[]) => text[$language === "en" ? 1 : 0];
  const feedbackText = () => ({
    correct: bi("Верно", "Correct"),
    allow: bi("Нужно было разрешить", "This event should have been allowed"),
    block: bi("Угроза должна быть заблокирована", "This threat should have been blocked"),
  }[feedback] || bi("Примените только текущее правило", "Apply only the current rule"));

  onMount(startGame); onDestroy(cleanup);

  function schedule(callback: () => void, delay: number) {
    const timeout = setTimeout(() => {
      pendingTimers.delete(timeout);
      callback();
    }, delay);
    pendingTimers.add(timeout);
  }

  function cleanup() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const timeout of pendingTimers) clearTimeout(timeout);
    pendingTimers.clear();
  }

  function startGame() {
    cleanup();
    correct=0;strikes=0;combo=0;timeLeft=55;ruleIndex=0;feedback="";locked=false;failed=false;current=makeLog();
    timer=setInterval(()=>{timeLeft-=1;if(timeLeft<=0)fail();},1000);
  }
  function makeLog():Log {
    const internal=Math.random()>.42, trusted=Math.random()>.35;
    const actions=["READ","WRITE","LOGIN","DELETE","EXPORT"];
    const action=actions[Math.floor(Math.random()*actions.length)];
    return {internal,trusted,action,ip:internal?`10.${rand(1,254)}.${rand(0,254)}.${rand(1,254)}`:`${rand(20,220)}.${rand(0,255)}.${rand(0,255)}.${rand(1,254)}`,user:["operator","service","guest","admin"][rand(0,3)],time:`${String(rand(0,23)).padStart(2,"0")}:${String(rand(0,59)).padStart(2,"0")}`};
  }
  function rand(min:number,max:number){return min+Math.floor(Math.random()*(max-min+1));}
  function decide(allow:boolean){
    if(locked||failed)return;locked=true;const shouldAllow=rules[ruleIndex].check(current);
    if(allow===shouldAllow){correct+=1;combo+=1;feedback="correct";if(correct>=GOAL){if(timer)clearInterval(timer);schedule(()=>gotoReplace("/minigamedone"),700);return;}}
    else{strikes+=1;combo=0;feedback=shouldAllow?"allow":"block";if(strikes>=3){schedule(fail,500);return;}}
    schedule(()=>{ruleIndex=Math.min(2,Math.floor(correct/4));current=makeLog();feedback="";locked=false;},550);
  }
  function fail(){if(timer)clearInterval(timer);failed=true;locked=true;}
</script>

<main class="log-page"><section class="terminal">
  <p class="eyebrow">{bi("Аудит безопасности", "Security audit")}</p><h1>{bi("Анализ журнала", "Access log analysis")}</h1>
  <div class="rule"><small>{bi("Текущее правило", "Current rule")}</small><strong>{ruleText(rules[ruleIndex].title)}</strong><span>{ruleText(rules[ruleIndex].hint)}</span></div>
  <div class="stats"><span>{bi("Проверено", "Reviewed")} <b>{correct}/{GOAL}</b></span><span>{bi("Серия", "Combo")} <b>×{combo}</b></span><span>{bi("Ошибки", "Errors")} <b>{strikes}/3</b></span><span>{bi("Время", "Time")} <b>{timeLeft}s</b></span></div>
  {#if current}<article class="log-entry" class:flash={feedback}>
    <div class="log-head"><span>{bi("СОБЫТИЕ ДОСТУПА", "ACCESS EVENT")}</span><time>{current.time}</time></div>
    <dl><div><dt>{bi("ПОЛЬЗОВАТЕЛЬ", "USER")}</dt><dd>{current.user}</dd></div><div><dt>{bi("IP-АДРЕС", "IP ADDRESS")}</dt><dd>{current.ip}</dd></div><div><dt>{bi("ДЕЙСТВИЕ", "ACTION")}</dt><dd class:danger={["DELETE","EXPORT"].includes(current.action)}>{current.action}</dd></div><div><dt>{bi("УСТРОЙСТВО", "DEVICE")}</dt><dd class:danger={!current.trusted}>{current.trusted ? bi("ДОВЕРЕННОЕ", "TRUSTED") : bi("НЕИЗВЕСТНОЕ", "UNKNOWN")}</dd></div></dl>
  </article>{/if}
  <p class="feedback">{feedbackText()}</p>
  <div class="actions"><button class="block" on:click={()=>decide(false)} disabled={locked}>{bi("БЛОКИРОВАТЬ", "BLOCK")}</button><button class="allow" on:click={()=>decide(true)} disabled={locked}>{bi("РАЗРЕШИТЬ", "ALLOW")}</button></div>
  {#if failed}<div class="overlay"><strong>{bi("Аудит провален", "Audit failed")}</strong><button on:click={startGame}>{bi("Начать заново", "Restart")}</button></div>{/if}
</section></main>

<style>
  :global(html),:global(body){overflow:hidden;background:#030405}.log-page{width:100vw;min-height:100vh;padding:14px;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(245,158,11,.14),transparent 30rem),#030405;color:#fff}.terminal{position:relative;width:min(620px,100%);padding:22px;border:1px solid rgba(251,191,36,.22);border-radius:24px;background:rgba(8,8,7,.97)}.eyebrow,small{color:#fcd34d;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}h1{margin:6px 0 13px;font-size:clamp(29px,8vw,43px);font-weight:950;line-height:1}.rule{display:grid;gap:3px;padding:13px;border-left:3px solid #f59e0b;border-radius:8px;background:rgba(245,158,11,.08)}.rule strong{font-size:16px}.rule span{color:rgba(255,255,255,.58);font-size:12px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:12px 0}.stats span{display:grid;padding:8px;border-radius:9px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.5);font-size:10px}.stats b{color:#fcd34d;font-size:15px}.log-entry{padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:15px;background:#080b0d}.log-entry.flash{border-color:#fcd34d}.log-head{display:flex;justify-content:space-between;color:#94a3b8;font-size:11px;font-weight:900}dl{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:14px 0 0}dl div{display:grid;gap:2px}dt{color:#64748b;font-size:10px}dd{margin:0;font-family:monospace;font-size:15px;font-weight:900}.danger{color:#fca5a5}.feedback{min-height:23px;text-align:center;color:#fde68a;font-size:13px;font-weight:800}.actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.actions button,.overlay button{padding:16px;border-radius:13px;color:#fff;font-weight:950}.block{border:1px solid #ef4444;background:#7f1d1d}.allow{border:1px solid #22c55e;background:#14532d}.actions button:active{transform:scale(.97)}.actions button:disabled{opacity:.5}.overlay{position:absolute;inset:0;z-index:3;display:grid;place-content:center;gap:12px;text-align:center;border-radius:24px;background:rgba(0,0,0,.9)}.overlay strong{font-size:25px}.overlay button{border:1px solid #f59e0b;background:#78350f}@media(max-height:680px){.terminal{padding:14px}.stats{margin:7px 0}.rule{padding:8px}dl{margin-top:8px;gap:7px}.feedback{margin:6px}}
  .log-page{width:100%;height:100%;min-height:0;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:10px max(12px,var(--safe-right)) max(12px,var(--safe-bottom)) max(12px,var(--safe-left))}.log-page .terminal{flex:0 0 auto;min-width:0;margin:auto 0}
</style>
