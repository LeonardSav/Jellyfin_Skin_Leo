/* ==========================================================
   LeoFlix : script du thème (v0.36)
   À coller dans Jellyfin : Tableau de bord > JavaScript Injector,
   en mode « connecté seulement » (pas public).
   Ne pas charger ce fichier depuis GitHub : copier-coller le contenu,
   après l'avoir lu. Il ne contient ni adresse, ni nom, ni clé.

   Fonctions :
   1. Menus du lecteur centrés au-dessus du bouton qui les a ouverts
   2. Volume : glisser fiable (Firefox lâche le glisser natif)
   3. Barre de progression : glisser fiable, saut au relâchement

   Chaque fonction vérifie que ce qu'elle cherche existe ; sinon elle ne fait rien
   (utile si un plugin n'est pas installé ou si Jellyfin change).
   ========================================================== */
(() => {
  'use strict';
  if (window.__leoflix) return;          // déjà chargé : on ne double pas les écouteurs
  window.__leoflix = { version: '0.36' };

  /* ---------- Réglages (à adapter si besoin) ---------- */
  const CONFIG = {
    centerMenus: true,     // 1. centrer les menus du lecteur sur leur bouton
    volumeDrag: true,      // 2. glisser du volume
    progressDrag: true,    // 3. glisser de la barre de progression
    edgeMargin: 0.03       // marge mini des menus avec le bord de l'écran (3 % de la largeur)
  };

  const playerOpen = () => !!document.querySelector('#videoOsdPage:not(.hide)');

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
