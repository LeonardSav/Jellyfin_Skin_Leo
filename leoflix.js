/* ==========================================================
   LeoFlix : script du thème (v0.38)
   À coller dans Jellyfin : Tableau de bord > JavaScript Injector,
   en mode « connecté seulement » (pas public).
   Ne pas charger ce fichier depuis GitHub : copier-coller le contenu,
   après l'avoir lu. Il ne contient ni adresse, ni nom, ni clé.

   Fonctions :
   1. Menus du lecteur centrés au-dessus du bouton qui les a ouverts
   2. Volume : glisser fiable (Firefox lâche le glisser natif)
   3. Barre de progression : glisser fiable, saut au relâchement
   4. Fiche : lien « retour à la série » au-dessus du logo (mesure le logo réellement affiché)
   5. Fiche d'un film ou d'une série : lien « ← Bibliothèque », même style
   6. Barre du haut : toutes les bibliothèques (Jellyfin en range une partie dans « Plus »)
   7. Accueil : chaque bibliothèque illustrée par un de ses médias au hasard, nom en bas à gauche
   8. Carte « Épisode suivant » : titre court (« 2. Nom » au lieu de « Série - S2:E2 - Nom »)
   9. Menu « LeoFlix » (menu de l'avatar) : thème activé / désactivé et couleur, mémorisés par compte
  10. Lecteur : interrupteur « fond des sous-titres » dans le menu Sous-titres (mémorisé par compte)
  11. Lecteur : noms clairs pour les pistes audio et sous-titres (« English · Stereo », « French · SDH »)
  12. Lecteur : clic sur un épisode du menu épisodes = lecture directe
  13. Page saison : carte « Reprendre / À suivre » en haut, avec l'épisode à continuer
  14. Fiche série : flèches ‹ › sur la rangée des saisons (ordinateur, seulement si elle dépasse)
  15. Page saison : bouton « Infos / Grille » pour la liste des épisodes (mémorisé par compte)
  16. Barre du haut : une capsule en verre par groupe de boutons (bibliothèques, icônes, titre, outils)
  17. Nouvel appareil : réglages de base (sous-titres, « passer » résumés et aperçus) s'il n'a rien choisi

   Chaque fonction vérifie que ce qu'elle cherche existe ; sinon elle ne fait rien
   (utile si un plugin n'est pas installé ou si Jellyfin change).
   ========================================================== */
