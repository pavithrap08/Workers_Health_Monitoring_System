// =========================================================
// Worker Safety PWA (Worker-level)
// - Micro-break decision: WORKER vitals only
// - Environment: display only
// - Robust notifications (PWA-safe) + never crash tick()
// =========================================================

// -------------------------
// ThingSpeak channels
// -------------------------
const WORKER_CHANNEL_ID = "2436533";
const WORKER_READ_KEY   = "IEHPXGUC6U1K4NJX";
// field1 HR, field2 SpO2, field3 Body Temp, field4 Accel, field5 Fall, field6 Presence

const ENV_CHANNEL_ID = "2451818";
const ENV_READ_KEY   = "AP36OTQMUVKAHQGA";
// field1 Temp, field2 Hum, field3 Sound, field4 Air, field5 Dust, field6 Flame

// Refresh interval (ms)
const REFRESH_MS = 8000;

// -------------------------
const $ = (id) => document.getElementById(id);
const nowMs = () => Date.now();

// Demo profile values
$("wName").innerText = "Ram";
$("wId").innerText = "ind_110";
$("wIndustry").innerText = "Construction Site";
$("wShift").innerText = "Morning Shift";

// -------------------------
// App mode + network UI
// -------------------------
function detectAppMode(){
  // Standalone PWA detection
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  $("appMode").innerText = isStandalone ? "PWA" : "Web";
}
detectAppMode();

function updateNetStatus(){
  $("netStatus").innerText = navigator.onLine ? "Online" : "Offline";
}
window.addEventListener("online", updateNetStatus);
window.addEventListener("offline", updateNetStatus);
updateNetStatus();

let lastUpdateAt = 0;
function renderUpdatedAgo(){
  if (!lastUpdateAt){ $("updatedAgo").innerText = "—"; return; }
  const sec = Math.max(0, Math.floor((nowMs() - lastUpdateAt) / 1000));
  $("updatedAgo").innerText = sec < 60 ? `${sec}s` : `${Math.floor(sec/60)}m`;
}
setInterval(renderUpdatedAgo, 1000);

// -------------------------
// Tips rotation
// -------------------------
const TIPS = [
  "Safety isn’t extra work. It’s how work gets done.",
  "Take the break now—avoid the accident later.",
  "Hydrate: small sips every 20–30 minutes.",
  "Breathing reset: 4s in, 2s hold, 6s out ×5.",
  "Micro-breaks reduce fatigue and mistakes.",
  "Stop early. Recover fast. Perform better.",
  "Work smart. Work safe. Go home well.",
];
let tipIndex = 0;
function rotateTip(){
  $("tipText").innerText = TIPS[tipIndex % TIPS.length];
  tipIndex++;
}
rotateTip();
setInterval(rotateTip, 15000);

// =========================================================
// Micro-break countdown timer
// =========================================================
let mbInterval = null;
let mbTotalSec = 5 * 60;
let mbRemainingSec = mbTotalSec;
let mbRunning = false;
let lastWasBreak = false;

function pad2(n){ return String(n).padStart(2, "0"); }

function renderMbTime(){
  const m = Math.floor(mbRemainingSec / 60);
  const s = mbRemainingSec % 60;
  $("mbTime").innerText = `${pad2(m)}:${pad2(s)}`;
  $("mbTarget").innerText = `${Math.floor(mbTotalSec/60)} min`;
}

function showMicrobreakUI(show){
  $("mbWrap").style.display = show ? "block" : "none";
}

function stopMicrobreakTimer(){
  if (mbInterval) clearInterval(mbInterval);
  mbInterval = null;
  mbRunning = false;
}

function resetMicrobreakTimer(minutes = 5){
  stopMicrobreakTimer();
  mbTotalSec = Math.max(1, Math.round(minutes * 60));
  mbRemainingSec = mbTotalSec;
  renderMbTime();
}

function startMicrobreakTimer(){
  if (mbRunning) return;
  mbRunning = true;

  if (mbInterval) clearInterval(mbInterval);
  mbInterval = setInterval(() => {
    mbRemainingSec = Math.max(0, mbRemainingSec - 1);
    renderMbTime();

    if (mbRemainingSec === 0){
      stopMicrobreakTimer();
      $("mbNote").innerText = "✅ Micro-break complete. You may resume work if you feel stable.";
      notifySafe("✅ Micro-break complete", "You may resume work if you feel stable.").catch(()=>{});
    }
  }, 1000);
}

