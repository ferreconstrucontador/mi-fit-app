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
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function lerpPose(a, b, u) {
    const o = {};
    for (const k of KEYS) { const x = a[k] || 0, y = b[k] || 0; o[k] = x + (y - x) * u; }
    return o;
  }

  // Calcula las articulaciones (pelvis en 0,0). El ESQUELETO es el mismo para los 12
  // personajes: solo cambian el grosor, el vestuario y la cabeza (S.hr, S.sw, S.hw).
  function solve(p, anim, S) {
    const front = anim.view === 'f';
    const tt = rad(180 - p.t);
    const tdir = [Math.sin(tt), Math.cos(tt)];
    const perp = [-Math.cos(tt), Math.sin(tt)];
    const P = [0, 0];
    const neck = add(P, tdir, L.T);
    const ht = rad(180 - p.t + p.hd);
    const head = add(neck, [Math.sin(ht), Math.cos(ht)], L.NECK + S.hr);
    const Sc = add(P, tdir, L.T - 5);
    const sw = front ? S.sw : 0, hw = front ? S.hw : 0;
    const side = sgn => (front ? sgn : 1);
    const d = (a, sgn) => { const r = rad(a); return [Math.sin(r) * side(sgn), Math.cos(r)]; };
    const armRel = anim.armRel ? -p.t : 0;
    const J = { P, neck, head, front };
    for (const [k, sgn] of [['L', -1], ['R', 1]]) {
      const Sh = add(Sc, perp, sw * sgn);
      const s = p['s' + k] + armRel, e = p['e' + k];
      const E = add(Sh, d(s, sgn), L.UA);
      const Wr = add(E, d(s + e, sgn), L.FA);
      const Hp = add(P, perp, hw * sgn);
      const h = p['h' + k], kn = p['k' + k];
      const K = add(Hp, d(h, sgn), L.TH);
      const A = add(K, d(h - kn, sgn), L.SH);
      const Ft = front ? [A[0] + 6 * sgn, A[1] + 1] : add(A, d(h - kn + 90, 1), L.FT);
      J['S' + k] = Sh; J['E' + k] = E; J['W' + k] = Wr; J['H' + k] = Hp; J['K' + k] = K; J['A' + k] = A; J['F' + k] = Ft;
    }
    return J;
  }

  const PTS = ['neck', 'SL', 'SR', 'EL', 'ER', 'WL', 'WR', 'HL', 'HR', 'KL', 'KR', 'AL', 'AR', 'FL', 'FR', 'P'];
  function shift(J, dx, dy) {
    const o = { front: J.front };
    for (const k of PTS.concat('head')) o[k] = [J[k][0] + dx, J[k][1] + dy];
    return o;
  }
  function bounds(J, S) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const k of PTS) { const [x, y] = J[k]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    minX = Math.min(minX, J.head[0] - S.hr); maxX = Math.max(maxX, J.head[0] + S.hr);
    minY = Math.min(minY, J.head[1] - S.hr); maxY = Math.max(maxY, J.head[1] + S.hr);
    return { minX, maxX, minY, maxY };
  }
  function anchorY(J, anim, S) {
    if (anim.anchor === 'hands') return (anim.handY || BAR_Y) - Math.min(J.WL[1], J.WR[1]);
    return GROUND - 6 - bounds(J, S).maxY;
  }

  // =========================================================================
  //  PERSONAJES: 12 modelos sobre el MISMO esqueleto
  // =========================================================================
  const ACCENTS = [
    { id: 'naranja', n: 'Naranja energético', c: '#ff5a1f' },
    { id: 'azul', n: 'Azul eléctrico', c: '#1e88ff' },
    { id: 'verde', n: 'Verde neón', c: '#22d760' },
    { id: 'morado', n: 'Morado', c: '#8b5cf6' },
    { id: 'rosa', n: 'Rosa coral', c: '#ff6b81' },
    { id: 'gris', n: 'Negro / Gris', c: '#454d5b' }
  ];
  const GROUPS = [
    { id: 'humanos', n: 'Humanos', i: '🧍' },
    { id: 'mascotas', n: 'Mascotas', i: '🐾' },
    { id: 'objetos', n: 'Objetos', i: '🤖' }
  ];
  const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixC = (a, b, t) => { const x = hexRGB(a), y = hexRGB(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const shade = (c, t) => mixC(c, '#000000', t);
  const tint = (c, t) => mixC(c, '#ffffff', t);

  // Dimensiones base (humano atlético). Cada personaje sobrescribe lo que necesite.
  const BASE = {
    sw: 18, hw: 8, hpf: 11, wf: 14, ds: 10, dh: 8.5, ws: 9, // anchos de torso (frente y perfil)
    hr: 13, legW: 13, armW: 9.5, shortsW: 16, sleeveW: 12, shirtW: 7, handR: 4.6, shoeW: 8,
    pantsFull: false, legwarm: false, wrist: false, tail: 0, tailW: 8, tailLen: 30,
    jr: 0, hairStyle: 'short', eyes: 'dot', mouth: 'smile', band: null, outline: null, fx: []
  };
  const CHARS = [
    { id: 'atleta_m', n: 'Atleta Masculino', g: 'humanos', d: 'Deportivo clásico', kind: 'human', head: 'human', b: {},
      col: A => ({ skin: '#e9b48c', hair: '#2b1d14', shirt: A.c, shorts: '#2c3550', shoe: '#ffffff' }) },
    { id: 'atleta_f', n: 'Atleta Femenina', g: 'humanos', d: 'Coleta y conjunto deportivo', kind: 'human', head: 'human',
      b: { sw: 15, hw: 9, hpf: 13, wf: 10, ds: 9, dh: 10, ws: 8, hr: 12.5, legW: 12.2, armW: 8.8, shortsW: 15, sleeveW: 10, hairStyle: 'ponytail' },
      col: A => ({ skin: '#e8b794', hair: '#5a2d14', shirt: A.c, shorts: '#2f3358', shoe: '#ffffff' }) },
    { id: 'fuerza', n: 'Fuerza / Robusto', g: 'humanos', d: 'Complexión ancha de halterofilia', kind: 'human', head: 'human',
      b: { sw: 23, hw: 10, hpf: 14, wf: 18, ds: 13, dh: 10.5, ws: 12, hr: 13.5, legW: 16, armW: 13.5, shortsW: 20, sleeveW: 0, shirtW: 9, handR: 5.6, shoeW: 9, hairStyle: 'buzz', beltBig: true, mouth: 'flat' },
      col: A => ({ skin: '#c98c66', hair: '#1d1512', shirt: A.c, shorts: '#2a2f3a', shoe: '#e9eaee' }) },
    { id: 'zen', n: 'Zen / Estilizado', g: 'humanos', d: 'Ligero, ideal para movilidad y yoga', kind: 'human', head: 'human',
      b: { sw: 13.5, hw: 7.5, hpf: 9, wf: 8, ds: 8, dh: 7, ws: 7, hr: 12, legW: 10.5, armW: 7.6, shortsW: 12.5, sleeveW: 9, handR: 4, shoeW: 7, hairStyle: 'bun', eyes: 'closed', pantsFull: true, outline: '#cfc6b3' },
      col: A => ({ skin: '#f1cba9', hair: '#3b2a22', shirt: A.c, shorts: '#e8e1d2', shoe: '#f1cba9' }) },
    { id: 'ninja', n: 'Ninja / Agilidad', g: 'humanos', d: 'Atuendo oscuro con cinta en la frente', kind: 'human', head: 'human',
      b: { sw: 17, hw: 8, hpf: 11, wf: 12, ds: 9.5, dh: 8.5, ws: 8.5, hr: 12.8, legW: 12.5, armW: 9, shortsW: 14.5, sleeveW: 11, pantsFull: true, wrist: true, hairStyle: 'covered', eyes: 'sharp', mouth: 'flat', band: 'acc', bandTails: true, outline: '#566079' },
      col: A => ({ skin: '#e2ad88', hair: '#15161b', shirt: '#2d3240', shorts: '#272c39', shoe: '#363c4c' }) },
    { id: 'retro80', n: 'Retro 80s / Aeróbicos', g: 'humanos', d: 'Banda en la cabeza y calentadores', kind: 'human', head: 'human',
      b: { sw: 16.5, hw: 8.5, hpf: 12, wf: 12, ds: 9.5, dh: 9.5, ws: 8.5, hr: 12.8, legW: 12.4, armW: 9, shortsW: 15, sleeveW: 0, legwarm: true, wrist: true, hairStyle: 'puff', band: 'acc', bandStripes: true },
      col: A => ({ skin: '#d99f78', hair: '#7a3f1d', shirt: A.c, shorts: shade(A.c, .38), shoe: '#ffffff' }) },
    { id: 'gorila', n: 'Gorila Fuerza', g: 'mascotas', d: 'Robusto y musculoso', kind: 'animal', head: 'gorila',
      b: { sw: 24, hw: 11, hpf: 14, wf: 19, ds: 14, dh: 11, ws: 12.5, hr: 14.5, legW: 15.5, armW: 14, shortsW: 20, sleeveW: 0, shirtW: 9, handR: 6.4, shoeW: 10, wrist: true, fx: ['chest'] },
      col: A => ({ skin: '#413d46', hair: '#2b2830', shirt: '#413d46', shorts: A.c, shoe: '#2b2830', patch: '#8c7866', chest: '#625b69' }) },
    { id: 'zorro', n: 'Zorrito Atleta', g: 'mascotas', d: 'Con banda deportiva (guiño a MiNutriApp)', kind: 'animal', head: 'zorro',
      b: { sw: 16, hw: 8, hpf: 11, wf: 12, ds: 9.5, dh: 8.5, ws: 8.5, hr: 13, legW: 11.5, armW: 9, shortsW: 15, sleeveW: 0, handR: 4.8, shoeW: 9, tail: 1, tailW: 11, tailLen: 32, band: 'acc', fx: ['belly'] },
      col: A => ({ skin: '#ee8a2b', hair: '#3b2a20', shirt: '#ee8a2b', shorts: A.c, shoe: '#3b2a20', white: '#fff3e6', dark: '#3b2a20' }) },
    { id: 'jaguar', n: 'Jaguar Maya', g: 'mascotas', d: 'Atlético con manchas estilizadas', kind: 'animal', head: 'jaguar',
      b: { sw: 18, hw: 8.5, hpf: 12, wf: 13, ds: 10.5, dh: 9, ws: 9.5, hr: 13, legW: 12.5, armW: 10.5, shortsW: 16, sleeveW: 0, handR: 5.2, shoeW: 9, tail: 1, tailW: 6.5, tailLen: 36, fx: ['spots'] },
      col: A => ({ skin: '#e0a43a', hair: '#3b2714', shirt: '#e0a43a', shorts: A.c, shoe: '#6a4420', light: '#f7e3b4', spot: '#3b2714' }) },
    { id: 'panda', n: 'Panda Fitness', g: 'mascotas', d: 'Amigable con muñequeras deportivas', kind: 'animal', head: 'panda',
      b: { sw: 19, hw: 9, hpf: 13, wf: 15, ds: 12, dh: 10.5, ws: 11.5, hr: 15, legW: 15, armW: 12.5, shortsW: 18, sleeveW: 0, shirtW: 8, handR: 6, shoeW: 10, wrist: true, tail: 1, tailW: 9, tailLen: 8, outline: '#b9bfcc' },
      col: A => ({ skin: '#2b2b31', hair: '#2b2b31', shirt: '#f1f2f6', shorts: A.c, shoe: '#2b2b31', white: '#f1f2f6', dark: '#2b2b31' }) },
    { id: 'fitbot', n: 'Fit-Bot (Androide)', g: 'objetos', d: 'Robot con juntas luminosas', kind: 'robot', head: 'robot',
      b: { sw: 17, hw: 8, hpf: 10.5, wf: 12, ds: 9.5, dh: 8.5, ws: 9, hr: 12.5, legW: 10, armW: 8.6, shortsW: 13, sleeveW: 0, shirtW: 9, handR: 4.4, shoeW: 8, jr: 4.4, fx: ['core'] },
      col: A => ({ skin: '#aeb8c6', hair: '#707c8e', shirt: '#c6cdd9', shorts: '#6f7b8d', shoe: '#4c5666' }) },
    { id: 'maniqui', n: 'Maniquí Articulado', g: 'objetos', d: 'Figura de madera con esferas', kind: 'mannequin', head: 'maniqui',
      b: { sw: 15, hw: 7, hpf: 9, wf: 8, ds: 8, dh: 7, ws: 7, hr: 12, legW: 9, armW: 8, shortsW: 0, sleeveW: 0, shirtW: 6, handR: 4, shoeW: 7, jr: 5 },
      col: A => ({ skin: '#dcb98c', hair: '#b8905f', shirt: '#dcb98c', shorts: '#c6a173', shoe: '#c6a173' }) }
  ];
  const CHAR_BY_ID = {}; CHARS.forEach(c => { CHAR_BY_ID[c.id] = c; });
  const ACCENT_BY_ID = {}; ACCENTS.forEach(a => { ACCENT_BY_ID[a.id] = a; });

  function resolveSpec(charId, accentId) {
    const ch = CHAR_BY_ID[charId] || CHARS[0];
    const ac = ACCENT_BY_ID[accentId] || ACCENTS[0];
    const A = { c: ac.c, d: shade(ac.c, .28), l: tint(ac.c, .42) };
    const S = Object.assign({}, BASE, ch.b, ch.col(A));
    S.id = ch.id; S.kind = ch.kind; S.head = ch.head;
    S.acc = A.c; S.accD = A.d; S.accL = A.l;
    S.skinD = shade(S.skin, .2);
    return S;
  }
  // Los colores base de las clases CSS (.av-*) viajan como variables en el contenedor.
  function applyVars(el, S) {
    const v = {
      '--av-skin': S.skin, '--av-skin-d': S.skinD, '--av-hair': S.hair,
      '--av-shirt': S.shirt, '--av-shirt-d': shade(S.shirt, .22),
      '--av-shorts': S.shorts, '--av-shorts-d': shade(S.shorts, .3),
      '--av-shoe': S.shoe, '--av-shoe-d': shade(S.shoe, .2),
      '--av-leg-w': S.legW, '--av-arm-w': S.armW, '--av-shirt-w': S.shirtW
    };
    for (const k in v) el.style.setProperty(k, v[k]);
  }

  // ---------- Dibujo ----------
  const f1 = n => Math.round(n * 10) / 10;
  const pt = p => f1(p[0]) + ',' + f1(p[1]);
  const seg = (a, b, w, cls) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke-width="${f1(w)}" class="${cls}"/>`;
  const segc = (a, b, w, col, op) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${col}" stroke-width="${f1(w)}" stroke-linecap="round"${op ? ` opacity="${op}"` : ''}/>`;
  const poly = (a, b, c, cls) => `<polyline points="${pt(a)} ${pt(b)} ${pt(c)}" class="${cls}" fill="none"/>`;
  const circ = (c, r, fill, ex) => `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="${fill}"${ex || ''}/>`;
  const ellip = (c, rx, ry, fill, ang, ex) => `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}" transform="rotate(${f1(ang || 0)} ${f1(c[0])} ${f1(c[1])})"${ex || ''}/>`;
  const tri = (a, b, c, fill) => `<polygon points="${pt(a)} ${pt(b)} ${pt(c)}" fill="${fill}" stroke="${fill}" stroke-width="2" stroke-linejoin="round"/>`;
  // Franja perpendicular a un hueso (calentadores, cintas)
  function stripe(a, b, t, w, thick, col) {
    const c = lp(a, b, t), dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, nx = -dy / n, ny = dx / n;
    return segc([c[0] - nx * w / 2, c[1] - ny * w / 2], [c[0] + nx * w / 2, c[1] + ny * w / 2], thick, col);
  }

  function drawLimb(J, k, far, S) {
    const tone = far ? ' far' : '';
    const Hp = J['H' + k], K = J['K' + k], A = J['A' + k], F = J['F' + k];
    let s = poly(Hp, K, A, 'av-leg' + tone);
    if (S.shortsW) {
      if (S.pantsFull) s += seg(Hp, K, S.shortsW - 1.5, 'av-shorts' + tone) + seg(K, A, S.shortsW - 3, 'av-shorts' + tone);
      else s += seg(Hp, lp(Hp, K, .55), S.shortsW, 'av-shorts' + tone);
    }
    if (S.legwarm) {
      const c1 = far ? S.accD : S.acc;
      s += segc(lp(K, A, .12), lp(K, A, .82), S.legW + 3.4, c1);
      s += stripe(K, A, .2, S.legW + 3.4, 1.8, '#ffffff') + stripe(K, A, .3, S.legW + 3.4, 1.8, '#ffffff');
    }
    s += seg(A, F, S.shoeW, 'av-shoe' + tone);
    if (S.kind === 'animal') s += circ(F, S.shoeW * .52, far ? shade(S.shoe, .2) : S.shoe);
    return s;
  }
  function drawArm(J, k, far, S) {
    const tone = far ? ' far' : '';
    const Sh = J['S' + k], E = J['E' + k], Wr = J['W' + k];
    let s = poly(Sh, E, Wr, 'av-arm' + tone);
    if (S.sleeveW) s += seg(Sh, lp(Sh, E, .4), S.sleeveW, 'av-sleeve' + tone);
    if (S.wrist) {
      s += segc(lp(E, Wr, .66), lp(E, Wr, .94), S.armW + 3, far ? S.accD : S.acc);
    }
    if (S.kind === 'robot') s += circ(Wr, S.handR + .8, '#4c5666');
    else s += `<circle cx="${f1(Wr[0])}" cy="${f1(Wr[1])}" r="${S.handR}" class="av-hand${tone}"/>`;
    return s;
  }

  // Marco del torso: u = lateral (frente) o hacia delante (perfil); v = a lo largo de la columna.
  function torsoFrame(p) {
    const tt = rad(180 - p.t);
    const tdir = [Math.sin(tt), Math.cos(tt)], perp = [-Math.cos(tt), Math.sin(tt)];
    return { tdir, perp, ang: Math.atan2(tdir[0], -tdir[1]) * 180 / Math.PI };
  }

  function drawTorso(J, p, S) {
    const { tdir, perp, ang } = torsoFrame(p), front = J.front;
    const T = (u, v) => add(add(J.P, tdir, v), perp, u);
    const shW = front ? S.sw : S.ds, hpW = front ? S.hpf : S.dh, wW = front ? S.wf : S.ws;
    const a = add(J.P, perp, hpW), b = add(J.P, perp, -hpW);
    const top = add(J.P, tdir, L.T - 2);
    const c = add(top, perp, -shW), d = add(top, perp, shW);
    const waist = add(J.P, tdir, L.T * .45);
    const w1 = add(waist, perp, wW), w2 = add(waist, perp, -wW);
    let s = '';
    if (S.kind === 'mannequin') {
      const g = 3.6;
      const wu = add(J.P, tdir, L.T * .45 + g), wl = add(J.P, tdir, L.T * .45 - g);
      s += `<path d="M${pt(add(wu, perp, wW))} L${pt(d)} L${pt(c)} L${pt(add(wu, perp, -wW))} Z" class="av-shirt"/>`;
      s += `<path d="M${pt(a)} L${pt(add(wl, perp, wW))} L${pt(add(wl, perp, -wW))} L${pt(b)} Z" class="av-shirt"/>`;
      s += segc(add(waist, perp, -wW - 3), add(waist, perp, wW + 3), 5.5, S.acc);
      s += circ(waist, 4.6, shade(S.skin, .16)) + circ(add(waist, [-1, -1], 1.6), 1.5, tint(S.skin, .45));
    } else {
      const dp = `M${pt(a)} L${pt(w1)} L${pt(d)} L${pt(c)} L${pt(w2)} L${pt(b)} Z`;
      if (S.outline) s += `<path d="${dp}" fill="${S.outline}" stroke="${S.outline}" stroke-width="${S.shirtW + 2.6}" stroke-linejoin="round"/>`;
      s += `<path d="${dp}" class="av-shirt"/>`;
    }
    // Cinturón / short sobre la cadera
    if (S.kind !== 'mannequin') s += `<path d="M${pt(add(J.P, perp, hpW + 1))} L${pt(add(J.P, perp, -hpW - 1))}" class="av-belt"/>`;
    if (S.beltBig) {
      s += segc(add(add(J.P, tdir, 3), perp, hpW + 2), add(add(J.P, tdir, 3), perp, -hpW - 2), 8, '#3a2c24');
      s += circ(T(front ? 0 : S.dh * .85, 3), 3.4, S.acc);
    }
    if (S.id === 'ninja') s += segc(add(add(J.P, tdir, 5), perp, hpW + 1), add(add(J.P, tdir, 5), perp, -hpW - 1), 5, S.acc);
    // Detalles por personaje
    for (const fx of S.fx) {
      if (fx === 'chest') s += ellip(T(front ? 0 : 3, L.T * .6), front ? 11.5 : 4.8, 15, S.chest, ang);
      else if (fx === 'belly') s += ellip(T(front ? 0 : 3, L.T * .52), front ? 7.5 : 3.6, 15, S.white, ang);
      else if (fx === 'spots') {
        const pts = front ? [[-8, .22], [7, .3], [-3, .5], [9, .58], [-9, .7], [3, .8]] : [[4, .22], [-4, .34], [5, .52], [-3, .64], [4, .78]];
        for (const [u, v] of pts) { const q = T(u, v * L.T); s += circ(q, 2.8, 'none', ` stroke="${S.spot}" stroke-width="1.5"`) + circ(q, 1, S.spot); }
      } else if (fx === 'core') {
        const q = T(front ? 0 : 3.2, L.T * .62);
        s += ellip(T(front ? 0 : 2.4, L.T * .6), front ? 9 : 3.8, 11, '#8e99ab', ang) + circ(q, 6.6, S.acc, ' opacity=".28"') + circ(q, 3.2, S.acc);
      }
    }
    return s;
  }

  function drawTail(J, p, S, tm) {
    if (!S.tail) return '';
    const { tdir, perp } = torsoFrame(p), front = J.front;
    const T = (u, v) => add(add(J.P, tdir, v), perp, u);
    const wv = Math.sin(tm / 260) * 3, len = S.tailLen;
    const base = front ? T(S.hpf * .7, 4) : T(-S.dh + 1, 5);
    const ctrl = front ? T(S.hpf + len * .5, -2 + wv) : T(-S.dh - len * .55, 1 + wv);
    const end = front ? T(S.hpf + len * .75, 6 + wv * 1.4) : T(-S.dh - len, 5 + wv * 1.6);
    const fur = S.skin;
    let s = `<path d="M${pt(base)} Q${pt(ctrl)} ${pt(end)}" fill="none" stroke="${fur}" stroke-width="${S.tailW}" stroke-linecap="round"/>`;
    if (S.id === 'zorro') s += circ(end, S.tailW * .62, S.white);
    if (S.id === 'panda') s = circ(front ? T(S.hpf + 2, 2) : T(-S.dh - 2, 4), 5.5, S.white);
    if (S.id === 'jaguar') for (const t of [.3, .55, .8]) { const q = [(1 - t) * (1 - t) * base[0] + 2 * t * (1 - t) * ctrl[0] + t * t * end[0], (1 - t) * (1 - t) * base[1] + 2 * t * (1 - t) * ctrl[1] + t * t * end[1]]; s += circ(q, 1.6, S.spot); }
    return s;
  }

  function drawJoints(J, S) {
    if (!S.jr) return '';
    const big = ['SL', 'SR', 'HL', 'HR'], mid = ['EL', 'ER', 'KL', 'KR'], small = ['WL', 'WR', 'AL', 'AR'];
    let s = '';
    const one = (c, r) => {
      if (S.kind === 'robot') return circ(c, r + 3.4, S.acc, ' opacity=".26"') + circ(c, r, '#2a3340') + circ(c, r - 2.1, S.acc);
      return circ(c, r, shade(S.skin, .18)) + circ([c[0] - r * .32, c[1] - r * .34], r * .34, tint(S.skin, .5));
    };
    for (const k of small) s += one(J[k], S.jr * .72);
    for (const k of mid) s += one(J[k], S.jr * .92);
    for (const k of big) s += one(J[k], S.jr);
    s += one(J.neck, S.jr * .7);
    return s;
  }

  // ---------- Cabezas ----------
  function drawHead(J, p, S, tm) {
    const c = J.head, r = S.hr, front = J.front;
    const ht = rad(180 - p.t + p.hd);
    const up = [Math.sin(ht), Math.cos(ht)], fw = [-up[1], up[0]]; // fw = hacia donde mira (perfil) / derecha (frente)
    const Q = (u, v) => [c[0] + fw[0] * u * r + up[0] * v * r, c[1] + fw[1] * u * r + up[1] * v * r];
    const ang = Math.atan2(up[0], -up[1]) * 180 / Math.PI;
    const E = (u, v, rx, ry, fill, a2, ex) => ellip(Q(u, v), rx * r, ry * r, fill, ang + (a2 || 0), ex);
    const C = (u, v, rr, fill, ex) => circ(Q(u, v), rr * r, fill, ex);
    const Ln = (u1, v1, u2, v2, w, col) => segc(Q(u1, v1), Q(u2, v2), w, col);
    const P2 = (arr, fill, ex) => `<polygon points="${arr.map(q => pt(Q(q[0], q[1]))).join(' ')}" fill="${fill}"${ex || ''}/>`;
    const wave = Math.sin(tm / 170) * .16;
    const headCircle = fill => `<circle ${fill ? `fill="${fill}"` : 'class="av-skin"'} cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}"/>`;
    const eyeDots = (col, rr) => front ? C(-.36, -.04, rr, col) + C(.36, -.04, rr, col) : C(.56, .05, rr, col);
    let s = seg(J.neck, add(J.neck, up, L.NECK + 2), 8, 'av-skin-l');
    const bandCol = S.band === 'acc' ? S.acc : null;
    const band = () => {
      if (!bandCol) return '';
      let b = Ln(-.9, .42, .9, .42, r * .3, bandCol);
      if (S.bandStripes) b += Ln(-.9, .5, .9, .5, 1.5, '#ffffff') + Ln(-.9, .34, .9, .34, 1.5, '#ffffff');
      if (S.bandTails || S.id === 'zorro') {
        if (front) b += Ln(.88, .42, 1.35, .12 + wave, r * .17, bandCol) + Ln(1.35, .12 + wave, 1.5, -.35 + wave, r * .13, bandCol);
        else b += Ln(-.88, .42, -1.5, .3 + wave, r * .17, bandCol) + Ln(-1.5, .3 + wave, -2.1, .05 + wave * 1.6, r * .13, bandCol);
      }
      return b;
    };

    if (S.head === 'human') {
      // Detrás de la cabeza
      if (S.hairStyle === 'ponytail') {
        s += front
          ? E(1.0, .15, .24, .62, S.hair, 22)
          : `<path d="M${pt(Q(-.8, .6))} Q${pt(Q(-2.0, .55 + wave))} ${pt(Q(-1.75, -.95 + wave))}" fill="none" stroke="${S.hair}" stroke-width="${f1(r * .5)}" stroke-linecap="round"/>`;
      }
      if (S.hairStyle === 'puff') s += C(-.15, .5, 1.32, S.hair);
      s += headCircle();
      if (!front) s += C(-.05, -.02, .2, S.skinD) + C(1.0, -.12, .15, S.skin);
      // Cabello
      if (S.hairStyle !== 'puff' && S.hairStyle !== 'covered') {
        const buzz = S.hairStyle === 'buzz';
        s += front
          ? `<path d="M${pt(Q(-1, .1))} Q${pt(Q(0, buzz ? 1.45 : 1.8))} ${pt(Q(1, .1))} Q${pt(Q(0, buzz ? .95 : .72))} ${pt(Q(-1, .1))} Z" fill="${S.hair}"/>`
          : `<path d="M${pt(Q(-1, -.05))} Q${pt(Q(-1.05, 1.2))} ${pt(Q(0, 1.02))} Q${pt(Q(.75, 1.0))} ${pt(Q(.6, buzz ? .55 : .35))} Q${pt(Q(.1, buzz ? .5 : .2))} ${pt(Q(-1, -.05))} Z" fill="${S.hair}"/>`;
      } else if (S.hairStyle === 'covered') {
        s += front
          ? `<path d="M${pt(Q(-1, .05))} Q${pt(Q(0, 1.9))} ${pt(Q(1, .05))} L${pt(Q(.95, .62))} L${pt(Q(-.95, .62))} Z" fill="${S.hair}"/>`
          : `<path d="M${pt(Q(-1, -.1))} Q${pt(Q(-1.1, 1.3))} ${pt(Q(0, 1.05))} Q${pt(Q(.9, 1.0))} ${pt(Q(.98, .6))} L${pt(Q(-.2, .55))} Z" fill="${S.hair}"/>`;
      } else {
        s += front
          ? `<path d="M${pt(Q(-1, .1))} Q${pt(Q(0, 1.7))} ${pt(Q(1, .1))} Q${pt(Q(0, .8))} ${pt(Q(-1, .1))} Z" fill="${S.hair}"/>`
          : `<path d="M${pt(Q(-1, .0))} Q${pt(Q(-1, 1.2))} ${pt(Q(.1, 1.05))} Q${pt(Q(.8, 1.0))} ${pt(Q(.62, .4))} Q${pt(Q(.1, .3))} ${pt(Q(-1, 0))} Z" fill="${S.hair}"/>`;
      }
      if (S.hairStyle === 'bun') s += C(-.12, 1.32, .42, S.hair);
      s += band();
      // Cara
      if (S.eyes === 'closed') {
        const arc = u => `<path d="M${pt(Q(u - .17, .0))} Q${pt(Q(u, -.2))} ${pt(Q(u + .17, .0))}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-linecap="round"/>`;
        s += front ? arc(-.36) + arc(.36) : arc(.55);
      } else if (S.eyes === 'sharp') {
        s += front ? Ln(-.55, .12, -.2, -.02, 1.8, '#111') + Ln(.55, .12, .2, -.02, 1.8, '#111') + C(-.36, -.07, .09, '#111') + C(.36, -.07, .09, '#111')
          : Ln(.34, .14, .8, -.02, 1.8, '#111') + C(.58, .0, .09, '#111');
      } else s += eyeDots('#1a1a1a', .12);
      if (S.mouth === 'flat') s += front ? Ln(-.25, -.5, .25, -.5, 1.5, '#7a3b2a') : Ln(.5, -.5, .88, -.5, 1.5, '#7a3b2a');
      else s += front
        ? `<path d="M${pt(Q(-.3, -.46))} Q${pt(Q(0, -.74))} ${pt(Q(.3, -.46))}" fill="none" stroke="#7a3b2a" stroke-width="1.6" stroke-linecap="round"/>`
        : `<path d="M${pt(Q(.5, -.46))} Q${pt(Q(.78, -.66))} ${pt(Q(.95, -.4))}" fill="none" stroke="#7a3b2a" stroke-width="1.6" stroke-linecap="round"/>`;
      return s;
    }

    if (S.head === 'gorila') {
      s += front ? C(-1.0, 0, .27, S.hair) + C(1.0, 0, .27, S.hair) : C(-.05, .05, .27, S.hair);
      s += headCircle();
      s += E(-.1, .95, .55, .36, S.hair);               // cresta
      s += front ? E(0, -.12, .68, .62, S.patch) : E(.55, -.1, .5, .62, S.patch);
      s += front ? Ln(-.58, .3, .58, .3, r * .26, S.hair) : Ln(.1, .34, .98, .3, r * .26, S.hair);
      s += eyeDots('#16141a', .1);
      s += front ? C(-.12, -.2, .06, '#2b2830') + C(.12, -.2, .06, '#2b2830') + Ln(-.3, -.5, .3, -.5, 1.6, '#2b2830')
        : C(.97, -.12, .07, '#2b2830') + Ln(.55, -.5, .95, -.46, 1.6, '#2b2830');
      return s;
    }

    if (S.head === 'zorro') {
      // Orejas (detrás)
      if (front) s += tri(Q(-.95, .45), Q(-.3, .98), Q(-.75, 1.85), S.skin) + tri(Q(.95, .45), Q(.3, .98), Q(.75, 1.85), S.skin)
        + tri(Q(-.72, .78), Q(-.45, 1.0), Q(-.7, 1.45), S.dark) + tri(Q(.72, .78), Q(.45, 1.0), Q(.7, 1.45), S.dark);
      else s += tri(Q(-.2, .95), Q(.5, .8), Q(.28, 1.8), shade(S.skin, .12)) + tri(Q(-.85, .6), Q(-.1, .98), Q(-.55, 1.85), S.skin) + tri(Q(-.6, .85), Q(-.28, 1.0), Q(-.5, 1.5), S.dark);
      s += headCircle();
      if (front) s += E(-.5, -.3, .52, .42, S.white, 30) + E(.5, -.3, .52, .42, S.white, -30) + E(0, -.38, .36, .34, S.skin) + E(0, -.42, .3, .26, S.white) + C(0, -.2, .12, S.dark);
      else s += `<path d="M${pt(Q(.55, .3))} L${pt(Q(1.75, -.28))} L${pt(Q(.6, -.62))} Z" fill="${S.skin}" stroke="${S.skin}" stroke-width="${f1(r * .3)}" stroke-linejoin="round"/>`
        + E(.55, -.42, .6, .34, S.white, -15) + C(1.85, -.28, .17, S.dark);
      s += eyeDots(S.dark, .11);
      s += band();
      return s;
    }

    if (S.head === 'jaguar') {
      s += front ? C(-.82, .78, .33, S.skin) + C(.82, .78, .33, S.skin) + C(-.82, .78, .17, S.spot) + C(.82, .78, .17, S.spot)
        : C(-.35, .95, .33, shade(S.skin, .1)) + C(.1, 1.0, .33, S.skin) + C(.1, 1.0, .16, S.spot);
      s += headCircle();
      s += front ? E(0, -.32, .5, .4, S.light) + C(0, -.12, .12, '#5a2f2a') + Ln(0, -.2, 0, -.46, 1.3, S.spot)
        : E(.62, -.28, .5, .36, S.light) + C(1.05, -.06, .13, '#5a2f2a');
      s += front ? C(-.38, .06, .15, '#f2d36b') + C(.38, .06, .15, '#f2d36b') + C(-.38, .06, .07, '#111') + C(.38, .06, .07, '#111')
        : C(.55, .08, .15, '#f2d36b') + C(.58, .08, .07, '#111');
      for (const [u, v] of (front ? [[-.7, .45], [.7, .45], [-.62, -.2], [.62, -.2], [0, .7]] : [[-.3, .55], [.1, .7], [-.55, .1], [.15, -.05]])) s += C(u, v, .07, S.spot);
      return s;
    }

    if (S.head === 'panda') {
      s += front ? C(-.78, .78, .38, S.dark) + C(.78, .78, .38, S.dark) : C(-.4, .92, .38, S.dark) + C(.1, 1.0, .35, S.dark);
      s += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}" fill="${S.white}" stroke="${S.outline}" stroke-width="1.4"/>`;
      s += front ? E(-.42, .02, .24, .31, S.dark, 22) + E(.42, .02, .24, .31, S.dark, -22) + C(-.42, .04, .07, '#fff') + C(.42, .04, .07, '#fff')
        : E(.48, .02, .22, .3, S.dark, -15) + C(.52, .05, .07, '#fff');
      s += front ? E(0, -.34, .34, .26, '#e4e6ec') + E(0, -.2, .15, .1, S.dark) + Ln(0, -.28, 0, -.46, 1.2, S.dark)
        : E(.85, -.22, .34, .26, '#e4e6ec') + E(1.1, -.08, .12, .1, S.dark);
      return s;
    }

    if (S.head === 'robot') {
      const box = (x1, y1, x2, y2, fill, w) => `<polygon points="${[Q(x1, y2), Q(x2, y2), Q(x2, y1), Q(x1, y1)].map(pt).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="${w}" stroke-linejoin="round"/>`;
      s += Ln(0, .9, 0, 1.45, 2.2, '#707c8e') + C(0, 1.52, .2, S.acc, ' opacity=".3"') + C(0, 1.52, .13, S.acc);
      s += box(-.78, -.78, .78, .78, 'var(--av-skin)', r * .42).replace('fill="var(--av-skin)" stroke="var(--av-skin)"', 'style="fill:var(--av-skin);stroke:var(--av-skin)"');
      s += front ? box(-.62, -.42, .62, .36, '#1c2431', r * .26) : box(-.05, -.42, .95, .36, '#1c2431', r * .26);
      s += front
        ? C(-.3, -.03, .26, S.acc, ' opacity=".3"') + C(.3, -.03, .26, S.acc, ' opacity=".3"') + C(-.3, -.03, .14, S.acc) + C(.3, -.03, .14, S.acc)
        : C(.5, -.03, .26, S.acc, ' opacity=".3"') + C(.5, -.03, .14, S.acc);
      s += front ? C(-1.0, 0, .17, '#707c8e') + C(1.0, 0, .17, '#707c8e') : C(-.15, 0, .2, '#707c8e');
      return s;
    }

    // Maniquí de madera
    s += `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(r * .84)}" ry="${f1(r * 1.1)}" class="av-skin" transform="rotate(${f1(ang)} ${f1(c[0])} ${f1(c[1])})"/>`;
    s += Ln(-.78, .42, .78, .42, 3, S.acc);
    s += front ? Ln(0, .1, 0, -.7, 1, shade(S.skin, .2)) : Ln(.2, .12, .8, .08, 1, shade(S.skin, .22));
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
      this.charId = opts.char || 'atleta_m';
      this.accentId = opts.accent || 'naranja';
      this.animKey = 'breathe';
      this.props = [];
      this.speed = 1;
      this.t0 = performance.now();
      this.raf = null; this.to = null;
      this.paused = false;
      this.lastFrame = 0;
      this.cycleList = null;
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="avatar-svg" role="img" aria-label="Entrenador virtual"><g class="av-scene"></g><g class="av-body"></g></svg>`;
      this.svgScene = el.querySelector('.av-scene');
      this.svgBody = el.querySelector('.av-body');
      this._frame = this._frame.bind(this);
      this.set({ anim: opts.anim || 'breathe', props: opts.props || [] });
      this.start();
    }
    set({ anim, char, accent, props, speed } = {}) {
      if (char) this.charId = char;
      if (accent) this.accentId = accent;
      if (props) this.props = props;
      if (speed) this.speed = speed;
      // Sin pose propia → animación dinámica por defecto (nunca se queda estático)
      if (anim) this.animKey = ANIMS[anim] ? anim : FALLBACK_ANIM;
      this.S = resolveSpec(this.charId, this.accentId);
      applyVars(this.el, this.S);
      this._prepare();
      this.t0 = performance.now();
      this._render(0);
    }
    _prepare() {
      const a = ANIMS[this.animKey], S = this.S;
      let minX = 1e9, maxX = -1e9, lowP = -1e9, J0 = null;
      for (const k of a.kf) {
        const Jk = solve(lerpPose(k, k, 0), a, S);
        if (!J0) J0 = Jk;
        const bk = bounds(Jk, S); minX = Math.min(minX, bk.minX); maxX = Math.max(maxX, bk.maxX);
        lowP = Math.max(lowP, Jk.P[1] + anchorY(Jk, a, S));
      }
      let dx = W / 2 - (minX + maxX) / 2;
      if (a.view === 'f') dx = W / 2;
      if (a.band === 'front' || a.trx) dx -= 25;
      if (a.band === 'back') dx += 25;
      this.dx = dx;
      this.first = shift(J0, dx, anchorY(J0, a, S));
      this.lowP = lowP;
    }
    _render(time) {
      const a = ANIMS[this.animKey], S = this.S, n = a.kf.length;
      const dur = a.dur / this.speed;
      const tt = ((time % dur) + dur) % dur;           // nunca negativo
      const ph = (tt / dur) * n;
      const i = Math.floor(ph) % n, u = ph - Math.floor(ph);
      const e = (1 - Math.cos(Math.PI * u)) / 2;
      const p = lerpPose(a.kf[i], a.kf[(i + 1) % n], e);
      const J0 = solve(p, a, S);
      const J = shift(J0, this.dx, anchorY(J0, a, S) - p.j);
      const tm = time * this.speed;
      const ctx = { time: tm, first: this.first, lowP: this.lowP };
      const props = this.props || [];
      this.svgScene.innerHTML = drawScene(a, ctx, J, props);
      let b = `<ellipse cx="${f1(J.P[0])}" cy="${GROUND}" rx="${30 - Math.min(p.j, 20)}" ry="4" class="av-shadow"/>`;
      if (J.front) {
        b += drawTail(J, p, S, tm) + drawLimb(J, 'L', false, S) + drawLimb(J, 'R', false, S) + drawTorso(J, p, S) + drawHead(J, p, S, tm) + drawArm(J, 'L', false, S) + drawArm(J, 'R', false, S);
      } else {
        b += drawArm(J, 'L', true, S) + drawLimb(J, 'L', true, S) + drawTail(J, p, S, tm) + drawTorso(J, p, S) + drawLimb(J, 'R', false, S) + drawHead(J, p, S, tm) + drawArm(J, 'R', false, S);
      }
      b += drawJoints(J, S) + drawProps(J, props, a, ctx);
      this.svgBody.innerHTML = b;
    }
    // Doble disparador: requestAnimationFrame + temporizador de respaldo. Si el navegador
    // móvil no entrega frames (ahorro de energía / WebView), el temporizador sigue animando.
    _schedule() {
      this.raf = requestAnimationFrame(this._frame);
      this.to = setTimeout(this._frame, 90);
    }
    _frame() {
      if (this.raf == null && this.to == null) return;     // detenido
      cancelAnimationFrame(this.raf); clearTimeout(this.to);
      this._schedule();                                    // reprograma SIEMPRE primero
      const now = performance.now();
      this.lastFrame = now;
      if (this.paused || document.hidden) return;
      try {
        if (this.cycleList && now - this.cycleT > this.cycleMs) {
          this.cycleI = (this.cycleI + 1) % this.cycleList.length; this.cycleT = now;
          this.set({ anim: this.cycleList[this.cycleI] });
        }
        this._render(Math.max(0, now - this.t0));
      } catch (err) { /* se reintenta en el siguiente frame */ }
    }
    renderAt(frac) { const a = ANIMS[this.animKey]; this._render((a.dur / this.speed) * frac); }
    start() {
      if (this.raf == null && this.to == null) { this.lastFrame = performance.now(); this._schedule(); }
    }
    stop() { cancelAnimationFrame(this.raf); clearTimeout(this.to); this.raf = null; this.to = null; }
    pause(v = true) { this.paused = v; if (!v) this.ensure(); }
    // Vigilante: si el bucle se detuvo, lo reinicia y dibuja de inmediato.
    ensure() {
      if (this.paused) return;
      if ((this.raf == null && this.to == null) || performance.now() - (this.lastFrame || 0) > 400) {
        this.stop(); this.start();
        try { this._render(Math.max(0, performance.now() - this.t0)); } catch (err) { /* */ }
      }
    }
    // Rota por una lista de animaciones (vista previa de la galería)
    cycle(list, ms) {
      this.cycleList = list; this.cycleMs = ms; this.cycleI = 0; this.cycleT = performance.now();
      this.set({ anim: list[0] });
    }
    destroy() { this.stop(); this.cycleList = null; this.el.innerHTML = ''; }
  }

  // Deriva accesorios a partir del equipo requerido por el ejercicio
  const EQUIP_PROP = { mancuernas: 'dumbbell', kettlebell: 'kettlebell', barra: 'barbell', liga_tubular: 'band', banda_larga: 'band', miniband: 'miniband', cuerda: 'rope', rueda: 'wheel', balon: 'ball', trx: 'trx', barra_dom: 'bar', silla: 'chair' };
  function propsFor(eq) { return (eq || []).map(e => EQUIP_PROP[e]).filter(Boolean); }

  global.MiFitAvatar = { Avatar, ANIMS, CHARS, GROUPS, ACCENTS, propsFor, FALLBACK_ANIM };
})(window);
