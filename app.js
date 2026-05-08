/* =========================================================
   ABI v3 — fanzine FR · 3 onglets · simple
   ========================================================= */
const BARS = [
  { id:1,  name:"Le Captain Pub",     address:"11 Fbg des Annonciades", lat:45.8992, lng:6.1294, pintNormal:5.50, pintHH:4.00, hhStart:"18:00", hhEnd:"20:00", lastUpdate:"2026-05-05", hasNonAlc:true,  nonAlcPrice:4.50 },
  { id:2,  name:"Le Munich",          address:"1 Quai Perrière",        lat:45.8989, lng:6.1283, pintNormal:6.20, pintHH:5.00, hhStart:"17:00", hhEnd:"19:00", lastUpdate:"2026-05-06", hasNonAlc:true,  nonAlcPrice:5.00 },
  { id:3,  name:"Le Pâquier Café",    address:"Av. d'Albigny",          lat:45.9024, lng:6.1349, pintNormal:9.00, pintHH:null, hhStart:null,    hhEnd:null,    lastUpdate:"2026-05-04", hasNonAlc:false },
  { id:4,  name:"Le Verre des Alpes", address:"Rue Carnot",             lat:45.8978, lng:6.1267, pintNormal:7.50, pintHH:5.50, hhStart:"18:30", hhEnd:"20:30", lastUpdate:"2026-05-03", hasNonAlc:true,  nonAlcPrice:4.80 },
  { id:5,  name:"Le Snug",            address:"13 Rue Grenette",        lat:45.8985, lng:6.1278, pintNormal:6.50, pintHH:4.50, hhStart:"17:30", hhEnd:"19:30", lastUpdate:"2026-05-07", hasNonAlc:false },
  { id:6,  name:"Finn Kelly's",       address:"10 Fbg des Balmettes",   lat:45.8961, lng:6.1271, pintNormal:7.00, pintHH:5.00, hhStart:"17:00", hhEnd:"20:00", lastUpdate:"2026-05-06", hasNonAlc:true,  nonAlcPrice:5.50 },
  { id:7,  name:"L'Esquisse",         address:"21 Rue Royale",          lat:45.8998, lng:6.1302, pintNormal:5.80, pintHH:null, hhStart:null,    hhEnd:null,    lastUpdate:"2026-05-05", hasNonAlc:false },
  { id:8,  name:"La Verrière",        address:"Quartier des Marquisats",lat:45.8949, lng:6.1324, pintNormal:8.00, pintHH:6.50, hhStart:"18:00", hhEnd:"19:30", lastUpdate:"2026-05-07", hasNonAlc:true,  nonAlcPrice:5.50 },
  { id:9,  name:"Le Woodstock",       address:"7 Quai Eustache Chappuis",lat:45.9003,lng:6.1311, pintNormal:6.80, pintHH:4.80, hhStart:"17:00", hhEnd:"20:00", lastUpdate:"2026-05-04", hasNonAlc:false },
  { id:10, name:"La Coloc",           address:"Rue Sommeiller",         lat:45.8995, lng:6.1289, pintNormal:6.60, pintHH:4.50, hhStart:"18:00", hhEnd:"21:00", lastUpdate:"2026-05-06", hasNonAlc:true,  nonAlcPrice:4.50 },
];

