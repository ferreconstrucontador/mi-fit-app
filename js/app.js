/* =========================================================================
   MiFitApp · app.js
   Lógica principal: almacenamiento, navegación nativa (History API), temas,
   perfil, gimnasio, rutina (offline + Gemini), entrenador en vivo
   (cronómetro, voz, vibración, Wake Lock, RPE), progreso, respaldo y tour.
   ========================================================================= */
(function () {
  'use strict';

  const APP_VERSION = '1.2.0'; // Mantener igual a VERSION en sw.js
  const HOME_TAB = 'rutina';   // Pestaña principal: "Atrás" regresa aquí antes de salir
  const TABS = ['perfil', 'gimnasio', 'rutina', 'entrenador', 'progreso'];
  const DB = window.MiFitDB;
  const { Avatar, propsFor, CHARS, GROUPS, ACCENTS } = window.MiFitAvatar;

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const hhmmss = ms => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); return h ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  const fmtFecha = (k, opt = { day: 'numeric', month: 'short' }) => new Date(k + 'T12:00:00').toLocaleDateString('es-MX', opt);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---------- localStorage ----------
  const K = {
    profile: 'mifit_profile', equip: 'mifit_equip', settings: 'mifit_settings', tab: 'mifit_activeTab',
    theme: 'mifit_theme', routine: 'mifit_routine', prog: 'mifit_prog', travel: 'mifit_travel',
    lastBackup: 'mifit_lastBackup', lastActivity: 'mifit_lastActivity', lastReminder: 'mifit_lastReminder', welcomed: 'mifit_welcomed'
  };
  const LS = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('⚠️ No se pudo guardar en el dispositivo'); } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
  };

  const DEF_PROFILE = { edad: 30, sexo: 'm', peso: 70, estatura: 170, nivel: 'principiante', dias: 3, objetivo: 'hipertrofia', lesiones: [] };
  const DEF_SETTINGS = { genero: 'm', personaje: '', acento: 'naranja', enfoque: false, voz: true, vibra: true, beep: true, duracion: 30, apiKey: '', sesion: 0 };

  const S = {
    profile: Object.assign({}, DEF_PROFILE, LS.get(K.profile, {})),
    equip: LS.get(K.equip, ['tapete']),
    settings: Object.assign({}, DEF_SETTINGS, LS.get(K.settings, {})),
    prog: LS.get(K.prog, {}),
    travel: LS.get(K.travel, null),
    routine: LS.get(K.routine, null),
    tab: HOME_TAB,
    routineDirty: false,
    workouts: [],
    metrics: [],
    calOffset: 0,
    chartMetric: 'peso'
  };
  // Entrenador elegido (migra el antiguo ajuste masculino/femenino)
  if (!CHARS.some(c => c.id === S.settings.personaje)) S.settings.personaje = S.settings.genero === 'f' ? 'atleta_f' : 'atleta_m';
  if (!ACCENTS.some(a => a.id === S.settings.acento)) S.settings.acento = 'naranja';
  const charById = id => CHARS.find(c => c.id === id) || CHARS[0];
  const avOpts = () => ({ char: S.settings.personaje, accent: S.settings.acento });
  const saveProfile = () => { LS.set(K.profile, S.profile); S.routineDirty = true; };
  const saveSettings = () => LS.set(K.settings, S.settings);
  const travelActive = () => S.travel && S.travel.fecha === dayKey();
  const equipoEfectivo = () => (travelActive() ? S.travel.equipo : S.equip);

  // ---------- IndexedDB (MiFitDB) ----------
  const IDB = {
    db: null,
    open() {
      return new Promise((res) => {
        if (!('indexedDB' in window)) return res(null);
        const rq = indexedDB.open('MiFitDB', 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          if (!db.objectStoreNames.contains('workouts')) db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
          if (!db.objectStoreNames.contains('metrics')) db.createObjectStore('metrics', { keyPath: 'fecha' });
          if (!db.objectStoreNames.contains('mirror')) db.createObjectStore('mirror', { keyPath: 'day' });
        };
        rq.onsuccess = () => { IDB.db = rq.result; res(rq.result); };
        rq.onerror = () => res(null);
      });
    },
    tx(store, mode, fn) {
      return new Promise((res, rej) => {
        if (!IDB.db) return res(null);
        const t = IDB.db.transaction(store, mode); const st = t.objectStore(store);
        const r = fn(st);
        t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
        t.onerror = () => rej(t.error);
      });
    },
    all: s => IDB.tx(s, 'readonly', st => st.getAll()).then(r => r || []),
    put: (s, v) => IDB.tx(s, 'readwrite', st => st.put(v)),
    del: (s, k) => IDB.tx(s, 'readwrite', st => st.delete(k)),
    clear: s => IDB.tx(s, 'readwrite', st => st.clear())
  };

  // ---------- Toast / Banner ----------
  let toastT;
  function toast(msg, ms = 2200) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- Tema ----------
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(pref) {
    const dark = pref === 'dark' || (pref === 'auto' && mq.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme-pref', pref);
    $('#metaTheme').setAttribute('content', dark ? '#0b0e13' : '#f3f5f8');
    $('#themeIcon').textContent = pref === 'light' ? '☀️' : pref === 'dark' ? '🌙' : '🌓';
    $$('#sTema button').forEach(b => b.classList.toggle('on', b.dataset.v === pref));
  }
  function setTheme(pref) { LS.set(K.theme, pref); try { localStorage.setItem(K.theme, pref); } catch (e) { /* */ } applyTheme(pref); }
  const themePref = () => { try { return localStorage.getItem(K.theme) || 'auto'; } catch (e) { return 'auto'; } };
  mq.addEventListener && mq.addEventListener('change', () => { if (themePref() === 'auto') applyTheme('auto'); });

  // =========================================================================
  //  NAVEGACIÓN NATIVA (History API)
  //  - Cada modal / reproductor / tour agrega una entrada al historial.
  //  - "Atrás" cierra primero la capa superior, luego vuelve a la pestaña
  //    principal y solo después sale de la app.
  // =========================================================================
  const overlays = []; // pila de capas abiertas
  let ignorePop = 0;

  function renderTab(t) {
    if (!TABS.includes(t)) t = HOME_TAB;
    const prev = S.tab;
    S.tab = t;
    $$('.tab').forEach(s => { s.hidden = s.dataset.tab !== t; });
    $$('.bottom-nav button').forEach(b => { const on = b.dataset.nav === t; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    LS.set(K.tab, t);
    if (prev !== t) window.scrollTo({ top: 0 });
    onTabShown(t, prev);
  }
  function goTab(t) {
    if (t === S.tab) return;
    const st = history.state || {};
    if (t === HOME_TAB) {
      if (st.lvl === 'tab') { history.back(); return; }
      renderTab(t);
    } else {
      if (st.lvl === 'tab') history.replaceState({ lvl: 'tab', tab: t }, '');
      else history.pushState({ lvl: 'tab', tab: t }, '');
      renderTab(t);
    }
  }
  function pushOverlay(name) { overlays.push(name); history.pushState({ lvl: 'overlay', name }, ''); }
  function swapOverlay(from, to) {
    const i = overlays.lastIndexOf(from);
    if (i >= 0) overlays[i] = to; else overlays.push(to);
    history.replaceState({ lvl: 'overlay', name: to }, '');
  }
  function popOverlayUI() { if (overlays.length) history.back(); }

  window.addEventListener('popstate', (e) => {
    if (ignorePop > 0) { ignorePop--; return; }
    if (overlays.length) {
      const top = overlays[overlays.length - 1];
      if (top === 'player' && P.active) {
        // Primer "Atrás": preguntar. Segundo "Atrás" con el diálogo abierto: terminar y guardar.
        history.pushState({ lvl: 'overlay', name: 'player' }, '');
        if (!$('#plExit').hidden) { finishWorkout(true, true); return; }
        showExitDialog();
        return;
      }
      overlays.pop();
      closeLayer(top);
      return;
    }
    const st = e.state || {};
    renderTab(st.lvl === 'tab' ? st.tab : HOME_TAB);
  });

  function closeLayer(name) {
    if (name === 'modal') closeModalUI();
    else if (name === 'tour') endTourUI();
    else if (name === 'player') closePlayerUI();
  }

  // ---------- Modal ----------
  let modalOnClose = null, modalAvatars = [];
  function openModal(title, html, opts = {}) {
    const m = $('#modal');
    modalAvatars.forEach(a => a.destroy()); modalAvatars = [];
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    if (m.hidden) { m.hidden = false; pushOverlay('modal'); }
    modalOnClose = opts.onClose || null;
    $('#modalBody').scrollTop = 0;
    return $('#modalBody');
  }
  function closeModal() { if (overlays[overlays.length - 1] === 'modal') popOverlayUI(); }
  function closeModalUI() {
    $('#modal').hidden = true;
    modalAvatars.forEach(a => a.destroy()); modalAvatars = [];
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }

  // =========================================================================
  //  PESTAÑA 1 · PERFIL
  // =========================================================================
  function renderPerfil() {
    const p = S.profile;
    $('#pEdad').value = p.edad || ''; $('#pSexo').value = p.sexo; $('#pPeso').value = p.peso || ''; $('#pEstatura').value = p.estatura || '';
    setSeg('#pNivel', p.nivel); setSeg('#pDias', String(p.dias));
    $('#pObjetivo').innerHTML = Object.entries(DB.OBJETIVOS).map(([k, o]) =>
      `<button class="choice ${p.objetivo === k ? 'on' : ''}" data-v="${k}" role="radio" aria-checked="${p.objetivo === k}"><span class="ci">${o.i}</span><span><b>${o.n}</b><small>${o.d}</small></span></button>`).join('');
    const les = p.lesiones || [];
    $('#pLesiones').innerHTML = `<button class="chip none ${les.length ? '' : 'on'}" data-v="none">✅ Ninguna</button>` +
      DB.LESIONES.map(l => `<button class="chip ${les.includes(l.id) ? 'on' : ''}" data-v="${l.id}" aria-pressed="${les.includes(l.id)}">${l.i} ${l.n}</button>`).join('');
    const gp = $('#galeriaPerfil'); if (!gp._avs || !gp._avs.length) renderGallery(gp);
    $('#sVoz').checked = !!S.settings.voz; $('#sVibra').checked = !!S.settings.vibra; $('#sBeep').checked = !!S.settings.beep;
    $('#sApiKey').value = S.settings.apiKey || '';
    $('#keyStatus').textContent = S.settings.apiKey ? '🟢 Clave guardada en este dispositivo.' : '⚪ Sin clave: se usa el generador offline integrado.';
    renderBio();
    const lb = LS.get(K.lastBackup, 0);
    $('#lastBackupInfo').textContent = lb ? `Último respaldo: ${new Date(lb).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no has hecho un respaldo.';
    renderMirrors();
  }
  function renderBio() {
    const p = S.profile, kg = +p.peso, cm = +p.estatura, edad = +p.edad;
    if (!kg || !cm) { $('#bioStats').innerHTML = ''; return; }
    const imc = kg / ((cm / 100) ** 2);
    const cat = imc < 18.5 ? 'Bajo' : imc < 25 ? 'Saludable' : imc < 30 ? 'Sobrepeso' : 'Obesidad';
    const tmb = Math.round(10 * kg + 6.25 * cm - 5 * (edad || 30) + (p.sexo === 'f' ? -161 : 5));
    const agua = (kg * 0.035).toFixed(1);
    $('#bioStats').innerHTML = `<div class="stat"><b>${imc.toFixed(1)}</b><small>IMC · ${cat}</small></div><div class="stat"><b>${tmb}</b><small>kcal en reposo</small></div><div class="stat"><b>${agua} L</b><small>agua al día</small></div>`;
    const split = { 2: 'Cuerpo completo ×2', 3: 'Cuerpo completo ×3', 4: 'Superior / Inferior', 5: 'Sup · Inf · Empuje · Tirón · Piernas', 6: 'Empuje · Tirón · Piernas ×2' }[p.dias];
    $('#splitHint').textContent = p.objetivo === 'movilidad' ? 'Plan: sesiones de movilidad y control.' : `Plan semanal: ${split}`;
  }
  function setSeg(sel, v) { $$(sel + ' button').forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); }

  function bindPerfil() {
    const saveBio = debounce(() => {
      S.profile.edad = +$('#pEdad').value || ''; S.profile.peso = +$('#pPeso').value || ''; S.profile.estatura = +$('#pEstatura').value || '';
      S.profile.sexo = $('#pSexo').value; saveProfile(); renderBio(); toast('✔️ Perfil guardado');
    }, 600);
    ['#pEdad', '#pPeso', '#pEstatura', '#pSexo'].forEach(s => $(s).addEventListener('input', saveBio));
    $('#pNivel').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.profile.nivel = b.dataset.v; setSeg('#pNivel', b.dataset.v); saveProfile(); toast('✔️ Nivel actualizado'); });
    $('#pDias').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.profile.dias = +b.dataset.v; setSeg('#pDias', b.dataset.v); saveProfile(); renderBio(); });
    $('#pObjetivo').addEventListener('click', e => { const b = e.target.closest('.choice'); if (!b) return; S.profile.objetivo = b.dataset.v; saveProfile(); renderPerfil(); toast(`🎯 Objetivo: ${DB.OBJETIVOS[b.dataset.v].n}`); });
    $('#pLesiones').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      let l = S.profile.lesiones || [];
      if (b.dataset.v === 'none') l = []; else l = l.includes(b.dataset.v) ? l.filter(x => x !== b.dataset.v) : l.concat(b.dataset.v);
      S.profile.lesiones = l; saveProfile(); renderPerfil();
    });
    bindGallery($('#galeriaPerfil'));
    $('#sVoz').addEventListener('change', e => { S.settings.voz = e.target.checked; saveSettings(); });
    $('#sVibra').addEventListener('change', e => { S.settings.vibra = e.target.checked; saveSettings(); });
    $('#sBeep').addEventListener('change', e => { S.settings.beep = e.target.checked; saveSettings(); });
    $('#btnProbarVoz').addEventListener('click', () => { unlockAudio(); speak('¡Hola! Soy tu entrenador. Vamos a entrenar con todo.', true, true); beep(880); vibrate(80); });
    $('#sApiKey').addEventListener('input', debounce(() => { S.settings.apiKey = $('#sApiKey').value.trim(); saveSettings(); $('#keyStatus').textContent = S.settings.apiKey ? '🟢 Clave guardada en este dispositivo.' : '⚪ Sin clave.'; }, 500));
    $('#btnVerKey').addEventListener('click', () => { const i = $('#sApiKey'); i.type = i.type === 'password' ? 'text' : 'password'; });
    $('#btnBorrarKey').addEventListener('click', () => { S.settings.apiKey = ''; saveSettings(); $('#sApiKey').value = ''; $('#keyStatus').textContent = '⚪ Clave eliminada.'; });
    $('#btnProbarKey').addEventListener('click', async () => {
      S.settings.apiKey = $('#sApiKey').value.trim(); saveSettings();
      if (!S.settings.apiKey) { $('#keyStatus').textContent = 'Pega primero tu clave.'; return; }
      $('#keyStatus').textContent = '⏳ Probando conexión…';
      try { await gemini('Responde solo con el JSON {"ok":true}', 15000); $('#keyStatus').textContent = '🟢 ¡Conexión exitosa con Gemini!'; }
      catch (err) { $('#keyStatus').textContent = '🔴 ' + err.message; }
    });
    $('#sTema').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.v); });
    $('#btnExportar').addEventListener('click', exportBackup);
    $('#btnCompartir').addEventListener('click', shareBackup);
    $('#fileImport').addEventListener('change', importBackup);
    $('#btnReset').addEventListener('click', resetAll);
  }

  // =========================================================================
  //  PESTAÑA 2 · GIMNASIO
  // =========================================================================
  function equipoHTML(sel, fixedTxt) {
    return DB.EQUIPO.map(c => `<h3 class="eq-cat">${c.cat}</h3><div class="eq-grid">` + c.items.map(i => {
      const on = i.fixed || sel.includes(i.id);
      return `<button class="eq-card ${on ? 'on' : ''} ${i.fixed ? 'fixed' : ''}" data-id="${i.id}" aria-pressed="${on}" ${i.fixed ? 'disabled' : ''}><span class="ei">${i.i}</span><b>${i.n}</b><small>${i.fixed ? fixedTxt || i.d : i.d}</small></button>`;
    }).join('') + '</div>').join('');
  }
  function renderGimnasio() {
    $('#equipoLista').innerHTML = equipoHTML(S.equip);
    const n = S.equip.length + 1;
    const ej = DB.EJERCICIOS.filter(e => e.eq.every(q => q === 'corporal' || S.equip.includes(q))).length;
    $('#equipoResumen').textContent = `🧰 ${n} herramienta${n > 1 ? 's' : ''} · ${ej} ejercicios disponibles`;
    $('#travelInfo').textContent = travelActive() ? `🧳 Modo viaje activo hoy (${S.travel.equipo.length ? S.travel.equipo.map(i => DB.EQUIPO_NOMBRE[i]).join(', ') : 'solo peso corporal'}).` : '';
  }
  function bindGimnasio() {
    $('#equipoLista').addEventListener('click', e => {
      const b = e.target.closest('.eq-card'); if (!b || b.disabled) return;
      const id = b.dataset.id;
      S.equip = S.equip.includes(id) ? S.equip.filter(x => x !== id) : S.equip.concat(id);
      LS.set(K.equip, S.equip); S.routineDirty = true; renderGimnasio(); vibrate(15);
    });
    $('#btnViaje').addEventListener('click', openTravel);
  }
  function openTravel() {
    let sel = travelActive() ? S.travel.equipo.slice() : [];
    const body = openModal('🧳 Hoy solo tengo…', `<p class="hint">Elige lo que tienes hoy. Tu inventario de casa no se modifica.</p><div id="tvList">${equipoHTML(sel)}</div>
      <button class="btn btn-primary btn-lg" id="tvUse">⚡ Recalcular rutina de hoy</button>
      ${travelActive() ? '<button class="btn btn-ghost" id="tvOff">🏠 Volver a mi gimnasio</button>' : ''}`);
    body.querySelector('#tvList').addEventListener('click', e => {
      const b = e.target.closest('.eq-card'); if (!b || b.disabled) return;
      const id = b.dataset.id; sel = sel.includes(id) ? sel.filter(x => x !== id) : sel.concat(id);
      b.classList.toggle('on', sel.includes(id));
    });
    body.querySelector('#tvUse').addEventListener('click', () => {
      S.travel = { fecha: dayKey(), equipo: sel }; LS.set(K.travel, S.travel);
      generarOffline(true); closeModal(); renderGimnasio(); goTab('rutina'); toast('🧳 Rutina recalculada para hoy');
    });
    const off = body.querySelector('#tvOff');
    if (off) off.addEventListener('click', () => { S.travel = null; LS.del(K.travel); generarOffline(true); closeModal(); renderGimnasio(); toast('🏠 De vuelta a tu gimnasio'); });
  }

  // =========================================================================
  //  PESTAÑA 3 · RUTINA
  // =========================================================================
  function recientes() {
    const set = new Set();
    S.workouts.slice(-3).forEach(w => (w.ids || []).forEach(id => set.add(id)));
    return set;
  }
  function generarOffline(nueva) {
    const seed = nueva ? (Date.now() & 0x7fffffff) : DB.hash(dayKey() + '|' + S.settings.sesion);
    S.routine = DB.generarRutina(S.profile, equipoEfectivo(), {
      duracion: S.settings.duracion, indiceSesion: S.settings.sesion, semilla: seed, prog: S.prog, recientes: recientes()
    });
    S.routine.sesion = S.settings.sesion;
    S.routine.viaje = travelActive();
    LS.set(K.routine, S.routine); S.routineDirty = false;
    renderRutina();
  }
  function ensureRoutine() {
    const r = S.routine;
    if (!r || !r.items || !r.items.length || r.fecha !== dayKey() || r.sesion !== S.settings.sesion || S.routineDirty || r.duracion !== S.settings.duracion || !!r.viaje !== !!travelActive()) generarOffline(false);
  }

  function itemMeta(it) {
    if (it.mode === 'time') return `${it.sets > 1 ? it.sets + ' × ' : ''}${it.secs}s`;
    return `${it.sets} × ${it.reps} reps`;
  }
  function progHint(id) {
    const p = S.prog[id]; if (!p) return '';
    const e = DB.BY_ID[id]; const cargable = e && e.eq.some(q => ['mancuernas', 'kettlebell', 'barra', 'liga_tubular', 'banda_larga', 'miniband'].includes(q));
    if (p.last === 'facil') return `<p class="ex-prog">📈 Subimos el reto (${p.d > 0 ? '+' : ''}${p.d})${cargable && p.d >= 4 ? ' · 💡 Sube el peso o usa una liga más fuerte' : ''}</p>`;
    if (p.last === 'pesado') return `<p class="ex-prog down">📉 Ajustado a tu nivel (${p.d})${cargable ? ' · Baja el peso o usa liga más ligera' : ''}</p>`;
    return `<p class="ex-prog">✅ Progresión constante (${p.d > 0 ? '+' : ''}${p.d})</p>`;
  }

  let thumbAvatars = [];
  function renderRutina() {
    const r = S.routine; if (!r) return;
    $('#rDiaNum').textContent = `Sesión ${S.settings.sesion + 1} · ${fmtFecha(dayKey(), { weekday: 'long', day: 'numeric', month: 'long' })}`;
    $('#rDiaNombre').textContent = r.diaNombre;
    const nEj = r.items.filter(i => i.block === 'pri').length;
    $('#rMeta').textContent = `${DB.OBJETIVOS[S.profile.objetivo].i} ${DB.OBJETIVOS[S.profile.objetivo].n} · ~${DB.estimarMinutos(r)} min · ${nEj} ejercicios principales`;
    const fu = $('#rFuente'); fu.textContent = r.fuente === 'ia' ? '✨ Gemini' : '📴 Offline'; fu.classList.toggle('ai', r.fuente === 'ia');
    setSeg('#rDuracion', String(S.settings.duracion));
    $('#btnIA').hidden = !S.settings.apiKey;
    const tb = $('#travelBanner'); tb.hidden = !travelActive();
    if (travelActive()) tb.innerHTML = `🧳 <b>Modo viaje:</b> rutina adaptada a ${S.travel.equipo.length ? S.travel.equipo.map(i => DB.EQUIPO_NOMBRE[i]).join(', ') : 'peso corporal'}.`;
    const ia = $('#iaExplicacion'); ia.hidden = !(r.fuente === 'ia' && r.explicacion); if (r.explicacion) ia.textContent = '✨ ' + r.explicacion;

    thumbAvatars.forEach(a => a.destroy()); thumbAvatars = [];
    const blocks = [['cal', '🔥 Calentamiento'], ['pri', '💥 Bloque principal'], ['enf', '🧘 Enfriamiento y estiramiento']];
    let html = '';
    for (const [b, title] of blocks) {
      const its = r.items.map((it, idx) => ({ it, idx })).filter(x => x.it.block === b);
      if (!its.length) continue;
      const mins = Math.round(its.reduce((a, x) => a + DB.duracionItem(x.it), 0) / 60);
      html += `<h3 class="block-title">${title} <small>· ${mins} min</small></h3>`;
      for (const { it, idx } of its) {
        const e = DB.BY_ID[it.id]; if (!e) continue;
        const eqTxt = e.eq.length ? e.eq.map(q => DB.EQUIPO_NOMBRE[q]).join(' + ') : 'Peso corporal';
        html += `<article class="ex-card" data-idx="${idx}">
          <button class="ex-thumb" data-act="ver" aria-label="Ver demostración de ${esc(e.n)}" data-anim="${e.a}"></button>
          <div>
            <h4>${esc(e.n)}</h4>
            <div class="ex-meta"><span class="hl">${itemMeta(it)}</span>${it.block === 'pri' ? `<span>⏸ ${it.rest}s</span>` : ''}<span>${esc(eqTxt)}</span></div>
            <p class="ex-muscles">🎯 ${esc(e.m)}</p>
            ${it.nota ? `<p class="ex-muscles">✨ ${esc(it.nota)}</p>` : ''}
            ${it.block === 'pri' ? progHint(it.id) : ''}
          </div>
          <div class="ex-actions">
            <button class="btn btn-ghost" data-act="ver">👁️ Ver técnica</button>
            <button class="btn btn-ghost" data-act="swap">🔄 Cambiar ejercicio</button>
          </div>
        </article>`;
      }
    }
    $('#rutinaLista').innerHTML = html;
    // Miniaturas estáticas del avatar (sin animación para ahorrar batería)
    $$('#rutinaLista .ex-thumb').forEach(el => {
      const card = el.closest('.ex-card'); const it = r.items[+card.dataset.idx]; const e = DB.BY_ID[it.id];
      const a = new Avatar(el, { anim: e.a, ...avOpts(), props: propsFor(e.eq), muscles: e.mus });
      a.stop(); a.renderAt(0.5); thumbAvatars.push(a);
    });
  }
  function bindRutina() {
    $('#rDuracion').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.settings.duracion = +b.dataset.v; saveSettings(); generarOffline(false); toast(`⏱ Rutina de ${b.dataset.v} minutos`); });
    $('#btnRegenerar').addEventListener('click', () => { generarOffline(true); toast('🔄 Nueva rutina generada'); vibrate(20); });
    $('#btnIA').addEventListener('click', generarIA);
    $('#btnEmpezar').addEventListener('click', startWorkout);
    $('#btnEntrenadorRutina').addEventListener('click', openGalleryModal);
    $('#btnCambiarEntrenador').addEventListener('click', openGalleryModal);
    $('#rutinaLista').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const idx = +b.closest('.ex-card').dataset.idx; const it = S.routine.items[idx];
      if (b.dataset.act === 'swap') {
        const excl = new Set(S.routine.items.map(x => x.id));
        const alt = DB.alternativa(it, S.profile, equipoEfectivo(), excl);
        if (!alt) { toast('No hay otra alternativa con tu equipo'); return; }
        const nuevo = DB.prescribir(alt, it.block, S.profile, S.prog);
        if (it.block === 'pri') { nuevo.sets = it.sets; nuevo.rest = it.rest; }
        S.routine.items[idx] = nuevo; LS.set(K.routine, S.routine); renderRutina();
        toast(`🔄 Cambiado por: ${alt.n}`); vibrate(20);
      } else verEjercicio(it.id);
    });
  }
  function verEjercicio(id) {
    const e = DB.BY_ID[id]; if (!e) return;
    const les = DB.LESIONES.filter(l => e.ci.includes(l.id)).map(l => l.n).join(', ');
    const body = openModal(e.n, `<div class="avatar-box" id="mvAvatar"></div>
      <p><b>🎯 Músculos:</b> ${esc(e.m)}</p><p><b>✅ Técnica:</b> ${esc(e.tip)}</p>
      <p class="hint">Equipo: ${e.eq.length ? e.eq.map(q => DB.EQUIPO_NOMBRE[q]).join(' + ') : 'Peso corporal'} · Nivel ${'⭐'.repeat(e.lv)}${les ? ` · Precaución: ${esc(les)}` : ''}</p>`);
    modalAvatars.push(new Avatar(body.querySelector('#mvAvatar'), { anim: e.a, ...avOpts(), props: propsFor(e.eq), muscles: e.mus }));
  }

  // ---------- Gemini (opcional) ----------
  async function gemini(prompt, timeout = 30000) {
    const key = S.settings.apiKey; if (!key) throw new Error('Sin API Key');
    if (!navigator.onLine) throw new Error('Sin conexión a internet');
    const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } })
      });
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const j = await res.json(); msg = j.error && j.error.message ? j.error.message : msg; } catch (e) { /* */ }
        if (res.status === 400 || res.status === 403) msg = 'Clave inválida o sin permisos. ' + msg;
        throw new Error(msg);
      }
      const j = await res.json();
      const txt = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts.map(p => p.text || '').join('');
      if (!txt) throw new Error('Respuesta vacía de Gemini');
      return JSON.parse(txt.replace(/^```json\s*|```$/g, ''));
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Tiempo de espera agotado');
      throw e;
    } finally { clearTimeout(tm); }
  }

  async function generarIA() {
    const btn = $('#btnIA'); btn.disabled = true; btn.textContent = '⏳ Pensando…';
    try {
      const p = S.profile;
      const ctx = { lv: DB.LEVEL[p.nivel] || 1, lesiones: p.lesiones || [], equipo: new Set(['corporal'].concat(equipoEfectivo())) };
      const lista = DB.EJERCICIOS.filter(e => DB.permitido(e, ctx));
      const catalogo = lista.map(e => `${e.id}|${e.n}|${e.p}|${e.f}|${e.t === 's' ? 'seg' : 'reps'}`).join('\n');
      const progTxt = Object.entries(S.prog).slice(-15).map(([id, v]) => `${id}:${v.last}`).join(', ');
      const dia = DB.generarRutina(p, equipoEfectivo(), { indiceSesion: S.settings.sesion, duracion: S.settings.duracion }).diaNombre;
      const prompt = `Eres un entrenador personal certificado. Diseña la sesión de HOY en español.
Perfil: ${p.edad} años, ${p.sexo === 'f' ? 'mujer' : 'hombre'}, ${p.peso} kg, ${p.estatura} cm, nivel ${p.nivel}, entrena ${p.dias} días/semana.
Objetivo: ${DB.OBJETIVOS[p.objetivo].n}. Lesiones/limitaciones: ${(p.lesiones || []).join(', ') || 'ninguna'}.
Equipo disponible: ${['Peso corporal'].concat(equipoEfectivo().map(i => DB.EQUIPO_NOMBRE[i])).join(', ')}.
Duración total: ${S.settings.duracion} minutos. Enfoque sugerido del día: ${dia}.
Sensaciones recientes (RPE): ${progTxt || 'sin datos'}.
Usa EXCLUSIVAMENTE ids de este catálogo (id|nombre|patrón|fases c=calentamiento p=principal e=enfriamiento|tipo):
${catalogo}
Reglas: bloque "cal" 3-6 ejercicios de 30-40 s; bloque "pri" coherente con el objetivo; bloque "enf" 3-6 estiramientos de 30-45 s.
Cada repetición ≈ 3.5 s. La suma de trabajo + descansos debe aproximarse a ${S.settings.duracion} minutos.
Responde SOLO JSON: {"explicacion":"3-4 frases motivadoras explicando la lógica de la sesión","ejercicios":[{"id":"","bloque":"cal|pri|enf","series":3,"reps":12,"segundos":null,"descanso":60,"nota":"consejo breve"}]}
Usa "reps" o "segundos" (el otro en null).`;
      const out = await gemini(prompt);
      const items = (out.ejercicios || []).filter(x => DB.BY_ID[x.id] && lista.includes(DB.BY_ID[x.id])).map(x => {
        const block = ['cal', 'pri', 'enf'].includes(x.bloque) ? x.bloque : 'pri';
        const reps = +x.reps || 0, secs = +x.segundos || 0;
        return {
          id: x.id, block, sets: clamp(Math.round(+x.series || 1), 1, 6), mode: reps && !secs ? 'reps' : 'time',
          reps: clamp(Math.round(reps), 0, 50), secs: clamp(Math.round(secs || 30), 10, 180),
          rest: clamp(Math.round(+x.descanso || (block === 'pri' ? 45 : 10)), 5, 180), nota: String(x.nota || '').slice(0, 140)
        };
      });
      const order = { cal: 0, pri: 1, enf: 2 };
      items.sort((a, b) => order[a.block] - order[b.block]);
      if (items.filter(i => i.block === 'pri').length < 2) throw new Error('La IA no devolvió una rutina válida');
      S.routine = { fecha: dayKey(), dia: 'ia', diaNombre: dia, duracion: S.settings.duracion, objetivo: p.objetivo, fuente: 'ia', explicacion: String(out.explicacion || '').slice(0, 600), items, sesion: S.settings.sesion, viaje: travelActive() };
      LS.set(K.routine, S.routine); renderRutina(); toast('✨ Rutina creada con IA');
    } catch (err) {
      toast('⚠️ IA no disponible: ' + err.message + '. Usando modo offline.', 4000);
    } finally { btn.disabled = false; btn.textContent = '✨ Con IA'; }
  }

  // =========================================================================
  //  GALERÍA DE ENTRENADORES (12 personajes sobre el mismo esqueleto)
  // =========================================================================
  const PREVIEW_ANIMS = ['jack', 'squat', 'curl', 'lunge', 'press', 'shadowbox'];
  // En los anatómicos la vista previa ilumina los músculos de cada movimiento
  const PREVIEW_ANAT = [{ a: 'squat', m: DB.parseMus('cu,gl|is,ab') }, { a: 'curl', m: DB.parseMus('bi|ho') }, { a: 'press', m: DB.parseMus('ho,tr|pe') },
    { a: 'pushup', m: DB.parseMus('pe,tr|ho,ab') }, { a: 'lunge', m: DB.parseMus('cu,gl|is,pa') }, { a: 'jack', m: DB.parseMus('ho,cu|pa,gl') }];
  const THUMB_MUS = DB.parseMus('pe,ho,cu|ab,bi,pa');
  let galTab = null;

  function renderGallery(root, opts = {}) {
    if (root._avs) root._avs.forEach(a => a.destroy());
    root._avs = []; root._opts = opts;
    const cur = charById(S.settings.personaje);
    const tab = galTab || cur.g;
    root.innerHTML = `
      <div class="gal-preview"><div class="avatar-box gal-av"></div><div class="gal-info"><b>${esc(cur.n)}</b><small>${esc(cur.d)}</small></div></div>
      <div class="gtabs" role="tablist" aria-label="Tipo de entrenador">${GROUPS.map(g => `<button role="tab" class="${g.id === tab ? 'on' : ''}" aria-selected="${g.id === tab}" data-gtab="${g.id}">${g.i} ${g.n}</button>`).join('')}</div>
      <div class="gal-grid" role="list">${CHARS.filter(c => c.g === tab).map(c => `<button role="listitem" class="gal-tile ${c.id === cur.id ? 'on' : ''}" aria-pressed="${c.id === cur.id}" data-char="${c.id}"><span class="gal-thumb" data-thumb="${c.id}"></span><b>${esc(c.n)}</b></button>`).join('')}</div>
      <p class="label">🎨 Color de atuendo / acento</p>
      <div class="swatches" role="group" aria-label="Color de acento">${ACCENTS.map(a => `<button class="sw ${a.id === S.settings.acento ? 'on' : ''}" style="--c:${a.c}" data-acc="${a.id}" aria-pressed="${a.id === S.settings.acento}" aria-label="${esc(a.n)}" title="${esc(a.n)}"></button>`).join('')}</div>
      <p class="hint center">${esc(ACCENTS.find(a => a.id === S.settings.acento).n)}</p>`;
    const pv = new Avatar(root.querySelector('.gal-av'), Object.assign({ anim: 'jack' }, avOpts()));
    pv.cycle(cur.kind === 'anatomy' ? PREVIEW_ANAT : PREVIEW_ANIMS, 3200); root._avs.push(pv);
    $$('.gal-thumb', root).forEach(el => {
      const a = new Avatar(el, { anim: 'breathe', char: el.dataset.thumb, accent: S.settings.acento, muscles: charById(el.dataset.thumb).kind === 'anatomy' ? THUMB_MUS : null });
      a.stop(); a.renderAt(0.5); root._avs.push(a);
    });
    if (opts.modal) root._avs.forEach(a => modalAvatars.push(a));
  }
  function bindGallery(root) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-gtab],[data-char],[data-acc]'); if (!t) return;
      if (t.dataset.gtab) { galTab = t.dataset.gtab; renderGallery(root, root._opts); return; }
      if (t.dataset.char) { S.settings.personaje = t.dataset.char; toast(`🎭 ${charById(t.dataset.char).n}`); }
      else { S.settings.acento = t.dataset.acc; toast(`🎨 ${ACCENTS.find(a => a.id === t.dataset.acc).n}`); }
      vibrate(15); applyTrainer();
    });
  }
  function updateTrainerLabels() {
    const n = charById(S.settings.personaje).n;
    $('#btnEntrenadorRutina').textContent = `🎭 Entrenador: ${n} ›`;
    $('#btnCambiarEntrenador').textContent = `🎭 Entrenador: ${n} · Cambiar`;
  }
  function applyTrainer() {
    saveSettings();
    if (idleAvatar) idleAvatar.set(avOpts());
    if (liveAvatar) liveAvatar.set(avOpts());
    updateTrainerLabels();
    $$('.gallery').forEach(g => { if (g._avs && g._avs.length) renderGallery(g, g._opts); });
    if (S.tab === 'rutina') renderRutina();
  }
  function openGalleryModal() {
    const body = openModal('🎭 Elige tu entrenador', '<div class="gallery" id="galeriaModal"></div><button class="btn btn-primary btn-lg" id="galOk">✔️ Listo</button>');
    const g = body.querySelector('#galeriaModal');
    bindGallery(g); renderGallery(g, { modal: true });
    body.querySelector('#galOk').addEventListener('click', closeModal);
  }

  // =========================================================================
  //  PESTAÑA 4 · ENTRENADOR EN VIVO
  // =========================================================================
  let idleAvatar = null, liveAvatar = null;
  function renderCoachIdle() {
    ensureRoutine();
    const r = S.routine; const first = r && r.items.find(i => i.block === 'pri');
    const e = first ? DB.BY_ID[first.id] : null;
    if (!idleAvatar) idleAvatar = new Avatar($('#avatarIdle'), { anim: e ? e.a : 'breathe', ...avOpts(), props: e ? propsFor(e.eq) : [], muscles: e ? e.mus : null });
    else { idleAvatar.set({ anim: e ? e.a : 'breathe', ...avOpts(), props: e ? propsFor(e.eq) : [], muscles: e ? e.mus : null }); idleAvatar.start(); }
    $('#coachIdleInfo').innerHTML = r ? `<b>${esc(r.diaNombre)}</b> · ${r.items.length} ejercicios · ~${DB.estimarMinutos(r)} min${e ? `<br>Primer ejercicio fuerte: ${esc(e.n)}` : ''}` : '';
  }

  // ---------- Audio, voz y vibración ----------
  let actx = null, voiceEs = null;
  function unlockAudio() {
    try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
    if ('speechSynthesis' in window && !voiceEs) pickVoice();
  }
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    voiceEs = vs.find(v => /es[-_](MX|US|419)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = pickVoice;
  function speak(text, interrupt = true, force = false) {
    if ((!S.settings.voz && !force) || !('speechSynthesis' in window)) return;
    try {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceEs ? voiceEs.lang : 'es-MX'; if (voiceEs) u.voice = voiceEs;
      u.rate = 1.05; u.pitch = 1; speechSynthesis.speak(u);
    } catch (e) { /* */ }
  }
  function beep(freq = 880, dur = 0.12, vol = 0.18) {
    if (!S.settings.beep || !actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* */ }
  }
  function vibrate(p) { if (S.settings.vibra && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* */ } }

  // ---------- Screen Wake Lock ----------
  let wakeLock = null;
  async function lockScreen() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { wakeLock = null; }
  }
  function releaseScreen() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && P.active) lockScreen();
    if (liveAvatar) liveAvatar.pause(document.hidden || !!(P.active && P.paused));
  });

  // ---------- Reproductor ----------
  const RING_C = 2 * Math.PI * 52;
  const P = { active: false };

  // Cada ejercicio empieza con 10 s exactos de preparación (guía de postura).
  function buildSteps(r) {
    const steps = [];
    r.items.forEach((it, i) => {
      steps.push({ type: 'prep', secs: DB.PREP_SECS, i });
      for (let n = 1; n <= it.sets; n++) {
        steps.push({ type: 'work', i, set: n, sets: it.sets, mode: it.mode, secs: it.secs, reps: it.reps });
        const lastSet = n === it.sets, lastItem = i === r.items.length - 1;
        if (!lastSet) steps.push({ type: 'rest', i, secs: it.rest, rpe: null });                                   // entre series
        else if (!lastItem && it.block === 'pri') steps.push({ type: 'rest', i: i + 1, secs: Math.max(it.rest, 15), rpe: it.id }); // antes del siguiente ejercicio
      }
    });
    return steps;
  }

  function startWorkout() {
    ensureRoutine();
    if (!S.routine || !S.routine.items.length) { toast('Primero genera una rutina'); return; }
    unlockAudio();
    Object.assign(P, {
      active: true, steps: buildSteps(S.routine), idx: 0, phaseMs: 0, sessionMs: 0, workMs: 0, last: performance.now(),
      paused: false, log: [], rpe: {}, said: {}, startedAt: new Date(), routine: JSON.parse(JSON.stringify(S.routine)), kcalW: 0,
      guide: null, guideView: 'A', inspectWasPaused: false
    });
    if (S.tab !== 'entrenador') goTab('entrenador');
    $('#coachIdle').hidden = true; $('#player').hidden = false; $('#plExit').hidden = true;
    document.body.classList.add('training');
    if (idleAvatar) idleAvatar.stop();
    if (!liveAvatar) liveAvatar = new Avatar($('#avatarLive'), avOpts());
    liveAvatar.start();
    applyFocus(S.settings.enfoque, true);
    pushOverlay('player');
    lockScreen();
    $('#plVoice').textContent = S.settings.voz ? '🔊' : '🔇';
    clearInterval(P.timer); P.timer = setInterval(tick, 200);
    enterStep();
  }

  const curStep = () => P.steps[P.idx];
  const itemOf = st => P.routine.items[st.i];
  const metaItem = it => `${it.sets > 1 ? it.sets + ' series · ' : ''}${it.mode === 'reps' ? it.reps + ' reps' : it.secs + ' s'}`;
  // Músculos del ejercicio; con avatar anatómico se explica el código de color
  function musTexto(e) {
    if (charById(S.settings.personaje).kind !== 'anatomy') return '🎯 ' + e.m;
    const pr = DB.musNombres(e.mus.p).join(', '), se = DB.musNombres(e.mus.s).join(', ');
    return `🔴 ${pr}${se ? '  ·  🩷 ' + se : ''}`;
  }

  // ---------- Guía visual de postura (preparación / consulta) ----------
  function setAB(v) {
    P.guideView = v;
    $$('#plAB button').forEach(b => b.classList.toggle('on', b.dataset.ab === v));
    liveAvatar.showPose(v);
    $('#plHoldChip').hidden = !(P.guide === 'prep' && v === 'B');   // en B la cuenta regresiva se detiene
  }
  function openGuide(it, mode) {
    const g = DB.BY_ID[it.id].guia;
    P.guide = mode;
    $('#player').dataset.guide = 'on';
    $('#techIni').textContent = g.ini; $('#techEje').textContent = g.eje; $('#techErr').textContent = g.err;
    liveAvatar.setGuide(g.marks);
    setAB('A');
  }
  function quietPause(v) {
    P.paused = v; $('#player').classList.toggle('paused', v);
    $('#plPause').textContent = v ? '▶' : '⏸'; $('#plPause').setAttribute('aria-label', v ? 'Reanudar' : 'Pausar');
  }
  // Consultar la postura en cualquier momento (pausa mientras se revisa)
  function openInspect() {
    if (!P.active || P.guide) return;
    const st = curStep(); if (!st || st.type === 'prep') return;
    P.inspectWasPaused = P.paused;
    quietPause(true);
    const it = itemOf(st), e = DB.BY_ID[it.id];
    $('#plDone').hidden = true; $('#plRestCtrl').hidden = true; $('#plRpe').hidden = true; $('#plNext').hidden = true; $('#plPosture').hidden = true;
    $('#plBlock').textContent = 'Postura inicial'; $('#plName').textContent = e.n; $('#plSet').textContent = 'Cuenta en pausa';
    $('#plMuscles').textContent = musTexto(e);
    liveAvatar.set({ anim: e.a, ...avOpts(), props: propsFor(e.eq), muscles: e.mus });
    openGuide(it, 'inspect');
    $('#plGoWrap').hidden = false; $('#plGo').textContent = '▶️ Continuar';
    speak(`Postura inicial. ${e.guia.ini}`);
  }
  function closeInspect() {
    if (P.guide !== 'inspect') return;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    quietPause(P.inspectWasPaused);
    enterStep(true);   // restaura el paso actual sin reiniciar su cronómetro
  }

  function enterStep(resume) {
    const st = curStep();
    if (!resume) { P.phaseMs = 0; P.said = {}; }
    P.guide = null; P.guideView = 'A';
    const player = $('#player');
    player.dataset.phase = st.type; player.dataset.guide = '';
    const it = itemOf(st) || P.routine.items[0]; const e = DB.BY_ID[it.id];
    const blockName = { cal: 'Calentamiento', pri: 'Bloque principal', enf: 'Enfriamiento' }[it.block];
    $('#plRpe').hidden = true; $('#plNext').hidden = true; $('#plDone').hidden = true; $('#plRestCtrl').hidden = true;
    $('#plGoWrap').hidden = true; $('#plHoldChip').hidden = true;
    $('#plPosture').hidden = st.type === 'prep';
    $('#plNextEye').textContent = 'Siguiente';

    if (st.type === 'work') {
      $('#plBlock').textContent = blockName;
      $('#plName').textContent = e.n;
      $('#plSet').textContent = st.sets > 1 ? `Serie ${st.set} de ${st.sets}` : (st.mode === 'time' ? 'Por tiempo' : '');
      $('#plMuscles').textContent = musTexto(e);
      $('#plTip').textContent = '✅ ' + (it.nota || e.tip);
      liveAvatar.set({ anim: e.a, ...avOpts(), props: propsFor(e.eq), muscles: e.mus });
      liveAvatar.setGuide(null); liveAvatar.showPose(null);
      liveAvatar.start(); liveAvatar.ensure(); // arranque explícito del bucle al empezar la serie
      if (st.mode === 'reps') {
        $('#plDone').hidden = false;
        $('#plLabel').textContent = `${st.reps} reps`;
        if (!resume) speak(`${e.n}. ${st.reps} repeticiones.${st.sets > 1 ? ` Serie ${st.set} de ${st.sets}.` : ''}`);
      } else {
        $('#plLabel').textContent = 'Trabajo';
        if (!resume) speak(`${e.n}. ${st.secs} segundos.${st.sets > 1 ? ` Serie ${st.set} de ${st.sets}.` : ''} ¡Ya!`);
      }
      if (!resume) { beep(1046, 0.18); vibrate([60, 40, 60]); }
    } else if (st.type === 'prep') {
      $('#plBlock').textContent = `Prepárate · ${st.i + 1} de ${P.routine.items.length}`;
      $('#plName').textContent = e.n;
      $('#plSet').textContent = metaItem(it);
      $('#plMuscles').textContent = musTexto(e); $('#plTip').textContent = '';
      liveAvatar.set({ anim: e.a, ...avOpts(), props: propsFor(e.eq), muscles: e.mus });
      openGuide(it, 'prep');
      liveAvatar.start(); liveAvatar.ensure();
      $('#plLabel').textContent = 'Prepárate';
      $('#plGoWrap').hidden = false; $('#plGo').textContent = '⏭️ Empezar ya';
      $('#plNext').hidden = false; $('#plNextEye').textContent = 'Vas a hacer';
      $('#plNextName').textContent = e.n;
      $('#plNextMeta').textContent = `${it.sets} × ${it.mode === 'reps' ? it.reps + ' reps' : it.secs + ' s'}${it.block === 'pri' ? ' · descanso ' + it.rest + ' s' : ''}`;
      if (!resume) { speak(`${st.i === 0 ? '¡Vamos! ' : ''}${e.n}. Posición inicial: ${e.guia.ini}`); beep(660, 0.12); vibrate(80); }
    } else {
      // Descanso
      const ne = e;
      const nextWork = P.steps.slice(P.idx + 1).find(x => x.type === 'work');
      $('#plBlock').textContent = 'Descanso';
      $('#plName').textContent = 'Respira y recupera';
      $('#plSet').textContent = 'Hidrátate con un trago de agua';
      $('#plMuscles').textContent = '';
      $('#plTip').textContent = 'Inhala por la nariz, exhala lento por la boca.';
      liveAvatar.set({ anim: 'breathe', ...avOpts(), props: [], muscles: null });
      liveAvatar.setGuide(null); liveAvatar.showPose(null);
      $('#plLabel').textContent = 'Descanso';
      $('#plNext').hidden = false;
      $('#plNextName').textContent = ne.n;
      $('#plNextMeta').textContent = nextWork ? (nextWork.mode === 'reps' ? `${nextWork.reps} reps` : `${nextWork.secs} s`) + (nextWork.sets > 1 ? ` · serie ${nextWork.set}/${nextWork.sets}` : '') : '';
      $('#plRestCtrl').hidden = false;
      if (st.rpe) {
        $('#plRpe').hidden = false; $('#plRpeName').textContent = DB.BY_ID[st.rpe].n;
        $$('#plRpe button').forEach(b => b.classList.toggle('on', P.rpe[st.rpe] === b.dataset.rpe));
      }
      if (!resume) { speak(`Descansa ${st.secs} segundos. Siguiente: ${ne.n}.`); beep(660, 0.15); vibrate(120); }
    }
    // Progreso global
    $('#plProgressBar').style.width = `${(P.idx / P.steps.length) * 100}%`;
    renderTime();
  }

  // ---------- Vista Enfoque / Estudio ----------
  function applyFocus(on, silent) {
    S.settings.enfoque = !!on; saveSettings();
    $('#player').classList.toggle('focus', !!on);
    $('#plFocus').classList.toggle('on', !!on); $('#plFocus').setAttribute('aria-pressed', !!on);
    if (liveAvatar) liveAvatar.set({ floor: !!on });
    if (P.active) renderTime();
    if (!silent) toast(on ? '🎯 Vista Enfoque' : '🖥️ Vista clásica');
  }
  function renderFocus(st, el, txt) {
    const it = itemOf(st);
    let big = txt, label = '', set = '', sub = 'SESIÓN ' + hhmmss(P.sessionMs);
    if (st.type === 'work') {
      set = st.sets > 1 ? `SERIE ${st.set} DE ${st.sets}` : '';
      if (st.mode === 'reps') { big = `${pad(st.sets)} x ${pad(st.reps)}`; label = 'SERIES x REPS'; sub = '⏱ ' + mmss(el); }
      else label = 'TIEMPO RESTANTE';
    } else if (st.type === 'rest') { label = 'DESCANSO'; set = 'PRÓXIMO: ' + DB.BY_ID[it.id].n.toUpperCase(); }
    else { label = P.guide === 'prep' && P.guideView === 'B' ? 'EN PAUSA · REVISANDO TÉCNICA' : 'PREPÁRATE'; set = metaItem(it).toUpperCase(); }
    $('#fhBig').textContent = big; $('#fhLabel').textContent = label; $('#fhSet').textContent = set; $('#fhSub').textContent = sub;
  }

  function renderTime() {
    const st = curStep(); if (!st) return;
    const el = P.phaseMs / 1000;
    let txt, frac;
    if (st.type === 'work' && st.mode === 'reps') {
      txt = mmss(el); frac = Math.min(1, el / Math.max(1, st.reps * 3.5));
    } else {
      const rem = st.secs - el; txt = mmss(rem); frac = 1 - Math.max(0, rem) / st.secs;
    }
    $('#plTime').textContent = txt;
    $('#plRing').style.strokeDashoffset = (RING_C * frac).toFixed(1);
    $('#plTotal').textContent = hhmmss(P.sessionMs);
    if ($('#player').classList.contains('focus')) renderFocus(st, el, txt);
  }

  function tick() {
    const now = performance.now(); const dt = Math.min(now - P.last, 2000); P.last = now;
    if (!P.active) return;
    if (liveAvatar) liveAvatar.ensure(); // red de seguridad: reanima si el bucle se detuvo
    if (P.paused) return;
    if (P.guide === 'prep' && P.guideView === 'B') return; // revisando el punto máximo: la cuenta regresiva espera
    P.sessionMs += dt; P.phaseMs += dt;
    const st = curStep();
    if (st.type === 'work') P.workMs += dt;
    if (!(st.type === 'work' && st.mode === 'reps')) {
      const rem = st.secs - P.phaseMs / 1000;
      const sec = Math.ceil(rem);
      if (sec <= 3 && sec >= 1 && !P.said[sec]) {
        P.said[sec] = true; beep(sec === 1 ? 990 : 880, 0.1);
        if (st.secs > 5) speak(['', 'uno', 'dos', 'tres'][sec], st.type === 'prep'); // en la preparación corta la lectura de la postura
        vibrate(40);
      }
      if (st.type === 'work' && !P.said.half && st.secs >= 20 && rem <= st.secs / 2) {
        P.said.half = true;
        const e = DB.BY_ID[itemOf(st).id];
        if (/cambia de (lado|pierna)/i.test(e.tip)) speak('Cambia de lado', true); else if (st.secs >= 30) speak('¡Mitad! Sigue así', true);
      }
      if (rem <= 0) { advance(); return; }
    }
    renderTime();
  }

  function logWork() {
    const st = curStep(); if (!st || st.type !== 'work') return;
    const it = itemOf(st); const e = DB.BY_ID[it.id];
    const secs = P.phaseMs / 1000;
    if (secs < 2) return;
    P.log.push({ id: it.id, block: it.block, secs, reps: st.mode === 'reps' ? st.reps : 0 });
    P.kcalW += e.met * (+S.profile.peso || 70) * secs / 3600;
  }
  function goStep(i) {
    if (P.guide === 'inspect') quietPause(P.inspectWasPaused);
    if (i >= P.steps.length) { logWork(); finishWorkout(true); return; }
    P.idx = Math.max(0, i); enterStep();
  }
  function advance() { logWork(); goStep(P.idx + 1); }

  function setPaused(v) {
    P.paused = v; $('#player').classList.toggle('paused', v);
    $('#plPause').textContent = v ? '▶' : '⏸'; $('#plPause').setAttribute('aria-label', v ? 'Reanudar' : 'Pausar');
    liveAvatar && liveAvatar.pause(v);
    if (v) { speak('Pausa'); releaseScreen(); } else { speak('Continuamos', true); lockScreen(); }
  }
  function showExitDialog() {
    if (P.guide === 'inspect') { P.inspectWasPaused = false; closeInspect(); }
    if (!P.paused) setPaused(true);
    $('#plExit').hidden = false;
  }

  function bindPlayer() {
    $('#btnIniciarCoach').addEventListener('click', startWorkout);
    $('#plDone').addEventListener('click', () => { vibrate(50); advance(); });
    $('#plSkip').addEventListener('click', () => { speak('¡Vamos!'); advance(); });
    $('#plMinus').addEventListener('click', () => { const st = curStep(); st.secs = Math.max(Math.ceil(P.phaseMs / 1000) + 1, st.secs - 15); P.said = {}; renderTime(); });
    $('#plPlus').addEventListener('click', () => { const st = curStep(); st.secs += 15; P.said = {}; renderTime(); });
    $('#plPause').addEventListener('click', () => { if (P.guide === 'inspect') { closeInspect(); return; } setPaused(!P.paused); });
    $('#plFocus').addEventListener('click', () => applyFocus(!S.settings.enfoque));
    $('#plPosture').addEventListener('click', openInspect);
    $('#plGo').addEventListener('click', () => { if (P.guide === 'inspect') closeInspect(); else { speak('¡Vamos!'); advance(); } });
    $('#plAB').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !P.guide) return; setAB(b.dataset.ab); vibrate(15); });
    $('#plNextBtn').addEventListener('click', () => advance());
    $('#plPrev').addEventListener('click', () => {
      if (curStep().type === 'work' && P.phaseMs > 3000) { enterStep(); return; }
      let j = P.idx - 1; while (j > 0 && P.steps[j].type !== 'work') j--;
      goStep(j);
    });
    $('#plVoice').addEventListener('click', () => {
      S.settings.voz = !S.settings.voz; saveSettings(); $('#plVoice').textContent = S.settings.voz ? '🔊' : '🔇'; $('#sVoz').checked = S.settings.voz;
      if (!S.settings.voz && 'speechSynthesis' in window) speechSynthesis.cancel(); else speak('Voz activada');
    });
    $('#plClose').addEventListener('click', showExitDialog);
    $('#plExitContinue').addEventListener('click', () => { $('#plExit').hidden = true; setPaused(false); });
    $('#plExitSave').addEventListener('click', () => finishWorkout(true, true));
    $('#plExitDiscard').addEventListener('click', () => { if (confirm('¿Salir sin guardar esta sesión?')) { stopSession(); popOverlayUI(); } });
    $('#plRpe').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const id = curStep().rpe; if (!id) return;
      P.rpe[id] = b.dataset.rpe;
      $$('#plRpe button').forEach(x => x.classList.toggle('on', x === b));
      vibrate(30); toast({ facil: '📈 Subiremos el reto la próxima vez', justo: '👌 ¡Perfecto! Progresión ligera', pesado: '📉 Lo ajustaremos para la próxima' }[b.dataset.rpe]);
    });
  }

  function applyRPE() {
    const delta = { facil: 2, justo: 1, pesado: -2 };
    for (const [id, v] of Object.entries(P.rpe)) {
      const cur = S.prog[id] || { d: 0 };
      S.prog[id] = { d: clamp((cur.d || 0) + delta[v], -6, 12), last: v, fecha: dayKey() };
    }
    LS.set(K.prog, S.prog);
  }

  function stopSession() {
    P.active = false; clearInterval(P.timer); releaseScreen();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (liveAvatar) liveAvatar.stop();
  }
  function closePlayerUI() {
    stopSession();
    document.body.classList.remove('training');
    $('#player').hidden = true; $('#coachIdle').hidden = false; $('#player').classList.remove('paused');
    $('#plPause').textContent = '⏸';
    renderCoachIdle();
  }

  async function finishWorkout(save, early = false) {
    const completo = !early;
    stopSession();
    const series = P.log.filter(l => l.block === 'pri').length;
    const totalSeries = P.log.length;
    const kg = +S.profile.peso || 70;
    const restSecs = Math.max(0, (P.sessionMs - P.workMs) / 1000);
    const kcal = Math.round(P.kcalW + 1.5 * kg * restSecs / 3600);
    const mins = Math.max(1, Math.round(P.sessionMs / 60000));
    const ids = [...new Set(P.log.map(l => l.id))];
    let saved = false;
    if (save && P.log.length) {
      applyRPE();
      const w = {
        fecha: new Date().toISOString(), dia: dayKey(), mins, secs: Math.round(P.sessionMs / 1000), series: totalSeries, seriesPrincipales: series,
        kcal, ids, ejercicios: ids.map(i => DB.BY_ID[i].n), objetivo: S.profile.objetivo, diaNombre: P.routine.diaNombre, completo, fuente: P.routine.fuente
      };
      await IDB.put('workouts', w);
      S.settings.sesion = (S.settings.sesion || 0) + 1; saveSettings();
      LS.set(K.lastActivity, Date.now());
      await loadData(); saveMirror();
      S.routineDirty = true; saved = true;
    }
    document.body.classList.remove('training');
    $('#player').hidden = true; $('#coachIdle').hidden = false;
    if (!saved) { popOverlayUI(); return; }
    speak(completo ? '¡Entrenamiento completado! Excelente trabajo.' : 'Sesión guardada. ¡Buen trabajo!');
    vibrate([100, 60, 100, 60, 200]);
    // Reemplaza la capa del reproductor por el resumen (misma entrada de historial)
    swapOverlay('player', 'modal');
    $('#modal').hidden = false;
    showSummary({ mins, totalSeries, series, kcal, ids, completo, ms: P.sessionMs });
  }

  function showSummary(r) {
    const kg = +S.profile.peso || 70;
    const vasos = Math.max(2, Math.ceil((r.mins / 60) * 3) + 1);
    const prot = Math.round(kg * 0.3);
    const tipsObj = {
      grasa: 'Prioriza proteína y verduras en tu siguiente comida; evita compensar con bebidas azucaradas.',
      hipertrofia: 'Duerme 7–9 horas: ahí es donde el músculo se reconstruye.',
      fuerza: 'Mantén la técnica perfecta antes de subir peso. La constancia gana.',
      resistencia: 'Repón electrolitos si sudaste mucho (una pizca de sal y limón en tu agua).',
      movilidad: 'Repite 5 minutos de movilidad al despertar para mantener lo ganado.'
    };
    $('#modalTitle').textContent = r.completo ? '🏆 ¡Entrenamiento completado!' : '💾 Sesión guardada';
    $('#modalBody').innerHTML = `<div class="summary-hero"><div class="big">${r.completo ? '🎉' : '💪'}</div><p class="hint">${esc(P.routine.diaNombre)} · ${fmtFecha(dayKey(), { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <div class="summary-grid">
        <div class="stat"><b>${hhmmss(r.ms)}</b><small>Tiempo total</small></div>
        <div class="stat"><b>${r.totalSeries}</b><small>Series completadas</small></div>
        <div class="stat"><b>${r.kcal}</b><small>kcal estimadas</small></div>
        <div class="stat"><b>${r.ids.length}</b><small>Ejercicios</small></div>
      </div>
      <div class="tip-box">💧 <b>Hidratación:</b> toma ${vasos} vasos de agua (250 ml) en la próxima hora.<br>🥚 <b>Proteína:</b> ~${prot} g en las próximas 2 horas.<br>🛌 ${tipsObj[S.profile.objetivo] || ''}</div>
      ${Object.keys(P.rpe).length ? `<p class="hint">📈 Ajustamos ${Object.keys(P.rpe).length} ejercicio(s) según cómo te sentiste para tu próxima sesión.</p>` : '<p class="hint">💡 Tip: en los descansos toca “Fácil / Justo / Muy pesado” para que la app ajuste tu progresión.</p>'}
      <button class="btn btn-primary btn-lg" id="sumOk">📈 Ver mi progreso</button>`;
    modalOnClose = () => { renderCoachIdle(); goTab('progreso'); };
    $('#sumOk').addEventListener('click', closeModal);
  }

  // =========================================================================
  //  PESTAÑA 5 · PROGRESO
  // =========================================================================
  async function loadData() {
    S.workouts = (await IDB.all('workouts')).sort((a, b) => a.fecha.localeCompare(b.fecha));
    S.metrics = (await IDB.all('metrics')).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  function streak() {
    const days = new Set(S.workouts.map(w => w.dia));
    let d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0; while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function renderProgreso() {
    const w = S.workouts;
    const mins = w.reduce((a, x) => a + (x.mins || 0), 0), kcal = w.reduce((a, x) => a + (x.kcal || 0), 0);
    const st = streak();
    $('#kpis').innerHTML = `<div class="kpi hot"><b>🔥 ${st}</b><small>día${st === 1 ? '' : 's'} de racha</small></div>
      <div class="kpi"><b>${w.length}</b><small>sesiones</small></div><div class="kpi"><b>${mins}</b><small>minutos</small></div><div class="kpi"><b>${kcal.toLocaleString('es-MX')}</b><small>kcal quemadas</small></div>`;
    renderCalendar();
    if (!$('#mFecha').value) $('#mFecha').value = dayKey();
    setSeg('#chartMetric', S.chartMetric);
    renderChart();
    renderKcalChart();
    $('#historial').innerHTML = w.length ? w.slice().reverse().slice(0, 30).map(x => `<div class="h-item"><div><b>${esc(x.diaNombre || 'Entrenamiento')}${x.completo ? '' : ' (parcial)'}</b><small>${fmtFecha(x.dia, { weekday: 'short', day: 'numeric', month: 'short' })} · ${x.series} series · ${x.ejercicios.length} ejercicios</small></div><div class="h-k">${x.mins}′<br><small>${x.kcal} kcal</small></div><button class="icon-btn" data-del="${x.id}" aria-label="Borrar sesión">🗑️</button></div>`).join('') : '<p class="chart-empty">Aún no hay entrenamientos. ¡Tu primera sesión te espera! 💪</p>';
  }
  function renderCalendar() {
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + S.calOffset);
    const ttl = base.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); $('#calTitle').textContent = ttl.charAt(0).toUpperCase() + ttl.slice(1);
    const days = new Set(S.workouts.map(w => w.dia));
    const startDow = (base.getDay() + 6) % 7; // lunes = 0
    const nDays = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    let h = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < startDow; i++) h += '<div class="day empty"></div>';
    const today = dayKey();
    for (let d = 1; d <= nDays; d++) {
      const k = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(d)}`;
      h += `<div class="day ${days.has(k) ? 'done' : ''} ${k === today ? 'today' : ''}">${d}</div>`;
    }
    $('#calendar').innerHTML = h;
  }
  function lineChart(points, unit) {
    if (points.length < 1) return '<p class="chart-empty">Registra tus medidas para ver la gráfica.</p>';
    const Wd = 340, Hd = 170, pl = 36, pr = 12, pt = 14, pb = 26;
    const ys = points.map(p => p.y); let min = Math.min(...ys), max = Math.max(...ys);
    if (max - min < 1) { min -= 1; max += 1; }
    const x = i => pl + (points.length === 1 ? (Wd - pl - pr) / 2 : i * (Wd - pl - pr) / (points.length - 1));
    const y = v => pt + (1 - (v - min) / (max - min)) * (Hd - pt - pb);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
    const area = `${path} L${x(points.length - 1).toFixed(1)},${Hd - pb} L${x(0).toFixed(1)},${Hd - pb} Z`;
    const grid = [min, (min + max) / 2, max].map(v => `<line x1="${pl}" x2="${Wd - pr}" y1="${y(v)}" y2="${y(v)}" class="axis"/><text x="${pl - 4}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`).join('');
    const step = Math.ceil(points.length / 5);
    const labels = points.map((p, i) => (i % step === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${Hd - 8}" text-anchor="middle">${fmtFecha(p.x)}</text>` : '').join('');
    const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="4" class="dot"><title>${fmtFecha(p.x)}: ${p.y} ${unit}</title></circle>`).join('');
    const last = points[points.length - 1], first = points[0], diff = last.y - first.y;
    return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Gráfica">${grid}<path d="${area}" class="area"/><path d="${path}" class="line"/>${dots}${labels}</svg>
      <p class="hint center">Actual: <b>${last.y} ${unit}</b>${points.length > 1 ? ` · Cambio: <b>${diff > 0 ? '+' : ''}${diff.toFixed(1)} ${unit}</b>` : ''}</p>`;
  }
  function renderChart() {
    const m = S.chartMetric; const unit = m === 'peso' ? 'kg' : 'cm';
    const pts = S.metrics.filter(x => x[m]).map(x => ({ x: x.fecha, y: +x[m] })).slice(-20);
    $('#chart').innerHTML = lineChart(pts, unit);
  }
  function renderKcalChart() {
    const days = []; const d = new Date(); d.setDate(d.getDate() - 13);
    for (let i = 0; i < 14; i++) { const k = dayKey(d); days.push({ k, v: S.workouts.filter(w => w.dia === k).reduce((a, w) => a + w.kcal, 0) }); d.setDate(d.getDate() + 1); }
    const max = Math.max(50, ...days.map(x => x.v));
    const Wd = 340, Hd = 140, bw = (Wd - 20) / 14;
    const bars = days.map((x, i) => { const h = (x.v / max) * (Hd - 40); return `<rect x="${10 + i * bw + 3}" y="${Hd - 22 - h}" width="${bw - 6}" height="${Math.max(h, 2)}" rx="4" class="bar" opacity="${x.v ? 1 : .25}"><title>${fmtFecha(x.k)}: ${x.v} kcal</title></rect>${x.v ? `<text x="${10 + i * bw + bw / 2}" y="${Hd - 26 - h}" text-anchor="middle" class="val">${x.v}</text>` : ''}<text x="${10 + i * bw + bw / 2}" y="${Hd - 6}" text-anchor="middle">${new Date(x.k + 'T12:00').getDate()}</text>`; }).join('');
    $('#chartKcal').innerHTML = `<p class="label">🔥 Calorías estimadas · últimos 14 días</p><svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Calorías por día">${bars}</svg>`;
  }
  function bindProgreso() {
    $('#calPrev').addEventListener('click', () => { S.calOffset--; renderCalendar(); });
    $('#calNext').addEventListener('click', () => { S.calOffset++; renderCalendar(); });
    $('#chartMetric').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.chartMetric = b.dataset.v; setSeg('#chartMetric', b.dataset.v); renderChart(); });
    $('#mFecha').addEventListener('change', () => {
      const m = S.metrics.find(x => x.fecha === $('#mFecha').value) || {};
      ['peso', 'cintura', 'cadera', 'brazo', 'muslo'].forEach(k => { $('#m' + k[0].toUpperCase() + k.slice(1)).value = m[k] || ''; });
    });
    $('#btnGuardarMedida').addEventListener('click', async () => {
      const rec = { fecha: $('#mFecha').value || dayKey() };
      let any = false;
      ['peso', 'cintura', 'cadera', 'brazo', 'muslo'].forEach(k => { const v = parseFloat($('#m' + k[0].toUpperCase() + k.slice(1)).value); if (v > 0) { rec[k] = v; any = true; } });
      if (!any) { toast('Escribe al menos una medida'); return; }
      await IDB.put('metrics', rec);
      if (rec.peso && rec.fecha === dayKey()) { S.profile.peso = rec.peso; LS.set(K.profile, S.profile); }
      LS.set(K.lastActivity, Date.now());
      await loadData(); saveMirror(); renderProgreso(); toast('📏 Medidas guardadas');
    });
    $('#historial').addEventListener('click', async e => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (!confirm('¿Borrar esta sesión del historial?')) return;
      await IDB.del('workouts', +b.dataset.del); await loadData(); renderProgreso(); toast('🗑️ Sesión eliminada');
    });
    $('#btnTour2').addEventListener('click', startTour);
  }

  // =========================================================================
  //  RESPALDO, RESTAURACIÓN Y COPIAS ESPEJO
  // =========================================================================
  async function buildBackup() {
    const ls = {};
    Object.values(K).forEach(k => { try { const v = localStorage.getItem(k); if (v != null) ls[k] = v; } catch (e) { /* */ } });
    // Por privacidad, la API Key NO se incluye en el respaldo
    if (ls[K.settings]) { try { const s = JSON.parse(ls[K.settings]); s.apiKey = ''; ls[K.settings] = JSON.stringify(s); } catch (e) { /* */ } }
    return { app: 'MiFitApp', version: APP_VERSION, exportado: new Date().toISOString(), entrenador: { personaje: S.settings.personaje, acento: S.settings.acento }, localStorage: ls, workouts: await IDB.all('workouts'), metrics: await IDB.all('metrics') };
  }
  const backupName = () => `mifitapp-respaldo-${dayKey()}.json`;
  async function exportBackup() {
    const data = await buildBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = backupName();
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    markBackup(); toast('⬇️ Respaldo descargado');
  }
  async function shareBackup() {
    const data = await buildBackup();
    const file = new File([JSON.stringify(data)], backupName(), { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Respaldo MiFitApp', text: 'Mi respaldo de MiFitApp 💪' }); markBackup(); toast('📤 Respaldo compartido'); }
      catch (e) { if (e.name !== 'AbortError') exportBackup(); }
    } else { toast('Tu navegador no permite compartir archivos: se descargará'); exportBackup(); }
  }
  function markBackup() { LS.set(K.lastBackup, Date.now()); $('#banner').hidden = true; if (S.tab === 'perfil') renderPerfil(); }
  async function restoreData(data) {
    if (!data || data.app !== 'MiFitApp') throw new Error('El archivo no es un respaldo de MiFitApp');
    const keepKey = LS.get(K.settings, {}).apiKey || S.settings.apiKey;
    Object.entries(data.localStorage || {}).forEach(([k, v]) => { if (k.startsWith('mifit_')) try { localStorage.setItem(k, v); } catch (e) { /* */ } });
    if (data.entrenador) { const st = LS.get(K.settings, {}); if (data.entrenador.personaje) st.personaje = data.entrenador.personaje; if (data.entrenador.acento) st.acento = data.entrenador.acento; LS.set(K.settings, st); }
    if (keepKey) { const s = LS.get(K.settings, {}); s.apiKey = keepKey; LS.set(K.settings, s); }
    await IDB.clear('workouts'); await IDB.clear('metrics');
    for (const w of data.workouts || []) await IDB.put('workouts', w);
    for (const m of data.metrics || []) await IDB.put('metrics', m);
  }
  async function importBackup(e) {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm(`¿Restaurar el respaldo del ${new Date(data.exportado).toLocaleString('es-MX')}? Se reemplazarán tus datos actuales.`)) return;
      await restoreData(data); toast('✅ Respaldo restaurado'); setTimeout(() => location.reload(), 700);
    } catch (err) { toast('⚠️ ' + err.message, 3500); }
  }
  async function saveMirror() {
    try {
      const data = await buildBackup();
      await IDB.put('mirror', { day: dayKey(), ts: Date.now(), data });
      const all = (await IDB.all('mirror')).sort((a, b) => b.day.localeCompare(a.day));
      for (const m of all.slice(7)) await IDB.del('mirror', m.day);
    } catch (e) { /* */ }
  }
  async function renderMirrors() {
    const all = (await IDB.all('mirror')).sort((a, b) => b.day.localeCompare(a.day));
    $('#mirrorList').innerHTML = all.length ? all.map(m => `<div class="h-item"><div><b>${fmtFecha(m.day, { weekday: 'long', day: 'numeric', month: 'short' })}</b><small>${(m.data.workouts || []).length} sesiones · ${(m.data.metrics || []).length} medidas</small></div><button class="btn btn-ghost" data-mirror="${m.day}">Restaurar</button></div>`).join('') : '<p class="hint">Se crean automáticamente al usar la app.</p>';
  }
  function bindMirrors() {
    $('#mirrorList').addEventListener('click', async e => {
      const b = e.target.closest('[data-mirror]'); if (!b) return;
      if (!confirm('¿Restaurar esta copia espejo? Se reemplazarán tus datos actuales.')) return;
      const m = (await IDB.all('mirror')).find(x => x.day === b.dataset.mirror);
      try { await restoreData(m.data); toast('✅ Copia restaurada'); setTimeout(() => location.reload(), 700); } catch (err) { toast('⚠️ ' + err.message); }
    });
  }
  async function resetAll() {
    if (!confirm('¿Borrar TODOS tus datos de MiFitApp en este dispositivo? Esta acción no se puede deshacer.')) return;
    if (!confirm('Última confirmación: ¿descargaste un respaldo?')) return;
    Object.values(K).forEach(k => LS.del(k));
    await IDB.clear('workouts'); await IDB.clear('metrics'); await IDB.clear('mirror');
    location.reload();
  }
  function checkBackupReminder() {
    const lastAct = LS.get(K.lastActivity, 0), lastB = LS.get(K.lastBackup, 0), lastR = LS.get(K.lastReminder, 0);
    const DAY = 864e5, now = Date.now();
    if (!lastAct || lastAct <= lastB || now - lastR < DAY || (lastB && now - lastB < DAY)) return;
    const b = $('#banner');
    b.innerHTML = `<span>💾 Tienes entrenamientos sin respaldar.</span><button class="btn btn-primary" id="bnNow">Respaldar</button><button class="btn btn-ghost" id="bnLater">Luego</button>`;
    b.hidden = false;
    $('#bnNow').addEventListener('click', () => { LS.set(K.lastReminder, Date.now()); shareBackup(); });
    $('#bnLater').addEventListener('click', () => { LS.set(K.lastReminder, Date.now()); b.hidden = true; });
  }

  // =========================================================================
  //  TOUR GUIADO (7 pasos) Y PREGUNTAS FRECUENTES
  // =========================================================================
  const TOUR = [
    { tab: 'perfil', sel: '#tab-perfil .card', t: '1 · Tu perfil y salud', x: 'Captura edad, peso, nivel y días disponibles. Con esto calculamos tu plan semanal.' },
    { tab: 'perfil', sel: '#pLesiones', t: '2 · Semáforo de lesiones', x: 'Marca rodillas, espalda baja, hombros o muñecas y excluiremos ejercicios de riesgo automáticamente.' },
    { tab: 'gimnasio', sel: '#equipoLista .eq-grid', t: '3 · Tu gimnasio', x: 'Marca el equipo que tienes. ¿De viaje? Usa “Modo Viaje” para recalcular solo por hoy.' },
    { tab: 'rutina', sel: '#tab-rutina .hero-card', t: '4 · Tu rutina inteligente', x: 'Elige 15, 30, 45 o 60 minutos. Calentamiento → bloque principal → estiramiento. Con API Key de Gemini puedes generarla con IA.' },
    { tab: 'rutina', sel: '#rutinaLista .ex-card', t: '5 · Cambia y aprende', x: 'Toca “Ver técnica” para ver al entrenador animado o “Cambiar ejercicio” para una alternativa equivalente.' },
    { tab: 'entrenador', sel: '#coachIdle .card', t: '6 · Entrenador en vivo', x: 'Avatar arriba, cronómetro abajo. Voz en español, pitidos, vibración y pantalla siempre encendida. En los descansos califica: Fácil / Justo / Muy pesado. Elige entre 14 entrenadores (¡incluye anatómicos con músculos en rojo!). Toca 🎯 para la Vista Enfoque y 🧍 para ver la postura.' },
    { tab: 'progreso', sel: '#kpis', t: '7 · Progreso y respaldo', x: 'Racha, calorías, medidas y gráficas. Haz respaldos desde Perfil y compártelos por WhatsApp o Drive. ¡A entrenar!' }
  ];
  let tourI = 0, tourPrevTab = null;
  function startTour() {
    if ($('#modal').hidden === false) { closeModal(); setTimeout(startTour, 120); return; }
    tourI = 0; tourPrevTab = S.tab;
    $('#tour').hidden = false; pushOverlay('tour'); showTourStep();
  }
  function showTourStep() {
    const s = TOUR[tourI];
    renderTab(s.tab);
    $('#tourStep').textContent = `Paso ${tourI + 1} de ${TOUR.length}`;
    $('#tourTitle').textContent = s.t; $('#tourText').textContent = s.x;
    $('#tourPrev').disabled = tourI === 0;
    $('#tourNext').textContent = tourI === TOUR.length - 1 ? '¡Listo! 💪' : 'Siguiente';
    const target = $(s.sel);
    const spot = $('#tourSpot'), card = $('#tourCard');
    if (!target) { spot.style.cssText = 'top:50%;left:50%;width:0;height:0'; card.style.top = ''; card.style.bottom = '24px'; return; }
    target.scrollIntoView({ block: 'center' });
    requestAnimationFrame(() => {
      const r = target.getBoundingClientRect(); const padd = 6;
      const top = Math.max(4, r.top - padd), h = Math.min(r.height + padd * 2, window.innerHeight * 0.55);
      spot.style.cssText = `top:${top}px;left:${Math.max(4, r.left - padd)}px;width:${Math.min(r.width + padd * 2, window.innerWidth - 8)}px;height:${h}px`;
      if (top + h / 2 < window.innerHeight / 2) { card.style.top = ''; card.style.bottom = 'calc(16px + env(safe-area-inset-bottom))'; }
      else { card.style.bottom = ''; card.style.top = 'calc(16px + env(safe-area-inset-top))'; }
    });
  }
  function endTour() { if (overlays[overlays.length - 1] === 'tour') popOverlayUI(); }
  function endTourUI() {
    $('#tour').hidden = true; LS.set(K.welcomed, true);
    const st = history.state || {};
    renderTab(st.lvl === 'tab' ? st.tab : (tourPrevTab && tourPrevTab !== HOME_TAB && st.lvl === 'tab' ? tourPrevTab : HOME_TAB));
  }
  function bindTour() {
    $('#tourNext').addEventListener('click', () => { if (tourI < TOUR.length - 1) { tourI++; showTourStep(); } else endTour(); });
    $('#tourPrev').addEventListener('click', () => { if (tourI > 0) { tourI--; showTourStep(); } });
    $('#tourSkip').addEventListener('click', endTour);
    window.addEventListener('resize', debounce(() => { if (!$('#tour').hidden) showTourStep(); }, 200));
  }

  const FAQ = [
    ['¿Mis datos están seguros?', 'Sí. Todo se guarda solo en tu teléfono (localStorage e IndexedDB). Nada se envía a servidores, salvo cuando tú usas la IA de Gemini con tu propia clave.'],
    ['¿Funciona sin internet?', 'Sí, al 100%. Instálala con “Agregar a pantalla de inicio” y funcionará offline. Solo la generación con IA requiere conexión.'],
    ['¿Cómo instalo la app?', 'Android/Chrome: menú ⋮ → “Instalar app”. iPhone/Safari: botón Compartir → “Agregar a inicio”.'],
    ['¿Cómo funciona la sobrecarga progresiva?', 'En el descanso tras la última serie de cada ejercicio, toca Fácil, Justo o Muy pesado. La próxima vez ajustamos repeticiones o segundos y te sugerimos subir o bajar resistencia.'],
    ['¿Qué hace el semáforo de lesiones?', 'Excluye ejercicios de alto impacto o riesgo para la zona marcada (por ejemplo saltos para rodillas o lagartijas para muñecas) y elige variantes seguras.'],
    ['¿Cómo obtengo la API Key de Gemini?', 'Entra a aistudio.google.com, inicia sesión con tu cuenta Google y crea una API Key gratuita. Pégala en Perfil → Inteligencia Artificial.'],
    ['¿Por qué la pantalla no se apaga?', 'Durante el entrenamiento activamos “Screen Wake Lock” para que veas el cronómetro. Se libera al pausar o terminar.'],
    ['¿Cómo no pierdo mi progreso?', 'Descarga o comparte tu respaldo (Perfil → Datos y respaldo). Además guardamos copias espejo automáticas de los últimos 7 días dentro del teléfono.'],
    ['El botón “Atrás” de mi celular…', 'Cierra primero ventanas y el reproductor, luego regresa a Mi Rutina y solo después sale de la app. En el entrenamiento te pregunta antes de salir.'],
    ['¿Puedo cambiar de entrenador?', 'Sí: en Perfil → Mi entrenador, o con el botón “🎭 Entrenador” antes de empezar. Hay 14 personajes (humanos, mascotas, objetos y anatómicos) y 6 colores de acento. Tu elección se guarda y va en el respaldo.'],
    ['¿Qué es la preparación de 10 segundos?', 'Antes de cada ejercicio ves la pose inicial con puntos luminosos en las articulaciones a cuidar y flechas de movimiento. Alterna A (pose inicial) y B (punto máximo): en B la cuenta se pausa. Toca “Empezar ya” para saltarla o “🧍 Postura inicial” para consultarla en cualquier momento.'],
    ['¿Qué significan los músculos rojos?', 'Con los entrenadores anatómicos, el rojo intenso con pulso marca los músculos principales del ejercicio y el rojo suave los secundarios.'],
    ['¿Qué es la Vista Enfoque?', 'Toca 🎯 en el entrenamiento: fondo de estudio oscuro, series × repeticiones (o el tiempo) en grande y el avatar a gran tamaño. Tu elección se recuerda.'],
    ['¿Cómo se calculan las calorías?', 'Con valores MET de cada ejercicio × tu peso × tiempo real de trabajo, más el gasto en los descansos. Es una estimación.']
  ];
  function renderFAQ() { $('#faq').innerHTML = FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join(''); }
  function openManual() {
    const body = openModal('📘 Manual MiFitApp', `<button class="btn btn-primary btn-lg" id="mnTour">🧭 Iniciar tour guiado (7 pasos)</button><div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div><p class="version">MiFitApp v${APP_VERSION}</p>`);
    body.querySelector('#mnTour').addEventListener('click', startTour);
  }

  // =========================================================================
  //  CICLO DE PESTAÑAS
  // =========================================================================
  function onTabShown(t, prev) {
    if (prev === 'perfil' && t !== 'perfil') { const g = $('#galeriaPerfil'); if (g._avs) { g._avs.forEach(a => a.destroy()); g._avs = []; g.innerHTML = ''; } }
    updateTrainerLabels();
    if (prev === 'entrenador' && t !== 'entrenador' && idleAvatar && !P.active) idleAvatar.stop();
    if (t === 'perfil') renderPerfil();
    else if (t === 'gimnasio') renderGimnasio();
    else if (t === 'rutina') { ensureRoutine(); renderRutina(); }
    else if (t === 'entrenador') { if (!P.active) renderCoachIdle(); }
    else if (t === 'progreso') renderProgreso();
    $('#headerSub').textContent = { perfil: 'Tu perfil y salud', gimnasio: 'Tu inventario de equipo', rutina: 'Tu rutina de hoy', entrenador: 'Entrenador en vivo', progreso: 'Tu progreso' }[t];
  }

  // ---------- Service Worker ----------
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    // Solo recarga al ACTUALIZAR (ya había un Service Worker); en la primera instalación no hace falta
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const notify = w => {
        const b = $('#banner');
        b.innerHTML = '<span>🚀 Nueva versión disponible.</span><button class="btn btn-primary" id="bnUpd">Actualizar</button>';
        b.hidden = false;
        $('#bnUpd').addEventListener('click', () => w.postMessage('skipWaiting'));
      };
      if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) notify(nw); });
      });
    }).catch(() => { /* sin SW */ });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloaded || P.active) return; reloaded = true; location.reload(); });
  }

  // ---------- Arranque ----------
  async function init() {
    applyTheme(themePref());
    saveSettings();
    $('#appVersion').textContent = `MiFitApp v${APP_VERSION} · Hecho para entrenar sin excusas`;
    await IDB.open();
    await loadData();
    bindPerfil(); bindGimnasio(); bindRutina(); bindPlayer(); bindProgreso(); bindTour(); bindMirrors(); renderFAQ();
    $$('.bottom-nav button').forEach(b => b.addEventListener('click', () => { if (overlays.length) return; goTab(b.dataset.nav); }));
    $('#btnTheme').addEventListener('click', () => { const order = ['light', 'dark', 'auto']; const nx = order[(order.indexOf(themePref()) + 1) % 3]; setTheme(nx); toast({ light: '☀️ Tema claro', dark: '🌙 Tema oscuro', auto: '🌓 Tema automático' }[nx]); });
    $('#btnManual').addEventListener('click', openManual);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlays.length && !(P.active && overlays[overlays.length - 1] === 'player')) popOverlayUI(); });

    // Historial: estado base = pestaña principal
    const qTab = new URLSearchParams(location.search).get('tab');
    const saved = TABS.includes(qTab) ? qTab : LS.get(K.tab, HOME_TAB);
    history.replaceState({ lvl: 'home' }, '');
    if (saved !== HOME_TAB && TABS.includes(saved)) { history.pushState({ lvl: 'tab', tab: saved }, ''); renderTab(saved); }
    else renderTab(HOME_TAB);

    saveMirrorDaily();
    checkBackupReminder();
    registerSW();
    if (!LS.get(K.welcomed, false)) {
      const body = openModal('👋 ¡Bienvenido a MiFitApp!', `<p>Tu entrenador personal de bolsillo: rutinas inteligentes con <b>tu</b> equipo, avatar animado, cronómetro y voz guía. 100% privado y offline.</p>
        <ol class="hint"><li>Completa tu perfil y lesiones.</li><li>Marca tu equipo en Mi Gimnasio.</li><li>Pulsa ▶️ Empezar entrenamiento.</li></ol>
        <button class="btn btn-primary btn-lg" id="wTour">🧭 Hacer el tour (1 min)</button><button class="btn btn-ghost" id="wSkip">Ahora no</button>`, { onClose: () => LS.set(K.welcomed, true) });
      body.querySelector('#wTour').addEventListener('click', startTour);
      body.querySelector('#wSkip').addEventListener('click', closeModal);
    }
  }
  async function saveMirrorDaily() {
    const all = await IDB.all('mirror');
    if (!all.some(m => m.day === dayKey()) && (S.workouts.length || S.metrics.length)) saveMirror();
  }

  // Exponer para depuración/pruebas
  window.MiFitApp = { S, P, version: APP_VERSION, buildSteps, generarOffline };
  document.addEventListener('DOMContentLoaded', init);
})();
