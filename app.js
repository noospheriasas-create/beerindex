/* =========================================================
   ABI v3 — fanzine FR · Supabase backend
   ========================================================= */
const SUPABASE_URL = 'https://rjptjimynwumehytqyqn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcHRqaW15bnd1bWVoeXRxeXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzIzMzUsImV4cCI6MjA5MzgwODMzNX0.roClkQ2E3c7iPg67DLI5q3Z8sFL2PyQoAmypeq7v_3Q';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let BARS = [];

const LS = { introDone:"abi:introDone", mode:"abi:mode", favs:"abi:favs", nick:"abi:nick", device:"abi:device" };
const state = {
  tab: "carte",
  mode: localStorage.getItem(LS.mode) || "alc",
  hhFilter: false,
  selectedBarId: null,
  reports: 0,
  favs: JSON.parse(localStorage.getItem(LS.favs) || "[]"),
  nick: localStorage.getItem(LS.nick) || "",
  device: localStorage.getItem(LS.device) || `abi-${Math.random().toString(36).slice(2,8)}`,
  sort: "price",
};
localStorage.setItem(LS.device, state.device);

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const fmt = (n) => Number(n).toFixed(2).replace(".", ",");
const eur = (n) => `€${fmt(n)}`;

const tier = (price) => {
  if (price < 6)  return { c:"#6F8F62", k:"cheap", label:"correct" };
  if (price < 7)  return { c:"#B98D32", k:"fair",  label:"raisonnable" };
  if (price < 8)  return { c:"#C95F39", k:"steep", label:"ça pique" };
  return            { c:"#8B2D1A", k:"rip",   label:"chacal" };
};
const parseHM = (s) => { const [h,m] = s.split(":").map(Number); return h*60 + m; };
const nowMins = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
const isHHActive = (b) => {
  if (!b.hhStart || !b.hhEnd) return false;
  const n = nowMins();
  return n >= parseHM(b.hhStart) && n < parseHM(b.hhEnd);
};
const minsHH = (b) => {
  if (!b.hhStart) return null;
  const n = nowMins();
  if (n >= parseHM(b.hhStart) && n < parseHM(b.hhEnd)) return { active:true, end: parseHM(b.hhEnd) - n };
  if (n < parseHM(b.hhStart)) return { active:false, start: parseHM(b.hhStart) - n };
  return null;
};
const priceFor = (b) => state.mode === "nonalc" ? b.nonAlcPrice : b.pintNormal;
const visibleBars = () => BARS.filter(b => {
  if (state.mode === "nonalc" && !b.hasNonAlc) return false;
  if (state.hhFilter && !isHHActive(b)) return false;
  return true;
});

const toast = (msg, ms=2200) => {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._tm); toast._tm = setTimeout(() => t.hidden = true, ms);
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

function mapBarFromDb(b) {
  return {
    id: b.id, name: b.name, address: b.address, lat: b.lat, lng: b.lng,
    pintNormal: b.pint_normal, pintHH: b.pint_hh,
    hhStart: b.hh_start, hhEnd: b.hh_end,
    hasNonAlc: b.has_non_alc, nonAlcPrice: b.non_alc_price,
    lastUpdate: b.last_update,
  };
}

async function fetchBars() {
  const { data, error } = await sb.from('bars').select('*').order('id');
  if (error) { console.error('Supabase fetch error:', error); toast("Connexion à la base perdue."); return false; }
  BARS = data.map(mapBarFromDb);
  return true;
}

async function fetchMyReportCount() {
  const { count, error } = await sb.from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', state.device);
  if (!error) state.reports = count || 0;
}

function computeIndex() {
  const list = state.mode === "nonalc"
    ? BARS.filter(b => b.hasNonAlc).map(b => b.nonAlcPrice)
    : BARS.map(b => b.pintNormal);
  if (!list.length) return { today: 0 };
  return { today: list.reduce((a,b)=>a+b,0) / list.length };
}

function todayLabel() {
  const d = new Date();
  const days = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · annecy`;
}

// ============== TABS / NAV ==============
function setTab(name) {
  state.tab = name;
  $$(".screen[data-tab]").forEach(s => s.hidden = s.dataset.tab !== name);
  $$(".tab[data-go-tab]").forEach(b => b.classList.toggle("is-active", b.dataset.goTab === name));
  $("#landing").hidden = name !== "landing";
  if (name !== "admin") $("#admin").hidden = true;
  if (name === "carte") setTimeout(() => map && map.invalidateSize(), 60);
  if (name === "liste") renderList();
  if (name === "moi") renderProfile();
  if (["carte","liste","moi"].includes(name)) history.replaceState(null,"",`#${name}`);
}

