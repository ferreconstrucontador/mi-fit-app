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
    // Rodillas apoyadas en el piso (pivote), pantorrillas y pies levantados hacia atrás (tibia fija a ~35° sobre el suelo);
    // manos y rodillas quedan a la misma altura en A y en B, y la distancia mano-rodilla se conserva.
    kneepushup: { dur: 2000, pf: true, kf: [{ t: 51.4, hL: -51.4, hR: -51.4, kL: 73.6, kR: 73.6, sL: 0, sR: 0 }, { t: 64, hL: -64, hR: -64, kL: 61, kR: 61, sL: -55.7, eL: 86.7, sR: -55.7, eR: 86.7 }] },
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
    // La mano de la pierna flexionada (R, la más cercana a la cámara) sujeta el empeine/tobillo detrás del glúteo (cinemática inversa calculada para cada fotograma)
    stretchquad: { dur: 4000, kf: [{ t: -4, hR: -5, kR: 165, sR: -24.2, eR: 29.1, sL: 80 }, { t: -4, hR: -8, kR: 165, sR: -26.8, eR: 34.1, sL: 85, hd: 4 }] },
    stretchham: { dur: 4000, kf: [{ t: 50, hL: 90, hR: 90, sL: 95, sR: 95 }, { t: 62, hL: 90, hR: 90, sL: 100, sR: 100 }] },
    stretcharm: { view: 'f', dur: 4000, kf: [{ sR: -80, sL: 40, eL: -110 }, { sR: -84, sL: 42, eL: -112, hd: 4 }] },
    stretchtri: { dur: 4000, kf: [{ sR: 170, eR: 170, sL: 160, eL: 110 }, { sR: 172, eR: 170, sL: 162, eL: 112, hd: -4 }] },
    stretchside: { view: 'f', dur: 4200, kf: [{ t: -14, sR: 172, sL: 20 }, { t: 0, sR: 172, sL: 172 }, { t: 14, sL: 172, sR: 20 }, { t: 0, sR: 172, sL: 172 }] },
    stretchchest: { dur: 4000, wall: 'back', kf: [{ sL: -70, sR: -70, hd: -5 }, { sL: -82, sR: -82, hd: -8 }] },
    child: { dur: 4500, kf: [{ t: 112, hL: 80, hR: 80, kL: 170, kR: 170, sL: 98, sR: 98 }, { t: 108, hL: 80, hR: 80, kL: 170, kR: 170, sL: 98, sR: 98 }] },
    // Superman: decúbito prono. Pelvis y abdomen apoyados; brazos y piernas extendidos que se elevan en arco.
    superman: { dur: 3600, pf: true, anchor: 'pelvis', vb: [-22, -26, 244, 317], kf: [{ t: 90, hd: 14, sL: 98, sR: 98, eL: 0, eR: 0, hL: -92, hR: -92, kL: 0, kR: 0 }, { t: 76, hd: 8, sL: 112, sR: 112, eL: 0, eR: 0, hL: -112, hR: -112, kL: 0, kR: 0 }] },
    // Cobra suave (esfinge): pelvis, abdomen y piernas apoyados en el piso; solo el pecho se eleva, con los antebrazos en el suelo.
    cobra: { dur: 4000, pf: true, anchor: 'pelvis', vb: [-14, -14, 228, 296], kf: [{ t: 80, hd: 0, sL: 53, eL: 37, sR: 53, eR: 37, hL: -91, hR: -91, kL: 0, kR: 0 }, { t: 64, hd: -8, sL: 0, eL: 90, sR: 0, eR: 90, hL: -91, hR: -91, kL: 0, kR: 0 }] },
    // Y-T-W boca abajo: decúbito prono, torso apenas elevado y brazos extendidos que dibujan Y (arriba), T (a la altura de los hombros) y W (codos flexionados).
    ytw: { dur: 5400, pf: true, anchor: 'pelvis', vb: [-22, -26, 244, 317], kf: [{ t: 78, hd: 10, sL: 135, sR: 135, eL: 0, eR: 0, hL: -91, hR: -91, kL: 0, kR: 0 }, { t: 78, hd: 10, sL: 100, sR: 100, eL: -12, eR: -12, hL: -91, hR: -91, kL: 0, kR: 0 }, { t: 78, hd: 10, sL: 112, sR: 112, eL: 95, eR: 95, hL: -91, hR: -91, kL: 0, kR: 0 }] },
    // Jalón isométrico con toalla: de frente, manos separadas tensando la toalla desde arriba hasta el pecho
    towelpull: { view: 'f', dur: 2400, towel: true, kf: [{ sL: 165, sR: 165 }, { sL: 22, eL: 118, sR: 22, eR: 118, hd: 2 }] },
    kneehug: { dur: 3600, kf: [{ t: 270, hL: 165, hR: 165, kL: 150, kR: 150, sL: 140, sR: 140, eL: 30, eR: 30 }, { t: 272, hL: 172, hR: 172, kL: 150, kR: 150, sL: 145, sR: 145, eL: 30, eR: 30 }] },
    dislocate: { view: 'f', dur: 3000, bandHands: true, kf: [{ sL: 30, sR: 30 }, { sL: 178, sR: 178 }] },
    pullapart: { view: 'f', dur: 2000, bandHands: true, kf: [{ sL: 80, eL: -70, sR: 80, eR: -70 }, { sL: 90, sR: 90 }] },
    // Escaladora vertical / Stepper: pasos alternos con las manos en el manillar. El accesorio 'stepper'
    // dibuja la máquina y sus pedales siguen exactamente a los pies del avatar.
    stepper: { dur: 1400, stepper: true, kf: [
      { t: 8, sL: 52, eL: 10, sR: 52, eR: 10, hR: 62, kR: 82, hL: 8, kL: 6 },
      { t: 8, sL: 52, eL: 10, sR: 52, eR: 10, hL: 62, kL: 82, hR: 8, kR: 6, j: 1 }] },
    stepperhiit: { dur: 760, stepper: true, kf: [
      { t: 14, sL: 55, eL: 12, sR: 55, eR: 12, hR: 66, kR: 88, hL: 10, kL: 10 },
      { t: 14, sL: 55, eL: 12, sR: 55, eR: 12, hL: 66, kL: 88, hR: 10, kR: 10, j: 2 }] },
    stepperdeep: { dur: 1900, stepper: true, kf: [
      { t: 0, sL: 50, eL: 8, sR: 50, eR: 8, hR: 78, kR: 100, hL: 4, kL: 2 },
      { t: 0, sL: 50, eL: 8, sR: 50, eR: 8, hL: 78, kL: 100, hR: 4, kR: 2, j: 1 }] },
    steppersid: { view: 'f', dur: 1600, stepper: true, kf: [
      { t: 0, sL: 24, eL: -14, sR: 24, eR: -14, hR: 34, kR: 84, hL: 5, kL: 3 },
      { t: 0, sL: 24, eL: -14, sR: 24, eR: -14, hL: 34, kL: 84, hR: 5, kR: 3, j: 1 }] }
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
      const Ft = front ? [A[0] + 6 * sgn, A[1] + 1] : anim.pf ? add(A, d(h - kn, 1), L.FT + 1) : add(A, d(h - kn + 90, 1), L.FT);
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
    if (anim.anchor === 'pelvis') return GROUND - 10 - J.P[1];      // boca abajo: el abdomen descansa en el piso
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
    { id: 'objetos', n: 'Objetos', i: '🤖' },
    { id: 'anatomia', n: 'Anatómicos', i: '🫀' }
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
      col: A => ({ skin: '#dcb98c', hair: '#b8905f', shirt: '#dcb98c', shorts: '#c6a173', shoe: '#c6a173' }) },
    // Figuras anatómicas plateadas: los músculos trabajados se iluminan en rojo
    { id: 'anat_m', n: 'Anatómico Hombre', g: 'anatomia', d: 'Plata metálica · músculos que se iluminan', kind: 'anatomy', head: 'anat',
      b: { sw: 19.5, hw: 8.2, hpf: 11.5, wf: 14.5, ds: 11, dh: 9, ws: 10, hr: 12.6, legW: 13.6, armW: 10.4, shortsW: 0, sleeveW: 0, shirtW: 6, handR: 4.4, shoeW: 7.5, fem: false },
      col: A => ({ skin: '#a9b2bf', hair: '#8d96a4', shirt: '#b7bfca', shorts: '#a9b2bf', shoe: '#98a1af' }) },
    { id: 'anat_f', n: 'Anatómico Mujer', g: 'anatomia', d: 'Plata metálica · músculos que se iluminan', kind: 'anatomy', head: 'anat',
      b: { sw: 15.5, hw: 9, hpf: 13, wf: 10.8, ds: 9.5, dh: 10.5, ws: 8.5, hr: 11.8, legW: 12.6, armW: 8.8, shortsW: 0, sleeveW: 0, shirtW: 6, handR: 3.9, shoeW: 7, fem: true },
      col: A => ({ skin: '#adb6c3', hair: '#8d96a4', shirt: '#bbc3ce', shorts: '#adb6c3', shoe: '#9ba4b2' }) }
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

  // =========================================================================
  //  ANATOMÍA 2.5D — solo "Anatómico Hombre" y "Anatómico Mujer"
  //  Siluetas esculpidas con <path> orgánicos sobre el MISMO esqueleto. Cada músculo es un
  //  "listón" (dos bordes de puntos) suavizado con curvas Bézier (Catmull-Rom); degradados
  //  radiales plata/titanio dan volumen y las fibras salen de interpolar ambos bordes.
  //  Los músculos activos usan degradado carmesí y un resplandor pulsante (feGaussianBlur).
  //  Nada de este bloque lo usan los otros 12 modelos.
  // =========================================================================
  const mlevel = (S, id) => (S.mlev && S.mlev[id]) || 0;

  // Curva suave que pasa por los puntos (Catmull-Rom → cúbicas de Bézier)
  function smoothPath(pts, closed) {
    const n = pts.length;
    if (n < 2) return '';
    const g = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${pt(pts[0])}`;
    const m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
    }
    return d + (closed ? 'Z' : '');
  }
  const ribPath = r => smoothPath(r.e1.concat(r.e2.slice().reverse()), true);
  function ribFibers(r, n) {
    let d = '';
    for (let k = 1; k <= n; k++) d += smoothPath(r.e1.map((q, i) => lp(q, r.e2[i], k / (n + 1))), false);
    return d;
  }
  // Listón sobre un hueso A→B. st = [t, a, b]: posición t a lo largo y distancias laterales con signo
  // (+ = frente en perfil / derecha de la imagen en vista frontal). sg espeja el lado; k escala el grosor.
  function boneRib(A, B, st, sg, k) {
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = uy * sg * k, ny = -ux * sg * k;
    const q = (t, o) => [A[0] + ux * len * t + nx * o, A[1] + uy * len * t + ny * o];
    return { e1: st.map(s => q(s[0], s[1])), e2: st.map(s => q(s[0], s[2])) };
  }
  // Listón en el marco del torso. st = [u1, v1, u2, v2] (u lateral/hacia delante, v a lo largo de la columna)
  function torsoRib(P, tdir, perp, st, sg, ku) {
    const q = (u, v) => [P[0] + tdir[0] * v + perp[0] * u * sg * ku, P[1] + tdir[1] * v + perp[1] * u * sg * ku];
    return { e1: st.map(s => q(s[0], s[1])), e2: st.map(s => q(s[2], s[3])) };
  }
  const prof = a => a.map(s => [s[0], s[1], -s[2]]);

  // ----- Tablas de forma (varón). Mujer: ver ANF al final -----
  const AN = {
    // siluetas base [t, delante|fuera, detrás|dentro]
    thighS: [[0, 8.2, 9.6], [.2, 8.6, 8.8], [.45, 8.2, 7.6], [.7, 6.6, 6.0], [.9, 5.2, 5.0], [1, 4.8, 4.8]],
    thighF: [[0, 7.5, 5.5], [.3, 8.0, 6.5], [.6, 7.0, 5.8], [.9, 5.2, 4.8], [1, 4.8, 4.6]],
    shinS: [[0, 4.6, 4.8], [.12, 4.2, 6.2], [.3, 3.8, 6.8], [.5, 3.6, 5.6], [.75, 3.2, 3.6], [1, 3.0, 3.2]],
    shinF: [[0, 4.6, 4.4], [.15, 5.8, 5.4], [.35, 5.6, 5.0], [.6, 4.0, 3.6], [.85, 3.2, 3.0], [1, 3.0, 3.0]],
    armS: [[0, 6.4, 6.4], [.25, 5.6, 5.8], [.5, 5.0, 5.4], [.8, 3.9, 4.2], [1, 3.5, 3.5]],
    armF: [[0, 6.2, 5.0], [.3, 5.4, 4.6], [.6, 4.8, 4.2], [1, 3.6, 3.4]],
    foreS: [[0, 3.8, 3.8], [.2, 4.6, 4.3], [.45, 4.0, 3.6], [.8, 2.8, 2.6], [1, 2.4, 2.4]],
    foreF: [[0, 3.8, 3.6], [.25, 4.8, 4.2], [.6, 3.4, 3.0], [1, 2.4, 2.4]],
    torsoS: [[0, 7.5, 9.0], [5, 9.5, 11.2], [12, 9.8, 10.2], [20, 8.4, 8.4], [28, 9.0, 8.2], [36, 10.6, 9.0], [44, 12.2, 10.2], [52, 11.4, 10.8], [58, 8.6, 9.2], [62, 5.2, 5.6]],
    torsoF: [[0, 9.5], [5, 11.6], [12, 12.0], [20, 9.8], [28, 9.6], [36, 11.4], [44, 13.4], [50, 15.4], [55, 17.5], [59, 14], [62, 5.2]],
    // músculos [t, borde1, borde2]
    quadS: [[.04, 8.4, 2.5], [.2, 8.9, 1.6], [.45, 8.4, 1.4], [.7, 6.9, 1.6], [.92, 5.4, 2.6], [.98, 4.2, 3.0]],
    hamS: [[.05, -1.5, -9.8], [.2, -1.2, -9.0], [.45, -1.2, -7.8], [.7, -1.4, -6.2], [.9, -2.2, -5.0]],
    calfS: [[.04, -1.2, -5.8], [.14, -1.0, -6.6], [.3, -1.2, -7.0], [.48, -1.6, -5.4], [.64, -2.0, -3.6]],
    soleusS: [[.45, -1.4, -4.6], [.62, -1.5, -4.0], [.82, -1.6, -3.2]],
    tibS: [[.1, 4.2, .6], [.4, 3.6, .5], [.8, 2.8, .5]],
    vlF: [[.1, 7.6, 2.8], [.3, 8.2, 2.4], [.6, 7.2, 2.4], [.88, 5.2, 2.6]],
    rfF: [[.08, 3.6, -3.2], [.3, 4.6, -3.8], [.6, 3.8, -3.4], [.85, 2.8, -2.8]],
    vmF: [[.5, -2.0, -5.6], [.7, -2.2, -6.2], [.85, -2.6, -5.8], [.95, -3.4, -4.8]],
    hamF: [[.08, 9.2, 6.0], [.4, 9.6, 6.4], [.8, 6.8, 4.4]],
    hamFi: [[.2, -5.4, -7.6], [.5, -5.6, -7.8], [.8, -4.6, -6.2]],
    tibF: [[.08, 2.2, -2.0], [.3, 2.6, -2.2], [.6, 2.0, -1.8], [.88, 1.2, -1.2]],
    gastroOF: [[.05, 5.0, 2.0], [.2, 6.4, 2.2], [.38, 6.0, 2.0], [.55, 3.8, 1.6]],
    gastroIF: [[.05, -2.0, -5.2], [.2, -2.2, -5.6], [.38, -2.0, -5.2], [.55, -1.8, -3.6]],
    delS: [[-.12, 3, -3], [0, 6.4, -6.4], [.15, 7.2, -7.0], [.32, 6.0, -5.6], [.46, 3.4, -3.2]],
    bicS: [[.26, 5.4, .6], [.4, 5.9, .5], [.6, 5.2, .6], [.82, 3.8, .8]],
    triS: [[.2, -.6, -6.0], [.4, -.6, -6.4], [.6, -.7, -5.6], [.82, -.8, -4.0]],
    flexS: [[.06, 4.0, .4], [.25, 4.8, .3], [.5, 3.6, .3], [.82, 2.4, .5]],
    extS: [[.06, -.4, -3.8], [.25, -.4, -4.4], [.5, -.4, -3.4], [.82, -.5, -2.3]],
    delF: [[-.12, 3, -3], [0, 6.6, -6.0], [.15, 7.4, -6.6], [.32, 6.2, -5.0], [.46, 3.6, -2.8]],
    bicF: [[.26, 3.2, -3.0], [.4, 3.8, -3.4], [.62, 3.4, -3.0], [.82, 2.6, -2.4]],
    triF: [[.2, 6.0, 2.4], [.45, 6.4, 2.6], [.7, 5.2, 2.4], [.85, 3.8, 2.2]],
    foreMF: [[.06, 3.2, -3.0], [.25, 4.2, -3.6], [.6, 3.0, -2.6], [.85, 2.2, -2.0]],
    // torso [u1, v1, u2, v2]
    trapF: [[3.2, 61.5, 3.0, 57], [9, 59, 8.8, 54.6], [16.8, 54.6, 14.6, 51.4]],
    pecF: [[1, 50.5, 1, 38.4], [8, 52.4, 4, 36.2], [14.6, 51.6, 9, 36.8], [15.6, 46, 13.8, 40.5]],
    oblF: [[12.2, 36, 7.0, 38], [12.4, 26, 6.6, 31], [10.6, 16, 5.6, 22], [7.8, 12.6, 5.6, 14]],
    latF: [[13.2, 49, 11.2, 46], [16.0, 44, 12.6, 38], [14.8, 34, 11, 30], [11.4, 24, 9.6, 26]],
    gluF: [[10.2, 13, 9.6, 6], [14.0, 11, 11, 4.8], [14.6, 4, 11.4, 2.6]],
    trapS: [[-2.8, 61.5, -2.2, 59], [-6.5, 58, -4.2, 54], [-9.6, 50, -6.4, 48], [-10.4, 42, -9.0, 42]],
    latS: [[-9.2, 50, -5.6, 48], [-10.8, 42, -6.4, 40], [-9.8, 30, -6.0, 30], [-7.4, 22, -5.4, 24]],
    erecS: [[-5.6, 50, -3.2, 49], [-6.4, 36, -3.6, 36], [-5.8, 20, -3.4, 20], [-4.4, 13, -3.2, 14]],
    pecS: [[5.5, 51.5, 3.6, 49.5], [10.4, 48, 5.4, 45.5], [11.8, 42, 6.0, 41], [10.6, 37, 6.4, 37.6]],
    absS: [[5.4, 34, 3.6, 34], [8.6, 32, 4, 30], [8.8, 20, 4, 20], [8.0, 12, 3.6, 12.4]],
    gluS: [[-3, 14, -2.6, 8], [-8.4, 12.6, -5.6, 8.4], [-11.6, 7, -7.4, 5.6], [-10.4, 1.6, -6.4, 1.4]],
    absRows: [32, 25.4, 18.8, 12.6], absCu: 3.1, absHw: 2.7, kU: 1, kL: 1, kA: 1
  };
  // Mujer: cadera y glúteo más amplios, cintura marcada, hombros y pecho más pequeños, extremidades más finas
  const ANF = Object.assign({}, AN, {
    torsoS: [[0, 7.5, 9.5], [5, 9.2, 12.4], [12, 9.0, 11], [20, 7.4, 7.6], [28, 8.4, 7.4], [36, 10.8, 8.2], [44, 11.8, 9.4], [52, 10.2, 9.8], [58, 7.6, 8.4], [62, 4.8, 5.2]],
    torsoF: [[0, 11], [5, 13.6], [12, 14], [20, 10.2], [28, 8.4], [36, 9.8], [44, 11.8], [50, 13.2], [55, 14.6], [59, 11.5], [62, 4.6]],
    pecF: [[1, 47.5, 1, 39], [7, 48.6, 2.6, 36.4], [12.2, 46.8, 6.5, 35.6], [12.8, 41.5, 10.5, 37.2]],
    pecS: [[5, 48, 3.4, 46], [9.8, 44, 5.2, 42.4], [11.2, 38.5, 5.8, 38.2], [9.4, 35.5, 6, 35.8]],
    gluS: [[-3, 15.5, -2.6, 8.4], [-9, 14.4, -6, 9], [-12.6, 8.2, -8, 6.2], [-11.4, 1.4, -7, 1.4]],
    gluF: [[11, 14, 10, 6], [15.6, 11.5, 12, 4.8], [16, 3.6, 12.4, 2.4]],
    absRows: [30.4, 24.4, 18.4, 12.6], absCu: 2.7, absHw: 2.3, kU: .86, kL: .92, kA: .8
  });

  // ----- Degradados y filtro (solo se inyectan cuando el personaje es anatómico) -----
  function anatDefs(u) {
    const rg = (id, stops, cx, cy, r) => `<radialGradient id="${id}${u}" cx="${cx || .36}" cy="${cy || .3}" r="${r || .82}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</radialGradient>`;
    return rg('aM', [[0, '#f7f9fd'], [.3, '#d5dce7'], [.66, '#9ea8b8'], [1, '#5d6777']])        // plata metálico (músculo en reposo)
      + rg('aMf', [[0, '#c7cfda'], [.4, '#99a2b1'], [.8, '#697381'], [1, '#434b57']])             // ídem, lado lejano
      + rg('aA', [[0, '#ff9c9c'], [.26, '#ff2f3c'], [.68, '#c8001c'], [1, '#68000f']])            // carmesí (principal)
      + rg('aAf', [[0, '#ea6c74'], [.3, '#d11a2a'], [.74, '#98001a'], [1, '#50000c']])
      + rg('aS', [[0, '#ffe2e5'], [.34, '#ff9ca8'], [.74, '#d9566a'], [1, '#8f2a3e']])            // rojo suave (secundario)
      + rg('aSf', [[0, '#e9b2b8'], [.4, '#da7a8c'], [.8, '#a8465a'], [1, '#6a2434']])
      + rg('aB', [[0, '#8b95a4'], [.6, '#545d6a'], [1, '#2e343e']], .5, .4, .9)                   // titanio oscuro (estructura)
      + rg('aBf', [[0, '#6c7583'], [.6, '#404751'], [1, '#232931']], .5, .4, .9)
      + rg('aH', [[0, '#fbfcff'], [.28, '#dbe1ea'], [.68, '#a3adbb'], [1, '#606a79']], .38, .3, .86) // cabeza / manos / articulaciones
      + rg('aT', [[0, '#ffffff'], [.5, '#e3e8ef'], [1, '#a9b2bf']], .4, .35, .8)                   // perla / titanio claro (tendones, rótula)
      + rg('aHr', [[0, '#8a94a3'], [.6, '#586170'], [1, '#323944']], .4, .3, .9)                // cabello titanio (cofia y coleta)
      + `<radialGradient id="aO${u}"><stop offset="0" stop-color="#04070c" stop-opacity=".55"/><stop offset=".55" stop-color="#04070c" stop-opacity=".2"/><stop offset="1" stop-color="#04070c" stop-opacity="0"/></radialGradient>`   // oclusión en pliegues
      + `<filter id="aF${u}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="1.1"/></filter>`    // brillo de las fibras
      + `<filter id="aE${u}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation=".5"/></filter>`     // sombreado suave del rostro
      + `<filter id="aG${u}" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>`;
  }

  // Luz de borde (rim light): fino brillo especular plateado en hombros, espalda, glúteos y cuádriceps
  const RIM = { hombros: 'top', espalda: 'e1', gluteos: 'e1', cuadriceps: 'e1' };
  // Un músculo: contorno con degradado + fibras sutiles; si es principal, su forma alimenta el resplandor
  // Orientación de las fibras por grupo: 'long' (a lo largo del músculo), 'fan' (abanico del pectoral),
  // 'diag' (fibras oblicuas/penadas: deltoides, glúteos, oblicuos, dorsales)
  const FIBMODE = { pecho: 'fan', hombros: 'diag', gluteos: 'diag', abdomen: 'diag', espalda: 'diag' };
  function fiberD(r, mode, n) {
    const e1 = r.e1, e2 = r.e2, m = Math.min(e1.length, e2.length);
    if (!mode || m < 2) return ribFibers(r, n);
    const at = (e, f) => { const i = Math.min(m - 2, Math.max(0, Math.floor(f))); return lp(e[i], e[i + 1], Math.min(1, Math.max(0, f - i))); };
    const cnt = n + 3, skew = mode === 'diag' ? .28 : 0;
    let d = '';
    for (let k = 0; k < cnt; k++) {
      const f = (m - 1) * (k + .5) / cnt, a = at(e1, f), b = at(e2, Math.min(m - 1, f + (m - 1) * skew));
      d += `M${pt(lp(a, b, .1))}L${pt(lp(a, b, .9))}`;
    }
    return d;
  }
  function muscleSvg(rib, id, far, A, fib) {
    const S = A.S, lv = mlevel(S, id), u = A.u;
    const d = ribPath(rib);
    const fill = (lv === 2 ? 'aA' : lv === 1 ? 'aS' : 'aM') + (far ? 'f' : '') + u;
    let s = `<path d="${d}" fill="url(#${fill})" stroke="${lv === 2 ? '#74000f' : lv === 1 ? '#a43a4c' : '#59636f'}" stroke-width=".7" stroke-linejoin="round"/>`;
    if (fib && !S.lite) {
      const fd = fiberD(rib, FIBMODE[id], fib), c = A.c || 0;
      s += `<path d="${fd}" fill="none" stroke="${lv === 2 ? 'rgba(88,0,14,.5)' : lv === 1 ? 'rgba(120,30,50,.42)' : 'rgba(40,50,68,.36)'}" stroke-width=".55" stroke-linecap="round"/>`;
      if (lv && c > .04) {      // las fibras se encienden en carmesí al acercarse al punto máximo (B)
        if (lv === 2 && !far) s += `<g filter="url(#aF${u})" opacity="${f1(c * (.55 + .35 * A.pu))}"><path d="${fd}" fill="none" stroke="#ff3347" stroke-width="1.6" stroke-linecap="round"/></g>`;
        s += `<path d="${fd}" fill="none" stroke="${lv === 2 ? 'rgba(255,96,112,' : 'rgba(255,176,190,'}${f1((.16 + .62 * c) * (lv === 2 ? 1 : .5))})" stroke-width="${f1(.5 + .35 * c)}" stroke-linecap="round"/>`;
      }
    }
    if (RIM[id] && !far && !S.lite) {
      const mean = e => e.reduce((a, q) => a + q[0] + q[1], 0) / e.length;
      const e = RIM[id] === 'e1' ? rib.e1 : (mean(rib.e1) <= mean(rib.e2) ? rib.e1 : rib.e2);   // 'top' = borde más cercano a la luz (arriba-izquierda)
      s += `<path d="${smoothPath(e, false)}" fill="none" stroke="${lv === 2 ? 'rgba(255,226,226,.9)' : 'rgba(255,255,255,.85)'}" stroke-width=".85" stroke-linecap="round" opacity=".8"/>`;
    }
    if (lv === 2) A.glow.push(d);
    return s;
  }
  const baseSvg = (rib, far, A) => `<path d="${ribPath(rib)}" fill="url(#aB${far ? 'f' : ''}${A.u})" stroke="#2b313a" stroke-width=".8" stroke-linejoin="round"/>`;

  // ----- Estructura continua de una extremidad: contorno exterior + relleno con UN degradado compartido -----
  // (el contorno se dibuja debajo de todos los rellenos: solo se ve por fuera de la unión, sin costuras ni "bolitas")
  const limbGrad = (id, a, b, far) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"><stop offset="0" stop-color="${far ? '#6a7381' : '#8d97a6'}"/><stop offset="1" stop-color="${far ? '#262c35' : '#373e49'}"/></linearGradient>`;
  function baseLayer(shapes, gid) {
    let o = '', f = '';
    for (const sh of shapes) {
      if (sh.d) { o += `<path d="${sh.d}" fill="#2b313a" stroke="#2b313a" stroke-width="1.9" stroke-linejoin="round"/>`; f += `<path d="${sh.d}" fill="url(#${gid})"/>`; }
      else { o += circ(sh.c, sh.r + .95, '#2b313a'); f += circ(sh.c, sh.r, `url(#${gid})`); }
    }
    return o + f;
  }
  // Sombra suave de oclusión (penumbra) alrededor de una pieza que queda delante de otra
  // (la luz viene de arriba-izquierda: la penumbra se desplaza un poco hacia abajo-derecha)
  const shadowStroke = ds => ds.map(d => `<g transform="translate(1.1 1.7)"><path d="${d}" fill="none" stroke="#04070c" stroke-width="10" stroke-linejoin="round" opacity=".05"/><path d="${d}" fill="none" stroke="#04070c" stroke-width="6.5" stroke-linejoin="round" opacity=".09"/><path d="${d}" fill="none" stroke="#04070c" stroke-width="3.2" stroke-linejoin="round" opacity=".15"/></g>`).join('');
  // Oclusión ambiental en los pliegues (rodilla y cadera flexionadas, en perfil)
  const dirn = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const angBetween = (v, w) => Math.acos(Math.max(-1, Math.min(1, v[0] * w[0] + v[1] * w[1]))) * 180 / Math.PI;
  function foldShade(J, Hp, K, An, A, far) {
    let s = '';
    const fold = (c, r, o) => `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="url(#aO${A.u})" opacity="${f1(Math.min(1, o) * (far ? .8 : 1))}"/>`;
    const u1 = dirn(K, Hp), u2 = dirn(K, An), ak = angBetween(u1, u2);
    if (ak < 140) { const st = Math.min(1, (140 - ak) / 80), b = dirn([0, 0], [u1[0] + u2[0], u1[1] + u2[1]]); s += fold([K[0] + b[0] * 4.6, K[1] + b[1] * 4.6], 5 + 5 * st, .4 + .6 * st); }
    const tv = dirn(J.P, J.neck), th = dirn(Hp, K), ah = angBetween(tv, th);
    if (ah < 135) { const st = Math.min(1, (135 - ah) / 70), b = dirn([0, 0], [tv[0] + th[0], tv[1] + th[1]]); s += fold([Hp[0] + b[0] * 6.5, Hp[1] + b[1] * 6.5], 6 + 5 * st, .35 + .6 * st); }
    return s;
  }
  // Tendón perla/titanio claro con brillo
  function tendon(pts, w, full) {
    const d = smoothPath(pts, false);
    return (full ? `<path d="${d}" fill="none" stroke="#6f7988" stroke-width="${f1(w + 1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>` : '')
      + `<path d="${d}" fill="none" stroke="#e4e8ef" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
      + (full && w >= 1.8 ? `<path d="${d}" fill="none" stroke="#fff" stroke-width="${f1(w * .35)}" stroke-linecap="round" opacity=".85"/>` : '');
  }
  const bp = (A, B, t, o, sg, k) => { const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1; return [A[0] + dx * t + dy / len * o * sg * k, A[1] + dy * t - dx / len * o * sg * k]; };
  const axAng = (A, B) => Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI;
  const pearl = (c, rx, ry, ang, A) => ellip(c, rx, ry, `url(#aT${A.u})`, ang, ' stroke="#8a94a3" stroke-width=".4"');

  function anLeg(J, k, far, S, T, A, sh) {
    const Hp = J['H' + k], K = J['K' + k], An = J['A' + k], F = J['F' + k], fr = J.front, m = fr ? (k === 'L' ? -1 : 1) : 1, kk = T.kL, u = A.u, full = !S.lite;
    const thigh = boneRib(Hp, K, prof(fr ? T.thighF : T.thighS), m, kk), shin = boneRib(K, An, prof(fr ? T.shinF : T.shinS), m, kk);
    const dT = ribPath(thigh), dS = ribPath(shin), gid = `aL${u}${k}${far ? 'f' : 'n'}`;
    let s = limbGrad(gid, Hp, An, far);
    if (sh && full) s += shadowStroke([dT, dS]);
    s += baseLayer([{ d: dT }, { d: dS }, { c: Hp, r: 7.2 * kk }, { c: K, r: 4.9 * kk }, { c: An, r: 3.1 * kk }], gid);
    const mu = (a, b, st, id, f) => muscleSvg(boneRib(a, b, st, m, kk), id, far, A, f);
    const P = (a, b, t, o) => bp(a, b, t, o, m, kk);
    if (fr) {
      s += mu(Hp, K, T.hamF, 'isquios', 1) + mu(Hp, K, T.hamFi, 'isquios', 1) + mu(K, An, T.gastroOF, 'pantorrillas', 2) + mu(K, An, T.gastroIF, 'pantorrillas', 2)
        + mu(K, An, T.tibF, 'tibial', 1) + mu(Hp, K, T.vlF, 'cuadriceps', 3) + mu(Hp, K, T.vmF, 'cuadriceps', 2) + mu(Hp, K, T.rfF, 'cuadriceps', 2);
      s += tendon([P(Hp, K, .84, 0), P(Hp, K, 1, 0), P(K, An, .15, 0)], 1.9, full) + (full ? tendon([P(Hp, K, .06, 7.6), P(Hp, K, .5, 8.2), P(Hp, K, .96, 5.4)], 1.1, full) : '');
      const fx = (a, b) => [F[0] + a * m, F[1] + b];
      s += `<path d="${smoothPath([fx(-4.2, -1.8), fx(-1, -3), fx(3.2, -2.4), fx(5.4, -.2), fx(4.6, 2.2), fx(1.2, 3), fx(-3.8, 2)], true)}" fill="url(#aH${u})" stroke="#4d5663" stroke-width=".6" stroke-linejoin="round"/>`;
      if (full) s += `<path d="M${pt(fx(-2.4, -1.6))}Q${pt(fx(0, -2.6))} ${pt(fx(2.8, -1.8))}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width=".7" stroke-linecap="round"/>`
        + `<path d="M${pt(fx(1.4, 1))}L${pt(fx(1.8, 2.8))}M${pt(fx(3.2, .6))}L${pt(fx(3.9, 2.2))}" fill="none" stroke="rgba(40,50,68,.45)" stroke-width=".5" stroke-linecap="round"/>`;
    } else {
      s += mu(Hp, K, T.hamS, 'isquios', 3) + mu(K, An, T.calfS, 'pantorrillas', 3) + mu(K, An, T.soleusS, 'pantorrillas', 1) + mu(K, An, T.tibS, 'tibial', 1) + mu(Hp, K, T.quadS, 'cuadriceps', 3);
      s += tendon([P(Hp, K, .86, 4.4), P(Hp, K, 1, 5.0), P(K, An, .14, 4.1)], 1.9, full) + tendon([P(Hp, K, .84, -3.9), P(Hp, K, 1, -4.5), P(K, An, .1, -4.7)], 1.5, full);
      s += `<path d="${ribPath(boneRib(An, F, [[-.3, 2.6, -3.2], [.15, 3.8, -3.2], [.6, 3.2, -2.6], [1, 1.8, -1.8]], 1, 1))}" fill="url(#aH${u})" stroke="#4d5663" stroke-width=".6" stroke-linejoin="round"/>`;
      if (full) s += `<path d="M${pt(bp(An, F, .72, 3, 1, 1))}L${pt(bp(An, F, .72, -2.2, 1, 1))}M${pt(bp(An, F, .88, 2.3, 1, 1))}L${pt(bp(An, F, .88, -1.6, 1, 1))}" fill="none" stroke="rgba(40,50,68,.45)" stroke-width=".5" stroke-linecap="round"/>`
        + `<path d="M${pt(bp(An, F, .12, 3.4, 1, 1))}L${pt(bp(An, F, .62, 3.6, 1, 1))}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".7" stroke-linecap="round"/>`;
    }
    const kc = P(Hp, K, 1, fr ? 0 : 4.7);                       // rótula integrada (perla, sin contorno de "bola")
    return s + (!fr && full ? foldShade(J, Hp, K, An, A, far) : '') + pearl(kc, 3.1 * kk, 2.5 * kk, axAng(Hp, K), A) + circ(kc, .8, S.acc);
  }

  function anArm(J, k, far, S, T, A, sh) {
    const Sh = J['S' + k], E = J['E' + k], Wr = J['W' + k], fr = J.front, m = fr ? (k === 'L' ? -1 : 1) : 1, kk = T.kA, u = A.u, full = !S.lite;
    const upper = boneRib(Sh, E, prof(fr ? T.armF : T.armS), m, kk), fore = boneRib(E, Wr, prof(fr ? T.foreF : T.foreS), m, kk);
    const dU = ribPath(upper), dF = ribPath(fore), gid = `aQ${u}${k}${far ? 'f' : 'n'}`;
    let s = limbGrad(gid, Sh, Wr, far);
    if (sh && full) s += shadowStroke([dU, dF]);
    s += baseLayer([{ d: dU }, { d: dF }, { c: Sh, r: 6 * kk }, { c: E, r: 3.7 * kk }, { c: Wr, r: 2.5 * kk }], gid);
    const mu = (a, b, st, id, f) => muscleSvg(boneRib(a, b, st, m, kk), id, far, A, f);
    const P = (a, b, t, o) => bp(a, b, t, o, m, kk);
    if (fr) s += mu(Sh, E, T.triF, 'triceps', 2) + mu(E, Wr, T.foreMF, 'antebrazo', 2) + mu(Sh, E, T.bicF, 'biceps', 2) + mu(Sh, E, T.delF, 'hombros', 3);
    else s += mu(Sh, E, T.triS, 'triceps', 2) + mu(E, Wr, T.extS, 'antebrazo', 1) + mu(E, Wr, T.flexS, 'antebrazo', 2) + mu(Sh, E, T.bicS, 'biceps', 2) + mu(Sh, E, T.delS, 'hombros', 3);
    // tendones del codo y del hombro (perla/titanio claro)
    if (fr) s += tendon([P(Sh, E, .84, 0), P(Sh, E, 1, 0), P(E, Wr, .1, 0)], 1.5, full);
    else s += tendon([P(Sh, E, .84, 3.3), P(Sh, E, 1, 3.0), P(E, Wr, .1, 3.3)], 1.4, full) + tendon([P(Sh, E, .84, -3.5), P(Sh, E, 1, -4.0), P(E, Wr, .06, -3.6)], 1.4, full);
    s += pearl(P(Sh, E, .45, 0), 3, 1.3, axAng(Sh, E), A);                                   // inserción del deltoides
    const ec = P(Sh, E, 1, fr ? 0 : -3.9);
    s += pearl(ec, 2.4 * kk, 2 * kk, axAng(Sh, E), A) + circ(ec, .7, S.acc);                  // olécranon / pliegue del codo
    return s + anHand(E, Wr, m, S, A, fr, far);
  }
  // Mano estilizada: muñeca, palma, nudillos, dedos agrupados y pulgar (orientada según el antebrazo)
  function anHand(E, Wr, m, S, A, fr, far) {
    const u = A.u, sc = S.handR / 4.6, full = !S.lite, dr = dirn(E, Wr);
    const a0 = [Wr[0] - dr[0] * 3.2 * sc, Wr[1] - dr[1] * 3.2 * sc], a1 = [Wr[0] + dr[0] * 7.4 * sc, Wr[1] + dr[1] * 7.4 * sc];
    const w = fr ? .82 : 1;
    const palm = boneRib(a0, a1, [[0, 2.3 * sc * w, -2.3 * sc * w], [.2, 3.0 * sc * w, -2.8 * sc * w], [.5, 3.5 * sc * w, -3.3 * sc * w], [.78, 3.3 * sc * w, -3.1 * sc * w], [.94, 2.5 * sc * w, -2.3 * sc * w], [1, 1.2 * sc * w, -1.2 * sc * w]], m, 1);
    let s = `<path d="${ribPath(palm)}" fill="url(#aH${u})" stroke="#4d5663" stroke-width=".6" stroke-linejoin="round"${far ? ' opacity=".92"' : ''}/>`;
    // pulgar
    const t0 = lp(a0, a1, .22), t1 = lp(a0, a1, .56), nx = -dr[1] * m, ny = dr[0] * m;
    const T0 = [t0[0] + nx * 2.4 * sc * w, t0[1] + ny * 2.4 * sc * w], T1 = [t1[0] + nx * 4.4 * sc * w, t1[1] + ny * 4.4 * sc * w];
    s += `<path d="${ribPath(boneRib(T0, T1, [[0, 1.7 * sc, -1.7 * sc], [.6, 1.6 * sc, -1.5 * sc], [1, .9 * sc, -.9 * sc]], 1, 1))}" fill="url(#aH${u})" stroke="#4d5663" stroke-width=".5" stroke-linejoin="round"/>`;
    if (full) {
      const q = (t, o) => [a0[0] + (a1[0] - a0[0]) * t + nx * o * sc * w, a0[1] + (a1[1] - a0[1]) * t + ny * o * sc * w];
      s += `<path d="M${pt(q(.62, 1.4))}L${pt(q(.96, 1.1))}M${pt(q(.62, -.2))}L${pt(q(.98, -.2))}M${pt(q(.6, -1.7))}L${pt(q(.94, -1.4))}" fill="none" stroke="rgba(40,50,68,.45)" stroke-width=".45" stroke-linecap="round"/>`
        + `<path d="M${pt(q(.5, 2.8))}Q${pt(q(.55, 0))} ${pt(q(.5, -2.8))}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".6" stroke-linecap="round"/>`;
    }
    return s;
  }

  function anTorso(J, p, S, T, A, sh) {
    const { tdir, perp } = torsoFrame(p), front = J.front, P = J.P, ku = T.kU, full = !S.lite;
    const mu = (st, sg, id, f) => muscleSvg(torsoRib(P, tdir, perp, st, sg, ku), id, false, A, f);
    const R = (rows, fn) => rows.map(fn);
    const Tq = (u, v) => add(add(P, tdir, v), perp, u);
    let s = '';
    const baseRib = front ? torsoRib(P, tdir, perp, R(T.torsoF, r => [r[1], r[0], -r[1], r[0]]), 1, 1) : torsoRib(P, tdir, perp, R(T.torsoS, r => [r[1], r[0], -r[2], r[0]]), 1, 1);
    if (sh && full) s += shadowStroke([ribPath(baseRib)]);          // el tronco proyecta penumbra sobre las extremidades lejanas
    s += baseSvg(baseRib, false, A);
    if (front) {
      for (const sg of [-1, 1]) {
        s += mu(T.latF, sg, 'espalda', 2) + mu(T.gluF, sg, 'gluteos', 2) + mu(T.trapF, sg, 'espalda', 2) + mu(T.oblF, sg, 'abdomen', 2);
      }
      for (const v of T.absRows) for (const sg of [-1, 1]) {
        const cu = T.absCu * sg, hw = T.absHw, hh = 2.6;
        s += muscleSvg(torsoRib(P, tdir, perp, [[cu - hw, v + hh, cu + hw, v + hh], [cu - hw, v - hh, cu + hw, v - hh]], 1, ku), 'abdomen', false, A, 0);
      }
      for (const sg of [-1, 1]) s += mu(T.pecF, sg, 'pecho', 3);
      s += segc(Tq(0, 36.5), Tq(0, 10), .8, 'rgba(40,50,68,.45)');
      // clavículas y pliegue inguinal en perla (detalle tendinoso)
      for (const sg of [-1, 1]) {
        s += tendon([Tq(sg * 3 * ku, 58.6), Tq(sg * 9.5 * ku, 59.2), Tq(sg * 16.5 * ku, 56.4)], 1.4, full);
        if (full) s += tendon([Tq(sg * 10.6 * ku, 8.6), Tq(sg * 5.6 * ku, 5.2), Tq(0, 3.6)], 1.1, full);
      }
    } else {
      s += mu(T.gluS, 1, 'gluteos', 3) + mu(T.erecS, 1, 'espalda', 2) + mu(T.latS, 1, 'espalda', 3) + mu(T.trapS, 1, 'espalda', 2) + mu(T.absS, 1, 'abdomen', 2) + mu(T.pecS, 1, 'pecho', 3);
      for (const v of [28, 22.5, 17]) s += segc(Tq(4.4, v), Tq(8.2, v), .7, 'rgba(40,50,68,.5)');
      s += tendon([Tq(3.4, 59.2), Tq(1, 58.4), Tq(-3, 57.6)], 1.3, full);
    }
    return s;
  }

  // Cinta de ancho variable a lo largo de una polilínea (cola de caballo)
  function taperRib(pts, w0, w1) {
    const n = pts.length, e1 = [], e2 = [];
    pts.forEach((q, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * i / (n - 1)) / 2;
      e1.push([q[0] + dy / l * w, q[1] - dx / l * w]); e2.push([q[0] - dy / l * w, q[1] + dx / l * w]);
    });
    return { e1, e2 };
  }
  const cubic = (p0, p1, p2, p3, n) => { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; o.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); } return o; };

  // Cabeza y cuello esculpidos (maniquí anatómico): cráneo con arco supraciliar, pómulos, mandíbula y
  // esternocleidomastoideos; en la mujer la coleta nace del cráneo (cofia + cinta).
  function anHead(J, p, S, tm, A) {
    const c = J.head, r = S.hr, front = J.front, u = A.u, full = !S.lite, fem = !!S.fem;
    const ht = rad(180 - p.t + p.hd);
    const up = [Math.sin(ht), Math.cos(ht)], fw = [-up[1], up[0]];
    const Q = (a, b) => [c[0] + fw[0] * a * r + up[0] * b * r, c[1] + fw[1] * a * r + up[1] * b * r];
    const ang = Math.atan2(up[0], -up[1]) * 180 / Math.PI;
    const E = (a, b, rx, ry, fill, a2, ex) => ellip(Q(a, b), rx * r, ry * r, fill, ang + (a2 || 0), ex);
    const poly = (pts, closed) => smoothPath(pts.map(q => Q(q[0], q[1])), closed);
    const mirror = h => h.concat(h.slice(1, -1).reverse().map(q => [-q[0], q[1]]));
    const dark = 'rgba(34,44,62,', light = 'rgba(255,255,255,';
    const wv = Math.sin(tm / 300) * .16;
    const base = J.neck, top = add(J.neck, up, L.NECK + r * .55);
    let s = baseSvg(boneRib(base, top, front ? [[0, 5.6, -5.6], [.6, 4.4, -4.4], [1, 3.9, -3.9]] : [[0, 4.8, -5.8], [.6, 3.9, -4.9], [1, 3.6, -4.3]], 1, fem ? .9 : 1), false, A);
    // esternocleidomastoideos
    if (front) {
      for (const sg of [-1, 1]) s += muscleSvg({ e1: [Q(sg * .82, -.56), lp(Q(sg * .82, -.56), add(base, fw, sg * 3.8), .5), add(base, fw, sg * 3.8)], e2: [Q(sg * .5, -.72), lp(Q(sg * .5, -.72), add(base, fw, sg * 1.0), .5), add(base, fw, sg * 1.0)] }, 'cuello', false, A, 1);
    } else {
      s += muscleSvg({ e1: [Q(.08, -.72), lp(Q(.08, -.72), add(base, fw, 3.4), .5), add(base, fw, 3.4)], e2: [Q(-.3, -.62), lp(Q(-.3, -.62), add(base, fw, .2), .5), add(base, fw, .2)] }, 'cuello', false, A, 1);
    }
    // coleta (detrás del cráneo, nace de la cofia)
    let tail = '', cap = '', tie = '';
    if (fem) {
      if (front) {
        // vista frontal: recogido alto (moño) centrado detrás de la cabeza; la coleta de perfil no se toca
        const bc = [wv * .5, 1.2];
        tail = E(bc[0], bc[1], .5, .4, `url(#aHr${u})`, 0, ' stroke="#2a313b" stroke-width=".7"')
          + `<path d="M${pt(Q(bc[0] - .3, bc[1] + .16))}Q${pt(Q(bc[0], bc[1] + .3))} ${pt(Q(bc[0] + .3, bc[1] + .14))}M${pt(Q(bc[0] - .22, bc[1] - .06))}Q${pt(Q(bc[0], bc[1] + .06))} ${pt(Q(bc[0] + .24, bc[1] - .1))}" fill="none" stroke="rgba(255,255,255,.32)" stroke-width=".6" stroke-linecap="round"/>`;
        cap = `<path d="${poly([[-.92, .5], [-.6, 1.02], [0, 1.12], [.6, 1.02], [.92, .5], [.78, .2], [.4, .62], [0, .7], [-.4, .62], [-.78, .2]], true)}" fill="url(#aHr${u})" stroke="#2a313b" stroke-width=".7" stroke-linejoin="round"/>`;
        tie = E(0, 1.04, .34, .07, `url(#aT${u})`, 0, ' stroke="#8a94a3" stroke-width=".5"');
      } else {
        tail = `<path d="${ribPath(taperRib(cubic(Q(-.9, .52), Q(-1.7, .42 + wv), Q(-1.85, -.5 + wv * 1.4), Q(-1.4, -1.35 + wv), 6), r * .5, r * .13))}" fill="url(#aHr${u})" stroke="#2a313b" stroke-width=".7" stroke-linejoin="round"/>`;
        cap = `<path d="${poly([[.8, .78], [.35, 1.1], [-.35, 1.08], [-.93, .55], [-.98, -.02], [-.72, -.38], [-.4, -.06], [-.1, .35], [.35, .66]], true)}" fill="url(#aHr${u})" stroke="#2a313b" stroke-width=".7" stroke-linejoin="round"/>`;
        tie = E(-.93, .52, .2, .14, `url(#aT${u})`, 8, ' stroke="#8a94a3" stroke-width=".5"');
      }
    }
    s += tail;
    // cráneo: contorno de perfil / frente con mandíbula definida
    const outline = front
      ? mirror(fem ? [[0, 1.06], [.58, .97], [.84, .63], [.89, .24], [.88, -.06], [.8, -.42], [.64, -.7], [.36, -.94], [0, -1.04]] : [[0, 1.06], [.6, .97], [.88, .62], [.93, .22], [.92, -.08], [.84, -.42], [.7, -.7], [.42, -.93], [0, -1.03]])
      : (fem ? [[0, 1.06], [.5, .97], [.82, .62], [.9, .36], [.94, .3], [.89, .18], [.93, .05], [1.07, -.17], [.97, -.28], [.99, -.4], [.95, -.5], [.86, -.72], [.66, -.94], [.28, -.9], [-.18, -.7], [-.48, -.48], [-.8, -.2], [-.93, .2], [-.84, .66], [-.5, .96]]
        : [[0, 1.06], [.52, .96], [.84, .6], [.93, .34], [.98, .27], [.92, .16], [.96, .04], [1.13, -.2], [.99, -.3], [1.01, -.42], [.97, -.52], [.9, -.74], [.72, -.97], [.3, -.92], [-.2, -.72], [-.5, -.5], [-.82, -.2], [-.95, .2], [-.84, .66], [-.5, .96]]);
    s += `<path d="${poly(outline, true)}" fill="url(#aH${u})" stroke="#4d5663" stroke-width=".9" stroke-linejoin="round"/>`;
    // planos faciales: arco supraciliar, cuencas, pómulos, mandíbula, nariz y boca
    if (front) {
      // sombreado suave: capas translúcidas desenfocadas (cejas, cuencas, pómulos y línea de mandíbula)
      let fs = E(0, .62, .44, .22, light + '.22)');
      for (const sg of [-1, 1]) {
        fs += `<path d="M${pt(Q(sg * .14, .3))} Q${pt(Q(sg * .46, .46))} ${pt(Q(sg * .82, .3))}" fill="none" stroke="${dark}.22)" stroke-width="2.8" stroke-linecap="round"/>`
          + `<path d="M${pt(Q(sg * .14, .34))} Q${pt(Q(sg * .46, .5))} ${pt(Q(sg * .82, .34))}" fill="none" stroke="${light}.45)" stroke-width="1.1" stroke-linecap="round"/>`
          + E(sg * .36, .14, .26, .14, dark + '.14)') + E(sg * .36, .14, .18, .08, dark + '.3)') + E(sg * .33, .165, .05, .026, light + '.5)')
          + E(sg * .58, -.12, .26, .15, light + '.24)', sg * -20) + E(sg * .5, -.46, .22, .13, dark + '.14)')
          + `<path d="M${pt(Q(sg * .1, .22))} L${pt(Q(sg * .13, -.26))}" fill="none" stroke="${dark}.26)" stroke-width="1.2" stroke-linecap="round"/>` + E(sg * .17, -.3, .07, .04, dark + '.4)')
          + `<path d="M${pt(Q(sg * .82, -.28))} Q${pt(Q(sg * .74, -.58))} ${pt(Q(sg * .5, -.84))} T${pt(Q(sg * .2, -.97))}" fill="none" stroke="${dark}.12)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`
          + `<path d="M${pt(Q(sg * .82, -.28))} Q${pt(Q(sg * .74, -.58))} ${pt(Q(sg * .5, -.84))} T${pt(Q(sg * .2, -.97))}" fill="none" stroke="${dark}.26)" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      fs += E(0, -.2, .1, .08, light + '.34)') + `<path d="M${pt(Q(-.26, -.52))} Q${pt(Q(0, -.58))} ${pt(Q(.26, -.52))}" fill="none" stroke="${dark}.4)" stroke-width="1" stroke-linecap="round"/>` + E(0, -.64, .16, .05, light + '.2)') + E(0, -.82, .24, .14, light + '.16)');
      s += full ? `<g filter="url(#aE${u})">${fs}</g>` : fs;
    } else {
      s += E(-.75, .2, .24, .5, dark + '.16)') + E(.2, .72, .6, .2, light + '.2)', -8);
      s += `<path d="M${pt(Q(.42, .34))} Q${pt(Q(.72, .44))} ${pt(Q(.97, .27))}" fill="none" stroke="${dark}.38)" stroke-width="2.2" stroke-linecap="round"/>`
        + `<path d="M${pt(Q(.42, .38))} Q${pt(Q(.72, .48))} ${pt(Q(.97, .31))}" fill="none" stroke="${light}.6)" stroke-width="1" stroke-linecap="round"/>`
        + E(.6, .12, .2, .1, dark + '.5)') + E(.38, -.18, .26, .14, light + '.3)', -10) + E(.3, -.5, .22, .12, dark + '.2)')
        + `<path d="M${pt(Q(.95, .2))} L${pt(Q(1.09, -.18))}" fill="none" stroke="${light}.5)" stroke-width="1"/>` + E(.98, -.27, .05, .035, dark + '.55)')
        + `<path d="M${pt(Q(.82, -.46))} L${pt(Q(1.0, -.46))}" fill="none" stroke="${dark}.55)" stroke-width=".9" stroke-linecap="round"/>`
        + `<path d="M${pt(Q(-.26, -.64))} Q${pt(Q(.3, -.92))} ${pt(Q(.78, -.88))}" fill="none" stroke="${dark}.5)" stroke-width=".9" stroke-linecap="round"/>` + E(-.06, -.03, .13, .25, `url(#aH${u})`, 0, ' stroke="#4d5663" stroke-width=".7"');
    }
    return s + cap + tie;
  }

  // Ensamble completo del cuerpo anatómico (mismo orden de capas que los demás modelos)
  function drawAnatomy(J, p, S, tm, A) {
    const T = S.fem ? ANF : AN;
    let b;
    if (J.front) b = anLeg(J, 'L', false, S, T, A, false) + anLeg(J, 'R', false, S, T, A, false) + anTorso(J, p, S, T, A, false) + anHead(J, p, S, tm, A) + anArm(J, 'L', false, S, T, A, true) + anArm(J, 'R', false, S, T, A, true);
    else b = anArm(J, 'L', true, S, T, A, false) + anLeg(J, 'L', true, S, T, A, false) + anTorso(J, p, S, T, A, true) + anLeg(J, 'R', false, S, T, A, true) + anHead(J, p, S, tm, A) + anArm(J, 'R', false, S, T, A, true);
    // Resplandor de los músculos principales: copia desenfocada (feGaussianBlur) DEBAJO del cuerpo.
    // Así se ve sobre fondo claro y oscuro, y no aplana el sombreado de los músculos.
    if (A.glow.length) {
      const halo = S.lite
        ? A.glow.map(d => `<path d="${d}" fill="none" stroke="#ff2a3a" stroke-width="5" stroke-linejoin="round" opacity="${f1(.18 + .2 * A.pu)}"/>`).join('')
        : `<g filter="url(#aG${A.u})" opacity="${f1(.55 + .4 * A.pu)}">${A.glow.map(d => `<path d="${d}" fill="#ff2233"/>`).join('')}</g>`;
      b = halo + b;
    }
    return b;
  }

  // ---------- Guía de postura: marcadores luminosos y flechas de movimiento ----------
  function arrowSvg(a, b, col, op) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 6) return '';
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, tip = [b[0] - ux * 4, b[1] - uy * 4], base = [tip[0] - ux * 7, tip[1] - uy * 7];
    return `<g opacity="${op}"><line x1="${f1(a[0] + ux * 4)}" y1="${f1(a[1] + uy * 4)}" x2="${f1(base[0])}" y2="${f1(base[1])}" stroke="${col}" stroke-width="2.3" stroke-dasharray="4 3" stroke-linecap="round"/>`
      + `<polygon points="${pt(tip)} ${pt([base[0] + nx * 3.8, base[1] + ny * 3.8])} ${pt([base[0] - nx * 3.8, base[1] - ny * 3.8])}" fill="${col}"/></g>`;
  }
  function drawGuide(J, guide, arrows, hold, clock) {
    const pu = .5 + .5 * Math.sin(clock / 220), cy = '#22e6ff';
    let s = '';
    for (const ar of arrows) s += hold === 'B' ? arrowSvg(ar.b, ar.a, '#ffd166', .55) : arrowSvg(ar.a, ar.b, '#ffd166', .95);
    const placed = [];
    const label = (anchor, text) => {
      const right = anchor[0] < 100;
      let x = anchor[0] + (right ? 11 : -11), y = anchor[1] - 3;
      while (placed.some(q => Math.abs(q[0] - x) < 70 && Math.abs(q[1] - y) < 10)) y += 10;
      placed.push([x, y]);
      return `<text x="${f1(Math.max(4, Math.min(196, x)))}" y="${f1(y)}" text-anchor="${right ? 'start' : 'end'}" style="font:800 8.5px system-ui,sans-serif;fill:#fff;stroke:#052028;stroke-width:2.6px;paint-order:stroke;stroke-linejoin:round">${text}</text>`;
    };
    for (const [type, tok, text] of guide.marks) {
      let anchor;
      if (type === 'spine') {
        s += `<line x1="${f1(J.P[0])}" y1="${f1(J.P[1])}" x2="${f1(J.neck[0])}" y2="${f1(J.neck[1])}" stroke="${cy}" stroke-width="2.6" stroke-dasharray="5 3" stroke-linecap="round" opacity="${f1(.7 + .3 * pu)}"/>`
          + circ(J.P, 3.2, cy) + circ(J.neck, 3.2, cy);
        anchor = lp(J.P, J.neck, .5);
      } else if (type === 'span') {
        const a = J[tok + 'L'], b = J[tok + 'R'];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 12) s += `<line x1="${f1(a[0])}" y1="${f1(a[1] + 6)}" x2="${f1(b[0])}" y2="${f1(b[1] + 6)}" stroke="${cy}" stroke-width="2.2" stroke-linecap="round"/>` + circ([a[0], a[1] + 6], 2.6, cy) + circ([b[0], b[1] + 6], 2.6, cy);
        else s += circ(J[tok + 'R'], 5 + pu * 1.3, 'rgba(34,230,255,.2)', ` stroke="${cy}" stroke-width="2"`);
        anchor = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 6];
      } else {
        const pts = J.front ? [J[tok + 'L'], J[tok + 'R']] : [J[tok + 'R']];
        for (const q of pts) s += circ(q, 5.4 + pu * 1.6, 'rgba(34,230,255,.2)', ` stroke="${cy}" stroke-width="2" opacity="${f1(.75 + .25 * pu)}"`) + circ(q, 1.9, '#fff');
        anchor = pts[pts.length - 1];
      }
      s += label(anchor, text);
    }
    return s;
  }

  // Accesorios / equipo
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function drawProps(J, props, anim, ctx) {
    let s = '';
    const W1 = J.WL, W2 = J.WR, hm = mid(W1, W2);
    if (anim.towel) {            // toalla tensada entre ambas manos (se dibuja sobre las manos: queda sujeta)
      const dx = W2[0] - W1[0], dy = W2[1] - W1[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, nx = -uy, ny = ux;
      const a = [W1[0] - ux * 9, W1[1] - uy * 9], b = [W2[0] + ux * 9, W2[1] + uy * 9];
      s += segc(a, b, 8.4, '#64748b') + segc(a, b, 6.4, '#f1f5f9');
      for (let k = 1; k < 7; k++) { const t = k / 7, c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; s += segc([c[0] + nx * 2.7, c[1] + ny * 2.7], [c[0] - nx * 2.7, c[1] - ny * 2.7], .7, '#94a3b8'); }
      s += segc([W1[0] - ux * 2 + nx * 4.4, W1[1] - uy * 2 + ny * 4.4], [W1[0] - ux * 2 - nx * 4.4, W1[1] - uy * 2 - ny * 4.4], 1.6, '#475569') + segc([W2[0] + ux * 2 + nx * 4.4, W2[1] + uy * 2 + ny * 4.4], [W2[0] + ux * 2 - nx * 4.4, W2[1] + uy * 2 - ny * 4.4], 1.6, '#475569');
    }
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
        case 'stepper': {
          const gy = GROUND - 2, metal = '#64748b', dark = '#1f2937', rail = '#475569';
          const pedal = (k, col, w) => {
            const A = J['A' + k], F = J['F' + k];
            const py = Math.max(A[1], F[1]) + 4.2;                      // la suela apoya sobre el pedal
            return { py, x0: Math.min(A[0], F[0]) - 8, x1: Math.max(A[0], F[0]) + 5, col, w };
          };
          if (!J.front) {
            const hx = Math.max(W1[0], W2[0]), hy = (W1[1] + W2[1]) / 2;
            const colX = hx + 9, baseX = colX + 22;
            const cxAt = y => colX + (baseX - colX) * (y - hy) / (gy - hy);
            const link = (pd) => segc([pd.x1 - 3, pd.py + 2], [cxAt(pd.py + 2), pd.py + 2], 2.6, '#94a3b8');
            const rect = pd => `<rect x="${f1(pd.x0)}" y="${f1(pd.py)}" width="${f1(pd.x1 - pd.x0)}" height="4" rx="2" fill="${pd.col}"/><line x1="${f1(pd.x0 + 2)}" y1="${f1(pd.py + .8)}" x2="${f1(pd.x1 - 2)}" y2="${f1(pd.py + .8)}" stroke="#fff" stroke-opacity=".3" stroke-width=".8"/>`;
            const pl = pedal('L', '#475569'), pr2 = pedal('R', dark);
            s += link(pl) + rect(pl);                                      // pedal lejano
            s += segc([colX - 62, gy], [colX + 46, gy], 5, rail)           // base estabilizadora
              + segc([colX, hy], [baseX, gy], 4.6, metal)                  // columna inclinada
              + segc([hx - 3, hy], [colX, hy], 4.2, dark)                  // manillar
              + circ([colX, hy], 2.6, dark);
            s += link(pr2) + rect(pr2);                                    // pedal cercano
          } else {
            const hy = (W1[1] + W2[1]) / 2, lx = Math.min(W1[0], W2[0]) - 8, rx = Math.max(W1[0], W2[0]) + 8;
            const pl = pedal('L'), pr2 = pedal('R');
            const rect = (pd, col) => `<rect x="${f1((pd.x0 + pd.x1) / 2 - 8)}" y="${f1(pd.py)}" width="16" height="4" rx="2" fill="${col}"/>`;
            s += segc([lx, hy], [lx, gy], 3, metal) + segc([rx, hy], [rx, gy], 3, metal) + segc([lx - 14, gy], [rx + 14, gy], 5, rail)
              + segc([lx - 3, hy], [Math.min(W1[0], W2[0]) - 1, hy], 4, dark) + segc([Math.max(W1[0], W2[0]) + 1, hy], [rx + 3, hy], 4, dark);   // agarres laterales (no cruzan el cuerpo)
            s += segc([(pl.x0 + pl.x1) / 2 - 8, pl.py + 2], [lx, pl.py + 2], 2.4, '#94a3b8') + segc([(pr2.x0 + pr2.x1) / 2 + 8, pr2.py + 2], [rx, pr2.py + 2], 2.4, '#94a3b8');
            s += rect(pl, '#475569') + rect(pr2, dark);
          }
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
  let AV_UID = 0;
  const levMap = m => { const o = {}; if (m) { (m.s || []).forEach(k => { o[k] = 1; }); (m.p || []).forEach(k => { o[k] = 2; }); } return o; };
  const easeIO = u => (1 - Math.cos(Math.PI * u)) / 2;

  class Avatar {
    constructor(el, opts = {}) {
      this.el = el; this.uid = ++AV_UID;
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
      this.muscles = null; this.mlev = {};          // músculos iluminados (anatómicos)
      this.floor = false;                           // piso de estudio (Vista Enfoque)
      this.hold = null; this.tween = null; this.holdP = null; this.lastP = null; // pose A/B congelada
      this.guide = null; this.arrows = []; this.idxB = 1;
      const u = this.uid;
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="avatar-svg" role="img" aria-label="Entrenador virtual"><defs>`
        + `<linearGradient id="avf${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6238" stop-opacity=".8"/><stop offset=".22" stop-color="#5a3820" stop-opacity=".55"/><stop offset="1" stop-color="#1a0f08" stop-opacity="0"/></linearGradient>`
        + `<radialGradient id="avs${u}"><stop offset="0" stop-color="#ffb070" stop-opacity=".6"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></radialGradient></defs><g class="av-scene"></g><g class="av-body"></g></svg>`;
      this.svg = el.querySelector('svg');
      this.svgScene = el.querySelector('.av-scene');
      this.svgBody = el.querySelector('.av-body');
      this._frame = this._frame.bind(this);
      this.set({ anim: opts.anim || 'breathe', props: opts.props || [], muscles: opts.muscles, floor: opts.floor });
      this.start();
    }
    set({ anim, char, accent, props, speed, muscles, floor } = {}) {
      if (char) this.charId = char;
      if (accent) this.accentId = accent;
      if (props) this.props = props;
      if (speed) this.speed = speed;
      if (muscles !== undefined) { this.muscles = muscles; this.mlev = levMap(muscles); }
      if (floor !== undefined) { this.floor = !!floor; this.svg.classList.toggle('floor', this.floor); }
      // Sin pose propia → animación dinámica por defecto (nunca se queda estático)
      if (anim) this.animKey = ANIMS[anim] ? anim : FALLBACK_ANIM;
      this.S = resolveSpec(this.charId, this.accentId);
      applyVars(this.el, this.S);
      if (this.S.kind === 'anatomy') this._anatDefs();
      { const vb = ANIMS[this.animKey].vb; this.svg.setAttribute('viewBox', vb ? vb.join(' ') : `0 0 ${W} ${H}`); }   // poses muy largas (Superman) usan un encuadre más ancho
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
      if (a.stepper && a.view !== 'f') dx -= 14;
      this.dx = dx;
      this.first = shift(J0, dx, anchorY(J0, a, S));
      this.lowP = lowP;
      // Pose A = primer fotograma · Pose B = fotograma más alejado (punto máximo) + flechas de movimiento
      const JS = a.kf.map(k => { const q = lerpPose(k, k, 0), Jq = solve(q, a, S); return shift(Jq, dx, anchorY(Jq, a, S) - q.j); });
      const KEYJ = ['WL', 'WR', 'KL', 'KR', 'AL', 'AR', 'neck', 'P'];
      let best = 0, bi = 0;
      JS.forEach((Jq, i) => { let d = 0; KEYJ.forEach(k => { d += Math.hypot(Jq[k][0] - JS[0][k][0], Jq[k][1] - JS[0][k][1]); }); if (d > best) { best = d; bi = i; } });
      this.idxB = bi || (a.kf.length > 1 ? 1 : 0);
      const cand = ['WR', 'WL', 'neck', 'P', 'KR', 'KL', 'AR', 'AL'].map(k => ({ a: JS[0][k], b: JS[this.idxB][k] }))
        .map(c => Object.assign(c, { d: Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]) })).filter(c => c.d >= 14).sort((x, y) => y.d - x.d);
      const out = [];
      for (const c of cand) {
        if (out.length >= 2) break;
        if (out.some(o => Math.hypot(o.a[0] - c.a[0], o.a[1] - c.a[1]) < 10 && Math.hypot(o.b[0] - c.b[0], o.b[1] - c.b[1]) < 10)) continue;
        out.push(c);
      }
      this.arrows = out;
    }
    // Congela el avatar en la pose A (inicial) o B (punto máximo) con transición suave; null = vuelve a animar
    showPose(which) {
      if (!which) { this.hold = null; this.tween = null; this.t0 = performance.now(); return; }
      const a = ANIMS[this.animKey], k = a.kf[which === 'B' ? this.idxB : 0];
      this.tween = { from: this.lastP || lerpPose(a.kf[0], a.kf[0], 0), to: lerpPose(k, k, 0), t0: performance.now() };
      this.hold = which;
    }
    // Degradados y filtro de resplandor: solo se crean cuando el personaje es anatómico
    _anatDefs() {
      if (this.hasAnat) return;
      this.svg.querySelector('defs').insertAdjacentHTML('beforeend', anatDefs(this.uid));
      this.glowFe = this.svg.querySelector('#aG' + this.uid + ' feGaussianBlur');
      this.hasAnat = true;
    }
    setGuide(marks) { this.guide = marks && marks.length ? { marks } : null; }
    _render(time) {
      const a = ANIMS[this.animKey], S = this.S, n = a.kf.length, now = performance.now();
      let p;
      if (this.hold) {
        const tw = this.tween;
        if (tw) {
          const u = Math.min(1, (now - tw.t0) / 450);
          p = lerpPose(tw.from, tw.to, easeIO(u));
          if (u >= 1) { this.holdP = tw.to; this.tween = null; }
        } else p = this.holdP;
      } else {
        const dur = a.dur / this.speed;
        const tt = ((time % dur) + dur) % dur;           // nunca negativo
        const ph = (tt / dur) * n;
        const i = Math.floor(ph) % n, u = ph - Math.floor(ph);
        p = lerpPose(a.kf[i], a.kf[(i + 1) % n], easeIO(u));
      }
      this.lastP = p;
      S.mlev = this.mlev; S.clock = now;
      const J0 = solve(p, a, S);
      const J = shift(J0, this.dx, anchorY(J0, a, S) - p.j);
      const tm = this.hold ? now : time * this.speed;
      const ctx = { time: tm, first: this.first, lowP: this.lowP };
      const props = this.props || [];
      let sc = drawScene(a, ctx, J, props);
      if (this.floor) {
        sc = `<rect x="-400" y="${GROUND}" width="1000" height="600" fill="url(#avf${this.uid})"/><ellipse cx="${f1(J.P[0])}" cy="${GROUND + 2}" rx="82" ry="12" fill="url(#avs${this.uid})"/>`
          + `<line x1="-400" x2="600" y1="${GROUND}" y2="${GROUND}" stroke="#ffb27a" stroke-opacity=".55" stroke-width="1.4"/>` + sc;
      }
      this.svgScene.innerHTML = sc;
      let b = `<ellipse cx="${f1(J.P[0])}" cy="${GROUND}" rx="${30 - Math.min(p.j, 20)}" ry="4" class="av-shadow"/>`;
      if (S.kind === 'anatomy') {
        const pu = .5 + .5 * Math.sin(now / 260);
        S.lite = !!this.lite;
        if (this.glowFe) this.glowFe.setAttribute('stdDeviation', f1(S.lite ? 2 : 2.2 + 2 * pu));   // resplandor pulsante
        // progreso hacia el punto máximo (B): 0 = pose A, 1 = pose B (alimenta el brillo de las fibras)
        const kA = a.kf[0], kB = a.kf[this.idxB || 0]; let dAB = 0, dP = 0;
        for (const k of KEYS) { if (k === 'j' || k === 'hd') continue; dAB += Math.abs((kB[k] || 0) - (kA[k] || 0)); dP += Math.abs((p[k] || 0) - (kA[k] || 0)); }
        const cn = dAB > 4 ? Math.min(1, dP / dAB) : 0;
        // sombra de piso dinámica: se ensancha con el cuerpo y se atenúa/encoge con la elevación
        const bb = bounds(J, S), elev = Math.max(0, GROUND - 6 - bb.maxY), el = Math.min(elev, 70) / 70;
        const sw = Math.max(24, Math.min(88, (bb.maxX - bb.minX) * .5)) * (1 - .35 * el), sh = (3.6 + (bb.maxX - bb.minX > 110 ? .8 : 0)) * (1 - .3 * el), so = 1 - .75 * el;
        const scx = f1((bb.minX + bb.maxX) / 2);
        b = `<ellipse cx="${scx}" cy="${GROUND}" rx="${f1(sw * 1.22)}" ry="${f1(sh * 1.5)}" class="av-shadow" opacity="${f1(.45 * so)}"/><ellipse cx="${scx}" cy="${GROUND}" rx="${f1(sw)}" ry="${f1(sh)}" class="av-shadow" opacity="${f1(so)}"/>`;
        const t0 = performance.now();
        b += drawAnatomy(J, p, S, tm, { S, u: this.uid, glow: [], pu, c: cn });
        const cost = performance.now() - t0;   // coste real de construir el dibujo: si es alto, modo ligero
        this.costEma = this.costEma ? this.costEma * .9 + cost * .1 : cost;
        if (!this.lite && this.costEma > 12) this.lite = true;
        this.lastRender = now;
      } else if (J.front) {
        b += drawTail(J, p, S, tm) + drawLimb(J, 'L', false, S) + drawLimb(J, 'R', false, S) + drawTorso(J, p, S) + drawHead(J, p, S, tm) + drawArm(J, 'L', false, S) + drawArm(J, 'R', false, S);
      } else {
        b += drawArm(J, 'L', true, S) + drawLimb(J, 'L', true, S) + drawTail(J, p, S, tm) + drawTorso(J, p, S) + drawLimb(J, 'R', false, S) + drawHead(J, p, S, tm) + drawArm(J, 'R', false, S);
      }
      b += drawJoints(J, S) + drawProps(J, props, a, ctx);
      if (this.guide) b += drawGuide(J, this.guide, this.hold ? this.arrows : [], this.hold, now);
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
      const prev = this.lastFrame;
      this.lastFrame = now;
      if (this.paused || document.hidden) return;
      if (this.S.kind === 'anatomy') {   // solo anatómicos: ~30 fps y modo ligero si el equipo va lento
        const dt = now - prev; this.dtEma = this.dtEma ? this.dtEma * .92 + dt * .08 : dt;
        if (!this.lite && this.dtEma > 60) this.lite = true;
        if (now - (this.lastRender || 0) < 30) return;
      }
      try {
        if (this.cycleList && now - this.cycleT > this.cycleMs) this._cycleTo((this.cycleI + 1) % this.cycleList.length);
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
    // Rota por una lista de animaciones (vista previa de la galería). Cada ítem: 'anim' o { a, m: músculos }
    cycle(list, ms) {
      this.cycleList = list; this.cycleMs = ms;
      this._cycleTo(0);
    }
    _cycleTo(i) {
      this.cycleI = i; this.cycleT = performance.now();
      const it = this.cycleList[i];
      if (typeof it === 'string') this.set({ anim: it });
      else this.set({ anim: it.a, muscles: it.m || null });
    }
    destroy() { this.stop(); this.cycleList = null; this.el.innerHTML = ''; }
  }

  // Deriva accesorios a partir del equipo requerido por el ejercicio
  const EQUIP_PROP = { mancuernas: 'dumbbell', kettlebell: 'kettlebell', barra: 'barbell', liga_tubular: 'band', banda_larga: 'band', miniband: 'miniband', cuerda: 'rope', rueda: 'wheel', balon: 'ball', trx: 'trx', barra_dom: 'bar', silla: 'chair', escaladora: 'stepper' };
  function propsFor(eq) { return (eq || []).map(e => EQUIP_PROP[e]).filter(Boolean); }

  global.MiFitAvatar = { Avatar, ANIMS, CHARS, GROUPS, ACCENTS, propsFor, FALLBACK_ANIM };
})(window);