function initMicrobreakButtons(){
  const startBtn = $("mbStart");
  const stopBtn  = $("mbStop");
  const resetBtn = $("mbReset");

  if (startBtn) startBtn.onclick = () => {
    $("mbNote").innerText = "Take rest during micro-break time. Resume when the timer ends.";
    startMicrobreakTimer();
  };
  if (stopBtn) stopBtn.onclick = () => stopMicrobreakTimer();
  if (resetBtn) resetBtn.onclick = () => {
    $("mbNote").innerText = "Take rest during micro-break time. Resume when the timer ends.";
    resetMicrobreakTimer(5);
  };

  renderMbTime();
}
initMicrobreakButtons();

// -------------------------
// Theme toggle
// -------------------------
function setTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
  $("btnTheme").innerText = (t === "light") ? "Dark Mode" : "Light Mode";
}
setTheme(localStorage.getItem("theme") || "dark");

$("btnTheme").onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  setTheme(cur === "light" ? "dark" : "light");
};

// =========================================================
// Notifications (Production-safe for PWA)
// =========================================================
async function enableNotifications(){
  if (!("Notification" in window)) return;

  const permission = await Notification.requestPermission();
  $("btnNotify").innerText = (permission === "granted") ? "Alerts Enabled" : "Enable Alerts";

  // warm-up: show a test notification in PWA-safe way
  if (permission === "granted"){
    await notifySafe("Alerts enabled", "You will receive safety notifications.");
  }
}
$("btnNotify").onclick = () => enableNotifications().catch(()=>{});

async function notifySafe(title, body){
  try{
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // PWA-safe: service worker notifications
    if ("serviceWorker" in navigator){
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification){
        await reg.showNotification(title, {
          body,
          icon: "icon-192.png",
          badge: "icon-192.png",
          tag: "worker-safety",
          renotify: false
        });
        return;
      }
    }

    // Fallback: some browsers allow direct notifications in normal tab
    // Wrapped in try already to avoid crashing the app
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: "icon-192.png" });
  } catch (e){
    console.warn("notifySafe failed:", e);
  }
}

// =========================================================
// Helper notes
// =========================================================
function noteHR(hr){
  if (hr === null) return "Sensor not detected";
  if (hr >= 60 && hr <= 100) return "Normal range";
  if (hr <= 120) return "Elevated — monitor";
  return "High — possible strain";
}
function noteSpO2(s){
  if (s === null) return "Sensor not detected";
  if (s >= 95) return "Good oxygenation";
  if (s >= 92) return "Slightly low — monitor";
  return "Low — move to safe zone";
}
function noteTemp(t){
  if (t === null) return "Sensor not detected";
  if (t <= 37.5) return "Normal";
  if (t <= 38.0) return "Warm — hydrate";
  return "High — heat stress risk";
}
function noteAccel(a){
  if (a === null) return "No reading";
  if (a >= 0.90 && a <= 1.10) return "Stable posture";
  if (a <= 1.35) return "Light activity";
  if (a <= 1.80) return "Moderate activity";
  return "High activity/impact";
}

function haciBand(h){
  if (h >= 80) return { label:"SAFE",     ring:"var(--good)" };
  if (h >= 60) return { label:"MODERATE", ring:"var(--warn)" };
  if (h >= 40) return { label:"WARNING",  ring:"var(--warn)" };
  return          { label:"CRITICAL", ring:"var(--bad)" };
}

