/* =========================================================================
   MiFitApp · avatar.js
   Motor de renderizado SVG del entrenador virtual (cinemática directa 2D).
   - Esqueleto articulado: torso, cabeza, brazos (hombro/codo), piernas (cadera/rodilla).
   - Cada animación es una lista de poses clave (ángulos en grados) que se
     interpolan con suavizado coseno en bucle.
   - Vista 'side' (perfil, mirando a la derecha) o 'f' (frente).
   Convención de ángulos (mundo): 0 = hacia abajo, 90 = hacia adelante (+x),
   180 = hacia arriba, -90 = hacia atrás.
     t   inclinación del torso (0 = erguido, 90 = horizontal hacia adelante)
     hd  giro extra de la cabeza
     sL/sR  ángulo del brazo (hombro)      eL/eR  flexión del codo (antebrazo = s + e)
     hL/hR  ángulo del muslo (cadera)      kL/kR  flexión de rodilla (espinilla = h - k)
     j   elevación vertical (saltos) en px
   L = lado lejano (más oscuro), R = lado cercano.
   ========================================================================= */
(function (global) {
  'use strict';

  const W = 200, H = 260, GROUND = 246, BAR_Y = 34;
  const FALLBACK_ANIM = 'march'; // se usa si un ejercicio no tiene pose definida
  const L = { T: 62, NECK: 8, R: 13, UA: 33, FA: 30, TH: 44, SH: 42, FT: 11 };
  const KEYS = ['t', 'hd', 'sL', 'eL', 'sR', 'eR', 'hL', 'kL', 'hR', 'kR', 'j'];

  // ---------- Biblioteca de animaciones ----------
  const plankUp = { t: 63, hL: -63, hR: -63, sL: 0, sR: 0 };
  const quad = { t: 90, sL: 0, sR: 0, hL: 0, hR: 0, kL: 90, kR: 90 };
  const supineBent = { t: 270, hL: 135, hR: 135, kL: 110, kR: 110 };
  const squatLow = { t: 38, hL: 85, hR: 85, kL: 105, kR: 105 };
  const merge = (...o) => Object.assign({}, ...o);

  const ANIMS = {
    breathe: { view: 'f', dur: 3200, kf: [{ sL: 8, sR: 8, eL: 6, eR: 6 }, { sL: 11, sR: 11, eL: 10, eR: 10, j: 1 }] },
    march: { dur: 1300, kf: [{ hR: 70, kR: 90, sL: 35, eL: 70, sR: -25, eR: 30 }, { hL: 70, kL: 90, sR: 35, eR: 70, sL: -25, eL: 30 }] },
    highknees: { dur: 650, kf: [{ hR: 95, kR: 100, sL: 40, eL: 80, sR: -30, eR: 40, j: 6 }, { hL: 95, kL: 100, sR: 40, eR: 80, sL: -30, eL: 40, j: 6 }] },
    buttkick: { dur: 650, kf: [{ hR: -10, kR: 150, sL: 30, eL: 80, sR: -20, eR: 80, j: 4 }, { hL: -10, kL: 150, sR: 30, eR: 80, sL: -20, eL: 80, j: 4 }] },
    jack: { view: 'f', dur: 900, kf: [{ sL: 8, sR: 8 }, { sL: 90, sR: 90, hL: 12, hR: 12, j: 14 }, { sL: 165, sR: 165, hL: 22, hR: 22, j: 2 }, { sL: 90, sR: 90, hL: 12, hR: 12, j: 14 }] },
    jacklow: { view: 'f', dur: 2400, kf: [{ sL: 8, sR: 8 }, { sL: 160, sR: 160, hR: 24 }, { sL: 8, sR: 8 }, { sL: 160, sR: 160, hL: 24 }] },
    sidestep: { view: 'f', dur: 1300, kf: [{ hL: 6, hR: 18, sL: 20, sR: 20 }, { hL: 18, hR: 6, sL: 20, sR: 20 }] },
    abduction: { view: 'f', dur: 1800, kf: [{ sL: 15, sR: 15 }, { sL: 15, sR: 15, hR: 38, t: -5 }] },
    armcircles: { view: 'f', dur: 1100, kf: [{ sL: 80, sR: 80, j: 0 }, { sL: 92, sR: 92, eL: 10, eR: 10 }, { sL: 100, sR: 100 }, { sL: 88, sR: 88, eL: -10, eR: -10 }] },
    twist: { view: 'f', dur: 1700, kf: [{ sL: 95, sR: 50, eR: 90, t: -6 }, { sR: 95, sL: 50, eL: 90, t: 6 }] },
    hipcircle: { view: 'f', dur: 2200, kf: [{ t: 8, sL: 40, sR: 40, eL: -110, eR: -110 }, { t: 0, sL: 40, sR: 40, eL: -110, eR: -110, j: 2 }, { t: -8, sL: 40, sR: 40, eL: -110, eR: -110 }, { t: 0, sL: 40, sR: 40, eL: -110, eR: -110, j: 0 }] },
    legswing: { dur: 1500, kf: [{ hR: 65, sL: 70, sR: 10 }, { hR: -35, sL: 70, sR: 10 }] },
    shadowbox: { dur: 700, kf: [{ hR: 14, hL: -14, kR: 12, kL: 8, sR: 90, eR: 0, sL: 40, eL: 125, t: 6 }, { hR: 14, hL: -14, kR: 12, kL: 8, sL: 90, eL: 0, sR: 40, eR: 125, t: 6 }] },
    squat: { dur: 2400, kf: [{ sL: 10, sR: 10 }, merge(squatLow, { sL: 90, sR: 90 })] },
    squathold: { dur: 3500, kf: [merge(squatLow, { t: 30, hL: 95, hR: 95, kL: 130, kR: 130, sL: 70, sR: 70, eL: 40, eR: 40 }), merge(squatLow, { t: 32, hL: 95, hR: 95, kL: 130, kR: 130, sL: 70, sR: 70, eL: 45, eR: 45, hd: 4 })] },
    goblet: { dur: 2400, kf: [{ sL: 15, sR: 15, eL: 135, eR: 135 }, merge(squatLow, { sL: 30, sR: 30, eL: 135, eR: 135 })] },
    jumpsquat: { dur: 1200, kf: [merge(squatLow, { sL: -30, sR: -30 }), { sL: 150, sR: 150, j: 22 }, { sL: 20, sR: 20 }] },
    thruster: { dur: 2300, kf: [merge(squatLow, { sL: 25, sR: 25, eL: 150, eR: 150 }), { sL: 25, sR: 25, eL: 150, eR: 150 }, { sL: 176, sR: 176 }] },
    wallsit: { dur: 3600, wall: 'back', kf: [{ hL: 90, hR: 90, kL: 90, kR: 90, sL: 15, sR: 15 }, { hL: 90, hR: 90, kL: 90, kR: 90, sL: 18, sR: 18, hd: 3 }] },
    boxsquat: { dur: 2600, chair: 'seat', kf: [{ sL: 10, sR: 10 }, { t: 30, hL: 80, hR: 80, kL: 85, kR: 85, sL: 90, sR: 90 }] },
    lunge: { dur: 2400, kf: [{ sL: 5, sR: 5, hR: 25, hL: -20, kL: 10 }, { t: 4, hR: 82, kR: 88, hL: -18, kL: 82, sL: 5, sR: 5 }] },
    hinge: { dur: 2600, kf: [{ sL: 2, sR: 2 }, { t: 75, hL: 12, hR: 12, kL: 18, kR: 18, sL: 0, sR: 0 }] },
    goodmorning: { dur: 2600, armRel: true, kf: [{ sL: 160, sR: 160, eL: 150, eR: 150 }, { t: 70, hL: 8, hR: 8, kL: 14, kR: 14, sL: 160, sR: 160, eL: 150, eR: 150 }] },
    singlerdl: { dur: 2800, kf: [{ sL: 2, sR: 2 }, { t: 80, hL: -80, kL: 0, hR: 8, kR: 14, sL: 0, sR: 0 }] },
    swing: { dur: 1400, kf: [{ t: 65, hL: 15, hR: 15, kL: 28, kR: 28, sL: -25, sR: -25 }, { t: -4, sL: 92, sR: 92 }] },
    row: { dur: 2000, kf: [{ t: 60, hL: 20, hR: 20, kL: 25, kR: 25, sL: 0, sR: 0 }, { t: 60, hL: 20, hR: 20, kL: 25, kR: 25, sL: -55, eL: 55, sR: -55, eR: 55 }] },
    supportedrow: { dur: 2000, chair: 'hand', kf: [{ t: 70, hL: 10, hR: -10, kL: 15, kR: 5, sL: 0, sR: 0 }, { t: 70, hL: 10, hR: -10, kL: 15, kR: 5, sL: 0, sR: -55, eR: 55 }] },
    bandrow: { dur: 2000, band: 'front', kf: [{ sL: 85, sR: 85, hR: 10, kR: 12, hL: 10, kL: 12 }, { sL: -60, eL: 150, sR: -60, eR: 150, hR: 10, kR: 12, hL: 10, kL: 12 }] },
    chestpress: { dur: 2000, band: 'back', kf: [{ sL: -60, eL: 150, sR: -60, eR: 150, hR: 18, hL: -12, kR: 10 }, { sL: 85, sR: 85, hR: 18, hL: -12, kR: 10 }] },
    pulldown: { dur: 2200, band: 'top', kf: [{ sL: 172, sR: 172 }, { sL: 12, eL: 160, sR: 12, eR: 160 }] },
    trxrow: { dur: 2200, trx: true, kf: [{ t: -32, hL: 32, hR: 32, sL: 105, sR: 105 }, { t: -14, hL: 14, hR: 14, sL: 20, eL: 120, sR: 20, eR: 120 }] },
    pullup: { dur: 2400, anchor: 'hands', bar: true, kf: [{ sL: 178, sR: 178, hL: -8, hR: -8, kL: 50, kR: 50 }, { sL: 22, eL: 152, sR: 22, eR: 152, hL: -8, hR: -8, kL: 50, kR: 50, hd: -8 }] },
    deadhang: { dur: 3000, anchor: 'hands', bar: true, kf: [{ sL: 178, sR: 178, hL: 0, hR: 4, kR: 10 }, { sL: 177, sR: 177, hL: 2, hR: 6, kR: 14, hd: -3 }] },
    pushup: { dur: 2000, kf: [plankUp, { t: 80, hL: -80, hR: -80, sL: -42, eL: 70, sR: -42, eR: 70 }] },
    kneepushup: { dur: 2000, kf: [{ t: 53, hL: -53, hR: -53, kL: 37, kR: 37, sL: 0, sR: 0 }, { t: 70, hL: -70, hR: -70, kL: 20, kR: 20, sL: -42, eL: 70, sR: -42, eR: 70 }] },
    inclinepushup: { dur: 2000, chair: 'hand', kf: [{ t: 46, hL: -46, hR: -46, sL: 0, sR: 0 }, { t: 56, hL: -56, hR: -56, sL: -45, eL: 75, sR: -45, eR: 75 }] },
    wallpushup: { dur: 2000, wall: 'hand', kf: [{ t: 20, hL: -20, hR: -20, sL: 80, sR: 80 }, { t: 26, hL: -26, hR: -26, sL: 30, eL: 95, sR: 30, eR: 95 }] },
    pike: { dur: 2200, kf: [{ t: 138, hL: -42, hR: -42, sL: 42, sR: 42 }, { t: 150, hL: -40, hR: -40, sL: 72, eL: -70, sR: 72, eR: -70 }] },
    floorpress: { dur: 2200, kf: [merge(supineBent, { sL: 95, eL: 85, sR: 95, eR: 85 }), merge(supineBent, { sL: 180, sR: 180 })] },
    pullover: { dur: 2800, kf: [merge(supineBent, { sL: 180, sR: 180 }), merge(supineBent, { sL: -80, sR: -80 })] },
    curl: { dur: 1800, kf: [{ sL: 4, sR: 4, eL: 5, eR: 5 }, { sL: 8, sR: 8, eL: 135, eR: 135 }] },
    press: { view: 'f', dur: 2000, kf: [{ sL: 95, sR: 95, eL: 80, eR: 80 }, { sL: 172, sR: 172, eL: 5, eR: 5 }] },
    lateral: { view: 'f', dur: 2000, kf: [{ sL: 10, sR: 10, eL: 10, eR: 10 }, { sL: 85, sR: 85, eL: 10, eR: 10 }] },
    frontraise: { dur: 2000, kf: [{ sL: 5, sR: 5 }, { sL: 90, sR: 90 }] },
    triext: { dur: 2000, kf: [{ sL: 165, sR: 165, eL: 165, eR: 165 }, { sL: 170, sR: 170, eL: 5, eR: 5 }] },
    kickback: { dur: 1900, kf: [{ t: 50, hL: 20, hR: 20, kL: 30, kR: 30, sL: -75, sR: -75, eL: 75, eR: 75 }, { t: 50, hL: 20, hR: 20, kL: 30, kR: 30, sL: -75, sR: -75, eL: 0, eR: 0 }] },
    dips: { dur: 2200, anchor: 'hands', handY: 168, chair: 'hand', kf: [{ hL: 75, hR: 75, kL: 70, kR: 70, sL: -15, sR: -15 }, { t: 6, hL: 80, hR: 80, kL: 55, kR: 55, sL: -78, eL: 78, sR: -78, eR: 78 }] },
    plank: { dur: 3500, kf: [{ t: 78, hL: -78, hR: -78, sL: 0, sR: 0, eL: 90, eR: 90 }, { t: 78, hL: -78, hR: -78, sL: 0, sR: 0, eL: 90, eR: 90, hd: 6 }] },
    sideplank: { view: 'f', dur: 3500, kf: [{ t: 70, hR: -70, hL: 70, sR: 0, sL: 180 }, { t: 70, hR: -70, hL: 70, sR: 0, sL: 175, hd: 4 }] },
    shouldertap: { dur: 1400, kf: [merge(plankUp, { sR: 50, eR: 70 }), plankUp, merge(plankUp, { sL: 50, eL: 70 }), plankUp] },
    crunch: { dur: 2000, armRel: true, kf: [merge(supineBent, { sL: 170, sR: 170, eL: 150, eR: 150 }), merge(supineBent, { t: 300, sL: 170, sR: 170, eL: 150, eR: 150 })] },
    bicycle: { dur: 1600, armRel: true, kf: [{ t: 295, hL: 150, kL: 120, hR: 100, kR: 0, sL: 170, sR: 170, eL: 150, eR: 150 }, { t: 295, hR: 150, kR: 120, hL: 100, kL: 0, sL: 170, sR: 170, eL: 150, eR: 150 }] },
    deadbug: { dur: 2600, kf: [{ t: 270, sL: 180, sR: -95, hL: 100, kL: 0, hR: 180, kR: 90 }, { t: 270, sR: 180, sL: -95, hR: 100, kR: 0, hL: 180, kL: 90 }] },
    birddog: { dur: 2800, kf: [merge(quad, { sR: 95, hL: -90, kL: 0 }), quad, merge(quad, { sL: 95, hR: -90, kR: 0 }), quad] },
    catcow: { dur: 3200, kf: [merge(quad, { t: 84, hd: 30 }), merge(quad, { t: 96, hd: -28 })] },
    glutekick: { dur: 1800, kf: [quad, merge(quad, { hR: -100, kR: 80 })] },
    legraise: { dur: 2400, kf: [{ t: 270, hL: 92, hR: 92, sL: 90, sR: 90 }, { t: 270, hL: 172, hR: 172, sL: 90, sR: 90 }] },
    hollow: { dur: 3200, kf: [{ t: 285, hL: 105, hR: 105, sL: -110, sR: -110 }, { t: 288, hL: 108, hR: 108, sL: -112, sR: -112 }] },
    russian: { dur: 1600, kf: [{ t: -35, hL: 60, hR: 60, kL: 60, kR: 60, sL: 30, sR: 30, eL: 60, eR: 60 }, { t: -35, hL: 60, hR: 60, kL: 60, kR: 60, sL: 80, sR: 80, eL: 20, eR: 20 }] },
    bridge: { dur: 2200, kf: [merge(supineBent, { sL: -90, sR: -90, hL: 140, hR: 140, kL: 120, kR: 120 }), { t: 252, hL: 120, hR: 120, kL: 115, kR: 115, sL: -90, sR: -90 }] },
    mountain: { dur: 700, kf: [merge(plankUp, { hR: 30, kR: 110 }), merge(plankUp, { hL: 30, kL: 110 })] },
    burpee: { dur: 3200, kf: [{ sL: 5, sR: 5 }, { t: 60, hL: 95, hR: 95, kL: 125, kR: 125, sL: 0, sR: 0 }, plankUp, { t: 60, hL: 95, hR: 95, kL: 125, kR: 125, sL: 0, sR: 0 }, { sL: 170, sR: 170, j: 18 }] },
    burpeelow: { dur: 4200, kf: [{ sL: 5, sR: 5 }, { t: 60, hL: 95, hR: 95, kL: 125, kR: 125, sL: 0, sR: 0 }, plankUp, { t: 60, hL: 95, hR: 95, kL: 125, kR: 125, sL: 0, sR: 0 }, { sL: 170, sR: 170 }] },
    inchworm: { dur: 4400, kf: [{ sL: 5, sR: 5 }, { t: 118, hL: 0, hR: 0, sL: 0, sR: 0 }, plankUp, { t: 118, hL: 0, hR: 0, sL: 0, sR: 0 }] },
    jumprope: { dur: 520, rope: true, kf: [{ sL: 22, sR: 22, eL: 55, eR: 55 }, { sL: 22, sR: 22, eL: 55, eR: 55, j: 9 }] },
    skater: { view: 'f', dur: 1000, kf: [{ hR: 30, hL: 4, t: -8, sL: 60, sR: 20 }, { hL: 15, hR: 15, j: 12, sL: 40, sR: 40 }, { hL: 30, hR: 4, t: 8, sR: 60, sL: 20 }, { hL: 15, hR: 15, j: 12, sL: 40, sR: 40 }] },
    slam: { dur: 1400, kf: [{ sL: 175, sR: 175, j: 3 }, { t: 65, hL: 20, hR: 20, kL: 35, kR: 35, sL: 20, sR: 20 }] },
    woodchop: { dur: 1800, band: 'top', kf: [{ sL: 150, sR: 150, t: -6 }, { t: 35, hL: 30, hR: 30, kL: 40, kR: 40, sL: 30, sR: 30 }] },
    rollout: { dur: 2800, kf: [{ t: 40, hL: 0, hR: 0, kL: 90, kR: 90, sL: 55, sR: 55 }, { t: 78, hL: -62, hR: -62, kL: 28, kR: 28, sL: 150, sR: 150 }] },
    calf: { dur: 1600, kf: [{ sL: 5, sR: 5 }, { sL: 5, sR: 5, j: 8 }] },
    stretchquad: { dur: 4000, kf: [{ hL: -5, kL: 165, sL: -30, eL: -20, sR: 80 }, { hL: -8, kL: 165, sL: -32, eL: -20, sR: 85, hd: 4 }] },
    stretchham: { dur: 4000, kf: [{ t: 50, hL: 90, hR: 90, sL: 95, sR: 95 }, { t: 62, hL: 90, hR: 90, sL: 100, sR: 100 }] },
    stretcharm: { view: 'f', dur: 4000, kf: [{ sR: -80, sL: 40, eL: -110 }, { sR: -84, sL: 42, eL: -112, hd: 4 }] },
    stretchtri: { dur: 4000, kf: [{ sR: 170, eR: 170, sL: 160, eL: 110 }, { sR: 172, eR: 170, sL: 162, eL: 112, hd: -4 }] },
    stretchside: { view: 'f', dur: 4200, kf: [{ t: -14, sR: 172, sL: 20 }, { t: 0, sR: 172, sL: 172 }, { t: 14, sL: 172, sR: 20 }, { t: 0, sR: 172, sL: 172 }] },
    stretchchest: { dur: 4000, wall: 'back', kf: [{ sL: -70, sR: -70, hd: -5 }, { sL: -82, sR: -82, hd: -8 }] },
    child: { dur: 4500, kf: [{ t: 112, hL: 80, hR: 80, kL: 170, kR: 170, sL: 98, sR: 98 }, { t: 108, hL: 80, hR: 80, kL: 170, kR: 170, sL: 98, sR: 98 }] },
    cobra: { dur: 4000, kf: [{ t: 65, hL: -90, hR: -90, sL: 20, eL: 20, sR: 20, eR: 20 }, { t: 50, hL: -90, hR: -90, sL: 0, sR: 0, hd: -10 }] },
    kneehug: { dur: 3600, kf: [{ t: 270, hL: 165, hR: 165, kL: 150, kR: 150, sL: 140, sR: 140, eL: 30, eR: 30 }, { t: 272, hL: 172, hR: 172, kL: 150, kR: 150, sL: 145, sR: 145, eL: 30, eR: 30 }] },
    dislocate: { view: 'f', dur: 3000, bandHands: true, kf: [{ sL: 30, sR: 30 }, { sL: 178, sR: 178 }] },
    pullapart: { view: 'f', dur: 2000, bandHands: true, kf: [{ sL: 80, eL: -70, sR: 80, eR: -70 }, { sL: 90, sR: 90 }] }
  };

  // ---------- Matemática ----------
  const rad = a => a * Math.PI / 180;
  const add = (p, v, len) => [p[0] + v[0] * len, p[1] + v[1] * len];

  function lerpPose(a, b, u) {
    const o = {};
    for (const k of KEYS) { const x = a[k] || 0, y = b[k] || 0; o[k] = x + (y - x) * u; }
    return o;
  }

  // Calcula articulaciones en coordenadas de modelo (pelvis en 0,0)
  function solve(p, anim, gender) {
    const front = anim.view === 'f';
    const fem = gender === 'f';
    const tt = rad(180 - p.t);
    const tdir = [Math.sin(tt), Math.cos(tt)];
    const perp = [-Math.cos(tt), Math.sin(tt)];
    const P = [0, 0];
    const neck = add(P, tdir, L.T);
    const ht = rad(180 - p.t + p.hd);
    const head = add(neck, [Math.sin(ht), Math.cos(ht)], L.NECK + L.R);
    const Sc = add(P, tdir, L.T - 5);
    const sw = front ? (fem ? 15 : 18) : 0, hw = front ? (fem ? 9 : 8) : 0;
    const side = sgn => (front ? sgn : 1);
    const d = (a, sgn) => { const r = rad(a); return [Math.sin(r) * side(sgn), Math.cos(r)]; };
    const armRel = anim.armRel ? -p.t : 0;
    const J = { P, neck, head, front };
    for (const [k, sgn] of [['L', -1], ['R', 1]]) {
      const S = add(Sc, perp, sw * sgn);
      const s = p['s' + k] + armRel, e = p['e' + k];
      const E = add(S, d(s, sgn), L.UA);
      const Wr = add(E, d(s + e, sgn), L.FA);
      const Hp = add(P, perp, hw * sgn);
      const h = p['h' + k], kn = p['k' + k];
      const K = add(Hp, d(h, sgn), L.TH);
      const A = add(K, d(h - kn, sgn), L.SH);
      const Ft = front ? [A[0] + 6 * sgn, A[1] + 1] : add(A, d(h - kn + 90, 1), L.FT);
      J['S' + k] = S; J['E' + k] = E; J['W' + k] = Wr; J['H' + k] = Hp; J['K' + k] = K; J['A' + k] = A; J['F' + k] = Ft;
    }
    return J;
  }

  const PTS = ['neck', 'SL', 'SR', 'EL', 'ER', 'WL', 'WR', 'HL', 'HR', 'KL', 'KR', 'AL', 'AR', 'FL', 'FR', 'P'];
  function shift(J, dx, dy) {
    const o = { front: J.front };
    for (const k of PTS.concat('head')) o[k] = [J[k][0] + dx, J[k][1] + dy];
    return o;
  }
  function bounds(J) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const k of PTS) { const [x, y] = J[k]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    minX = Math.min(minX, J.head[0] - L.R); maxX = Math.max(maxX, J.head[0] + L.R);
    minY = Math.min(minY, J.head[1] - L.R); maxY = Math.max(maxY, J.head[1] + L.R);
    return { minX, maxX, minY, maxY };
  }
  function anchorY(J, anim) {
    if (anim.anchor === 'hands') return (anim.handY || BAR_Y) - Math.min(J.WL[1], J.WR[1]);
    return GROUND - 6 - bounds(J).maxY + (J.head && 0);
  }

  // ---------- Dibujo ----------
  const f1 = n => Math.round(n * 10) / 10;
  const pt = p => f1(p[0]) + ',' + f1(p[1]);
  const seg = (a, b, w, cls) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke-width="${w}" class="${cls}"/>`;
  const poly = (a, b, c, cls) => `<polyline points="${pt(a)} ${pt(b)} ${pt(c)}" class="${cls}" fill="none"/>`;

  function drawLimb(J, k, far) {
    const tone = far ? ' far' : '';
    return poly(J['H' + k], J['K' + k], J['A' + k], 'av-leg' + tone) +
      seg(J['H' + k], [(J['H' + k][0] * 0.45 + J['K' + k][0] * 0.55), (J['H' + k][1] * 0.45 + J['K' + k][1] * 0.55)], 16, 'av-shorts' + tone) +
      seg(J['A' + k], J['F' + k], 8, 'av-shoe' + tone);
  }
  function drawArm(J, k, far) {
    const tone = far ? ' far' : '';
    return poly(J['S' + k], J['E' + k], J['W' + k], 'av-arm' + tone) +
      seg(J['S' + k], [(J['S' + k][0] * 0.6 + J['E' + k][0] * 0.4), (J['S' + k][1] * 0.6 + J['E' + k][1] * 0.4)], 12, 'av-sleeve' + tone) +
      `<circle cx="${f1(J['W' + k][0])}" cy="${f1(J['W' + k][1])}" r="4.6" class="av-hand${tone}"/>`;
  }
  function drawTorso(J, p, gender) {
    const tt = rad(180 - p.t), perp = [-Math.cos(tt), Math.sin(tt)];
    const fem = gender === 'f', front = J.front;
    const shW = front ? (fem ? 15 : 18) : (fem ? 9 : 10), hpW = front ? (fem ? 13 : 11) : (fem ? 10 : 8.5);
    const a = add(J.P, perp, hpW), b = add(J.P, perp, -hpW);
    const top = add(J.P, [Math.sin(tt), Math.cos(tt)], L.T - 2);
    const c = add(top, perp, -shW), dd = add(top, perp, shW);
    const waist = add(J.P, [Math.sin(tt), Math.cos(tt)], L.T * 0.45);
    const wW = fem ? (front ? 10 : 8) : (front ? 14 : 9);
    const w1 = add(waist, perp, wW), w2 = add(waist, perp, -wW);
    return `<path d="M${pt(a)} L${pt(w1)} L${pt(dd)} L${pt(c)} L${pt(w2)} L${pt(b)} Z" class="av-shirt"/>` +
      `<path d="M${pt(add(J.P, perp, hpW + 1))} L${pt(add(J.P, perp, -hpW - 1))}" class="av-belt"/>`;
  }
  function drawHead(J, p, gender) {
    const [x, y] = J.head, r = L.R, fem = gender === 'f';
    const ht = rad(180 - p.t + p.hd);
    const up = [Math.sin(ht), Math.cos(ht)];           // hacia la coronilla
    const fwd = [Math.cos(ht), -Math.sin(ht)];          // hacia la cara
    let s = seg(J.neck, add(J.neck, up, L.NECK + 2), 8, 'av-skin-l');
    if (fem) {
      const pony = J.front ? add([x, y], up, r * 0.2) : add(add([x, y], fwd, -r * 1.05), up, r * 0.15);
      s += `<ellipse cx="${f1(pony[0])}" cy="${f1(pony[1])}" rx="${J.front ? 15 : 7}" ry="${J.front ? 14 : 10}" class="av-hair"/>`;
    }
    s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" class="av-skin"/>`;
    // Cabello (casquete)
    const c1 = add([x, y], up, r), back = add([x, y], fwd, -r), frontH = add([x, y], fwd, r);
    if (J.front) {
      const lft = [x - r, y - 2], rgt = [x + r, y - 2];
      s += `<path d="M${pt(lft)} Q${f1(x)},${f1(y - r * 1.7)} ${pt(rgt)} Q${f1(x)},${f1(y - r * 0.7)} ${pt(lft)} Z" class="av-hair"/>`;
      s += `<circle cx="${f1(x - 4.5)}" cy="${f1(y + 1)}" r="1.6" class="av-eye"/><circle cx="${f1(x + 4.5)}" cy="${f1(y + 1)}" r="1.6" class="av-eye"/>`;
      s += `<path d="M${f1(x - 4)},${f1(y + 6)} Q${f1(x)},${f1(y + 9)} ${f1(x + 4)},${f1(y + 6)}" class="av-mouth"/>`;
    } else {
      const midFront = add(add([x, y], fwd, r * 0.55), up, r * 0.35);
      s += `<path d="M${pt(back)} Q${pt(add(c1, fwd, -r * 0.9))} ${pt(c1)} Q${pt(add(c1, fwd, r * 0.6))} ${pt(midFront)} Q${f1(x)},${f1(y)} ${pt(back)} Z" class="av-hair"/>`;
      const eye = add(add([x, y], fwd, r * 0.55), up, r * 0.05);
      s += `<circle cx="${f1(eye[0])}" cy="${f1(eye[1])}" r="1.6" class="av-eye"/>`;
      void frontH;
    }
    return s;
  }

  // Accesorios / equipo
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function drawProps(J, props, anim, ctx) {
    let s = '';
    const W1 = J.WL, W2 = J.WR, hm = mid(W1, W2);
    for (const pr of props) {
      switch (pr) {
        case 'dumbbell':
          for (const w of (J.front ? [W1, W2] : [W2])) s += `<rect x="${f1(w[0] - 9)}" y="${f1(w[1] - 3)}" width="18" height="6" rx="2" class="av-metal"/><rect x="${f1(w[0] - 11)}" y="${f1(w[1] - 6)}" width="5" height="12" rx="2" class="av-plate"/><rect x="${f1(w[0] + 6)}" y="${f1(w[1] - 6)}" width="5" height="12" rx="2" class="av-plate"/>`;
          break;
        case 'kettlebell': {
          const c = [hm[0], hm[1] + 10];
          s += `<path d="M${f1(c[0] - 6)},${f1(c[1] - 6)} Q${f1(c[0])},${f1(c[1] - 18)} ${f1(c[0] + 6)},${f1(c[1] - 6)}" class="av-handle"/><circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="9" class="av-plate"/>`;
          break;
        }
        case 'barbell':
          if (J.front) s += seg([W1[0] - 30, W1[1]], [W2[0] + 30, W2[1]], 4, 'av-metal-l') + `<rect x="${f1(W1[0] - 34)}" y="${f1(W1[1] - 14)}" width="7" height="28" rx="2" class="av-plate"/><rect x="${f1(W2[0] + 27)}" y="${f1(W2[1] - 14)}" width="7" height="28" rx="2" class="av-plate"/>`;
          else s += `<circle cx="${f1(W2[0])}" cy="${f1(W2[1])}" r="17" class="av-plate"/><circle cx="${f1(W2[0])}" cy="${f1(W2[1])}" r="3" class="av-metal"/>`;
          break;
        case 'band': {
          let anchor;
          if (anim.band === 'front') anchor = [ctx.first.SR[0] + 85, ctx.first.SR[1] + 4];
          else if (anim.band === 'back') anchor = [ctx.first.SR[0] - 70, ctx.first.SR[1] + 4];
          else if (anim.band === 'top') anchor = [ctx.first.SR[0] + 14, 6];
          if (anim.bandHands) { s += seg(W1, W2, 3.5, 'av-band'); break; }
          if (anchor) { s += seg(anchor, W1, 3, 'av-band far') + seg(anchor, W2, 3.5, 'av-band'); if (anim.band !== 'top') s += `<rect x="${f1(anchor[0] - 3)}" y="${f1(anchor[1] - 40)}" width="6" height="${f1(GROUND - anchor[1] + 40)}" class="av-post"/>`; else s += `<rect x="${f1(anchor[0] - 20)}" y="0" width="40" height="6" class="av-post"/>`; }
          else { const foot = J.front ? mid(J.AL, J.AR) : J.FR; s += `<path d="M${pt(W1)} Q${pt([foot[0] - 6, foot[1] - 30])} ${pt(foot)}" class="av-band-p far"/><path d="M${pt(W2)} Q${pt([foot[0] + 6, foot[1] - 30])} ${pt(foot)}" class="av-band-p"/>`; }
          break;
        }
        case 'miniband':
          if (J.front) s += seg([J.KL[0], J.KL[1] - 6], [J.KR[0], J.KR[1] - 6], 4, 'av-band');
          else s += `<ellipse cx="${f1((J.KL[0] + J.KR[0]) / 2)}" cy="${f1((J.KL[1] + J.KR[1]) / 2 - 4)}" rx="9" ry="4" class="av-band-p"/>`;
          break;
        case 'rope': {
          const ph = (ctx.time / anim.dur) % 1;
          const under = ph < 0.5;
          const cy = under ? Math.max(J.AL[1], J.AR[1]) + 14 : J.head[1] - 30;
          const cx = (W1[0] + W2[0]) / 2 + (under ? 6 : -6);
          s += `<path d="M${pt(W1)} Q${f1(cx)},${f1(cy)} ${pt(W2)}" class="av-rope"/>`;
          break;
        }
        case 'wheel': s += `<circle cx="${f1(hm[0])}" cy="${f1(hm[1] + 3)}" r="9" class="av-plate"/><circle cx="${f1(hm[0])}" cy="${f1(hm[1] + 3)}" r="3" class="av-metal"/>`; break;
        case 'ball': s += `<circle cx="${f1(hm[0])}" cy="${f1(hm[1] - 2)}" r="11" class="av-ball"/><path d="M${f1(hm[0] - 11)},${f1(hm[1] - 2)} Q${f1(hm[0])},${f1(hm[1] + 4)} ${f1(hm[0] + 11)},${f1(hm[1] - 2)}" class="av-ball-l"/>`; break;
        case 'trx': {
          const a = [ctx.first.SR[0] + 90, 6];
          s += seg(a, W1, 2.5, 'av-strap far') + seg(a, W2, 3, 'av-strap') + `<rect x="${f1(a[0] - 14)}" y="0" width="28" height="6" class="av-post"/>`;
          break;
        }
        case 'bar':
          if (!anim.bar) s += '';
          break;
        default: break;
      }
    }
    return s;
  }

  function drawScene(anim, ctx, J, props) {
    let s = `<line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" class="av-ground"/>`;
    if (anim.bar || props.includes('bar')) {
      const y = anim.anchor === 'hands' ? (anim.handY || BAR_Y) : BAR_Y;
      s += `<rect x="20" y="${y - 3}" width="160" height="6" rx="3" class="av-metal"/><rect x="18" y="${y - 3}" width="6" height="${GROUND - y + 3}" class="av-post"/><rect x="176" y="${y - 3}" width="6" height="${GROUND - y + 3}" class="av-post"/>`;
    }
    if (anim.wall) {
      const x = anim.wall === 'back' ? Math.min(ctx.first.P[0], ctx.first.SR[0]) - 9 : Math.max(ctx.first.WR[0], ctx.first.WL[0]) + 6;
      s += anim.wall === 'back' ? `<rect x="0" y="0" width="${f1(Math.max(x, 2))}" height="${GROUND}" class="av-wall"/>` : `<rect x="${f1(x)}" y="0" width="${f1(W - x)}" height="${GROUND}" class="av-wall"/>`;
    }
    if (anim.chair || props.includes('chair')) {
      let x, y;
      if (anim.chair === 'hand') { x = (ctx.first.WR[0] + ctx.first.WL[0]) / 2; y = Math.max(ctx.first.WR[1], ctx.first.WL[1]) + 5; }
      else if (anim.chair === 'seat') { x = ctx.first.P[0] - 18; y = ctx.lowP + 12; }
      if (x != null) {
        y = Math.min(y, GROUND - 20);
        s += `<rect x="${f1(x - 22)}" y="${f1(y)}" width="44" height="7" rx="2" class="av-chair"/><rect x="${f1(x - 20)}" y="${f1(y)}" width="5" height="${f1(GROUND - y)}" class="av-chair"/><rect x="${f1(x + 15)}" y="${f1(y)}" width="5" height="${f1(GROUND - y)}" class="av-chair"/>`;
      }
    }
    return s;
  }

  // ---------- Clase pública ----------
  class Avatar {
    constructor(el, opts = {}) {
      this.el = el;
      this.gender = opts.gender || 'm';
      this.animKey = 'breathe';
      this.props = [];
      this.speed = 1;
      this.t0 = performance.now();
      this.raf = null;
      this.paused = false;
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="avatar-svg" role="img" aria-label="Entrenador virtual"><g class="av-scene"></g><g class="av-body"></g></svg>`;
      this.svgScene = el.querySelector('.av-scene');
      this.svgBody = el.querySelector('.av-body');
      this._loop = this._loop.bind(this);
      this.set({ anim: opts.anim || 'breathe', props: opts.props || [] });
      this.start();
    }
    set({ anim, gender, props, speed } = {}) {
      if (gender) this.gender = gender;
      if (props) this.props = props;
      if (speed) this.speed = speed;
      if (anim && ANIMS[anim]) this.animKey = anim; else if (anim) this.animKey = FALLBACK_ANIM; // sin pose propia: animación dinámica por defecto
      this.el.classList.toggle('fem', this.gender === 'f');
      this._prepare();
      this.t0 = performance.now();
      this._render(0);
    }
    _prepare() {
      const a = ANIMS[this.animKey];
      const p0 = lerpPose(a.kf[0], a.kf[0], 0);
      const J0 = solve(p0, a, this.gender);
      const b = bounds(J0);
      // Centrar horizontalmente según la envolvente de todos los fotogramas clave
      let minX = b.minX, maxX = b.maxX, lowP = -1e9;
      for (const k of a.kf) {
        const Jk = solve(lerpPose(k, k, 0), a, this.gender);
        const bk = bounds(Jk); minX = Math.min(minX, bk.minX); maxX = Math.max(maxX, bk.maxX);
        lowP = Math.max(lowP, Jk.P[1] + anchorY(Jk, a));
      }
      let dx = W / 2 - (minX + maxX) / 2;
      if (a.view === 'f') dx = W / 2;
      if (a.band === 'front' || a.trx) dx -= 25;
      if (a.band === 'back') dx += 25;
      this.dx = dx;
      this.first = shift(J0, dx, anchorY(J0, a));
      this.lowP = lowP;
    }
    _render(time) {
      const a = ANIMS[this.animKey];
      const n = a.kf.length;
      const dur = a.dur / this.speed;
      const tt = ((time % dur) + dur) % dur; // nunca negativo (evita kf[-1])
      const ph = (tt / dur) * n;
      const i = Math.floor(ph) % n, u = ph - Math.floor(ph);
      const e = (1 - Math.cos(Math.PI * u)) / 2;
      const p = lerpPose(a.kf[i], a.kf[(i + 1) % n], e);
      const J0 = solve(p, a, this.gender);
      const J = shift(J0, this.dx, anchorY(J0, a) - p.j);
      const ctx = { time: time * this.speed, first: this.first, lowP: this.lowP };
      const props = this.props || [];
      this.svgScene.innerHTML = drawScene(a, ctx, J, props);
      let b = '';
      const shadowY = GROUND;
      b += `<ellipse cx="${f1(J.P[0])}" cy="${shadowY}" rx="${30 - Math.min(p.j, 20)}" ry="4" class="av-shadow"/>`;
      if (J.front) {
        b += drawLimb(J, 'L', false) + drawLimb(J, 'R', false) + drawTorso(J, p, this.gender) + drawHead(J, p, this.gender) + drawArm(J, 'L', false) + drawArm(J, 'R', false);
      } else {
        b += drawArm(J, 'L', true) + drawLimb(J, 'L', true) + drawTorso(J, p, this.gender) + drawLimb(J, 'R', false) + drawHead(J, p, this.gender) + drawArm(J, 'R', false);
      }
      b += drawProps(J, props, a, ctx);
      this.svgBody.innerHTML = b;
    }
    _loop() {
      // Reprograma SIEMPRE primero: una excepción de dibujo no debe matar el bucle.
      this.raf = requestAnimationFrame(this._loop);
      const now = performance.now();
      this.lastFrame = now;
      if (this.paused) return;
      try { this._render(Math.max(0, now - this.t0)); } catch (e) { /* se reintenta en el siguiente frame */ }
    }
    renderAt(frac) { const a = ANIMS[this.animKey]; this._render((a.dur / this.speed) * frac); }
    start() {
      this.paused = false; this.lastFrame = performance.now();
      if (!this.raf) this.raf = requestAnimationFrame(this._loop);
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
    pause(v = true) { this.paused = v; if (!v) this.ensure(); }
    // Vigilante: si el navegador dejó de llamar al bucle, lo reinicia y dibuja ya.
    ensure() {
      if (this.paused) return;
      if (!this.raf || performance.now() - (this.lastFrame || 0) > 400) {
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null; this.start();
        try { this._render(Math.max(0, performance.now() - this.t0)); } catch (e) { /* */ }
      }
    }
    destroy() { this.stop(); this.el.innerHTML = ''; }
  }

  // Deriva accesorios a partir del equipo requerido por el ejercicio
  const EQUIP_PROP = { mancuernas: 'dumbbell', kettlebell: 'kettlebell', barra: 'barbell', liga_tubular: 'band', banda_larga: 'band', miniband: 'miniband', cuerda: 'rope', rueda: 'wheel', balon: 'ball', trx: 'trx', barra_dom: 'bar', silla: 'chair' };
  function propsFor(eq) { return (eq || []).map(e => EQUIP_PROP[e]).filter(Boolean); }

  global.MiFitAvatar = { Avatar, ANIMS, propsFor };
})(window);