document.addEventListener("click", (e) => {
  const goTab = e.target.closest("[data-go-tab]");
  if (goTab) {
    $("#confirm").hidden = true;
    $("#admGate").hidden = true;
    const t = goTab.dataset.goTab;
    if (t === "landing") { $("#landing").hidden = false; return; }
    if (t === "admin")   { openAdmin(); return; }
    $("#landing").hidden = true; $("#admin").hidden = true;
    setTab(t);
    return;
  }
  const barRow = e.target.closest("[data-bar-id]");
  if (barRow) { openSheet(+barRow.dataset.barId); return; }
});

// ============== ONBOARDING ==============
$$("[data-onb-skip]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); closeOnb(); }));
$$(".onb__mode").forEach(b => b.addEventListener("click", () => {
  state.mode = b.dataset.mode;
  localStorage.setItem(LS.mode, state.mode);
  closeOnb();
  toast(state.mode === "nonalc" ? "OK. Sans alcool. Bien joué." : "Ça marche. On te trouve une vraie pinte.");
  updateChips(); renderPins(); renderTopChip();
}));
function closeOnb() { $("#onb").hidden = true; localStorage.setItem(LS.introDone, "1"); }

// ============== TOP CHIP ==============
function renderTopChip() {
  const i = computeIndex();
  $("#idxChipPrice").textContent = i.today ? eur(i.today) : "—";
  $("#idxChipDelta").textContent = state.mode === "nonalc" ? "0,0 %" : "moyenne";
  $("#idxChipDelta").className = "pct";
}

// ============== MAP ==============
let map, markersLayer;
function initMap() {
  if (map) return;
  map = L.map("mapEl", { center: [45.8992, 6.1294], zoom: 15, zoomControl: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  renderPins();
}
function pinIcon(b) {
  const price = priceFor(b);
  const t = tier(price);
  const hh = isHHActive(b);
  return L.divIcon({
    html: `<div class="pin-pill t-${t.k} ${hh?"is-hh":""}">${eur(price)}</div>`,
    className: "pin-wrap", iconSize: [60,30], iconAnchor: [30,30],
  });
}
function renderPins() {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  const bars = visibleBars();
  $("#mapEmpty").hidden = bars.length > 0;
  bars.forEach(b => {
    const m = L.marker([b.lat, b.lng], { icon: pinIcon(b) });
    m.on("click", () => openSheet(b.id));
    m.addTo(markersLayer);
  });
}
function updateChips() {
  $("#modeAlcChip").classList.toggle("is-active", state.mode === "alc");
  $("#modeNonChip").classList.toggle("is-active", state.mode === "nonalc");
  $("#hhChip").classList.toggle("is-active", state.hhFilter);
  localStorage.setItem(LS.mode, state.mode);
}
$("#modeAlcChip").addEventListener("click", () => { state.mode = "alc"; updateChips(); renderPins(); renderTopChip(); renderProfile(); });
$("#modeNonChip").addEventListener("click", () => { state.mode = "nonalc"; updateChips(); renderPins(); renderTopChip(); renderProfile(); });
$("#hhChip").addEventListener("click", () => { state.hhFilter = !state.hhFilter; updateChips(); renderPins(); });
$("#mapFab").addEventListener("click", () => openReport(null));

// ============== BAR SHEET ==============
function timeAgo(dateStr) {
  if (!dateStr) return "récemment";
  const days = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

function openSheet(id) {
  const b = BARS.find(x => x.id === id);
  if (!b) return;
  state.selectedBarId = id;
  const price = priceFor(b);
  const t = tier(price);
  const hh = minsHH(b);
  const isFav = state.favs.includes(id);

  let hhCard = "";
  if (!b.pintHH) {
    hhCard = `<div class="hh-card is-cold"><div class="hh-card__icon">×</div><div class="hh-card__txt"><div class="hh-card__lbl">Happy hour</div><div class="hh-card__val">Aucun. Désolé.</div></div></div>`;
  } else if (hh && hh.active) {
    hhCard = `<div class="hh-card is-live"><div class="hh-card__icon">🔥</div><div class="hh-card__txt"><div class="hh-card__lbl">${b.hhStart}–${b.hhEnd}</div><div class="hh-card__val">${eur(b.pintHH)} la pinte · finit dans ${hh.end} min</div></div><span class="hh-card__live">Live</span></div>`;
  } else if (hh) {
    hhCard = `<div class="hh-card"><div class="hh-card__icon">⏱</div><div class="hh-card__txt"><div class="hh-card__lbl">${b.hhStart}–${b.hhEnd}</div><div class="hh-card__val">${eur(b.pintHH)} la pinte · dans ${hh.start} min</div></div></div>`;
  }

  $("#sheetBody").innerHTML = `
    <div class="bar-head">
      <div class="bar-head__row">
        <div style="flex:1;min-width:0">
          <h2>${escapeHtml(b.name)}</h2>
          <div class="bar-head__addr">${escapeHtml(b.address)}</div>
        </div>
        <button class="bar-fav ${isFav?"is-on":""}" id="favBtn" aria-label="Favori"><svg viewBox="0 0 24 24" width="18" height="18" fill="${isFav?"currentColor":"none"}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z"/></svg></button>
      </div>
    </div>
    <div class="price-row">
      <div>
        <div class="price-row__label">${state.mode === "nonalc" ? "Pinte 0,0 %" : "Pinte (50 cl)"}</div>
        <div class="price-row__val"><span class="cur">€</span>${fmt(price)}</div>
      </div>
      <span class="price-row__tier t-${t.k}">${t.label}</span>
    </div>
    <div class="price-update">Mis à jour ${timeAgo(b.lastUpdate)} · par un contributeur anonyme</div>
    ${hhCard}
    <div class="bar-actions">
      <button class="btn btn--ghost" id="dirBtn">↗ Itinéraire</button>
      <button class="btn btn--terra" id="reportFromBar">+ Signaler</button>
    </div>
    <div class="bar-foot">// les 5 derniers signalements approuvés sont moyennés</div>
  `;
  $("#sheetWrap").hidden = false;
  $("#favBtn").addEventListener("click", () => {
    if (state.favs.includes(id)) state.favs = state.favs.filter(x => x !== id);
    else state.favs.push(id);
    localStorage.setItem(LS.favs, JSON.stringify(state.favs));
    openSheet(id); renderProfile();
  });
  $("#dirBtn").addEventListener("click", () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
    window.open(url, "_blank", "noopener");
  });
  $("#reportFromBar").addEventListener("click", () => { closeSheet(); openReport(id); });
}
function closeSheet() { $("#sheetWrap").hidden = true; }
$$("[data-close-sheet]").forEach(b => b.addEventListener("click", closeSheet));

// ============== LISTE ==============
function renderList() {
  $("#listDate").textContent = todayLabel();
  const idx = computeIndex();
  const bars = visibleBars();
  const prices = bars.map(b => priceFor(b));
  $("#listAvg").textContent = idx.today ? eur(idx.today) : "—";
  $("#listMin").textContent = prices.length ? eur(Math.min(...prices)) : "—";
  $("#listMax").textContent = prices.length ? eur(Math.max(...prices)) : "—";
  $("#listCount").textContent = bars.length;
  $("#listMode").textContent = state.mode === "nonalc" ? "Pinte sans alcool" : "Pinte alcoolisée";

  const sorted = [...bars];
  if (state.sort === "price") sorted.sort((a,b) => priceFor(a) - priceFor(b));
  if (state.sort === "name")  sorted.sort((a,b) => a.name.localeCompare(b.name));
  if (state.sort === "hh")    sorted.sort((a,b) => (b.pintHH ? 1 : 0) - (a.pintHH ? 1 : 0) || priceFor(a)-priceFor(b));

  $("#listRows").innerHTML = sorted.map((b,i) => {
    const p = priceFor(b); const t = tier(p);
    const hh = b.pintHH ? `<span class="hh">HH ${eur(b.pintHH)}</span>` : "";
    return `<button class="list-row" data-bar-id="${b.id}">
      <span class="list-row__rank">${String(i+1).padStart(2,"0")}</span>
      <div class="list-row__main">
        <div class="list-row__name">${escapeHtml(b.name)}</div>
        <div class="list-row__meta"><span>${escapeHtml(b.address)}</span>${hh?`<span>${hh}</span>`:""}</div>
      </div>
      <span class="list-row__price t-${t.k}">${eur(p)}</span>
    </button>`;
  }).join("");
}
$$("[data-sort]").forEach(b => b.addEventListener("click", () => {
  state.sort = b.dataset.sort;
  $$("[data-sort]").forEach(x => x.classList.toggle("is-active", x === b));
  renderList();
}));

// ============== REPORT ==============
const QUOTES = {
  high: ["9 € la pinte ? T'es sûr que c'est pas un verre de vin ?", "C'est plus une pinte, c'est une taxe."],
  mid:  ["Prix correct. Suspect, même.", "Honnête. On en parle."],
  low:  ["Ça c'est une pinte. Solidarité.", "Dis-nous où, qu'on y aille tous."],
  none: ["Dis-moi que t'as pas payé 9 €. S'il te plaît."],
};
function pickQuote(p) {
  if (!p) return QUOTES.none[0];
  if (p >= 8) return QUOTES.high[Math.floor(Math.random()*QUOTES.high.length)];
  if (p <= 5) return QUOTES.low[Math.floor(Math.random()*QUOTES.low.length)];
  return QUOTES.mid[Math.floor(Math.random()*QUOTES.mid.length)];
}
function openReport(id) {
  const b = id ? BARS.find(x => x.id === id) : null;
  state.selectedBarId = b?.id || null;
  $("#mrBarName").textContent = b ? b.name : "(choisis un bar)";
  $("#priceInput").value = "";
  $("#hhField").checked = b ? isHHActive(b) : false;
  $$("input[name=fmt]").forEach(r => r.checked = r.value === "50");
  $("#newBarForm").hidden = true;
  $("#newBarName").value = "";
  $("#newBarAddr").value = "";
  $("#mrQuote").textContent = pickQuote(null);
  $("#reportModal").hidden = false;
  requestAnimationFrame(() => $("#reportModal").classList.add("is-open"));
  setTimeout(() => $("#priceInput").focus(), 380);
}
function closeReport() {
  $("#reportModal").classList.remove("is-open");
  setTimeout(() => $("#reportModal").hidden = true, 320);
}
$$("[data-close-report]").forEach(b => b.addEventListener("click", closeReport));
$("#priceInput").addEventListener("input", (e) => { $("#mrQuote").textContent = pickQuote(parseFloat(e.target.value)); });
$("#wrongBar").addEventListener("click", (e) => { e.preventDefault(); $("#newBarForm").hidden = !$("#newBarForm").hidden; });

$("#submitReport").addEventListener("click", async () => {
  const p = parseFloat($("#priceInput").value);
  if (!p || p <= 0 || p > 50) { toast("Ce prix me semble louche."); return; }
  const fmtVal = $("input[name=fmt]:checked")?.value || "50";
  const isHH = $("#hhField").checked;
  const newBarName = $("#newBarName").value.trim();
  const newBarAddr = $("#newBarAddr").value.trim();

  let bar = BARS.find(x => x.id === state.selectedBarId);
  let createdNewBar = false;

  // Si l'utilisateur a renseigné un nouveau bar, on l'insère d'abord
  if (!$("#newBarForm").hidden && newBarName) {
    const { data: ins, error: insErr } = await sb.from('bars').insert({
      name: newBarName,
      address: newBarAddr || "Annecy",
      lat: 45.8992, lng: 6.1294,
      pint_normal: p,
      has_non_alc: false,
    }).select().single();
    if (insErr) { toast("Erreur sur l'ajout du bar."); console.error(insErr); return; }
    bar = mapBarFromDb(ins);
    BARS.push(bar);
    createdNewBar = true;
  }

  if (!bar) { toast("Choisis un bar d'abord."); return; }

  const btn = $("#submitReport");
  btn.disabled = true; btn.textContent = "Envoi…";

  const { error } = await sb.from('reports').insert({
    bar_id: bar.id, price: p, format: parseInt(fmtVal),
    is_hh: isHH, device_id: state.device, status: 'pending',
  });

  btn.disabled = false; btn.textContent = "Envoyer";

  if (error) { toast("Erreur réseau. Réessaie."); console.error(error); return; }

  state.reports++;
  const old = bar.pintNormal;
  const previewAvg = +(((old * 4) + p) / 5).toFixed(2);
  $("#effectFrom").textContent = eur(old);
  $("#effectTo").textContent = eur(previewAvg);
  $("#effectBar").textContent = `au ${bar.name}`;
  $("#confirmQuote").textContent = createdNewBar
    ? "Nouveau bar ajouté. Merci."
    : p >= 8 ? "Courageux d'avouer ça. Bien."
    : p <= 5 ? "Solidarité. L'index te remercie."
    : "L'indice vient de gagner un peu en précision.";
  closeReport();
  $("#confirm").hidden = false;
  renderProfile();
  if (createdNewBar) renderPins();
});

// ============== LANDING ==============
function renderLanding() {
  const nonAlc = BARS.filter(b => b.hasNonAlc);
  const top3 = [...nonAlc].sort((a,b) => a.nonAlcPrice - b.nonAlcPrice).slice(0,3);
  $("#landingEyebrow").textContent = `/ sans alcool · ${nonAlc.length}`;
  $("#landingRows").innerHTML = top3.map((b,i) =>
    `<button class="list-row" data-bar-id="${b.id}" style="border-color:var(--line-soft)">
      <span class="list-row__rank">${String(i+1).padStart(2,"0")}</span>
      <div class="list-row__main">
        <div class="list-row__name">${escapeHtml(b.name)}</div>
        <div class="list-row__meta"><span>${escapeHtml(b.address)}</span><span>0,0 %</span></div>
      </div>
      <span class="list-row__price" style="color:var(--moss)">${eur(b.nonAlcPrice)}</span>
    </button>`
  ).join("");
}

// ============== ADMIN ==============
function openAdmin() {
  if (sessionStorage.getItem("abi:admin") === "1") {
    $("#admin").hidden = false; $("#admGate").hidden = true; renderAdmin();
  } else {
    $("#admGate").hidden = false; $("#admin").hidden = true;
    setTimeout(() => $("#admPwd").focus(), 100);
  }
}
$("#admEnter").addEventListener("click", () => {
  if ($("#admPwd").value.toLowerCase().trim() === "annecy") {
    sessionStorage.setItem("abi:admin","1");
    $("#admGate").hidden = true; $("#admin").hidden = false; renderAdmin();
  } else { toast("Nope."); }
});
$("#admPwd").addEventListener("keypress", (e) => { if (e.key === "Enter") $("#admEnter").click(); });

async function renderAdmin() {
  const { data: pending, error } = await sb.from('reports')
    .select('*, bars(name)').eq('status', 'pending').order('created_at', { ascending: false });

  if (error) { toast("Erreur admin"); console.error(error); return; }

  const reports = pending || [];
  $("#admStatSignals").textContent = reports.length;
  $("#admStatBars").textContent = BARS.length;
  $("#admPendCount").textContent = reports.length;
  $("#admBarCount").textContent = 0;

  if (reports.length > 0) {
    const now = Date.now();
    const avgMs = reports.reduce((s, r) => s + (now - new Date(r.created_at).getTime()), 0) / reports.length;
    $("#admStatDelay").textContent = avgMs < 3600000
      ? `${Math.round(avgMs/60000)} min`
      : `${(avgMs/3600000).toFixed(1)}h`;
  } else {
    $("#admStatDelay").textContent = "—";
  }

  $("#admBars").innerHTML = `<p style="font-family:var(--mono);font-size:11px;color:#8a8275;">Aucun nouveau bar en attente.</p>`;
  $("#admPending").innerHTML = reports.length === 0
    ? `<p style="font-family:var(--mono);font-size:11px;color:#8a8275;">Aucun signalement en attente.</p>`
    : reports.map(r => {
        const barName = r.bars?.name || "—";
        const flag = r.price >= 9 || r.price <= 4 ? `<b>· ⚑ aberrant</b>` : "";
        const ts = new Date(r.created_at).toLocaleString('fr-FR', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' });
        return `<div class="admin-row" data-rep="${r.id}" data-bar="${r.bar_id}">
          <div>
            <div class="admin-row__bar">${escapeHtml(barName)}</div>
            <div class="admin-row__meta">${eur(r.price)} · ${r.format}cl ${r.is_hh?"· HH":""} · ${ts} · ${escapeHtml(r.device_id || "—")} ${flag}</div>
          </div>
          <div class="admin-row__actions">
            <button class="admin-btn admin-btn--ok" data-action="approve">Valider</button>
            <button class="admin-btn admin-btn--no" data-action="reject">Rejeter</button>
          </div>
        </div>`;
      }).join("");

  $$("#admPending .admin-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const row = e.currentTarget.closest(".admin-row");
      const repId = row.dataset.rep;
      const barId = +row.dataset.bar;
      const action = e.currentTarget.dataset.action;
      row.querySelectorAll(".admin-btn").forEach(b => b.disabled = true);

      if (action === "approve") {
        await sb.from('reports').update({ status: 'approved' }).eq('id', repId);
        const { data: approved } = await sb.from('reports')
          .select('price').eq('bar_id', barId).eq('status', 'approved')
          .order('created_at', { ascending: false }).limit(5);
        if (approved?.length) {
          const avg = approved.reduce((s, r) => s + r.price, 0) / approved.length;
          await sb.from('bars').update({
            pint_normal: +avg.toFixed(2),
            last_update: new Date().toISOString().slice(0,10),
          }).eq('id', barId);
          const bar = BARS.find(b => b.id === barId);
          if (bar) { bar.pintNormal = +avg.toFixed(2); bar.lastUpdate = new Date().toISOString().slice(0,10); }
          renderTopChip(); renderPins();
        }
      } else {
        await sb.from('reports').update({ status: 'rejected' }).eq('id', repId);
      }
      row.style.transition = "opacity .25s, transform .25s";
      row.style.opacity = "0"; row.style.transform = "translateX(40px)";
      setTimeout(() => row.remove(), 260);
    });
  });
}

// ============== PROFILE ==============
function renderProfile() {
  $("#reportsCount").textContent = state.reports;
  $("#favsCount").textContent = state.favs.length;
  $("#profileNick").textContent = state.nick || "l'inconnu";
  if ($("#nickInput").value !== state.nick) $("#nickInput").value = state.nick;
  $("#prefModeVal").textContent = state.mode === "nonalc" ? "Pintes sans alcool" : "Pintes alcoolisées";
  if (state.favs.length === 0) {
    $("#favsList").innerHTML = `<p class="fav-empty">Aucun pour l'instant. Tape sur le ❤ d'un bar.</p>`;
  } else {
    $("#favsList").innerHTML = state.favs.map(id => {
      const b = BARS.find(x => x.id === id); if (!b) return "";
      return `<div class="fav-row">
        <span class="fav-row__name">${escapeHtml(b.name)}</span>
        <span class="fav-row__price">${eur(b.pintNormal)}</span>
        <button class="fav-row__rm" data-rm-fav="${b.id}" aria-label="Retirer">✕</button>
      </div>`;
    }).join("");
    $$("[data-rm-fav]").forEach(x => x.addEventListener("click", () => {
      state.favs = state.favs.filter(z => z !== +x.dataset.rmFav);
      localStorage.setItem(LS.favs, JSON.stringify(state.favs));
      renderProfile();
    }));
  }
}
$("#nickInput").addEventListener("input", (e) => {
  state.nick = e.target.value;
  localStorage.setItem(LS.nick, state.nick);
  $("#profileNick").textContent = state.nick || "l'inconnu";
});
$("#prefMode").addEventListener("click", () => {
  state.mode = state.mode === "alc" ? "nonalc" : "alc";
  localStorage.setItem(LS.mode, state.mode);
  updateChips(); renderProfile(); renderPins(); renderTopChip();
  toast(state.mode === "nonalc" ? "OK. Mode 0,0 % par défaut." : "Mode pinte alcoolisée par défaut.");
});
$("#prefRedo").addEventListener("click", () => { localStorage.removeItem(LS.introDone); $("#onb").hidden = false; });
$("#prefLanding").addEventListener("click", () => { $("#landing").hidden = false; });
$("#prefAdmin").addEventListener("click", () => openAdmin());

// ============== INIT ==============
async function init() {
  const ok = await fetchBars();
  await fetchMyReportCount();
  const h = location.hash.replace("#","");
  if (h === "admin") openAdmin();
  else if (h === "sans-alcool" || h === "landing") { $("#landing").hidden = false; }
  else if (["carte","liste","moi"].includes(h)) setTab(h);
  else setTab("carte");
  if (!localStorage.getItem(LS.introDone) && !h) { $("#onb").hidden = false; }
  renderTopChip(); renderProfile(); renderLanding(); updateChips(); initMap();
  if (!ok) toast("Données indisponibles. Réessaie plus tard.");
}
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", () => {
  const h = location.hash.replace("#","");
  if (h === "admin") openAdmin();
  else if (h === "sans-alcool" || h === "landing") $("#landing").hidden = false;
  else if (["carte","liste","moi"].includes(h)) setTab(h);
});