function computeHACI({hrOk, spo2Ok, tempOk, accel, fall, anomaly}){
  let score = 0;

  // SpO2 (35)
  if (spo2Ok === null) score += 24;
  else if (spo2Ok >= 95) score += 35;
  else if (spo2Ok >= 92) score += 28;
  else if (spo2Ok >= 88) score += 20;
  else score += 12;

  // HR (25)
  if (hrOk === null) score += 18;
  else if (hrOk >= 60 && hrOk <= 100) score += 25;
  else if (hrOk <= 120) score += 18;
  else score += 12;

  // Temp (20)
  if (tempOk === null) score += 14;
  else if (tempOk <= 37.5) score += 20;
  else if (tempOk <= 38.0) score += 14;
  else score += 10;

  // Activity (20)
  if (fall === 1) score += 0;
  else if (accel !== null && accel >= 0.9 && accel <= 1.1) score += 20;
  else if (accel !== null && accel <= 1.35) score += 16;
  else if (accel !== null && accel <= 1.8) score += 12;
  else score += 8;

  if (anomaly === "YES") score -= 8;
  if (fall === 1) score -= 25;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function decideWorkerAction({haci, fall, spo2Ok, tempOk, anomaly}){
  if (fall === 1){
    return {
      title: "Emergency: Fall detected",
      detail: "Stay still. Call supervisor immediately.",
      badge: "CRITICAL",
      badgeClass: "bad",
      icon: "!",
      boxBg: "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))",
      notify: {title:"🚨 EMERGENCY", body:"Fall detected! Call supervisor."}
    };
  }
  if (spo2Ok !== null && spo2Ok < 92){
    return {
      title: "Alert: Low SpO₂",
      detail: "Move to a safe zone and rest. Take deep breaths for 3–5 minutes.",
      badge: "ALERT",
      badgeClass: "bad",
      icon: "!",
      boxBg: "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))",
      notify: {title:"⚠ Low SpO₂", body:"Move to safe zone + rest 3–5 min."}
    };
  }
  if (tempOk !== null && tempOk > 38.0){
    return {
      title: "Alert: Heat stress risk",
      detail: "Take rest 3–5 minutes and hydrate. Inform supervisor if persistent.",
      badge: "ALERT",
      badgeClass: "bad",
      icon: "!",
      boxBg: "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))",
      notify: {title:"⚠ Heat Stress", body:"Take rest + hydration now."}
    };
  }

  if (haci < 60 || (anomaly === "YES" && haci < 75)){
    return {
      title: "Micro-break recommended",
      detail: "Take rest for 3–5 minutes now. Drink water. Resume when stable.",
      badge: "BREAK",
      badgeClass: "warn",
      icon: "⏱",
      boxBg: "linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))",
      notify: {title:"⚠ Micro-break", body:"Rest 3–5 min + hydrate."}
    };
  }

  return {
    title: "Normal",
    detail: "All readings stable. Continue monitoring.",
    badge: "SAFE",
    badgeClass: "good",
    icon: "✓",
    boxBg: "linear-gradient(180deg, rgba(34,197,94,0.14), rgba(34,197,94,0.05))",
    notify: null
  };
}

let lastNotifiedKey = "";

// =========================================================
// Fetch helpers
// =========================================================
async function fetchJson(url, timeoutMs = 8000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try{
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// -------------------------
// Environment (display only)
// -------------------------
async function fetchEnvLatest(){
  const url = `https://api.thingspeak.com/channels/${ENV_CHANNEL_ID}/feeds.json?api_key=${ENV_READ_KEY}&results=1`;
  const js  = await fetchJson(url);
  const f   = js.feeds?.[0] || {};

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const t     = toNum(f.field1);
  const hum   = toNum(f.field2);
  const sound = toNum(f.field3);
  const air   = toNum(f.field4);
  const dust  = toNum(f.field5);
  const flame = (f.field6 === null || f.field6 === undefined) ? null : toNum(f.field6);

  const clean = (n) => (n === null || n < 0) ? null : n;

  const tOk     = clean(t);
  const humOk   = clean(hum);
  const soundOk = clean(sound);
  const airOk   = clean(air);
  const dustOk  = clean(dust);

  $("envTemp").innerText  = tOk ?? "--";
  $("envHum").innerText   = humOk ?? "--";
  $("envSound").innerText = soundOk ?? "--";
  $("envAir").innerText   = airOk ?? "--";
  $("envDust").innerText  = dustOk ?? "--";
  $("envFlame").innerText = flame ?? "--";

  const notes = [];
  if (flame === 1) notes.push("Flame detected");
  if (soundOk !== null && (soundOk >= 2000 || soundOk === 4095)) notes.push("Noise spike");
  if (airOk !== null && airOk >= 800) notes.push("Air poor");
  if (dustOk !== null && dustOk >= 900) notes.push("Dust high");

  $("envNote").innerText = (notes.length === 0)
    ? "Industrial conditions updated."
    : ("Note: " + notes.join(", ") + ".");
}

// -------------------------
// Worker
// -------------------------
async function fetchWorkerLatest(){
  const url = `https://api.thingspeak.com/channels/${WORKER_CHANNEL_ID}/feeds.json?api_key=${WORKER_READ_KEY}&results=1`;
  const js  = await fetchJson(url);
  const f   = js.feeds?.[0];
  if (!f) throw new Error("No worker feed data found");

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const hr       = toNum(f.field1);
  const spo2     = toNum(f.field2);
  const temp     = toNum(f.field3);
  const accel    = toNum(f.field4);
  const fall     = toNum(f.field5);
  const presence = toNum(f.field6);

  $("lastSync").innerText = new Date().toLocaleTimeString();
  lastUpdateAt = nowMs();

  // Presence gate
  if (presence === 0){
    $("presence").innerText = "NO";
    $("anom").innerText = "--";
    $("fall").innerText = "--";
    $("status").innerText = "Not detected";
    $("subStatus").innerText = "Move near the device to sync worker readings.";
    $("haci").innerText = "--";
    $("ring").style.setProperty("--pct", 0);
    $("ring").style.setProperty("--ring", "var(--accent)");

    $("hr").innerText = "--";
    $("spo2").innerText="--";
    $("temp").innerText="--";
    $("accel").innerText="--";

    $("hrNote").innerText = "—";
    $("spo2Note").innerText="—";
    $("tempNote").innerText="—";
    $("accelNote").innerText="—";

    $("actionTitle").innerText = "Waiting for presence…";
    $("actionDetail").innerText = "Micro-break guidance will appear when worker is detected.";
    $("badge").innerText = "N/A";
    $("badge").className = "badge";
    $("alertIcon").innerText = "⏳";
    $("alertBox").style.background = "linear-gradient(180deg, rgba(110,231,255,0.10), rgba(110,231,255,0.04))";

    showMicrobreakUI(false);
    stopMicrobreakTimer();
    lastWasBreak = false;
    return;
  }

  $("presence").innerText = "YES";

  // Clean values
  const hrOk    = hr > 0 ? hr : null;
  const spo2Ok  = spo2 >= 70 ? spo2 : null;
  const tempOk  = temp >= 34 ? temp : null;
  const accelOk = accel > 0 ? accel : null;

  // Demo anomaly flag (rule-based)
  const anomaly = (fall === 1 ||
    (accelOk !== null && accelOk > 2.2) ||
    (hrOk !== null && hrOk > 130) ||
    (spo2Ok !== null && spo2Ok < 90)) ? "YES" : "NO";

  $("anom").innerText = anomaly;
  $("fall").innerText = fall ? "YES" : "NO";

  const haci = computeHACI({hrOk, spo2Ok, tempOk, accel: accelOk, fall, anomaly});
  $("haci").innerText = String(haci);

  const band = haciBand(haci);
  $("status").innerText = band.label;
  $("subStatus").innerText = anomaly === "YES"
    ? "Unusual pattern detected — monitoring closely."
    : "Stable pattern — monitoring.";

  $("ring").style.setProperty("--pct", haci);
  $("ring").style.setProperty("--ring", band.ring);

  // KPI UI
  $("hr").innerText = hrOk ?? "--";
  $("spo2").innerText = spo2Ok ?? "--";
  $("temp").innerText = tempOk ?? "--";
  $("accel").innerText = accelOk !== null ? accelOk.toFixed(2) : "--";

  $("hrNote").innerText = noteHR(hrOk);
  $("spo2Note").innerText = noteSpO2(spo2Ok);
  $("tempNote").innerText = noteTemp(tempOk);
  $("accelNote").innerText = noteAccel(accelOk);

  // Decision (WORKER only)
  const action = decideWorkerAction({haci, fall, spo2Ok, tempOk, anomaly});

  // Micro-break timer only during BREAK
  if (action.badge === "BREAK"){
    showMicrobreakUI(true);
    if (!lastWasBreak){
      resetMicrobreakTimer(5);
      $("mbNote").innerText = "Take rest during micro-break time. Press Start to begin countdown.";
    }
    lastWasBreak = true;
  } else {
    showMicrobreakUI(false);
    stopMicrobreakTimer();
    lastWasBreak = false;
  }

  $("actionTitle").innerText = action.title;
  $("actionDetail").innerText = action.detail;
  $("badge").innerText = action.badge;
  $("badge").className = `badge ${action.badgeClass}`;
  $("alertIcon").innerText = action.icon;
  $("alertBox").style.background = action.boxBg;

  // Notify (never crash app)
  if (action.notify){
    const key = `${action.notify.title}|${action.notify.body}|${band.label}`;
    if (key !== lastNotifiedKey){
      notifySafe(action.notify.title, action.notify.body).catch(()=>{});
      lastNotifiedKey = key;
    }
  }
}

// =========================================================
// Main refresh loop (robust)
// =========================================================
async function tick(){
  // Worker first (microbreak depends on it)
  try{
    await fetchWorkerLatest();
  } catch (err){
    $("status").innerText = "Offline / Error";
    $("subStatus").innerText = "Worker feed error. Check internet or ThingSpeak key. " + (err?.message || "");
  }

  // Environment is secondary (display only)
  try{
    await fetchEnvLatest();
  } catch (err){
    $("envNote").innerText = "Environment feed error. " + (err?.message || "");
  }
}

// =========================================================
// Service Worker registration
// =========================================================
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

// Initial + refresh
tick();
setInterval(tick, REFRESH_MS);
