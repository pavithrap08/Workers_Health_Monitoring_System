// -------------------------
// ThingSpeak Worker Channel
// -------------------------
const CHANNEL_ID = "2436533";
const READ_KEY   = "IEHPXGUC6U1K4NJX";

const workerId = "W-001"; // change if needed
document.getElementById("workerId").innerText = workerId;

const $ = (id) => document.getElementById(id);

// Theme
function setTheme(t){
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t);
  $("btnTheme").innerText = (t === "light") ? "Dark Mode" : "Light Mode";
}
setTheme(localStorage.getItem("theme") || "dark");
$("btnTheme").onclick = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");

// Notifications permission
async function enableNotifications(){
  if (!("Notification" in window)) return;
  const p = await Notification.requestPermission();
  $("btnNotify").innerText = (p === "granted") ? "Alerts Enabled" : "Enable Alerts";
}
$("btnNotify").onclick = enableNotifications;

function notify(title, body){
  if ("Notification" in window && Notification.permission === "granted"){
    new Notification(title, { body, icon: "icon-192.png" });
  }
}

// Helper notes
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
  if (h >= 80) return { label:"SAFE",     color:"good", ring:"var(--good)" };
  if (h >= 60) return { label:"MODERATE", color:"warn", ring:"var(--warn)" };
  if (h >= 40) return { label:"WARNING",  color:"warn", ring:"var(--warn)" };
  return          { label:"CRITICAL", color:"bad",  ring:"var(--bad)" };
}

// HACI demo score (client-side).
// Later you can replace with your Python ML API result.
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

  // ML penalty (demo): if anomaly flagged, reduce a bit
  if (anomaly === "YES") score -= 8;

  // fall penalty
  if (fall === 1) score -= 25;

  score = Math.max(0, Math.min(100, Math.round(score)));
  return score;
}

function decideAction({haci, fall, spo2Ok, tempOk, anomaly}){
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
      detail: "Move to a safe zone and take deep breaths.",
      badge: "ALERT",
      badgeClass: "bad",
      icon: "!",
      boxBg: "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))",
      notify: {title:"⚠ Low SpO₂", body:"Move to safe zone immediately."}
    };
  }
  if (tempOk !== null && tempOk > 38.0){
    return {
      title: "Alert: Heat stress risk",
      detail: "Hydrate and cool down. Inform supervisor if persistent.",
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
      detail: "Take 3–5 minutes rest + hydrate. Resume when stable.",
      badge: "BREAK",
      badgeClass: "warn",
      icon: "⏱",
      boxBg: "linear-gradient(180deg, rgba(245,158,11,0.16), rgba(245,158,11,0.06))",
      notify: {title:"⚠ Micro-break", body:"Take 3–5 minutes rest + hydrate."}
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

let lastNotifiedKey = ""; // prevent spam notifications

async function fetchLatest(){
  const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_KEY}&results=1`;
  const res = await fetch(url);
  const js  = await res.json();
  const f   = js.feeds[0];

  const hr = Number(f.field1 || 0);
  const spo2 = Number(f.field2 || 0);
  const temp = Number(f.field3 || 0);
  const accel = Number(f.field4 || 0);
  const fall = Number(f.field5 || 0);
  const presence = Number(f.field6 || 0);

  $("lastSync").innerText = new Date().toLocaleTimeString();

  // Presence gate
  if (presence === 0){
    $("presence").innerText = "NO";
    $("anom").innerText = "--";
    $("fall").innerText = "--";
    $("status").innerText = "Not detected";
    $("subStatus").innerText = "Move near the machine to sync worker readings.";
    $("haci").innerText = "--";
    $("ring").style.setProperty("--pct", 0);
    $("ring").style.setProperty("--ring", "var(--accent)");
    $("hr").innerText = "--"; $("spo2").innerText="--"; $("temp").innerText="--"; $("accel").innerText="--";
    $("hrNote").innerText = "—"; $("spo2Note").innerText="—"; $("tempNote").innerText="—"; $("accelNote").innerText="—";
    $("actionTitle").innerText = "Waiting for presence…";
    $("actionDetail").innerText = "No alerts while worker is not detected.";
    $("badge").innerText = "N/A";
    $("badge").className = "badge";
    $("alertIcon").innerText = "⏳";
    $("alertBox").style.background = "linear-gradient(180deg, rgba(110,231,255,0.10), rgba(110,231,255,0.04))";
    return;
  }

  $("presence").innerText = "YES";

  // Clean values (treat invalids as missing)
  const hrOk   = hr > 0 ? hr : null;
  const spo2Ok = spo2 >= 70 ? spo2 : null;
  const tempOk = temp >= 34 ? temp : null;
  const accelOk = accel > 0 ? accel : null;

  // Demo anomaly flag (replace later with your Python IF output)
  const anomaly = (fall === 1 || (accelOk !== null && accelOk > 2.2) || (hrOk !== null && hrOk > 130) || (spo2Ok !== null && spo2Ok < 90)) ? "YES" : "NO";
  $("anom").innerText = anomaly;
  $("fall").innerText = fall ? "YES" : "NO";

  // HACI + UI
  const haci = computeHACI({hrOk, spo2Ok, tempOk, accel: accelOk, fall, anomaly});
  $("haci").innerText = haci;

  const band = haciBand(haci);
  $("status").innerText = band.label;
  $("subStatus").innerText = anomaly === "YES" ? "Unusual pattern detected — monitoring closely." : "Stable pattern — monitoring.";
  $("ring").style.setProperty("--pct", haci);
  $("ring").style.setProperty("--ring", band.ring);

  // KPIs
  $("hr").innerText = hrOk ?? "--";
  $("spo2").innerText = spo2Ok ?? "--";
  $("temp").innerText = tempOk ?? "--";
  $("accel").innerText = accelOk !== null ? accelOk.toFixed(2) : "--";

  $("hrNote").innerText = noteHR(hrOk);
  $("spo2Note").innerText = noteSpO2(spo2Ok);
  $("tempNote").innerText = noteTemp(tempOk);
  $("accelNote").innerText = noteAccel(accelOk);

  // Action
  const action = decideAction({haci, fall, spo2Ok, tempOk, anomaly});
  $("actionTitle").innerText = action.title;
  $("actionDetail").innerText = action.detail;
  $("badge").innerText = action.badge;
  $("badge").className = `badge ${action.badgeClass}`;
  $("alertIcon").innerText = action.icon;
  $("alertBox").style.background = action.boxBg;

  // Notify (avoid spamming)
  if (action.notify){
    const key = `${action.notify.title}|${action.notify.body}|${band.label}`;
    if (key !== lastNotifiedKey){
      notify(action.notify.title, action.notify.body);
      lastNotifiedKey = key;
    }
  }
}

// Register service worker
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js");
}

// Initial + refresh
fetchLatest();
setInterval(fetchLatest, 8000);