const LS = { introDone:"abi:introDone", mode:"abi:mode", reports:"abi:reports", favs:"abi:favs", nick:"abi:nick", device:"abi:device" };
const state = {
  tab: "carte",
  mode: localStorage.getItem(LS.mode) || "alc",
  hhFilter: false,
  selectedBarId: null,
  reports: +(localStorage.getItem(LS.reports) || 0),
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
const isHHActive = (b) => {
  if (!b.hhStart || !b.hhEnd) return false;
  const n = 18*60 + 30; // demo
  return n >= parseHM(b.hhStart) && n < parseHM(b.hhEnd);
};
const minsHH = (b) => {
  if (!b.hhStart) return null;
  const n = 18*60 + 30;
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

function computeIndex() {
  const list = state.mode === "nonalc" ? BARS.filter(b => b.hasNonAlc).map(b => b.nonAlcPrice) : BARS.map(b => b.pintNormal);
  const avg = list.reduce((a,b)=>a+b,0) / list.length;
  return { today: avg, yesterday: avg + 0.12, delta: avg - (avg + 0.12) };
}

// ============== TABS ==============
function setTab(name) {
  state.tab = name;
  $$(".screen[data-tab]").forEach(s => s.hidden = s.dataset.tab !== name);
  $$(".tab[data-go-tab]").forEach(b => b.classList.toggle("is-active", b.dataset.goTab === name));
  $("#landing").hidden = name !== "landing";
  if (name !== "admin") $("#admin").hidden = true;
  if (name === "carte") setTimeout(() => map && map.invalidateSize(), 60);
  if (name === "liste") renderList();
  if (["carte","liste","moi"].includes(name)) history.replaceState(null,"",`#${name}`);
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-go-tab]");
  if (!btn) return;
  $("#confirm").hidden = true;
  $("#admGate").hidden = true;
  const t = btn.dataset.goTab;
  if (t === "landing") { $("#landing").hidden = false; return; }
  if (t === "admin") { openAdmin(); return; }
  $("#landing").hidden = true; $("#admin").hidden = true;
  setTab(t);
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
  $("#idxChipPrice").textContent = eur(i.today);
  const up = i.delta > 0;
  $("#idxChipDelta").textContent = `${up?"▲":"▼"} ${fmt(Math.abs(i.delta))}`;
  $("#idxChipDelta").className = `pct ${up?"up":"down"}`;
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
function openSheet(id) {
  const b = BARS.find(x => x.id === id);
  if (!b) return;
  state.selectedBarId = id;
  const price = priceFor(b);
  const t = tier(price);
  const hh = minsHH(b);
  const isFav = state.favs.includes(id);
  const days = Math.max(0, Math.round((Date.now() - new Date(b.lastUpdate).getTime()) / 86400000));
  const ago = days === 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} jours`;

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
          <h2>${b.name}</h2>
          <div class="bar-head__addr">${b.address} · ~${(Math.random()*0.6+0.2).toFixed(1)} km</div>
        </div>
        <button class="bar-fav ${isFav?"is-on":""}" id="favBtn"><svg viewBox="0 0 24 24" width="18" height="18" fill="${isFav?"currentColor":"none"}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z"/></svg></button>
      </div>
    </div>
    <div class="price-row">
      <div>
        <div class="price-row__label">${state.mode === "nonalc" ? "Pinte 0,0 %" : "Pinte (50 cl)"}</div>
        <div class="price-row__val"><span class="cur">€</span>${fmt(price)}</div>
      </div>
      <span class="price-row__tier t-${t.k}">${t.label}</span>
    </div>
    <div class="price-update">Mis à jour ${ago} · par un contributeur anonyme</div>
    ${hhCard}
    <div class="bar-actions">
      <button class="btn btn--ghost" id="dirBtn">↗ Itinéraire</button>
      <button class="btn btn--terra" id="reportFromBar">+ Signaler</button>
    </div>
    <div class="bar-foot">// les 5 derniers signalements sont moyennés</div>
  `;
  $("#sheetWrap").hidden = false;
  $("#favBtn").addEventListener("click", () => {
    if (state.favs.includes(id)) state.favs = state.favs.filter(x => x !== id);
    else state.favs.push(id);
    localStorage.setItem(LS.favs, JSON.stringify(state.favs));
    openSheet(id); renderProfile();
  });
  $("#dirBtn").addEventListener("click", () => toast("Ouvre l'app Plans en vrai."));
  $("#reportFromBar").addEventListener("click", () => { closeSheet(); openReport(id); });
}
function closeSheet() { $("#sheetWrap").hidden = true; }
$$("[data-close-sheet]").forEach(b => b.addEventListener("click", closeSheet));

// ============== LISTE ==============
function renderList() {
  const idx = computeIndex();
  const bars = visibleBars();
  const prices = bars.map(b => priceFor(b));
  $("#listAvg").textContent = eur(idx.today);
  $("#listMin").textContent = eur(Math.min(...prices));
  $("#listMax").textContent = eur(Math.max(...prices));
  $("#listCount").textContent = bars.length;
  $("#listMode").textContent = state.mode === "nonalc" ? "Pinte sans alcool" : "Pinte alcoolisée";

  let sorted = [...bars];
  if (state.sort === "price") sorted.sort((a,b) => priceFor(a) - priceFor(b));
  if (state.sort === "name") sorted.sort((a,b) => a.name.localeCompare(b.name));
  if (state.sort === "hh") sorted.sort((a,b) => (b.pintHH ? 1 : 0) - (a.pintHH ? 1 : 0) || priceFor(a)-priceFor(b));

  $("#listRows").innerHTML = sorted.map((b,i) => {
    const p = priceFor(b);
    const t = tier(p);
    const hh = b.pintHH ? `<span class="hh">HH ${eur(b.pintHH)}</span>` : "";
    return `
      <button class="list-row" data-bar-id="${b.id}">
        <span class="list-row__rank">${String(i+1).padStart(2,"0")}</span>
        <div class="list-row__main">
          <div class="list-row__name">${b.name}</div>
          <div class="list-row__meta"><span>${b.address}</span>${hh ? `<span>${hh}</span>` : ""}</div>
        </div>
        <span class="list-row__price t-${t.k}">${eur(p)}</span>
      </button>
    `;
  }).join("");
}
$$("[data-sort]").forEach(b => b.addEventListener("click", () => {
  state.sort = b.dataset.sort;
  $$("[data-sort]").forEach(x => x.classList.toggle("is-active", x === b));
  renderList();
}));

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-bar-id]");
  if (!btn) return;
  openSheet(+btn.dataset.barId);
});

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
  const b = id ? BARS.find(x => x.id === id) : BARS[0];
  state.selectedBarId = b?.id || null;
  $("#mrBarName").textContent = b ? b.name : "un bar d'Annecy";
  $("#priceInput").value = "";
  $("#hhField").checked = isHHActive(b || {});
  $$("input[name=fmt]").forEach(r => r.checked = r.value === "50");
  $("#newBarForm").hidden = true;
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
$("#submitReport").addEventListener("click", () => {
  const p = parseFloat($("#priceInput").value);
  if (!p || p <= 0 || p > 50) { toast("Ce prix me semble louche."); return; }
  state.reports++;
  localStorage.setItem(LS.reports, String(state.reports));
  const b = BARS.find(x => x.id === state.selectedBarId) || BARS[0];
  const old = b.pintNormal;
  const upd = +(((old * 4) + p) / 5).toFixed(2);
  $("#effectFrom").textContent = eur(old);
  $("#effectTo").textContent = eur(upd);
  $("#effectBar").textContent = `au ${b.name}`;
  $("#confirmQuote").textContent = p >= 8 ? "Courageux d'avouer ça. Bien." : p <= 5 ? "Solidarité. L'index te remercie." : "L'indice vient de gagner un peu en précision.";
  closeReport();
  $("#confirm").hidden = false;
  b.pintNormal = upd;
  renderTopChip(); renderPins(); renderProfile();
});