(() => {
  'use strict';
  if (window.__leoflix) return;          // déjà chargé : on ne double pas les écouteurs
  window.__leoflix = { version: '0.38' };

  /* ---------- Réglages (à adapter si besoin) ---------- */
  const CONFIG = {
    centerMenus: true,     // 1. centrer les menus du lecteur sur leur bouton
    volumeDrag: true,      // 2. glisser du volume
    progressDrag: true,    // 3. glisser de la barre de progression
    edgeMargin: 0.03,      // marge mini des menus avec le bord de l'écran (3 % de la largeur)
    backAboveLogo: true,   // 4. lien retour au-dessus du logo de la fiche
    libraryBack: true,     // 5. lien « ← Bibliothèque » sur les fiches de films et de séries
    allLibraries: true,    // 6. toutes les bibliothèques dans la barre du haut
    libraryImages: true,   // 7. images des bibliothèques sur l'accueil
    upNextTitle: true,     // 8. titre court dans la carte « Épisode suivant »
    themeMenu: true,       // 9. menu LeoFlix : thème on/off et couleur (par compte)
    subtitleBg: true,      // 10. interrupteur du fond des sous-titres
    clearTrackNames: true, // 11. noms clairs des pistes audio et sous-titres
    episodeClickPlays: true, // 12. clic sur un épisode du menu épisodes = lecture
    seasonResume: true,    // 13. carte « Reprendre / À suivre » sur la page saison
    seasonArrows: true,    // 14. flèches ‹ › sur la rangée des saisons (ordinateur)
    episodeView: true,     // 15. bouton « Infos / Grille » de la liste des épisodes (par compte)
    headerCapsules: true,  // 16. une capsule en verre par groupe de boutons de la barre du haut
    capsuleLogo: false,    //     le logo dans la capsule des bibliothèques (true) ou à part (false)
    deviceDefaults: true   // 17. réglages LeoFlix de base sur un appareil qui n'a encore rien choisi
  };

  const playerOpen = () => !!document.querySelector('#videoOsdPage:not(.hide)');

  /* ---------- Socle : « quelque chose a changé dans la page » ----------
     Jellyfin ne recharge jamais la page : il remplace des morceaux. Les fonctions qui ont besoin
     de réagir s'inscrivent avec onChange(fn) ; elles sont relancées au plus toutes les 250 ms
     (changement de page, redimensionnement, éléments ajoutés ou modifiés).
     Règle : chaque fonction est rapide, ne fait rien si rien n'a changé, et n'écrit dans la page
     que si la valeur est différente (sinon elle se relancerait elle-même). */
  const tasks = [];
  let queued = false, lastRun = 0;
  const runTasks = () => {
    queued = false; lastRun = Date.now();
    for (const t of tasks) { try { t(); } catch (err) { console.warn('[LeoFlix]', err); } }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    setTimeout(runTasks, Math.max(0, 250 - (Date.now() - lastRun)));
  };
  const onChange = fn => { tasks.push(fn); schedule(); };
  document.addEventListener('viewshow', schedule, true);
  addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
  });
  // Serveur : client de Jellyfin, avec les droits du compte connecté (aucune adresse ni clé ici)
  const api = () => window.ApiClient;
  const userId = () => { const a = api(); return a && a.getCurrentUserId && a.getCurrentUserId(); };
  // Adresse d'une bibliothèque, comme le routeur de Jellyfin
  const ROUTES = { movies: 'movies', tvshows: 'tv', music: 'music', books: 'books', homevideos: 'homevideos',
    musicvideos: 'musicvideos', boxsets: 'boxsets', playlists: 'playlists' };
  const libraryUrl = v => ROUTES[v.CollectionType]
    ? `#/${ROUTES[v.CollectionType]}?topParentId=${v.Id}&collectionType=${v.CollectionType}`
    : (v.CollectionType ? `#/list?parentId=${v.Id}` : `#/mixed?topParentId=${v.Id}&collectionType=mixed`);
  // Bibliothèques du compte (gardées 1 minute)
  let viewsCache = null, viewsAt = 0, viewsPending = null;
  const getViews = () => {
    if (viewsCache && Date.now() - viewsAt < 60000) return Promise.resolve(viewsCache);
    if (!viewsPending) {
      const a = api(), u = userId();
      if (!a || !u) return Promise.resolve(null);
      viewsPending = a.getUserViews({}, u)
        .then(r => { viewsCache = (r && r.Items) || []; viewsAt = Date.now(); return viewsCache; })
        .catch(() => null).finally(() => { viewsPending = null; });
    }
    return viewsPending;
  };
  const isFr = () => /^fr/i.test(document.documentElement.lang || '');
  const tr = (fr, en) => (isFr() ? fr : en);
  const idFromHref = href => (String(href || '').match(/(?:topParentId|parentId)=([0-9a-f]{32})/i) || [])[1];

  // Style des éléments créés par le script (panneau, interrupteurs) : indépendant du thème,
  // pour rester lisible même quand le thème est désactivé
  const uiCss = css => {
    let s = document.getElementById('lf-ui');
    if (!s) { s = document.createElement('style'); s.id = 'lf-ui'; document.head.appendChild(s); }
    s.textContent += css;
  };
  uiCss(`
    .lf-switch { all: unset; box-sizing: border-box; width: 42px; height: 24px; border-radius: 999px; padding: 3px; cursor: pointer; flex: none;
      background: rgba(255,255,255,.18); transition: background .2s; display: inline-flex; }
    .lf-switch span { width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.4);
      margin-left: 0; transition: margin-left .2s cubic-bezier(.2,.8,.2,1); }
    .lf-switch[aria-checked="true"] { background: var(--lf-ui-accent, #c4c9d2); }
    .lf-switch[aria-checked="true"] span { margin-left: 18px; }
    .lf-switch:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  `);

  /* Préférences par compte (couleur, thème, fond des sous-titres) : enregistrées sur le serveur dans les
     « préférences d'affichage » du compte (tous ses appareils), avec une copie locale pour s'appliquer dès l'ouverture.
     Prefs.get(clé), Prefs.set(clé, valeur), Prefs.watch(fn) : fn est appelée tout de suite puis à chaque changement. */
  const PREF_DEFAULTS = { theme: true, color: 'argent', subbg: 'glass', ep: 'list' };
  const Prefs = (() => {
    let data = { ...PREF_DEFAULTS }, user = null, timer = null;
    const subs = [];
    const KEY = u => 'leoflix:prefs:' + u;
    const read = u => { try { return JSON.parse(localStorage.getItem(KEY(u))); } catch (e) { return null; } };
    const write = () => { try { localStorage.setItem(KEY(user), JSON.stringify(data)); } catch (e) { /* stockage indisponible */ } };
    const emit = () => subs.forEach(f => { try { f(data); } catch (e) { console.warn('[LeoFlix]', e); } });
    const parse = cp => {
      const d = { ...PREF_DEFAULTS };
      if (cp.theme != null) d.theme = cp.theme !== 'false';
      if (cp.color) d.color = cp.color;
      if (cp.subbg) d.subbg = cp.subbg;
      if (cp.ep) d.ep = cp.ep;
      return d;
    };
    const push = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const a = api(), u = userId();
        if (!a || !u || u !== user) return;
        a.getDisplayPreferences('leoflix', u, 'leoflix').then(dp => {
          dp = dp || { Id: 'leoflix' };
          dp.CustomPrefs = Object.assign({}, dp.CustomPrefs, { theme: String(data.theme), color: data.color, subbg: data.subbg, ep: data.ep });
          return a.updateDisplayPreferences('leoflix', dp, u, 'leoflix');
        }).catch(err => console.warn('[LeoFlix] préférences non enregistrées sur le serveur', err));
      }, 400);
    };
    return {
      get: k => data[k],
      set: (k, v) => { if (data[k] === v) return; data = { ...data, [k]: v }; write(); emit(); push(); },
      watch: f => { subs.push(f); try { f(data); } catch (e) { console.warn('[LeoFlix]', e); } },
      // Appelée par le socle : charge les préférences du compte connecté (local tout de suite, serveur ensuite)
      check: () => {
        const u = userId();
        if (!u || u === user) return;
        user = u;
        data = { ...PREF_DEFAULTS, ...(read(u) || {}) };
        emit();
        api().getDisplayPreferences('leoflix', u, 'leoflix').then(dp => {
          const cp = dp && dp.CustomPrefs;
          if (user !== u || !cp || !(cp.color || cp.theme || cp.subbg || cp.ep)) return;
          data = parse(cp); write(); emit();
        }).catch(() => { /* hors ligne : on garde la copie locale */ });
      }
    };
  })();
  onChange(Prefs.check);

  // Lancer un élément sur CET appareil, via le serveur (comme « Lire sur… » d'une télécommande Jellyfin),
  // en reprenant là où il en était. Indépendant des boutons des plugins.
  let playBusy = false;
  const playHere = async id => {
    const a = api(), u = userId();
    if (!a || !u || playBusy) return false;
    playBusy = true;
    try {
      const dev = a.deviceId();
      const [sessions, item] = await Promise.all([a.getSessions({ DeviceId: dev }), a.getItem(u, id)]);
      const s = (sessions || []).find(x => x.DeviceId === dev);
      if (!s) throw new Error('session introuvable');
      const ticks = (item && item.UserData && item.UserData.PlaybackPositionTicks) || 0;
      await a.sendPlayCommand(s.Id, { ItemIds: id, PlayCommand: 'PlayNow', StartPositionTicks: ticks });
      return true;
    } catch (err) {
      console.warn('[LeoFlix] lecture impossible', err);
      return false;
    } finally { playBusy = false; }
  };

  // Écrit une variable CSS seulement si elle change
  const setVar = (el, name, value) => { if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value); };

  /* ---------- 1. Menus centrés ----------
     Le script ne touche qu'à une variable CSS (--lf-menu-left) posée sur le menu.
     Jellyfin peut réécrire left/top autant qu'il veut : le CSS (left: var(--lf-menu-left) !important)
     reprend la main. La hauteur est gérée par le CSS seul (bottom: var(--lf-menu-bottom)). */
  if (CONFIG.centerMenus) {
    const MENU = '.actionSheet, #popupFocusContainer';
    let lastBtn = null;

    const placeEl = el => {
      if (!lastBtn || !document.body.contains(lastBtn) || !playerOpen()) return;
      const w = el.offsetWidth;
      if (!w) return;
      const b = lastBtn.getBoundingClientRect();
      const cx = b.left + b.width / 2, m = innerWidth * CONFIG.edgeMargin;
      const left = Math.round(Math.min(Math.max(cx - w / 2, m), innerWidth - m - w)) + 'px';
      if (el.style.getPropertyValue('--lf-menu-left') !== left) el.style.setProperty('--lf-menu-left', left);
    };
    const place = () => document.querySelectorAll(MENU).forEach(placeEl);

    // Retenir le bouton du lecteur qui va ouvrir un menu
    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest && e.target.closest('.videoOsdBottom .buttons button');
      if (btn) lastBtn = btn;
    }, true);
    // Placer juste après le clic, puis rattraper un affichage un peu tardif
    document.addEventListener('click', () => {
      if (!playerOpen()) return;
      place(); requestAnimationFrame(place); setTimeout(place, 150);
    });
    // Placer dès qu'un menu apparaît ou change de contenu (avant l'affichage : pas de saut)
    new MutationObserver(muts => {
      if (!lastBtn || !playerOpen()) return;
      for (const mu of muts) {
        const t = mu.target.nodeType === 1 ? mu.target : mu.target.parentElement;
        if ((t && t.closest && t.closest(MENU)) ||
            [...mu.addedNodes].some(n => n.nodeType === 1 && (n.matches(MENU) || n.querySelector(MENU)))) { place(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', place);
  }

  /* Glisser piloté : on « capture » la souris dès le clic, pour que le geste continue
     même si elle sort de la barre, et on transmet la valeur à Jellyfin par ses propres événements. */
  const drag = (container, input, onMove, onEnd, e) => {
    e.preventDefault(); e.stopPropagation();
    container.setPointerCapture(e.pointerId);
    onMove(e);
    const end = () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', end);
      container.removeEventListener('lostpointercapture', end);
      onEnd && onEnd();
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', end);
    container.addEventListener('lostpointercapture', end);
  };
  const ratio = (ev, el) => { const r = el.getBoundingClientRect(); return r.width ? Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) : 0; };
  const fire = (input, type) => input.dispatchEvent(new Event(type, { bubbles: true }));

  /* ---------- 2. Volume ----------
     La classe lf-vol-drag garde la barre ouverte pendant le geste (voir le CSS). */
  if (CONFIG.volumeDrag) {
    document.addEventListener('pointerdown', e => {
      const c = e.target.closest && e.target.closest('.videoOsdBottom .osdVolumeSliderContainer');
      if (!c || e.button !== 0) return;
      const inp = c.querySelector('input');
      if (!inp) return;
      const wrap = c.closest('.volumeButtons');
      wrap && wrap.classList.add('lf-vol-drag');
      drag(c, inp, ev => {
        const v = Math.round(ratio(ev, c) * 100);
        if (+inp.value !== v) { inp.value = v; fire(inp, 'input'); fire(inp, 'change'); }
      }, () => wrap && wrap.classList.remove('lf-vol-drag'), e);
    }, true);
  }

  /* ---------- 4. Retour à la série au-dessus du logo ----------
     Le logo est une image « contenue » dans une zone fixe, calée en bas : sa hauteur visible dépend
     de chaque image (« The Office » est large et bas, un autre logo haut et étroit).
     Le script lit les dimensions de l'image, calcule la hauteur réellement dessinée et la donne au CSS
     (--lf-logo-h + classe lf-logo-ok) ; le CSS place le lien juste au-dessus. Sans logo : rien ne change. */
  if (CONFIG.backAboveLogo) {
    const sizes = new Map(); // adresse de l'image -> { w, h } (null = en cours de chargement ou illisible)
    onChange(() => {
      const page = document.querySelector('#itemDetailPage:not(.hide)');
      if (!page) return;
      const logo = page.querySelector('.detailLogo');
      const url = logo && !logo.classList.contains('hide')
        && (getComputedStyle(logo).backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1];
      if (!url) { page.classList.remove('lf-logo-ok'); return; }
      if (!sizes.has(url)) {
        sizes.set(url, null);
        const img = new Image();
        img.onload = () => { sizes.set(url, { w: img.naturalWidth, h: img.naturalHeight }); schedule(); };
        img.src = url;
      }
      const nat = sizes.get(url);
      const r = logo.getBoundingClientRect();
      if (!nat || !nat.w || !nat.h || !r.width || !r.height) return;
      setVar(page, '--lf-logo-h', Math.round(Math.min(r.width / nat.w, r.height / nat.h) * nat.h) + 'px');
      if (!page.classList.contains('lf-logo-ok')) page.classList.add('lf-logo-ok');
    });
  }

  /* ---------- 5. Lien « ← Bibliothèque » sur les fiches de films et de séries ----------
     Les saisons et épisodes ont déjà « ← The Office » (Jellyfin) ; les films et séries n'ont rien.
     Le script demande au serveur l'élément et ses ancêtres, trouve sa bibliothèque et ajoute
     le même lien (même balise que Jellyfin : il prend donc le même style et se place au-dessus du logo). */
  if (CONFIG.libraryBack) {
    const TYPES = ['Movie', 'Series', 'BoxSet'];
    const found = new Map(); // id de l'élément -> { name, url } | false (pas de bibliothèque) | null (en cours)
    onChange(() => {
      const page = document.querySelector('#itemDetailPage:not(.hide)');
      const box = page && page.querySelector('.nameContainer');
      const id = (location.hash.match(/[?&]id=([0-9a-f]{32})/i) || [])[1];
      if (!box || !id) return;
      const mine = box.querySelector('.lf-libback');
      if (box.querySelector('h1.parentName:not(.lf-libback)')) { mine && mine.remove(); return; } // Jellyfin a déjà un parent
      const lib = found.get(id);
      if (lib === undefined) {
        const a = api(), u = userId();
        if (!a || !u) return;
        found.set(id, null);
        Promise.all([a.getItem(u, id), a.getAncestorItems(id, u)]).then(([item, parents]) => {
          const v = TYPES.includes(item && item.Type) && (parents || []).find(p => p.Type === 'CollectionFolder');
          found.set(id, v ? { name: v.Name, url: libraryUrl(v) } : false);
          schedule();
        }).catch(() => found.set(id, false));
        return;
      }
      if (!lib) { mine && mine.remove(); return; }
      if (mine && mine.dataset.id === id) return;
      mine && mine.remove();
      const h1 = document.createElement('h1');
      h1.className = 'parentName lf-libback'; h1.dataset.id = id;
      const bdi = document.createElement('bdi'), link = document.createElement('a');
      link.className = 'button-link'; link.href = lib.url; link.textContent = lib.name;
      bdi.appendChild(link); h1.appendChild(bdi);
      box.insertBefore(h1, box.firstChild);
    });
  }

  /* ---------- 6. Toutes les bibliothèques dans la barre du haut ----------
     Jellyfin n'en affiche que 3, 5 ou 8 selon la largeur et range le reste dans « Plus ».
     Le script copie une capsule existante pour chaque bibliothèque manquante et la met en fin de ligne
     (jamais entre les éléments de Jellyfin), puis cache « Plus » (CSS : classe lf-all-views).
     Si Jellyfin affiche une bibliothèque de plus ou de moins (redimensionnement), la copie est ajustée. */
  if (CONFIG.allLibraries) {
    onChange(() => {
      const stack = document.querySelector('header.MuiAppBar-root:not(.videoOsd-appBar) .MuiToolbar-root > .MuiStack-root');
      if (!stack) return;
      if (!stack.classList.contains('lf-js')) stack.classList.add('lf-js'); // le CSS sait que le script mesure le débordement
      const native = [...stack.querySelectorAll(':scope > a.MuiButton-root:not(.MuiButton-sizeLarge):not(.lf-view)')];
      const nativeIds = new Set(native.map(a => idFromHref(a.getAttribute('href'))).filter(Boolean));
      const scrolls = stack.scrollWidth > stack.clientWidth + 2;
      if (stack.classList.contains('lf-scrolls') !== scrolls) stack.classList.toggle('lf-scrolls', scrolls);
      getViews().then(views => {
        if (!views || !stack.isConnected) return;
        const model = native.find(a => idFromHref(a.getAttribute('href')));
        if (!model) return;
        const missing = views.filter(v => !nativeIds.has(v.Id));
        // Retirer les copies devenues inutiles
        stack.querySelectorAll(':scope > .lf-view').forEach(c => { if (!missing.some(v => v.Id === c.dataset.id)) c.remove(); });
        for (const v of missing) {
          if (stack.querySelector(`:scope > .lf-view[data-id="${v.Id}"]`)) continue;
          const same = native.find(a => { const n = views.find(x => x.Id === idFromHref(a.getAttribute('href'))); return n && n.CollectionType === v.CollectionType; });
          const c = (same || model).cloneNode(true);
          c.classList.add('lf-view'); c.dataset.id = v.Id;
          c.classList.remove('Mui-focusVisible', 'MuiButton-colorPrimary', 'MuiButton-textPrimary');
          c.setAttribute('href', libraryUrl(v));
          c.removeAttribute('aria-current');
          const label = [...c.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim());
          if (label) label.textContent = v.Name; else c.appendChild(document.createTextNode(v.Name));
          stack.appendChild(c);
        }
        const all = missing.length === 0 || missing.every(v => stack.querySelector(`:scope > .lf-view[data-id="${v.Id}"]`));
        if (stack.classList.contains('lf-all-views') !== all) stack.classList.toggle('lf-all-views', all);
      });
    });
  }

  /* ---------- 7. Images des bibliothèques sur l'accueil ----------
     L'image générée par Jellyfin a le nom de la bibliothèque imprimé au milieu.
     Pour chaque vignette de bibliothèque, le script demande un film ou une série au hasard qui a une image
     de fond, la pose par-dessus (sous le voile de survol) et ajoute le nom en bas à gauche (au-dessus du voile).
     Nouveau tirage à chaque passage sur l'accueil. */
  if (CONFIG.libraryImages) {
    let visit = 0;
    document.addEventListener('viewshow', e => { if (e.target && e.target.classList && e.target.classList.contains('homePage')) visit++; }, true);
    onChange(() => {
      const cards = document.querySelectorAll('.homeSectionsContainer .card[data-type="CollectionFolder"][data-id]');
      if (!cards.length) return;
      getViews().then(views => {
        const a = api(), u = userId();
        if (!views || !a || !u) return;
        cards.forEach(card => {
          if (!card.isConnected || card.dataset.lfVisit === String(visit)) return;
          const scal = card.querySelector('.cardScalable');
          const v = views.find(x => x.Id === card.dataset.id);
          if (!scal || !v) return;
          card.dataset.lfVisit = String(visit);
          card.classList.add('lf-lib');
          let name = scal.querySelector(':scope > .lf-libname');
          if (!name) { name = document.createElement('div'); name.className = 'lf-libname'; scal.appendChild(name); }
          name.textContent = v.Name;
          a.getItems(u, { ParentId: v.Id, Recursive: true, IncludeItemTypes: 'Movie,Series', ImageTypes: 'Backdrop',
            SortBy: 'Random', Limit: 1, EnableTotalRecordCount: false, Fields: 'BackdropImageTags' }).then(r => {
            const it = r && r.Items && r.Items[0];
            const tag = it && it.BackdropImageTags && it.BackdropImageTags[0];
            if (!tag) { card.classList.remove('lf-lib'); return; } // rien à montrer : on garde l'image de Jellyfin
            const url = a.getScaledImageUrl(it.Id, { type: 'Backdrop', maxWidth: 720, tag, quality: 90 });
            const img = new Image();
            img.onload = () => {
              let el = scal.querySelector(':scope > .lf-libimg');
              if (!el) {
                el = document.createElement('div'); el.className = 'lf-libimg';
                const over = scal.querySelector(':scope > .cardOverlayContainer');
                scal.insertBefore(el, over || name);
              }
              el.style.backgroundImage = `url("${url}")`;
              requestAnimationFrame(() => el.classList.add('lf-on'));
            };
            img.onerror = () => card.classList.remove('lf-lib');
            img.src = url;
          }).catch(() => card.classList.remove('lf-lib'));
        });
      });
    });
  }

  /* ---------- 8. Titre court dans la carte « Épisode suivant » ----------
     Jellyfin écrit « Série - S2:E2 - Nom » d'un seul bloc ; le script garde « 2. Nom ». */
  if (CONFIG.upNextTitle) {
    onChange(() => {
      const t = document.querySelector('.upNextDialog .upNextDialog-title');
      if (!t) return;
      const txt = t.textContent;
      if (txt === t.dataset.lfShort) return;
      const m = txt.match(/S\d+:E(\d+)(?:-\d+)?\s*-\s*(.+)$/);
      if (!m) return;
      const short = `${m[1]}. ${m[2]}`;
      t.dataset.lfShort = short; t.textContent = short; t.title = txt;
    });
  }

  /* ---------- 9. Menu « LeoFlix » : thème activé / désactivé et couleur, par compte ----------
     Entrée « LeoFlix » dans le menu de l'avatar (sous Paramètres) qui ouvre un petit panneau.
     Thème désactivé = la feuille de style du thème est coupée ; le panneau garde son propre style (uiCss)
     pour qu'on puisse toujours le rallumer. */
  if (CONFIG.themeMenu) {
    const PALETTE = [
      { id: 'argent',   fr: 'Argent',       en: 'Silver',     c: [196, 201, 210], alt: [176, 184, 196], dark: true },
      { id: 'acier',    fr: 'Bleu acier',   en: 'Steel blue', c: [70, 130, 180],  alt: [46, 134, 210],  dark: false },
      { id: 'ambre',    fr: 'Ambre',        en: 'Amber',      c: [232, 168, 76],  alt: [245, 158, 40],  dark: true },
      { id: 'brique',   fr: 'Rouge brique', en: 'Brick red',  c: [192, 72, 60],   alt: [214, 84, 66],   dark: false },
      { id: 'emeraude', fr: 'Émeraude',     en: 'Emerald',    c: [52, 168, 122],  alt: [38, 190, 132],  dark: false }
    ];
    // Feuilles du thème : celle de Jellyfin qui importe le thème ; pendant un essai par la console, la copie #lf-test
    const themeStyles = () => {
      const test = document.getElementById('lf-test');
      return test ? [test] : [...document.querySelectorAll('style')].filter(s => s.id !== 'lf-ui' && s.textContent.includes('Jellyfin_Skin_Leo'));
    };
    let panel = null;
    const refreshPanel = () => {
      if (!panel) return;
      panel.querySelector('.lf-switch').setAttribute('aria-checked', String(Prefs.get('theme')));
      panel.querySelectorAll('.lf-swatch').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === Prefs.get('color'))));
    };
    let lastTheme = null;
    Prefs.watch(d => {
      const p = PALETTE.find(x => x.id === d.color) || PALETTE[0], r = document.documentElement;
      setVar(r, '--lf-accent', p.c.join(', '));
      setVar(r, '--lf-accent-alt', p.alt.join(', '));
      setVar(r, '--lf-accent-ch', p.c.join(' '));
      setVar(r, '--lf-on-accent', p.dark ? '14, 15, 20' : '255, 255, 255');
      setVar(r, '--lf-ui-accent', `rgb(${p.c.join(', ')})`);
      if (d.theme !== lastTheme) { // seulement quand ça change : laisse le bouton de comparaison du patch tranquille
        lastTheme = d.theme;
        themeStyles().forEach(s => { s.disabled = !d.theme; });
        r.classList.toggle('lf-theme-off', !d.theme);
      }
      refreshPanel();
    });

    uiCss(`
      #app-user-menu .lf-menu-entry .lf-dot { width: 14px; height: 14px; border-radius: 50%; margin-left: 4px; display: inline-block;
        background: var(--lf-ui-accent, #c4c9d2); box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 0 8px var(--lf-ui-accent, #c4c9d2); }
      #lf-panel { position: fixed; z-index: 1300; width: max-content; min-width: 210px; max-width: calc(100vw - 24px); box-sizing: border-box; padding: 16px 16px 14px;
        border-radius: 18px; color: #fff; font-family: 'DM Sans', 'Noto Sans', system-ui, sans-serif; font-size: 14px;
        background: linear-gradient(135deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,0) 60%), rgba(16,17,22,.86);
        -webkit-backdrop-filter: blur(24px) saturate(150%); backdrop-filter: blur(24px) saturate(150%);
        border: 1px solid rgba(255,255,255,.1); box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 24px 60px rgba(0,0,0,.55);
        animation: lfPanelIn .28s cubic-bezier(.22,1,.36,1) both; }
      @keyframes lfPanelIn { from { opacity: 0; } to { opacity: 1; } }
      #lf-panel .lf-p-title { font-size: 1.15rem; font-weight: 800; letter-spacing: -.01em; margin: 0 0 12px; }
      #lf-panel .lf-p-row { display: flex; align-items: center; justify-content: space-between; gap: 22px; padding: 6px 0 12px;
        border-bottom: 1px solid rgba(255,255,255,.08); cursor: pointer; }
      #lf-panel .lf-p-row + .lf-p-row { border-bottom: 0; padding: 12px 0 2px; cursor: default; }
      #lf-panel .lf-p-swatches { display: flex; gap: 8px; }
      #lf-panel .lf-swatch { all: unset; box-sizing: border-box; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; flex: none;
        background: rgb(var(--c)); box-shadow: 0 0 0 1px rgba(255,255,255,.15); transition: box-shadow .2s; }
      #lf-panel .lf-swatch:hover, #lf-panel .lf-swatch:focus-visible { box-shadow: 0 0 0 2px #0e0f14, 0 0 0 4px rgba(var(--c), .55); }
      #lf-panel .lf-swatch[aria-checked="true"] { box-shadow: 0 0 0 2px #0e0f14, 0 0 0 4px rgb(var(--c)), 0 0 12px rgba(var(--c), .7); }
    `);

    const closePanel = () => { if (panel) { panel.remove(); panel = null; } };
    const openPanel = () => {
      closePanel();
      panel = document.createElement('div');
      panel.id = 'lf-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'LeoFlix');
      // Pastilles seules, en ligne ; le nom reste en infobulle et pour les lecteurs d'écran
      const sw = PALETTE.map(p => `<button type="button" class="lf-swatch" role="radio" data-id="${p.id}" style="--c: ${p.c.join(', ')}"
        title="${tr(p.fr, p.en)}" aria-label="${tr(p.fr, p.en)}"></button>`).join('');
      panel.innerHTML = `<div class="lf-p-title">LeoFlix</div>
        <div class="lf-p-row"><span>${tr('Thème LeoFlix', 'LeoFlix theme')}</span><button type="button" class="lf-switch" role="switch" aria-checked="true"><span></span></button></div>
        <div class="lf-p-row"><span>${tr('Couleur', 'Color')}</span><div class="lf-p-swatches" role="radiogroup">${sw}</div></div>`;
      panel.querySelector('.lf-p-row').addEventListener('click', () => Prefs.set('theme', !Prefs.get('theme')));
      panel.querySelectorAll('.lf-swatch').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); Prefs.set('color', b.dataset.id); }));
      const bar = document.querySelector('header.MuiAppBar-root:not(.videoOsd-appBar)');
      const top = bar ? Math.round(bar.getBoundingClientRect().bottom) + 8 : 72;
      panel.style.top = top + 'px'; panel.style.right = Math.max(12, Math.round(innerWidth * 0.03)) + 'px';
      document.body.appendChild(panel);
      refreshPanel();
      panel.querySelector('.lf-switch').focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', e => { if (panel && !panel.contains(e.target) && !e.target.closest('.lf-menu-entry')) closePanel(); }, true);
    document.addEventListener('keydown', e => { if (panel && e.key === 'Escape') closePanel(); });
    document.addEventListener('viewshow', closePanel, true);

    onChange(() => {
      // Thème désactivé : couper aussi une feuille du thème recréée entre-temps
      if (!Prefs.get('theme')) themeStyles().forEach(s => { if (!s.disabled) s.disabled = true; });

      // Entrée « LeoFlix » dans le menu de l'avatar, sous « Paramètres »
      const list = document.querySelector('#app-user-menu .MuiMenu-list, #app-user-menu [role="menu"]');
      if (!list || list.querySelector('.lf-menu-entry')) return;
      const settings = list.querySelector('a[href*="mypreferencesmenu"]');
      const model = settings || list.querySelector('.MuiMenuItem-root');
      if (!model) return;
      const item = model.cloneNode(true);
      item.classList.add('lf-menu-entry'); item.removeAttribute('href'); item.setAttribute('role', 'menuitem'); item.tabIndex = -1;
      const icon = item.querySelector('.MuiListItemIcon-root');
      if (icon) icon.innerHTML = '<span class="lf-dot"></span>';
      const label = item.querySelector('.MuiListItemText-root .MuiTypography-root') || item.querySelector('.MuiListItemText-root');
      if (label) label.textContent = 'LeoFlix';
      item.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const backdrop = document.querySelector('#app-user-menu .MuiBackdrop-root');
        if (backdrop) backdrop.click(); else document.activeElement && document.activeElement.blur();
        setTimeout(openPanel, 60);
      });
      (settings || model).after(item);
    });
  }

  /* ---------- 10 et 11. Menus Audio et Sous-titres du lecteur ----------
     Le script retient quel bouton a ouvert le menu (Audio ou Sous-titres), puis :
     10. ajoute en bas du menu Sous-titres un interrupteur « Fond » (verre / aucun), mémorisé par compte.
         Ce n'est pas une ligne de piste : Jellyfin l'ignore, le menu reste ouvert ;
     11. remplace les noms techniques (« VOA AC3 5.1 @448kbps - English - Dolby Digital ») par des noms clairs
         (« English · 5.1 »), dans la langue de l'interface. Nom complet en infobulle ; si deux pistes ont le même
         nom clair, leur titre d'origine est ajouté en petit pour les distinguer. Nom illisible : on n'y touche pas. */
  if (CONFIG.subtitleBg) {
    Prefs.watch(d => {
      const r = document.documentElement, off = d.subbg === 'none';
      if ((r.dataset.lfSubbg === 'none') !== off) { if (off) r.dataset.lfSubbg = 'none'; else delete r.dataset.lfSubbg; }
      document.querySelectorAll('.lf-sub-row .lf-switch').forEach(s => s.setAttribute('aria-checked', String(!off)));
    });
    uiCss(`
      .lf-sub-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 4px 0 0; padding: 10px 16px 8px 14px;
        border-top: 1px solid rgba(255,255,255,.1); cursor: pointer; font-size: .88rem; color: #fff; }
      .lf-sub-row > span:first-child { line-height: 24px; }
    `);
  }
  if (CONFIG.clearTrackNames) uiCss(`.lf-track-extra { margin-left: 6px; font-size: .78em; opacity: .55; }`);

  if (CONFIG.subtitleBg || CONFIG.clearTrackNames) {
    let pending = null;
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest && e.target.closest('.videoOsdBottom .btnSubtitles, .videoOsdBottom .btnAudio');
      if (b) pending = { kind: b.classList.contains('btnAudio') ? 'audio' : 'sub', at: Date.now() };
    }, true);

    // Langues : nom (anglais ou dans la langue elle-même) -> code, construit une fois à la première utilisation
    let langMap = null;
    const langs = () => {
      if (langMap) return langMap;
      langMap = new Map();
      const add = (locale, code) => {
        try { const n = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(code); if (n) langMap.set(n.toLowerCase(), code); } catch (e) { /* code inconnu */ }
      };
      for (let i = 97; i < 123; i++) for (let j = 97; j < 123; j++) { const c = String.fromCharCode(i, j); add('en', c); add(c, c); }
      return langMap;
    };
    const SKIP = /^(default|par défaut|défaut|external|externe|aac|ac-?3|e-?ac-?3|dts([ -]?hd.*)?|truehd.*|flac|opus|mp3|vorbis|pcm.*|subrip|srt|ass|ssa|pgs(sub)?|dvd_?sub|dvb_subtitle|vobsub|web_?vtt|vtt|mov_text|dolby digital.*|dolby atmos|atmos|hdmv_pgs_subtitle)$/i;
    const clearName = (text, kind) => {
      let code = null, ch = null, comment = false, variant = '';
      const flags = new Set(), custom = [];
      for (const raw of text.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean)) {
        let p = raw.replace(/\s*\[(cc|sdh)\]\s*/ig, () => { flags.add('sdh'); return ' '; }).trim();
        const low = p.toLowerCase(), par = low.match(/^(.+?)\s*\((.+)\)$/);
        const lc = langs().get(low) || (par && langs().get(par[1]));
        if (lc) {
          if (!code) { code = lc; if (!langs().get(low) && par) variant = p.match(/\((.+)\)$/)[1]; }
          else if (lc !== code) custom.push(raw);
          continue;
        }
        if (SKIP.test(p)) continue;
        if (/^(forced|forcés?|forcées?)$/i.test(p)) { flags.add('forced'); continue; }
        if (/hearing impaired|malentendants?|^sdh$|^cc$/i.test(p)) { flags.add('sdh'); continue; }
        if (/^(stereo|stéréo)$/i.test(p)) { ch = 'stereo'; continue; }
        if (/^mono$/i.test(p)) { ch = 'mono'; continue; }
        const m = p.match(/^([1-9]\.[01])( .*)?$/);
        if (m) { ch = m[1] === '2.0' ? 'stereo' : m[1]; continue; }
        if (/comment/i.test(p)) comment = true;
        // Titre libre (« VOA AC3 5.1 @448kbps ») : on y lit quand même les canaux
        const inner = p.match(/(?:^|\s)([1-9]\.[01])(?:\s|$)/);
        if (inner && !ch) ch = inner[1] === '2.0' ? 'stereo' : inner[1];
        if (!ch && /\b(stereo|stéréo)\b/i.test(p)) ch = 'stereo';
        custom.push(raw);
      }
      if (!code) return null;
      let name = '';
      try { name = new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'language' }).of(code) || ''; } catch (e) { name = ''; }
      if (!name) return null;
      const out = [name.charAt(0).toLocaleUpperCase() + name.slice(1) + (variant ? ` (${variant})` : '')];
      if (kind === 'audio' && ch) out.push(ch === 'stereo' ? tr('Stéréo', 'Stereo') : ch === 'mono' ? 'Mono' : ch);
      if (flags.has('forced')) out.push(tr('forcés', 'forced'));
      if (flags.has('sdh')) out.push(tr('malentendants', 'SDH'));
      if (comment) out.push(tr('commentaire', 'commentary'));
      return { name: out.join(' · '), extra: custom[0] || '' };
    };
    const renameTracks = sheet => {
      const rows = [...sheet.querySelectorAll('.actionSheetMenuItem .actionSheetItemText')].filter(t => !t.dataset.lfOrig);
      if (!rows.length) return;
      const done = rows.map(t => { const orig = t.textContent.trim(); t.dataset.lfOrig = orig; return { t, orig, c: clearName(orig, sheet.dataset.lfKind) }; })
        .filter(x => x.c);
      const count = {};
      done.forEach(x => { count[x.c.name] = (count[x.c.name] || 0) + 1; });
      done.forEach(({ t, orig, c }) => {
        t.textContent = c.name; t.title = orig;
        if (count[c.name] > 1 && c.extra) { const s = document.createElement('span'); s.className = 'lf-track-extra'; s.textContent = c.extra; t.appendChild(s); }
      });
    };
    // « Off » (pas de sous-titres) en haut de la liste : Jellyfin reconnaît chaque choix à son numéro, pas à sa place
    const offFirst = sheet => {
      const off = sheet.querySelector('.actionSheetMenuItem[data-id="-1"]');
      if (off && off.parentElement && off.parentElement.firstElementChild !== off) off.parentElement.insertBefore(off, off.parentElement.firstElementChild);
    };
    // Aligner le texte de l'interrupteur sur celui des pistes (après la colonne de la coche)
    const alignRow = sheet => {
      const row = sheet.querySelector('.lf-sub-row'), ref = sheet.querySelector('.actionSheetMenuItem .actionSheetItemText');
      if (!row || !ref) return;
      const pad = Math.round(ref.getBoundingClientRect().left - row.getBoundingClientRect().left);
      if (pad > 0 && pad < 120) setVar(row, 'padding-left', pad + 'px');
    };
    const addSubToggle = sheet => {
      if (sheet.querySelector('.lf-sub-row')) return;
      const box = sheet.querySelector('.actionSheetScroller') || sheet.querySelector('.actionSheetContent');
      if (!box) return;
      const row = document.createElement('div');
      row.className = 'lf-sub-row';
      row.innerHTML = `<span>${tr('Fond', 'Background')}</span><button type="button" class="lf-switch" role="switch" aria-checked="${Prefs.get('subbg') !== 'none'}"><span></span></button>`;
      row.addEventListener('click', e => { e.stopPropagation(); Prefs.set('subbg', Prefs.get('subbg') === 'none' ? 'glass' : 'none'); });
      box.appendChild(row);
    };
    onChange(() => {
      if (!playerOpen()) return;
      if (pending && Date.now() - pending.at < 4000) {
        const fresh = [...document.querySelectorAll('.dialogContainer .actionSheet:not(#popupFocusContainer)')].filter(s => !s.dataset.lfKind);
        if (fresh.length) { fresh[fresh.length - 1].dataset.lfKind = pending.kind; pending = null; }
      }
      document.querySelectorAll('.actionSheet[data-lf-kind]').forEach(sheet => {
        if (CONFIG.clearTrackNames) renameTracks(sheet);
        if (sheet.dataset.lfKind === 'sub') { offFirst(sheet); if (CONFIG.subtitleBg) { addSubToggle(sheet); alignRow(sheet); } }
      });
    });
  }

  /* ---------- 12. Menu épisodes du lecteur (plugin InPlayerEpisodePreview) : clic sur un titre = lecture ----------
     Le plugin déplie l'épisode au clic ; son bouton lecture (start-item-<id>) est dans la partie dépliée.
     Le script l'actionne directement. L'épisode en cours garde son comportement (titre + résumé),
     le titre de saison et la liste des saisons ne changent pas. */
  if (CONFIG.episodeClickPlays) {
    // Lancement via le serveur (playHere, voir le socle) : le bouton du plugin ne réagit pas à un clic simulé (relevé du 31/10)
    document.addEventListener('click', e => {
      // Toute la ligne de l'épisode (titre compris), sauf ses petits boutons (vu, favori…)
      const row = e.target.closest && e.target.closest('#popupContentContainer .previewListItem .previewItemContainer');
      if (!row || e.target.closest('.previewQuickActionContainer') || row.querySelector('.previewGroupListItemTitle')) return;
      const li = row.closest('.previewListItem'), id = li && li.dataset.id;
      // Épisode en cours : son bouton lecture est désactivé et son contenu porte selectedListItem (relevé sur le plugin installé)
      const quick = id && document.getElementById('playButton-' + id);
      if (!id || (quick && quick.disabled) || li.querySelector('.previewListItemContent.selectedListItem')) return;
      e.preventDefault(); e.stopPropagation();
      playHere(id).then(ok => { const popup = ok && document.getElementById('previewPopup'); if (popup) popup.remove(); }); // le plugin ferme son menu de la même façon
    }, true);
  }

  /* ---------- 13. Page saison : carte « Reprendre / À suivre » ----------
     En haut de la liste des épisodes : le premier épisode commencé et pas fini de la saison,
     sinon le premier pas encore vu ; tout vu = pas de carte. L'épisode reste aussi à sa place dans la liste.
     Données relues à chaque passage sur la page (la progression change quand on revient du lecteur). */
  if (CONFIG.seasonResume) {
    let visit = 0;
    document.addEventListener('viewshow', () => { visit++; }, true);
    const pending = new Set();
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    uiCss('html.lf-theme-off .lf-resume { display: none !important; }');
    onChange(() => {
      const page = document.querySelector('#itemDetailPage:not(.hide)');
      const box = page && page.querySelector('#listChildrenCollapsible:not(.hide) #childrenContent');
      const id = (location.hash.match(/[?&]id=([0-9a-f]{32})/i) || [])[1];
      if (!box || !id) return;
      const old = box.querySelector(':scope > .lf-resume');
      const key = id + ':' + visit;
      if ((old && old.dataset.key === key) || pending.has(key)) return;
      const a = api(), u = userId();
      if (!a || !u) return;
      pending.add(key);
      Promise.all([a.getItem(u, id), a.getItems(u, { ParentId: id, IncludeItemTypes: 'Episode', Recursive: false,
        Fields: 'Overview', SortBy: 'ParentIndexNumber,IndexNumber', SortOrder: 'Ascending', EnableTotalRecordCount: false })])
        .then(([item, res]) => {
          pending.delete(key);
          const cur = box.querySelector(':scope > .lf-resume');
          if (!item || item.Type !== 'Season') { cur && cur.remove(); return; }
          const eps = (res && res.Items) || [];
          const ud = e => e.UserData || {};
          const ep = eps.find(e => !ud(e).Played && ud(e).PlaybackPositionTicks > 0) || eps.find(e => !ud(e).Played);
          if (!ep) { cur && cur.remove(); return; }
          const started = ud(ep).PlaybackPositionTicks > 0;
          const pct = started && ep.RunTimeTicks ? Math.min(100, ud(ep).PlaybackPositionTicks / ep.RunTimeTicks * 100) : 0;
          const min = t => Math.max(1, Math.round(t / 6e8));
          const meta = started && ep.RunTimeTicks
            ? tr(`${min(ep.RunTimeTicks - ud(ep).PlaybackPositionTicks)} min restantes`, `${min(ep.RunTimeTicks - ud(ep).PlaybackPositionTicks)} min left`)
            : (ep.RunTimeTicks ? `${min(ep.RunTimeTicks)} min` : '');
          const tag = ep.ImageTags && ep.ImageTags.Primary;
          const img = tag ? a.getScaledImageUrl(ep.Id, { type: 'Primary', maxWidth: 720, tag, quality: 90 }) : '';
          const label = started ? tr('Reprendre', 'Resume') : tr('À suivre', 'Up next');
          const card = document.createElement('div');
          card.className = 'lf-resume'; card.dataset.key = key; card.dataset.id = ep.Id;
          card.innerHTML = `
            <div class="lf-resume-img">
              <span class="lf-resume-fab material-icons" aria-hidden="true">play_arrow</span>
              ${pct ? `<div class="lf-resume-prog"><div style="width:${pct.toFixed(1)}%"></div></div>` : ''}
            </div>
            <div class="lf-resume-body">
              <div class="lf-resume-kicker">${label}</div>
              <div class="lf-resume-title">${ep.IndexNumber != null ? ep.IndexNumber + '. ' : ''}${esc(ep.Name)}</div>
              ${meta ? `<div class="lf-resume-meta">${meta}</div>` : ''}
              ${ep.Overview ? `<div class="lf-resume-ov">${esc(ep.Overview)}</div>` : ''}
              <button type="button" class="lf-resume-play"><span class="material-icons" aria-hidden="true">play_arrow</span><span>${label}</span></button>
            </div>`;
          if (img) card.querySelector('.lf-resume-img').style.backgroundImage = `url("${img}")`;
          const go = e => { e.preventDefault(); e.stopPropagation(); playHere(ep.Id); };
          card.querySelector('.lf-resume-play').addEventListener('click', go);
          card.querySelector('.lf-resume-img').addEventListener('click', go);
          if (cur) cur.replaceWith(card); else box.insertBefore(card, box.firstChild);
        })
        .catch(err => { pending.delete(key); console.warn('[LeoFlix] carte « Reprendre »', err); });
    });
  }

  /* ---------- 14. Flèches de la rangée des saisons ----------
     Jellyfin ne met pas de boutons ‹ › sur cette rangée (ce n'est pas un « scroller » comme les autres).
     On ajoute un bloc avec les mêmes classes que les flèches natives, donc le même style.
     Flèches visibles seulement si la rangée dépasse ; grisées tout au début / tout à la fin.
     Un clic = une « page » (largeur visible). Pas de fondu au bord : sous Firefox il disparaît au survol d'une carte. */
  if (CONFIG.seasonArrows) {
    const ROW = '#itemDetailPage:not(.hide) #listChildrenCollapsible .itemsContainer';
    const update = row => {
      const nav = row.__lfNav; if (!nav) return;
      const max = row.scrollWidth - row.clientWidth;
      const over = max > 4, start = row.scrollLeft <= 4, end = row.scrollLeft >= max - 4;
      if (nav.hidden !== !over) nav.hidden = !over;
      if (nav.children[0].disabled !== start) nav.children[0].disabled = start;
      if (nav.children[1].disabled !== end) nav.children[1].disabled = end;
    };
    const mkBtn = (dir, icon, label) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'emby-scrollbuttons-button paper-icon-button-light'; b.title = label;
      b.innerHTML = `<span class="material-icons ${icon}" aria-hidden="true"></span>`;
      b.addEventListener('click', () => {
        const row = b.closest('#listChildrenCollapsible').querySelector('.itemsContainer');
        row.scrollBy({ left: dir * row.clientWidth * 0.9, behavior: 'smooth' });
      });
      return b;
    };
    onChange(() => {
      const row = [...document.querySelectorAll(ROW)].find(r => r.querySelector(':scope > .card[data-type="Season"]'));
      if (!row) return;
      const sec = row.closest('#listChildrenCollapsible');
      if (!row.__lfNav || !sec.contains(row.__lfNav)) {
        sec.querySelectorAll('.lf-season-nav').forEach(n => n.remove());
        const nav = document.createElement('div');
        nav.className = 'emby-scrollbuttons lf-season-nav';
        nav.append(mkBtn(-1, 'chevron_left', tr('Précédent', 'Previous')), mkBtn(1, 'chevron_right', tr('Suivant', 'Next')));
        sec.classList.add('lf-has-nav'); sec.appendChild(nav); row.__lfNav = nav;
        if (!row.__lfScroll) { row.__lfScroll = true; row.addEventListener('scroll', () => update(row), { passive: true }); }
      }
      update(row);
    });
  }

  /* ---------- 15. Bouton « Infos / Grille » des épisodes ----------
     Une seule icône juste au-dessus de la liste des épisodes (sous la carte « Reprendre ») :
     elle montre l'affichage actuel ; un clic passe à l'autre et l'icône change.
     Le choix est une préférence du compte (Prefs « ep » : list / grid) et pose html[data-lf-ep] ;
     les deux affichages sont faits en CSS. */
  if (CONFIG.episodeView) {
    const MODES = {
      list: { icon: 'view_list', label: () => tr('Affichage : infos (cliquer pour la grille)', 'View: details (click for grid)') },
      grid: { icon: 'grid_view', label: () => tr('Affichage : grille (cliquer pour les infos)', 'View: grid (click for details)') }
    };
    const cur = () => Prefs.get('ep') === 'grid' ? 'grid' : 'list';
    const paint = b => {
      const m = MODES[cur()], span = b.firstElementChild;
      if (span.className !== 'material-icons ' + m.icon) span.className = 'material-icons ' + m.icon;
      if (b.title !== m.label()) { b.title = m.label(); b.setAttribute('aria-label', m.label()); }
    };
    Prefs.watch(() => {
      const v = cur();
      if (document.documentElement.dataset.lfEp !== v) document.documentElement.dataset.lfEp = v;
      document.querySelectorAll('.lf-ep-toggle button').forEach(paint);
    });
    onChange(() => {
      const list = [...document.querySelectorAll('#itemDetailPage:not(.hide) #childrenContent > .itemsContainer')]
        .find(c => c.querySelector('.listItem'));
      if (!list || (list.previousElementSibling && list.previousElementSibling.classList.contains('lf-ep-toggle'))) return;
      list.parentElement.querySelectorAll(':scope > .lf-ep-toggle').forEach(n => n.remove());
      const tog = document.createElement('div');
      tog.className = 'emby-scrollbuttons lf-ep-toggle';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'emby-scrollbuttons-button paper-icon-button-light';
      b.innerHTML = '<span class="material-icons" aria-hidden="true"></span>';
      b.addEventListener('click', () => Prefs.set('ep', cur() === 'grid' ? 'list' : 'grid'));
      tog.appendChild(b); paint(b);
      list.before(tog);
    });
  }

  /* ---------- 16. Capsules de la barre du haut ----------
     Une capsule en verre derrière chaque groupe : bibliothèques, icônes de droite (SyncPlay, cast, recherche, avatar),
     et sur les pages bibliothèque : titre + compteur, outils (Tout lire, filtre, tri…).
     Les conteneurs de Jellyfin (React) sont plus larges que leurs boutons et on ne les déplace pas :
     on mesure les boutons et on dessine la capsule en ::before / ::after de leur barre (variables --lf-cN-x/y/w/h/o).
     Les boutons des bibliothèques perdent leur capsule à eux (CSS, classe lf-caps) mais gardent leur survol.
     Quand la ligne des bibliothèques défile (petit écran), pas de capsule autour (le verre tient mal sur ce qui défile). */
  if (CONFIG.headerCapsules) {
    const logoIn = !!CONFIG.capsuleLogo;
    const vis = e => e && e.getClientRects().length > 0 && e.getBoundingClientRect().width > 0;
    const put = (el, k, v) => { if (el.style.getPropertyValue(k) !== v) el.style.setProperty(k, v); };
    // padX / padY : marge de la capsule autour des boutons ; choisies pour que l'espace visible
    // (bouton + sa marge intérieure) soit le même en haut, en bas et sur les côtés.
    const setCap = (tb, n, els, padX, padY) => {
      const rs = els.filter(vis).map(e => e.getBoundingClientRect());
      if (!rs.length) return put(tb, `--lf-c${n}-o`, '0');
      const t = tb.getBoundingClientRect();
      const l = Math.min(...rs.map(r => r.left)) - padX, r = Math.max(...rs.map(r => r.right)) + padX;
      const top = Math.min(...rs.map(r => r.top)) - padY, b = Math.max(...rs.map(r => r.bottom)) + padY;
      put(tb, `--lf-c${n}-x`, Math.round(l - t.left) + 'px'); put(tb, `--lf-c${n}-y`, Math.round(top - t.top) + 'px');
      put(tb, `--lf-c${n}-w`, Math.round(r - l) + 'px'); put(tb, `--lf-c${n}-h`, Math.round(b - top) + 'px');
      put(tb, `--lf-c${n}-o`, '1');
    };
    const mark = (el, c) => { if (!el.classList.contains(c)) el.classList.add(c); };
    const update = force => {
      const hdr = document.querySelector('header.MuiAppBar-root:not(.videoOsd-appBar)');
      if (!hdr) return;
      // Pendant un survol, les boutons montent / grandissent : on ne mesure pas (on remesure en sortant)
      if (!force && hdr.matches(':hover') && hdr.querySelector('.lf-caps')) return;
      const tbs = [...hdr.querySelectorAll(':scope > .MuiToolbar-root')];
      const t1 = tbs.find(tb => tb.querySelector(':scope > .MuiStack-root > a.MuiButton-sizeLarge'));
      if (t1) {
        mark(t1, 'lf-caps');
        const stack = t1.querySelector(':scope > .MuiStack-root');
        const scrolls = stack.classList.contains('lf-scrolls') || !stack.classList.contains('lf-js');
        const libs = scrolls ? [] : [...stack.children].filter(e => e.matches('a.MuiButton-root') && (logoIn || !e.classList.contains('MuiButton-sizeLarge')));
        setCap(t1, 1, libs, 6, 2);
        setCap(t1, 2, [...t1.children].filter(e => e !== stack), 10, 6);
      }
      const t2 = tbs.find(tb => tb.querySelector(':scope > button .MuiTypography-h2'));
      if (t2) {
        mark(t2, 'lf-caps'); mark(hdr, 'lf-caps-lib');
        const title = t2.querySelector(':scope > button'), tools = t2.querySelector(':scope > .MuiStack-root');
        setCap(t2, 1, [title, title.nextElementSibling].filter(e => e && e !== tools), 10, 10);
        setCap(t2, 2, tools ? [...tools.children] : [], 6, 4);
      } else if (hdr.classList.contains('lf-caps-lib')) hdr.classList.remove('lf-caps-lib');
    };
    onChange(() => update(false));
    document.addEventListener('mouseout', e => {
      const h = e.target.closest && e.target.closest('header.MuiAppBar-root');
      if (h && !h.contains(e.relatedTarget)) setTimeout(() => update(true), 350);
    }, true);
  }

  /* ---------- 17. Réglages de base d'un nouvel appareil ----------
     Jellyfin garde certains réglages dans le navigateur (localStorage, clé « <id du compte>-<nom> »),
     ils repartent donc de zéro sur chaque appareil. Si un réglage n'existe pas encore, on pose la valeur LeoFlix ;
     s'il existe (même identique à celui de Jellyfin), on n'y touche jamais. Rien n'est écrit sur le serveur.
     - sous-titres : style personnalisé, texte grand, blanc, sans fond (le fond en verre vient de LeoFlix) ;
     - segments « Résumé » et « Aperçu » : « Demander pour passer », comme l'intro et le générique. */
  if (CONFIG.deviceDefaults) {
    const DEFAULTS = {
      localplayersubtitleappearance3: JSON.stringify({ verticalPosition: '-3', aspectMode: 'contain', subtitleStyling: 'Custom',
        textSize: 'large', textWeight: 'normal', dropShadow: '', font: '', textBackground: 'transparent', textColor: '#ffffff' }),
      segmentTypeAction__Recap: 'AskToSkip',
      segmentTypeAction__Preview: 'AskToSkip'
    };
    const done = new Set();
    onChange(() => {
      const u = userId();
      if (!u || done.has(u)) return;
      done.add(u);
      try {
        for (const [name, value] of Object.entries(DEFAULTS)) {
          if (localStorage.getItem(u + '-' + name) === null) localStorage.setItem(u + '-' + name, value);
        }
      } catch (e) { /* stockage indisponible : on laisse Jellyfin faire */ }
    });
  }

  /* ---------- 3. Barre de progression ----------
     Pendant le geste : « input » (aperçu du temps) ; au relâchement : « change »
     (Jellyfin saute à ce moment-là, une seule demande au serveur). */
  if (CONFIG.progressDrag) {
    document.addEventListener('pointerdown', e => {
      const c = e.target.closest && e.target.closest('.videoOsdBottom .sliderContainer:not(.osdVolumeSliderContainer)');
      if (!c || e.button !== 0) return;
      const inp = c.querySelector('input.osdPositionSlider');
      if (!inp) return;
      const min = +inp.min || 0, max = +inp.max || 100;
      drag(c, inp, ev => {
        inp.value = (min + ratio(ev, inp) * (max - min)).toFixed(2);
        fire(inp, 'input');
      }, () => fire(inp, 'change'), e);
    }, true);
  }
})();