// ============== LANDING ==============
function renderLanding() {
  const top3 = BARS.filter(b => b.hasNonAlc).sort((a,b) => a.nonAlcPrice - b.nonAlcPrice).slice(0,3);
  $("#landingRows").innerHTML = top3.map((b,i) => {
    const t = tier(b.nonAlcPrice);
    return `
      <button class="list-row" data-bar-id="${b.id}" style="border-color:var(--line-soft)">
        <span class="list-row__rank">${String(i+1).padStart(2,"0")}</span>
        <div class="list-row__main">
          <div class="list-row__name">${b.name}</div>
          <div class="list-row__meta"><span>${b.address}</span><span>0,0 %</span></div>
        </div>
        <span class="list-row__price" style="color: var(--moss)">${eur(b.nonAlcPrice)}</span>
      </button>
    `;
  }).join("");
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
const PEND = [
  { id:"r1", barId:1, price:5.20, fmt:"50", hh:false, ts:"il y a 2 min",  device:"abi-7f3a" },
  { id:"r2", barId:8, price:8.50, fmt:"50", hh:false, ts:"il y a 14 min", device:"abi-9k2c" },
  { id:"r3", barId:5, price:4.50, fmt:"50", hh:true,  ts:"il y a 38 min", device:"abi-1b9e" },
  { id:"r4", barId:3, price:9.50, fmt:"50", hh:false, ts:"il y a 1 h",    device:"abi-aa11" },
  { id:"r5", barId:10,price:6.50, fmt:"33", hh:false, ts:"il y a 2 h",    device:"abi-cc44" },
];
const NEWBARS = [
  { id:"b1", name:"Le Cantal",  address:"Rue Vaugelas, Annecy", ts:"il y a 22 min", device:"abi-x1" },
  { id:"b2", name:"L'Éternel", address:"Bd Taine, Annecy",     ts:"il y a 1 h",    device:"abi-x2" },
];
function renderAdmin() {
  $("#admStatSignals").textContent = PEND.length + state.reports;
  $("#admStatBars").textContent = BARS.length;
  $("#admPendCount").textContent = PEND.length;
  $("#admBarCount").textContent = NEWBARS.length;
  $("#admPending").innerHTML = PEND.map(r => {
    const b = BARS.find(x => x.id === r.barId);
    const flag = r.price >= 9 || r.price <= 4 ? `<b>· ⚑ aberrant</b>` : "";
    return `<div class="admin-row" data-rep="${r.id}"><div><div class="admin-row__bar">${b?.name||"—"}</div><div class="admin-row__meta">${eur(r.price)} · ${r.fmt}cl ${r.hh?"· HH":""} · ${r.ts} · ${r.device} ${flag}</div></div><div class="admin-row__actions"><button class="admin-btn admin-btn--ok">Valider</button><button class="admin-btn admin-btn--no">Rejeter</button></div></div>`;
  }).join("");
  $("#admBars").innerHTML = NEWBARS.map(b => `<div class="admin-row"><div><div class="admin-row__bar">${b.name}</div><div class="admin-row__meta">${b.address} · ${b.ts} · ${b.device}</div></div><div class="admin-row__actions"><button class="admin-btn admin-btn--ok">Approuver</button><button class="admin-btn admin-btn--no">Rejeter</button></div></div>`).join("");
  $$("#admPending .admin-btn, #admBars .admin-btn").forEach(b => b.addEventListener("click", (e) => {
    const row = e.currentTarget.closest(".admin-row");
    row.style.transition = "opacity .25s, transform .25s";
    row.style.opacity = "0"; row.style.transform = "translateX(40px)";
    setTimeout(() => row.remove(), 260);
  }));
}

// ============== PROFILE ==============
function renderProfile() {
  $("#reportsCount").textContent = state.reports;
  $("#favsCount").textContent = state.favs.length;
  $("#profileNick").textContent = state.nick || "l'inconnu";
  $("#nickInput").value = state.nick;
  $("#prefModeVal").textContent = state.mode === "nonalc" ? "Pintes sans alcool" : "Pintes alcoolisées";
  if (state.favs.length === 0) {
    $("#favsList").innerHTML = `<p class="fav-empty">Aucun pour l'instant. Tape sur le ❤ d'un bar.</p>`;
  } else {
    $("#favsList").innerHTML = state.favs.map(id => {
      const b = BARS.find(x => x.id === id);
      if (!b) return "";
      return `<div class="fav-row"><span class="fav-row__name">${b.name}</span><span class="fav-row__price">${eur(b.pintNormal)}</span><button class="fav-row__rm" data-rm-fav="${b.id}">✕</button></div>`;
    }).join("");
    $$("[data-rm-fav]").forEach(x => x.addEventListener("click", () => {
      const id = +x.dataset.rmFav;
      state.favs = state.favs.filter(z => z !== id);
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
$("#prefLanding").addEventListener("click", () => { setTab("liste"); $("#landing").hidden = false; });
$("#prefAdmin").addEventListener("click", () => openAdmin());

// ============== INIT ==============
function init() {
  const h = location.hash.replace("#","");
  if (h === "admin") openAdmin();
  else if (h === "sans-alcool" || h === "landing") { $("#landing").hidden = false; }
  else if (["carte","liste","moi"].includes(h)) setTab(h);
  else setTab("carte");
  if (!localStorage.getItem(LS.introDone) && !h) { $("#onb").hidden = false; }
  renderTopChip(); renderProfile(); renderLanding(); updateChips(); initMap();
}
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", () => {
  const h = location.hash.replace("#","");
  if (h === "admin") openAdmin();
  else if (h === "sans-alcool" || h === "landing") $("#landing").hidden = false;
  else if (["carte","liste","moi"].includes(h)) setTab(h);
});
