/* =========================================================================
   MiFitApp · ejercicios.js
   Base de datos interna de ejercicios + catálogo de equipo + generador de rutinas.

   Leyenda de cada ejercicio:
     id   identificador único (no cambiar: se usa en historial y progresión)
     n    nombre visible
     g    grupo muscular principal
     p    patrón de movimiento (sentadilla, bisagra, zancada, gluteo, empuje_h,
          empuje_v, tiron_h, tiron_v, brazos, core, pantorrilla, cardio,
          calentamiento, movilidad, estiramiento)
     eq   equipo REQUERIDO (todos). Vacío = peso corporal.
     lv   nivel mínimo (1 principiante, 2 intermedio, 3 avanzado)
     ci   contraindicaciones (rodillas, espalda, hombros, munecas)
     t    'r' repeticiones · 's' segundos
     b    base (reps o segundos)
     a    animación del avatar (ver avatar.js)
     met  equivalente metabólico (para calorías)
     m    músculos trabajados
     tip  consejo de postura
     f    fases donde puede usarse: c calentamiento, p principal, e enfriamiento
   ========================================================================= */
(function (global) {
  'use strict';

  // ---------- Catálogo de equipo ----------
  const EQUIPO = [
    { cat: 'Sin equipo', items: [
      { id: 'corporal', n: 'Peso corporal', i: '🧍', d: 'Siempre disponible', fixed: true },
      { id: 'tapete', n: 'Tapete', i: '🧘', d: 'Para suelo y abdomen' },
      { id: 'silla', n: 'Silla o banco firme', i: '🪑', d: 'Fondos, step-ups, inclinadas' },
      { id: 'pared', n: 'Pared', i: '🧱', d: 'Sentadilla isométrica, apoyos' }
    ] },
    { cat: 'Ligas y bandas', items: [
      { id: 'liga_tubular', n: 'Ligas tubulares con agarres', i: '🎗️', d: 'Remos, press, curl', sug: ['Anclaje puerta 35-55 lbs', 'Ligera', 'Media', 'Fuerte'] },
      { id: 'miniband', n: 'Bandas circulares (mini bands)', i: '⭕', d: 'Glúteo y cadera', sug: ['Ligera', 'Media', 'Fuerte'] },
      { id: 'banda_larga', n: 'Banda larga de poder', i: '➰', d: 'Asistencia de dominadas, jalones', sug: ['Resistencia 15-35 lbs', 'Resistencia 35-65 lbs'] }
    ] },
    { cat: 'Pesas libres', items: [
      { id: 'mancuernas', n: 'Mancuernas', i: '🏋️', d: 'Ajustables o fijas', sug: ['5-40 lbs', 'Ajustables 2-20 kg', 'Par de 5 kg'] },
      { id: 'kettlebell', n: 'Pesa rusa (Kettlebell)', i: '🔔', d: 'Swings, goblet, remos', sug: ['8 kg', '12 kg', '16 kg'] },
      { id: 'barra', n: 'Barra recta con discos', i: '🏋️‍♂️', d: 'Fuerza básica', sug: ['Kit 20 kg convertible', 'Barra 20 kg + discos'] }
    ] },
    { cat: 'Accesorios', items: [
      { id: 'cuerda', n: 'Cuerda para saltar', i: '🪢', d: 'Cardio intenso', sug: ['Ajustable', 'Con rodamientos'] },
      { id: 'rueda', n: 'Rueda abdominal', i: '🛞', d: 'Core avanzado', sug: ['Rueda doble'] },
      { id: 'trx', n: 'TRX / Suspensión', i: '🎯', d: 'Remos y empujes', sug: ['Anclaje puerta', 'Anclaje techo'] },
      { id: 'balon', n: 'Balón medicinal', i: '🏐', d: 'Potencia y core', sug: ['3 kg', '5 kg'] },
      { id: 'barra_dom', n: 'Barra de dominadas', i: '🚪', d: 'Tirón vertical', sug: ['Anclaje puerta', 'Montaje en pared'] }
    ] },
    { cat: 'Cardio', items: [
      { id: 'escaladora', n: 'Escaladora vertical / Stepper', i: '🪜', d: 'Cardio, glúteo y piernas', sug: ['3 ángulos 35°-55° / 3 resortes', '1-2 resortes', '2-3 resortes'] }
    ] }
  ];
  const EQUIPO_NOMBRE = {};
  EQUIPO.forEach(c => c.items.forEach(i => { EQUIPO_NOMBRE[i.id] = i.n; }));

  const LESIONES = [
    { id: 'rodillas', n: 'Rodillas', i: '🦵' },
    { id: 'espalda', n: 'Espalda baja', i: '🔙' },
    { id: 'hombros', n: 'Hombros', i: '💪' },
    { id: 'munecas', n: 'Muñecas', i: '✋' }
  ];

  const OBJETIVOS = {
    grasa: { n: 'Pérdida de grasa', i: '🔥', d: 'Circuitos dinámicos con cardio' },
    hipertrofia: { n: 'Hipertrofia / Tonificación', i: '💪', d: 'Volumen moderado, 8–12 reps' },
    fuerza: { n: 'Fuerza general', i: '🏋️', d: 'Pocas reps, más descanso' },
    resistencia: { n: 'Resistencia / Cardio', i: '🫀', d: 'Intervalos por tiempo' },
    movilidad: { n: 'Movilidad y salud', i: '🧘', d: 'Rango de movimiento y control' }
  };

  // ---------- Ejercicios ----------
  const X = [
    // ===== Calentamiento =====
    { id: 'marcha', n: 'Marcha en el lugar', g: 'Cardio', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 's', b: 40, a: 'march', met: 3.5, m: 'Cuerpo completo, cadera', tip: 'Eleva rodillas a la altura de la cadera y balancea los brazos.', f: 'c' },
    { id: 'jack_bajo', n: 'Jumping jack sin impacto', g: 'Cardio', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 's', b: 40, a: 'jacklow', met: 4.5, m: 'Hombros, piernas', tip: 'Abre un pie a la vez mientras subes los brazos.', f: 'cp' },
    { id: 'circulos_brazos', n: 'Círculos de brazos', g: 'Hombros', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'armcircles', met: 2.5, m: 'Deltoides, manguito rotador', tip: 'Círculos pequeños a grandes, hombros lejos de las orejas.', f: 'c' },
    { id: 'rot_torso', n: 'Rotaciones de torso', g: 'Core', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'twist', met: 2.5, m: 'Oblicuos, columna torácica', tip: 'La cadera mira al frente; gira desde el pecho.', f: 'c' },
    { id: 'circulos_cadera', n: 'Círculos de cadera', g: 'Movilidad', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'hipcircle', met: 2.5, m: 'Cadera, zona lumbar', tip: 'Manos en la cintura, círculos amplios y lentos.', f: 'cp' },
    { id: 'balanceo_piernas', n: 'Balanceo de piernas', g: 'Movilidad', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'legswing', met: 3, m: 'Flexores de cadera, isquios', tip: 'Apóyate en algo firme y balancea sin arquear la espalda.', f: 'cp' },
    { id: 'boxeo_sombra', n: 'Boxeo de sombra', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: [], t: 's', b: 40, a: 'shadowbox', met: 6, m: 'Hombros, core, cardio', tip: 'Guardia arriba, gira la cadera en cada golpe.', f: 'cp' },
    { id: 'gato_vaca', n: 'Gato-vaca', g: 'Movilidad', p: 'movilidad', eq: [], lv: 1, ci: ['munecas'], t: 's', b: 40, a: 'catcow', met: 2.5, m: 'Columna, core', tip: 'Exhala al redondear, inhala al arquear. Movimiento lento.', f: 'cpe' },
    { id: 'buenos_dias_cal', n: 'Bisagra de cadera sin peso', g: 'Isquios', p: 'calentamiento', eq: [], lv: 1, ci: [], t: 'r', b: 12, a: 'goodmorning', met: 3, m: 'Isquiotibiales, glúteos', tip: 'Lleva la cadera atrás con espalda neutra.', f: 'c' },
    { id: 'aperturas_liga_cal', n: 'Aperturas con liga', g: 'Espalda', p: 'calentamiento', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'pullapart', met: 3, m: 'Deltoides posterior, romboides', tip: 'Brazos casi rectos, junta escápulas al abrir.', f: 'c' },
    { id: 'dislocaciones_liga', n: 'Pasos de hombro con liga', g: 'Movilidad', p: 'movilidad', eq: ['liga_tubular'], lv: 1, ci: ['hombros'], t: 'r', b: 10, a: 'dislocate', met: 2.5, m: 'Hombros, pecho', tip: 'Agarre ancho; pasa la liga por arriba sin doblar codos.', f: 'cp' },
    { id: 'cuerda_suave', n: 'Saltos suaves con cuerda', g: 'Cardio', p: 'calentamiento', eq: ['cuerda'], lv: 1, ci: ['rodillas'], t: 's', b: 40, a: 'jumprope', met: 8, m: 'Pantorrillas, cardio', tip: 'Saltos bajos sobre la punta de los pies.', f: 'c' },

    // ===== Sentadilla =====
    { id: 'sentadilla', n: 'Sentadilla', g: 'Piernas', p: 'sentadilla', eq: [], lv: 1, ci: [], t: 'r', b: 15, a: 'squat', met: 5, m: 'Cuádriceps, glúteos', tip: 'Rodillas alineadas con la punta de los pies, pecho arriba.', f: 'cp' },
    { id: 'sentadilla_silla', n: 'Sentadilla a la silla', g: 'Piernas', p: 'sentadilla', eq: ['silla'], lv: 1, ci: [], t: 'r', b: 12, a: 'boxsquat', met: 4.5, m: 'Cuádriceps, glúteos', tip: 'Roza la silla con la cadera y sube empujando con talones.', f: 'p' },
    { id: 'sentadilla_sumo', n: 'Sentadilla sumo', g: 'Piernas', p: 'sentadilla', eq: [], lv: 1, ci: [], t: 'r', b: 15, a: 'squat', met: 5, m: 'Aductores, glúteos', tip: 'Pies abiertos y puntas hacia afuera; rodillas siguen a los pies.', f: 'p' },
    { id: 'sentadilla_salto', n: 'Sentadilla con salto', g: 'Piernas', p: 'sentadilla', eq: [], lv: 2, ci: ['rodillas'], t: 'r', b: 12, a: 'jumpsquat', met: 8, m: 'Cuádriceps, glúteos, potencia', tip: 'Aterriza suave con rodillas flexionadas.', f: 'p' },
    { id: 'sentadilla_pared', n: 'Sentadilla isométrica en pared', g: 'Piernas', p: 'sentadilla', eq: ['pared'], lv: 1, ci: [], t: 's', b: 30, a: 'wallsit', met: 4, m: 'Cuádriceps', tip: 'Espalda pegada a la pared, rodillas a 90° o menos si molesta.', f: 'p' },
    { id: 'sentadilla_goblet', n: 'Sentadilla goblet con mancuerna', g: 'Piernas', p: 'sentadilla', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'goblet', met: 5.5, m: 'Cuádriceps, glúteos, core', tip: 'Sostén la pesa pegada al pecho; codos entre las rodillas.', f: 'p' },
    { id: 'sentadilla_goblet_kb', n: 'Sentadilla goblet con kettlebell', g: 'Piernas', p: 'sentadilla', eq: ['kettlebell'], lv: 1, ci: [], t: 'r', b: 12, a: 'goblet', met: 5.5, m: 'Cuádriceps, glúteos, core', tip: 'Kettlebell por los cuernos, pecho orgulloso.', f: 'p' },
    { id: 'sentadilla_liga', n: 'Sentadilla con liga', g: 'Piernas', p: 'sentadilla', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'squat', met: 5, m: 'Cuádriceps, glúteos', tip: 'Pisa la liga y lleva agarres a los hombros.', f: 'p' },
    { id: 'sentadilla_miniband', n: 'Sentadilla con mini band', g: 'Glúteos', p: 'sentadilla', eq: ['miniband'], lv: 1, ci: [], t: 'r', b: 15, a: 'squat', met: 5, m: 'Glúteo medio, cuádriceps', tip: 'Empuja las rodillas contra la banda todo el tiempo.', f: 'p' },
    { id: 'sentadilla_barra', n: 'Sentadilla trasera con barra', g: 'Piernas', p: 'sentadilla', eq: ['barra'], lv: 2, ci: ['rodillas', 'espalda'], t: 'r', b: 8, a: 'squat', met: 6, m: 'Cuádriceps, glúteos, espalda', tip: 'Barra sobre trapecios, core firme, baja controlado.', f: 'p' },
    { id: 'thruster', n: 'Thruster con mancuernas', g: 'Cuerpo completo', p: 'sentadilla', eq: ['mancuernas'], lv: 2, ci: ['hombros'], t: 'r', b: 10, a: 'thruster', met: 8, m: 'Piernas, hombros', tip: 'Sube de la sentadilla y usa el impulso para empujar arriba.', f: 'p' },
    { id: 'sentadilla_trx', n: 'Sentadilla asistida con TRX', g: 'Piernas', p: 'sentadilla', eq: ['trx'], lv: 1, ci: [], t: 'r', b: 15, a: 'squat', met: 4.5, m: 'Cuádriceps, glúteos', tip: 'Usa las asas solo para equilibrio, empuja con piernas.', f: 'p' },

    // ===== Bisagra =====
    { id: 'buenos_dias', n: 'Buenos días (peso corporal)', g: 'Isquios', p: 'bisagra', eq: [], lv: 1, ci: [], t: 'r', b: 15, a: 'goodmorning', met: 3.5, m: 'Isquiotibiales, glúteos, lumbares', tip: 'Rodillas suaves, cadera atrás, espalda plana.', f: 'p' },
    { id: 'peso_muerto_1p', n: 'Peso muerto a una pierna', g: 'Isquios', p: 'bisagra', eq: [], lv: 2, ci: [], t: 'r', b: 10, a: 'singlerdl', met: 4, m: 'Isquios, glúteo, equilibrio', tip: 'Cadera nivelada; la pierna de atrás forma una línea con tu espalda.', f: 'p' },
    { id: 'peso_muerto_liga', n: 'Peso muerto con liga', g: 'Isquios', p: 'bisagra', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'hinge', met: 4, m: 'Isquios, glúteos', tip: 'Pisa la liga; empuja la cadera adelante al subir.', f: 'p' },
    { id: 'peso_muerto_rumano', n: 'Peso muerto rumano con mancuernas', g: 'Isquios', p: 'bisagra', eq: ['mancuernas'], lv: 1, ci: ['espalda'], t: 'r', b: 12, a: 'hinge', met: 5, m: 'Isquios, glúteos, espalda', tip: 'Pesas pegadas a los muslos; baja hasta sentir el estiramiento.', f: 'p' },
    { id: 'peso_muerto_kb', n: 'Peso muerto con kettlebell', g: 'Isquios', p: 'bisagra', eq: ['kettlebell'], lv: 1, ci: ['espalda'], t: 'r', b: 12, a: 'hinge', met: 5, m: 'Glúteos, isquios', tip: 'Kettlebell entre los pies, espalda neutra.', f: 'p' },
    { id: 'swing_kb', n: 'Swing con kettlebell', g: 'Cuerpo completo', p: 'bisagra', eq: ['kettlebell'], lv: 2, ci: ['espalda'], t: 'r', b: 15, a: 'swing', met: 9, m: 'Glúteos, isquios, core', tip: 'Es un golpe de cadera, no una sentadilla. Brazos relajados.', f: 'p' },
    { id: 'peso_muerto_barra', n: 'Peso muerto con barra', g: 'Espalda/Piernas', p: 'bisagra', eq: ['barra'], lv: 2, ci: ['espalda'], t: 'r', b: 6, a: 'hinge', met: 6, m: 'Cadena posterior', tip: 'Barra rozando las piernas, empuja el piso.', f: 'p' },

    // ===== Glúteo =====
    { id: 'puente_gluteo', n: 'Puente de glúteo', g: 'Glúteos', p: 'gluteo', eq: [], lv: 1, ci: [], t: 'r', b: 15, a: 'bridge', met: 3.5, m: 'Glúteos, isquios', tip: 'Aprieta glúteos arriba, sin arquear la espalda baja.', f: 'cp' },
    { id: 'puente_1p', n: 'Puente a una pierna', g: 'Glúteos', p: 'gluteo', eq: [], lv: 2, ci: [], t: 'r', b: 10, a: 'bridge', met: 4, m: 'Glúteos, core', tip: 'Cadera nivelada, empuja con el talón de apoyo.', f: 'p' },
    { id: 'puente_miniband', n: 'Puente con mini band', g: 'Glúteos', p: 'gluteo', eq: ['miniband'], lv: 1, ci: [], t: 'r', b: 15, a: 'bridge', met: 4, m: 'Glúteo mayor y medio', tip: 'Abre rodillas contra la banda al subir.', f: 'p' },
    { id: 'hip_thrust_mancuerna', n: 'Hip thrust con mancuerna', g: 'Glúteos', p: 'gluteo', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'bridge', met: 4.5, m: 'Glúteos', tip: 'Pesa sobre la cadera, pausa 1 s arriba.', f: 'p' },
    { id: 'patada_gluteo', n: 'Patada de glúteo en cuadrupedia', g: 'Glúteos', p: 'gluteo', eq: [], lv: 1, ci: ['munecas'], t: 'r', b: 15, a: 'glutekick', met: 3.5, m: 'Glúteo mayor', tip: 'Empuja el talón al techo sin girar la cadera.', f: 'p' },
    { id: 'patada_gluteo_mb', n: 'Patada de glúteo con mini band', g: 'Glúteos', p: 'gluteo', eq: ['miniband'], lv: 1, ci: ['munecas'], t: 'r', b: 15, a: 'glutekick', met: 4, m: 'Glúteo mayor', tip: 'Banda sobre las rodillas, movimiento controlado.', f: 'p' },
    { id: 'caminata_lateral', n: 'Caminata lateral con mini band', g: 'Glúteos', p: 'gluteo', eq: ['miniband'], lv: 1, ci: [], t: 's', b: 30, a: 'sidestep', met: 4, m: 'Glúteo medio', tip: 'Semisentadilla, pasos cortos y tensión constante.', f: 'cp' },
    { id: 'abduccion_pie', n: 'Abducción de pierna de pie', g: 'Glúteos', p: 'gluteo', eq: [], lv: 1, ci: [], t: 'r', b: 15, a: 'abduction', met: 3, m: 'Glúteo medio', tip: 'Torso quieto, sube la pierna sin inclinarte.', f: 'p' },
    { id: 'abduccion_mb', n: 'Abducción con mini band', g: 'Glúteos', p: 'gluteo', eq: ['miniband'], lv: 1, ci: [], t: 'r', b: 15, a: 'abduction', met: 3.5, m: 'Glúteo medio', tip: 'Banda en tobillos, controla el regreso.', f: 'p' },

    // ===== Zancada =====
    { id: 'zancada_atras', n: 'Zancada hacia atrás', g: 'Piernas', p: 'zancada', eq: [], lv: 1, ci: ['rodillas'], t: 'r', b: 10, a: 'lunge', met: 5, m: 'Cuádriceps, glúteos', tip: 'Rodilla de atrás baja vertical, torso erguido.', f: 'p' },
    { id: 'zancada_estatica', n: 'Zancada estática (split squat)', g: 'Piernas', p: 'zancada', eq: [], lv: 1, ci: ['rodillas'], t: 'r', b: 10, a: 'lunge', met: 4.5, m: 'Cuádriceps, glúteos', tip: 'Pies fijos; sube y baja en línea recta.', f: 'p' },
    { id: 'zancada_mancuernas', n: 'Zancada con mancuernas', g: 'Piernas', p: 'zancada', eq: ['mancuernas'], lv: 2, ci: ['rodillas'], t: 'r', b: 10, a: 'lunge', met: 5.5, m: 'Cuádriceps, glúteos', tip: 'Pesas a los costados, paso largo y estable.', f: 'p' },
    { id: 'step_up', n: 'Subida a banco (step-up)', g: 'Piernas', p: 'zancada', eq: ['silla'], lv: 1, ci: [], t: 'r', b: 10, a: 'lunge', met: 5, m: 'Cuádriceps, glúteos', tip: 'Sube empujando con la pierna de arriba, no te impulses.', f: 'p' },
    { id: 'sentadilla_bulgara', n: 'Sentadilla búlgara', g: 'Piernas', p: 'zancada', eq: ['silla'], lv: 2, ci: ['rodillas'], t: 'r', b: 8, a: 'lunge', met: 5.5, m: 'Cuádriceps, glúteos', tip: 'Pie trasero en la silla; baja vertical.', f: 'p' },
    { id: 'zancada_lateral', n: 'Zancada lateral', g: 'Piernas', p: 'zancada', eq: [], lv: 1, ci: ['rodillas'], t: 'r', b: 10, a: 'skater', met: 4.5, m: 'Aductores, glúteos', tip: 'Lleva la cadera atrás sobre la pierna que flexionas.', f: 'p' },

    // ===== Empuje horizontal =====
    { id: 'lagartija_pared', n: 'Lagartija en pared', g: 'Pecho', p: 'empuje_h', eq: ['pared'], lv: 1, ci: [], t: 'r', b: 15, a: 'wallpushup', met: 3, m: 'Pecho, tríceps', tip: 'Cuerpo recto como tabla; codos a 45°.', f: 'p' },
    { id: 'lagartija_inclinada', n: 'Lagartija inclinada en banco', g: 'Pecho', p: 'empuje_h', eq: ['silla'], lv: 1, ci: ['munecas'], t: 'r', b: 12, a: 'inclinepushup', met: 4, m: 'Pecho, tríceps, hombros', tip: 'Manos en el borde, pecho hacia el banco.', f: 'p' },
    { id: 'lagartija_rodillas', n: 'Lagartija con rodillas apoyadas', g: 'Pecho', p: 'empuje_h', eq: [], lv: 1, ci: ['munecas'], t: 'r', b: 10, a: 'kneepushup', met: 4, m: 'Pecho, tríceps', tip: 'Línea recta de rodillas a cabeza.', f: 'p' },
    { id: 'lagartija', n: 'Lagartija', g: 'Pecho', p: 'empuje_h', eq: [], lv: 2, ci: ['munecas', 'hombros'], t: 'r', b: 10, a: 'pushup', met: 5, m: 'Pecho, tríceps, core', tip: 'Abdomen firme, baja el pecho hasta casi tocar.', f: 'p' },
    { id: 'lagartija_diamante', n: 'Lagartija diamante', g: 'Tríceps', p: 'empuje_h', eq: [], lv: 3, ci: ['munecas', 'hombros'], t: 'r', b: 8, a: 'pushup', met: 5.5, m: 'Tríceps, pecho', tip: 'Manos juntas formando un diamante bajo el pecho.', f: 'p' },
    { id: 'lagartija_declinada', n: 'Lagartija declinada (pies en silla)', g: 'Pecho', p: 'empuje_h', eq: ['silla'], lv: 3, ci: ['munecas', 'hombros'], t: 'r', b: 8, a: 'pushup', met: 5.5, m: 'Pecho superior, hombros', tip: 'Pies elevados, sin hundir la cadera.', f: 'p' },
    { id: 'press_pecho_liga', n: 'Press de pecho con liga', g: 'Pecho', p: 'empuje_h', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'chestpress', met: 4, m: 'Pecho, tríceps', tip: 'Liga anclada atrás; empuja al frente y regresa lento.', f: 'p' },
    { id: 'press_suelo_mancuernas', n: 'Press de pecho en suelo con mancuernas', g: 'Pecho', p: 'empuje_h', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'floorpress', met: 4.5, m: 'Pecho, tríceps', tip: 'Codos tocan el piso suave; empuja arriba.', f: 'p' },
    { id: 'press_suelo_barra', n: 'Press de pecho en suelo con barra', g: 'Pecho', p: 'empuje_h', eq: ['barra'], lv: 2, ci: ['hombros'], t: 'r', b: 8, a: 'floorpress', met: 5, m: 'Pecho, tríceps', tip: 'Agarre a la anchura de hombros, muñecas firmes.', f: 'p' },
    { id: 'lagartija_trx', n: 'Lagartija en TRX', g: 'Pecho', p: 'empuje_h', eq: ['trx'], lv: 2, ci: ['hombros'], t: 'r', b: 10, a: 'inclinepushup', met: 5, m: 'Pecho, core', tip: 'Inclínate más para hacerlo más difícil.', f: 'p' },

    // ===== Empuje vertical / hombros =====
    { id: 'pike_pushup', n: 'Lagartija pica (pike)', g: 'Hombros', p: 'empuje_v', eq: [], lv: 2, ci: ['munecas', 'hombros'], t: 'r', b: 8, a: 'pike', met: 5, m: 'Hombros, tríceps', tip: 'Cadera arriba en V invertida; la cabeza baja entre las manos.', f: 'p' },
    { id: 'press_hombro_mancuernas', n: 'Press de hombro con mancuernas', g: 'Hombros', p: 'empuje_v', eq: ['mancuernas'], lv: 1, ci: ['hombros'], t: 'r', b: 10, a: 'press', met: 4.5, m: 'Deltoides, tríceps', tip: 'No arquees la espalda; costillas abajo.', f: 'p' },
    { id: 'press_hombro_liga', n: 'Press de hombro con liga', g: 'Hombros', p: 'empuje_v', eq: ['liga_tubular'], lv: 1, ci: ['hombros'], t: 'r', b: 12, a: 'press', met: 4, m: 'Deltoides, tríceps', tip: 'Pisa la liga, empuja hacia arriba controlado.', f: 'p' },
    { id: 'press_militar_barra', n: 'Press militar con barra', g: 'Hombros', p: 'empuje_v', eq: ['barra'], lv: 2, ci: ['hombros', 'espalda'], t: 'r', b: 6, a: 'press', met: 5, m: 'Hombros, tríceps, core', tip: 'Glúteos apretados, cabeza pasa al frente cuando sube la barra.', f: 'p' },
    { id: 'press_kb', n: 'Press de hombro con kettlebell', g: 'Hombros', p: 'empuje_v', eq: ['kettlebell'], lv: 2, ci: ['hombros'], t: 'r', b: 8, a: 'press', met: 4.5, m: 'Hombros, estabilizadores', tip: 'Muñeca recta y codo bajo la pesa.', f: 'p' },
    { id: 'elev_laterales', n: 'Elevaciones laterales con mancuernas', g: 'Hombros', p: 'empuje_v', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'lateral', met: 3.5, m: 'Deltoides medio', tip: 'Sube hasta la altura del hombro, codos ligeramente flexionados.', f: 'p' },
    { id: 'elev_laterales_liga', n: 'Elevaciones laterales con liga', g: 'Hombros', p: 'empuje_v', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'lateral', met: 3.5, m: 'Deltoides medio', tip: 'Controla la bajada, sin balanceo.', f: 'p' },
    { id: 'elev_frontales', n: 'Elevaciones frontales con mancuernas', g: 'Hombros', p: 'empuje_v', eq: ['mancuernas'], lv: 1, ci: ['hombros'], t: 'r', b: 12, a: 'frontraise', met: 3.5, m: 'Deltoides anterior', tip: 'Sube a la altura de los ojos y baja lento.', f: 'p' },

    // ===== Tirón horizontal =====
    { id: 'ytw', n: 'Y-T-W boca abajo', g: 'Espalda', p: 'tiron_h', eq: [], lv: 1, ci: [], t: 'r', b: 10, a: 'cobra', met: 3, m: 'Espalda alta, deltoide posterior', tip: 'Frente cerca del piso; dibuja Y, T y W con los brazos.', f: 'p' },
    { id: 'superman', n: 'Superman', g: 'Espalda', p: 'tiron_h', eq: [], lv: 1, ci: ['espalda'], t: 'r', b: 12, a: 'superman', met: 3.5, m: 'Erectores, glúteos', tip: 'Eleva brazos y piernas a la vez, mirada al piso.', f: 'p' },
    { id: 'remo_liga', n: 'Remo con liga', g: 'Espalda', p: 'tiron_h', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'bandrow', met: 4, m: 'Dorsales, romboides, bíceps', tip: 'Jala los codos atrás y junta escápulas.', f: 'p' },
    { id: 'face_pull_liga', n: 'Face pull con liga', g: 'Espalda', p: 'tiron_h', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'bandrow', met: 3.5, m: 'Deltoide posterior, manguito', tip: 'Jala hacia la cara abriendo los codos.', f: 'p' },
    { id: 'aperturas_liga', n: 'Aperturas de liga (pull-apart)', g: 'Espalda', p: 'tiron_h', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'pullapart', met: 3, m: 'Romboides, deltoide posterior', tip: 'Brazos extendidos a la altura del pecho.', f: 'p' },
    { id: 'remo_banda_larga', n: 'Remo con banda larga', g: 'Espalda', p: 'tiron_h', eq: ['banda_larga'], lv: 1, ci: [], t: 'r', b: 15, a: 'bandrow', met: 4, m: 'Dorsales, bíceps', tip: 'Ancla la banda firme a la altura del pecho.', f: 'p' },
    { id: 'remo_mancuerna_apoyado', n: 'Remo con mancuerna apoyado en banco', g: 'Espalda', p: 'tiron_h', eq: ['mancuernas', 'silla'], lv: 1, ci: [], t: 'r', b: 12, a: 'supportedrow', met: 4, m: 'Dorsal, romboides', tip: 'Mano libre en la silla, espalda plana, codo pegado.', f: 'p' },
    { id: 'remo_mancuernas', n: 'Remo inclinado con mancuernas', g: 'Espalda', p: 'tiron_h', eq: ['mancuernas'], lv: 1, ci: ['espalda'], t: 'r', b: 12, a: 'row', met: 4.5, m: 'Dorsales, romboides', tip: 'Torso inclinado y firme; jala hacia la cadera.', f: 'p' },
    { id: 'remo_kb', n: 'Remo con kettlebell', g: 'Espalda', p: 'tiron_h', eq: ['kettlebell'], lv: 1, ci: ['espalda'], t: 'r', b: 12, a: 'row', met: 4.5, m: 'Dorsales, bíceps', tip: 'Sin girar el torso al subir la pesa.', f: 'p' },
    { id: 'remo_barra', n: 'Remo con barra', g: 'Espalda', p: 'tiron_h', eq: ['barra'], lv: 2, ci: ['espalda'], t: 'r', b: 8, a: 'row', met: 5, m: 'Espalda completa', tip: 'Barra hacia el ombligo, espalda neutra.', f: 'p' },
    { id: 'remo_trx', n: 'Remo en TRX', g: 'Espalda', p: 'tiron_h', eq: ['trx'], lv: 1, ci: [], t: 'r', b: 12, a: 'trxrow', met: 4.5, m: 'Dorsales, bíceps, core', tip: 'Cuerpo en tabla; acércate más al anclaje para hacerlo difícil.', f: 'p' },
    { id: 'pajaro_mancuernas', n: 'Pájaros con mancuernas', g: 'Espalda', p: 'tiron_h', eq: ['mancuernas'], lv: 2, ci: ['espalda'], t: 'r', b: 12, a: 'row', met: 3.5, m: 'Deltoide posterior', tip: 'Abre los brazos como alas sin subir los hombros.', f: 'p' },

    // ===== Tirón vertical =====
    { id: 'jalon_toalla', n: 'Jalón isométrico con toalla', g: 'Espalda', p: 'tiron_v', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'pulldown', met: 3, m: 'Dorsales', tip: 'Estira una toalla hacia afuera mientras bajas los codos.', f: 'p' },
    { id: 'jalon_liga', n: 'Jalón al pecho con liga', g: 'Espalda', p: 'tiron_v', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'pulldown', met: 4, m: 'Dorsales, bíceps', tip: 'Liga anclada arriba; codos hacia las costillas.', f: 'p' },
    { id: 'jalon_banda_larga', n: 'Jalón con banda larga', g: 'Espalda', p: 'tiron_v', eq: ['banda_larga'], lv: 1, ci: [], t: 'r', b: 15, a: 'pulldown', met: 4, m: 'Dorsales', tip: 'Pecho arriba, jala hasta la barbilla.', f: 'p' },
    { id: 'colgarse_barra', n: 'Colgarse de la barra', g: 'Espalda', p: 'tiron_v', eq: ['barra_dom'], lv: 1, ci: ['hombros'], t: 's', b: 20, a: 'deadhang', met: 3, m: 'Agarre, dorsales', tip: 'Hombros activos, no te dejes caer.', f: 'p' },
    { id: 'dominada_negativa', n: 'Dominada negativa', g: 'Espalda', p: 'tiron_v', eq: ['barra_dom'], lv: 2, ci: ['hombros'], t: 'r', b: 5, a: 'pullup', met: 6, m: 'Dorsales, bíceps', tip: 'Salta arriba y baja en 4-5 segundos.', f: 'p' },
    { id: 'dominada_asistida', n: 'Dominada asistida con banda', g: 'Espalda', p: 'tiron_v', eq: ['barra_dom', 'banda_larga'], lv: 2, ci: ['hombros'], t: 'r', b: 8, a: 'pullup', met: 6, m: 'Dorsales, bíceps', tip: 'Banda bajo el pie o rodilla; barbilla sobre la barra.', f: 'p' },
    { id: 'dominada', n: 'Dominada', g: 'Espalda', p: 'tiron_v', eq: ['barra_dom'], lv: 3, ci: ['hombros'], t: 'r', b: 6, a: 'pullup', met: 8, m: 'Dorsales, bíceps, core', tip: 'Desde brazos extendidos hasta barbilla sobre la barra.', f: 'p' },
    { id: 'pullover_mancuerna', n: 'Pullover con mancuerna', g: 'Espalda', p: 'tiron_v', eq: ['mancuernas'], lv: 1, ci: ['hombros'], t: 'r', b: 12, a: 'pullover', met: 3.5, m: 'Dorsales, pecho', tip: 'Acostado, brazos casi rectos, lleva la pesa atrás de la cabeza.', f: 'p' },

    // ===== Brazos =====
    { id: 'curl_mancuernas', n: 'Curl de bíceps con mancuernas', g: 'Brazos', p: 'brazos', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'curl', met: 3.5, m: 'Bíceps', tip: 'Codos pegados al cuerpo, sin balancear.', f: 'p' },
    { id: 'curl_martillo', n: 'Curl martillo', g: 'Brazos', p: 'brazos', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'curl', met: 3.5, m: 'Bíceps, braquial, antebrazo', tip: 'Palmas mirándose entre sí todo el recorrido.', f: 'p' },
    { id: 'curl_liga', n: 'Curl de bíceps con liga', g: 'Brazos', p: 'brazos', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'curl', met: 3.5, m: 'Bíceps', tip: 'Pisa la liga; aprieta arriba 1 segundo.', f: 'p' },
    { id: 'curl_kb', n: 'Curl con kettlebell', g: 'Brazos', p: 'brazos', eq: ['kettlebell'], lv: 1, ci: [], t: 'r', b: 12, a: 'curl', met: 3.5, m: 'Bíceps, antebrazo', tip: 'Sostén por los cuernos, codos quietos.', f: 'p' },
    { id: 'curl_barra', n: 'Curl con barra', g: 'Brazos', p: 'brazos', eq: ['barra'], lv: 1, ci: ['munecas'], t: 'r', b: 10, a: 'curl', met: 3.5, m: 'Bíceps', tip: 'Agarre a la anchura de hombros.', f: 'p' },
    { id: 'curl_trx', n: 'Curl de bíceps en TRX', g: 'Brazos', p: 'brazos', eq: ['trx'], lv: 2, ci: [], t: 'r', b: 12, a: 'trxrow', met: 4, m: 'Bíceps', tip: 'Codos fijos a la altura de hombros; lleva las manos a la frente.', f: 'p' },
    { id: 'fondos_silla', n: 'Fondos de tríceps en silla', g: 'Brazos', p: 'brazos', eq: ['silla'], lv: 1, ci: ['hombros', 'munecas'], t: 'r', b: 12, a: 'dips', met: 4, m: 'Tríceps', tip: 'Espalda cerca de la silla; baja a 90° de codo.', f: 'p' },
    { id: 'ext_triceps_mancuerna', n: 'Extensión de tríceps sobre la cabeza', g: 'Brazos', p: 'brazos', eq: ['mancuernas'], lv: 1, ci: ['hombros'], t: 'r', b: 12, a: 'triext', met: 3.5, m: 'Tríceps', tip: 'Codos apuntan al frente, no se abren.', f: 'p' },
    { id: 'patada_triceps', n: 'Patada de tríceps con mancuerna', g: 'Brazos', p: 'brazos', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 12, a: 'kickback', met: 3.5, m: 'Tríceps', tip: 'Brazo pegado al torso; solo se mueve el antebrazo.', f: 'p' },
    { id: 'patada_triceps_liga', n: 'Patada de tríceps con liga', g: 'Brazos', p: 'brazos', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 15, a: 'kickback', met: 3.5, m: 'Tríceps', tip: 'Extiende completamente atrás y regresa lento.', f: 'p' },

    // ===== Core =====
    { id: 'plancha', n: 'Plancha en antebrazos', g: 'Core', p: 'core', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'plank', met: 3.5, m: 'Abdomen, hombros', tip: 'Aprieta glúteos y abdomen; no hundas la cadera.', f: 'p' },
    { id: 'plancha_lateral', n: 'Plancha lateral', g: 'Core', p: 'core', eq: [], lv: 1, ci: ['hombros'], t: 's', b: 20, a: 'sideplank', met: 3.5, m: 'Oblicuos, glúteo medio', tip: 'Cadera alta, cuerpo en línea recta. Cambia de lado a la mitad.', f: 'p' },
    { id: 'dead_bug', n: 'Dead bug (bicho muerto)', g: 'Core', p: 'core', eq: [], lv: 1, ci: [], t: 'r', b: 12, a: 'deadbug', met: 3, m: 'Abdomen profundo', tip: 'Espalda baja pegada al piso todo el tiempo.', f: 'p' },
    { id: 'bird_dog', n: 'Bird dog', g: 'Core', p: 'core', eq: [], lv: 1, ci: ['munecas'], t: 'r', b: 12, a: 'birddog', met: 3, m: 'Core, glúteos, lumbares', tip: 'Brazo y pierna contrarios; no gires la cadera.', f: 'cp' },
    { id: 'crunch', n: 'Crunch abdominal', g: 'Core', p: 'core', eq: [], lv: 1, ci: ['espalda'], t: 'r', b: 15, a: 'crunch', met: 3, m: 'Recto abdominal', tip: 'Sube los hombros, no jales el cuello.', f: 'p' },
    { id: 'bicicleta', n: 'Bicicleta abdominal', g: 'Core', p: 'core', eq: [], lv: 1, ci: ['espalda'], t: 'r', b: 20, a: 'bicycle', met: 4, m: 'Oblicuos, abdomen', tip: 'Codo hacia rodilla contraria, lento y controlado.', f: 'p' },
    { id: 'elev_piernas', n: 'Elevación de piernas', g: 'Core', p: 'core', eq: [], lv: 2, ci: ['espalda'], t: 'r', b: 12, a: 'legraise', met: 3.5, m: 'Abdomen inferior', tip: 'Baja sin despegar la espalda baja del piso.', f: 'p' },
    { id: 'hollow', n: 'Hollow hold', g: 'Core', p: 'core', eq: [], lv: 2, ci: ['espalda'], t: 's', b: 20, a: 'hollow', met: 3.5, m: 'Abdomen', tip: 'Forma una “banana”: lumbares pegadas al piso.', f: 'p' },
    { id: 'giro_ruso', n: 'Giro ruso', g: 'Core', p: 'core', eq: [], lv: 1, ci: ['espalda'], t: 'r', b: 20, a: 'russian', met: 3.5, m: 'Oblicuos', tip: 'Pecho alto; gira el torso, no solo los brazos.', f: 'p' },
    { id: 'giro_ruso_balon', n: 'Giro ruso con balón medicinal', g: 'Core', p: 'core', eq: ['balon'], lv: 2, ci: ['espalda'], t: 'r', b: 16, a: 'russian', met: 4, m: 'Oblicuos', tip: 'Toca el balón a cada lado de la cadera.', f: 'p' },
    { id: 'rueda_abdominal', n: 'Rueda abdominal (de rodillas)', g: 'Core', p: 'core', eq: ['rueda'], lv: 2, ci: ['espalda', 'hombros'], t: 'r', b: 8, a: 'rollout', met: 4.5, m: 'Abdomen, dorsales', tip: 'Avanza solo hasta donde mantengas la espalda neutra.', f: 'p' },
    { id: 'pallof_liga', n: 'Press Pallof con liga', g: 'Core', p: 'core', eq: ['liga_tubular'], lv: 1, ci: [], t: 'r', b: 12, a: 'chestpress', met: 3, m: 'Core antirotación', tip: 'Liga anclada de lado; resiste el giro al extender.', f: 'p' },
    { id: 'lenador_liga', n: 'Leñador con liga', g: 'Core', p: 'core', eq: ['liga_tubular'], lv: 1, ci: ['espalda'], t: 'r', b: 12, a: 'woodchop', met: 4, m: 'Oblicuos, hombros', tip: 'De arriba a abajo en diagonal, pivota el pie.', f: 'p' },
    { id: 'toque_hombro', n: 'Plancha con toque de hombro', g: 'Core', p: 'core', eq: [], lv: 2, ci: ['munecas'], t: 'r', b: 16, a: 'shouldertap', met: 4, m: 'Core, hombros', tip: 'Pies separados, cadera sin balancearse.', f: 'p' },
    { id: 'rodillas_trx', n: 'Rodillas al pecho en TRX', g: 'Core', p: 'core', eq: ['trx'], lv: 2, ci: ['munecas'], t: 'r', b: 10, a: 'mountain', met: 5, m: 'Abdomen, hombros', tip: 'Pies en las asas; lleva rodillas al pecho sin subir la cadera.', f: 'p' },

    // ===== Pantorrilla =====
    { id: 'elev_talones', n: 'Elevación de talones', g: 'Pantorrillas', p: 'pantorrilla', eq: [], lv: 1, ci: [], t: 'r', b: 20, a: 'calf', met: 3, m: 'Gemelos, sóleo', tip: 'Sube alto, pausa y baja lento.', f: 'p' },
    { id: 'elev_talones_mancuernas', n: 'Elevación de talones con mancuernas', g: 'Pantorrillas', p: 'pantorrilla', eq: ['mancuernas'], lv: 1, ci: [], t: 'r', b: 15, a: 'calf', met: 3.5, m: 'Gemelos', tip: 'Puedes usar un escalón para mayor rango.', f: 'p' },

    // ===== Cardio =====
    { id: 'jumping_jacks', n: 'Jumping jacks', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 30, a: 'jack', met: 8, m: 'Cuerpo completo', tip: 'Aterriza en la punta del pie, ritmo constante.', f: 'cp' },
    { id: 'rodillas_altas', n: 'Rodillas altas', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 30, a: 'highknees', met: 8, m: 'Cadera, core, cardio', tip: 'Rodillas a la cintura y brazos activos.', f: 'cp' },
    { id: 'talones_gluteo', n: 'Talones al glúteo', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 30, a: 'buttkick', met: 7, m: 'Isquios, cardio', tip: 'Trote en el lugar llevando talones atrás.', f: 'cp' },
    { id: 'marcha_rapida', n: 'Marcha rápida con brazos', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: [], t: 's', b: 45, a: 'march', met: 5, m: 'Cardio sin impacto', tip: 'Rápido pero sin saltar: ideal para rodillas.', f: 'p' },
    { id: 'escaladores', n: 'Escaladores (mountain climbers)', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: ['munecas'], t: 's', b: 30, a: 'mountain', met: 8, m: 'Core, hombros, cardio', tip: 'Hombros sobre manos, rodillas rápidas al pecho.', f: 'p' },
    { id: 'burpee_sin_salto', n: 'Burpee sin salto', g: 'Cardio', p: 'cardio', eq: [], lv: 1, ci: ['munecas'], t: 'r', b: 8, a: 'burpeelow', met: 7, m: 'Cuerpo completo', tip: 'Lleva los pies atrás uno por uno si lo necesitas.', f: 'p' },
    { id: 'burpee', n: 'Burpee', g: 'Cardio', p: 'cardio', eq: [], lv: 2, ci: ['rodillas', 'munecas'], t: 'r', b: 10, a: 'burpee', met: 10, m: 'Cuerpo completo', tip: 'Plancha firme y salto explosivo al final.', f: 'p' },
    { id: 'skaters', n: 'Saltos de patinador', g: 'Cardio', p: 'cardio', eq: [], lv: 2, ci: ['rodillas'], t: 's', b: 30, a: 'skater', met: 8, m: 'Glúteos, piernas, equilibrio', tip: 'Salta de lado y aterriza suave en una pierna.', f: 'p' },
    { id: 'saltar_cuerda', n: 'Saltar la cuerda', g: 'Cardio', p: 'cardio', eq: ['cuerda'], lv: 1, ci: ['rodillas'], t: 's', b: 45, a: 'jumprope', met: 11, m: 'Pantorrillas, cardio', tip: 'Gira con las muñecas, codos cerca del cuerpo.', f: 'p' },
    { id: 'slam_balon', n: 'Lanzamiento de balón al piso', g: 'Cardio', p: 'cardio', eq: ['balon'], lv: 2, ci: ['espalda'], t: 'r', b: 12, a: 'slam', met: 9, m: 'Core, hombros, potencia', tip: 'Extiende arriba y lanza con todo el cuerpo.', f: 'p' },
    { id: 'gusano', n: 'Gusano (inchworm)', g: 'Cuerpo completo', p: 'cardio', eq: [], lv: 1, ci: ['munecas'], t: 'r', b: 6, a: 'inchworm', met: 5, m: 'Isquios, hombros, core', tip: 'Camina con las manos hasta la plancha y regresa.', f: 'cp' },

    // ===== Movilidad =====
    { id: 'sentadilla_profunda', n: 'Sentadilla profunda sostenida', g: 'Movilidad', p: 'movilidad', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 40, a: 'squathold', met: 2.5, m: 'Cadera, tobillos', tip: 'Talones abajo, codos empujan rodillas hacia afuera.', f: 'pe' },
    { id: 'zancada_flexor', n: 'Estiramiento de flexor de cadera', g: 'Movilidad', p: 'movilidad', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 40, a: 'lunge', met: 2.3, m: 'Psoas, cuádriceps', tip: 'Rodilla atrás apoyada en tapete, empuja la cadera adelante.', f: 'pe' },
    { id: 'gusano_mov', n: 'Caminata de manos lenta', g: 'Movilidad', p: 'movilidad', eq: [], lv: 1, ci: ['munecas'], t: 's', b: 40, a: 'inchworm', met: 3, m: 'Cadena posterior, hombros', tip: 'Rodillas suaves al bajar, respira profundo.', f: 'p' },
    // ===== Escaladora vertical / Stepper =====
    { id: 'escaladora_constante', n: 'Escaladora ritmo constante', g: 'Cardio', p: 'cardio', eq: ['escaladora'], lv: 1, ci: [], t: 's', b: 90, a: 'stepper', met: 7, m: 'Cuádriceps, glúteos, pantorrillas, cardio', tip: 'Inclinación media (45°) y 1-2 resortes; pasos fluidos de talón a punta, sin colgarte del manillar.', f: 'p' },
    { id: 'escaladora_hiit', n: 'Escaladora intervalos HIIT', g: 'Cardio', p: 'cardio', eq: ['escaladora'], lv: 2, ci: ['rodillas'], t: 's', b: 30, a: 'stepperhiit', met: 10, m: 'Cuádriceps, glúteos, cardio de alta intensidad', tip: 'Inclinación 35°-45° y 1-2 resortes; ráfagas intensas con control y respiración rítmica.', f: 'p' },
    { id: 'escaladora_profundo', n: 'Escaladora paso profundo', g: 'Piernas', p: 'zancada', eq: ['escaladora'], lv: 2, ci: ['rodillas'], t: 's', b: 40, a: 'stepperdeep', met: 8, m: 'Glúteos, cuádriceps', tip: 'Inclinación vertical (55°) y 2-3 resortes; baja el pedal por completo y empuja con el talón.', f: 'p' },
    { id: 'escaladora_lateral', n: 'Escaladora paso lateral', g: 'Glúteos', p: 'gluteo', eq: ['escaladora'], lv: 1, ci: [], t: 's', b: 40, a: 'steppersid', met: 6, m: 'Glúteo medio, abductores', tip: 'Inclinación 45°-55° y 1-2 resortes; abre la cadera hacia afuera y mantén el torso estable.', f: 'p' },

    // ===== Estiramientos (enfriamiento) =====
    { id: 'est_cuadriceps', n: 'Estiramiento de cuádriceps de pie', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 30, a: 'stretchquad', met: 2.3, m: 'Cuádriceps', tip: 'Rodillas juntas, glúteo apretado. Cambia de pierna a la mitad.', f: 'e' },
    { id: 'est_isquios', n: 'Estiramiento de isquios sentado', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: [], t: 's', b: 40, a: 'stretchham', met: 2.3, m: 'Isquiotibiales, espalda baja', tip: 'Inclínate desde la cadera, no fuerces.', f: 'e' },
    { id: 'est_hombro', n: 'Estiramiento de hombro cruzado', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'stretcharm', met: 2, m: 'Deltoides posterior', tip: 'Brazo a la altura del pecho; cambia de lado a la mitad.', f: 'e' },
    { id: 'est_triceps', n: 'Estiramiento de tríceps', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: ['hombros'], t: 's', b: 30, a: 'stretchtri', met: 2, m: 'Tríceps, dorsales', tip: 'Mano a la espalda, empuja suave el codo.', f: 'e' },
    { id: 'est_lateral', n: 'Estiramiento lateral de pie', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: [], t: 's', b: 30, a: 'stretchside', met: 2, m: 'Oblicuos, dorsales', tip: 'Crece hacia arriba antes de inclinarte.', f: 'e' },
    { id: 'est_pecho', n: 'Estiramiento de pecho', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: ['hombros'], t: 's', b: 30, a: 'stretchchest', met: 2, m: 'Pectorales, hombros', tip: 'Entrelaza manos atrás y abre el pecho.', f: 'e' },
    { id: 'postura_nino', n: 'Postura del niño', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: ['rodillas'], t: 's', b: 40, a: 'child', met: 1.8, m: 'Espalda, cadera', tip: 'Glúteos a los talones, respira hacia la espalda.', f: 'e' },
    { id: 'cobra', n: 'Cobra suave', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: ['espalda'], t: 's', b: 30, a: 'cobra', met: 1.8, m: 'Abdomen, flexores de cadera', tip: 'Cadera en el piso, sube solo lo cómodo.', f: 'e' },
    { id: 'abrazo_rodillas', n: 'Abrazo de rodillas', g: 'Estiramiento', p: 'estiramiento', eq: [], lv: 1, ci: [], t: 's', b: 40, a: 'kneehug', met: 1.8, m: 'Espalda baja, glúteos', tip: 'Balancéate suave de lado a lado.', f: 'e' },
    { id: 'respiracion', n: 'Respiración diafragmática', g: 'Recuperación', p: 'estiramiento', eq: [], lv: 1, ci: [], t: 's', b: 45, a: 'breathe', met: 1.3, m: 'Diafragma, sistema nervioso', tip: 'Inhala 4 s por la nariz, exhala 6 s por la boca.', f: 'e' },
    { id: 'est_pantorrilla', n: 'Estiramiento de pantorrilla en pared', g: 'Estiramiento', p: 'estiramiento', eq: ['pared'], lv: 1, ci: [], t: 's', b: 30, a: 'lunge', met: 2, m: 'Gemelos', tip: 'Talón trasero al piso, pierna recta.', f: 'e' }
  ];

  const PREP_SECS = 10; // preparación exacta antes de cada ejercicio
  // Compatibilidad de movimiento (herramientas extra): vincula una herramienta con grupos del catálogo
  const COMPAT = [
    { id: 'peso_inferior', n: 'Peso corporal / Tren inferior', test: e => ['sentadilla', 'zancada', 'gluteo', 'bisagra', 'pantorrilla'].includes(e.p) },
    { id: 'carga_libre', n: 'Mancuernas / Carga libre', test: e => e.eq.some(q => ['mancuernas', 'kettlebell', 'barra', 'balon'].includes(q)) },
    { id: 'ligas', n: 'Ligas / Resistencia', test: e => e.eq.some(q => ['liga_tubular', 'miniband', 'banda_larga'].includes(q)) },
    { id: 'cardio_stepper', n: 'Cardio / Stepper', test: e => e.p === 'cardio' || e.eq.some(q => ['escaladora', 'cuerda'].includes(q)) },
    { id: 'superior', n: 'Tren superior', test: e => ['empuje_h', 'empuje_v', 'tiron_h', 'tiron_v', 'brazos'].includes(e.p) },
    { id: 'core', n: 'Core / Abdomen', test: e => e.p === 'core' },
    { id: 'movilidad', n: 'Movilidad / Estiramiento', test: e => ['calentamiento', 'movilidad', 'estiramiento'].includes(e.p) },
    { id: 'general', n: 'Otro / General', test: () => false }
  ];
  const COMPAT_BY_ID = {}; COMPAT.forEach(c => { COMPAT_BY_ID[c.id] = c; });
  const BY_ID = {};
  X.forEach(e => { BY_ID[e.id] = e; });


  // =========================================================================
  //  MÚSCULOS ACTIVADOS (para iluminar al avatar anatómico)
  //  Formato 'principales|secundarios' con códigos de 2 letras.
  // =========================================================================
  const MUSCULOS = {
    pe: { id: 'pecho', n: 'Pecho' }, es: { id: 'espalda', n: 'Espalda / dorsales' }, ho: { id: 'hombros', n: 'Hombros' },
    bi: { id: 'biceps', n: 'Bíceps' }, tr: { id: 'triceps', n: 'Tríceps' }, ab: { id: 'abdomen', n: 'Abdomen' },
    gl: { id: 'gluteos', n: 'Glúteos' }, cu: { id: 'cuadriceps', n: 'Cuádriceps' }, is: { id: 'isquios', n: 'Isquiotibiales' },
    pa: { id: 'pantorrillas', n: 'Pantorrillas' }
  };
  const MUS_PATRON = {
    calentamiento: 'ho|ab', cardio: 'cu,gl|pa,ab,ho', movilidad: 'ab|gl', sentadilla: 'cu,gl|is,ab,pa', bisagra: 'gl,is|es,ab',
    gluteo: 'gl|is,ab', zancada: 'cu,gl|is,pa', empuje_h: 'pe|tr,ho,ab', empuje_v: 'ho|tr,pe,ab', tiron_h: 'es|bi,ho',
    tiron_v: 'es|bi,ho,ab', brazos: 'bi|ho', core: 'ab|ho', pantorrilla: 'pa|', estiramiento: 'is|'
  };
  const MUS_ID = {
    marcha: 'cu,gl|ab,pa', jack_bajo: 'ho,cu|pa,gl', circulos_brazos: 'ho|es,pe', rot_torso: 'ab|es', circulos_cadera: 'gl,ab|cu',
    balanceo_piernas: 'is,gl|cu,ab', buenos_dias_cal: 'is,gl|es', aperturas_liga_cal: 'es,ho|tr', cuerda_suave: 'pa|cu,ho',
    boxeo_sombra: 'ho,ab|pe,tr,cu', jumping_jacks: 'cu,ho|pa,gl', rodillas_altas: 'cu,ab|gl,pa', talones_gluteo: 'is|gl,pa',
    marcha_rapida: 'cu,gl|pa,ab', escaladores: 'ab,ho|cu,pe,tr', burpee_sin_salto: 'cu,pe|ho,tr,ab,gl', burpee: 'cu,gl,pe|ho,tr,ab,pa',
    skaters: 'gl,cu|is,pa,ab', saltar_cuerda: 'pa|cu,ho', slam_balon: 'ab,ho|es,pe,tr,gl', gusano: 'is,ho|ab,pe,pa',
    gato_vaca: 'es,ab|ho', dislocaciones_liga: 'ho,pe|es', sentadilla_profunda: 'cu,gl|is,pa', zancada_flexor: 'cu,gl|ab', gusano_mov: 'is,ho|ab,pa',
    sentadilla_sumo: 'cu,gl|is,ab', sentadilla_pared: 'cu|gl,pa', sentadilla_goblet: 'cu,gl|ab,ho', sentadilla_goblet_kb: 'cu,gl|ab,ho',
    sentadilla_miniband: 'gl,cu|is,ab', sentadilla_barra: 'cu,gl|es,ab,is', thruster: 'cu,gl,ho|tr,ab', sentadilla_salto: 'cu,gl|pa,is,ab',
    swing_kb: 'gl,is|es,ho,ab', peso_muerto_barra: 'gl,is,es|ab,bi', peso_muerto_1p: 'is,gl|ab,pa',
    hip_thrust_mancuerna: 'gl|is,cu', caminata_lateral: 'gl|cu,ab', abduccion_pie: 'gl|cu,ab', abduccion_mb: 'gl|cu,ab',
    lagartija_diamante: 'tr,pe|ho,ab', lagartija_declinada: 'pe,ho|tr,ab', lagartija_pared: 'pe|tr,ho', zancada_lateral: 'cu,gl|is',
    press_militar_barra: 'ho,tr|pe,ab', elev_laterales: 'ho|es', elev_laterales_liga: 'ho|es', elev_frontales: 'ho|pe,bi',
    ytw: 'es,ho|tr', superman: 'es,gl|is,ho', face_pull_liga: 'ho,es|bi', aperturas_liga: 'es,ho|tr', pajaro_mancuernas: 'ho,es|bi',
    jalon_toalla: 'es|bi,ho', pullover_mancuerna: 'es,pe|tr,ho',
    fondos_silla: 'tr|pe,ho', ext_triceps_mancuerna: 'tr|ho', patada_triceps: 'tr|ho,es', patada_triceps_liga: 'tr|ho,es',
    plancha: 'ab|ho,gl,pe', plancha_lateral: 'ab|ho,gl', dead_bug: 'ab|cu', bird_dog: 'ab,gl|es,ho', crunch: 'ab|', bicicleta: 'ab|cu',
    elev_piernas: 'ab|cu', hollow: 'ab|cu', giro_ruso: 'ab|ho', giro_ruso_balon: 'ab|ho,pe', rueda_abdominal: 'ab|es,ho,pe',
    pallof_liga: 'ab|ho,pe', lenador_liga: 'ab|ho,es,gl', toque_hombro: 'ab,ho|pe,tr', rodillas_trx: 'ab,ho|pe,cu',
    est_cuadriceps: 'cu|', est_isquios: 'is|es', est_hombro: 'ho|es', est_triceps: 'tr|ho', est_lateral: 'ab|es', est_pecho: 'pe|ho',
    postura_nino: 'es|gl', cobra: 'ab|pe', abrazo_rodillas: 'gl|es,is', respiracion: 'ab|', est_pantorrilla: 'pa|is',
    escaladora_constante: 'cu,gl|pa,is,ab', escaladora_hiit: 'cu,gl|pa,is,ab', escaladora_profundo: 'gl,cu|is,pa', escaladora_lateral: 'gl|cu,pa,ab'
  };
  function parseMus(str) {
    const [a, b] = String(str || '|').split('|');
    const map = c => c.split(',').filter(Boolean).map(k => MUSCULOS[k].id);
    return { p: map(a || ''), s: map(b || '') };
  }
  const musNombres = ids => ids.map(i => Object.values(MUSCULOS).find(m => m.id === i).n);

  // =========================================================================
  //  GUÍA DE POSTURA: posición inicial · ejecución · error común · marcadores
  //  Marcadores: [tipo, articulación, etiqueta]. K rodillas, A tobillos/pies, W manos,
  //  E codos, S hombros, H cadera. 'spine' = línea de la columna; 'span' = ancho entre lados.
  // =========================================================================
  const GUIA_PATRON = {
    calentamiento: { ini: 'De pie, relajado, hombros sueltos y respiración tranquila.', err: 'Moverte demasiado rápido y sin control.', marks: [['spine', '', 'Postura alta'], ['pt', 'S', 'Hombros relajados']] },
    cardio: { ini: 'Postura alta, abdomen activo y pies listos para aterrizar suave.', err: 'Aterrizar con rodillas rígidas o encorvarte.', marks: [['spine', '', 'Torso erguido'], ['pt', 'K', 'Rodillas suaves'], ['pt', 'A', 'Aterrizaje suave']] },
    movilidad: { ini: 'Posición cómoda, espalda larga y respiración tranquila.', err: 'Forzar el rango hasta sentir dolor.', marks: [['spine', '', 'Espalda larga'], ['pt', 'S', 'Hombros']] },
    sentadilla: { ini: 'Pies al ancho de hombros, pecho arriba y abdomen firme.', err: 'Rodillas hacia adentro o talones que se despegan del piso.', marks: [['pt', 'K', 'Rodillas alineadas'], ['spine', '', 'Espalda neutra'], ['span', 'A', 'Ancho de pies']] },
    bisagra: { ini: 'Pies al ancho de caderas, rodillas suaves y espalda neutra.', err: 'Redondear la espalda baja: es bisagra de cadera, no sentadilla.', marks: [['spine', '', 'Espalda neutra'], ['pt', 'H', 'Cadera atrás'], ['pt', 'K', 'Rodillas suaves']] },
    gluteo: { ini: 'Cuerpo estable, abdomen firme y cadera alineada.', err: 'Arquear la espalda baja en lugar de usar el glúteo.', marks: [['pt', 'H', 'Cadera'], ['spine', '', 'Espalda neutra'], ['pt', 'K', 'Rodillas']] },
    zancada: { ini: 'De pie, torso erguido y pies a la anchura de caderas.', err: 'Rodilla delantera que pasa de la punta o torso que cae al frente.', marks: [['pt', 'K', 'Rodilla sobre tobillo'], ['spine', '', 'Torso erguido'], ['pt', 'A', 'Pies firmes']] },
    empuje_h: { ini: 'Manos bajo los hombros y cuerpo recto de cabeza a talones.', err: 'Hundir la cadera o abrir los codos a 90°.', marks: [['spine', '', 'Cuerpo en línea'], ['pt', 'W', 'Manos bajo hombros'], ['pt', 'E', 'Codos a 45°']] },
    empuje_v: { ini: 'De pie firme, costillas abajo y muñecas rectas sobre los codos.', err: 'Arquear la espalda baja al empujar.', marks: [['spine', '', 'Costillas abajo'], ['pt', 'W', 'Muñecas rectas'], ['pt', 'E', 'Codos bajo muñecas']] },
    tiron_h: { ini: 'Torso firme, espalda neutra y hombros lejos de las orejas.', err: 'Jalar solo con los brazos y encoger los hombros.', marks: [['spine', '', 'Espalda plana'], ['pt', 'E', 'Codos pegados'], ['pt', 'W', 'Agarre firme']] },
    tiron_v: { ini: 'Agarre firme y hombros activos, lejos de las orejas.', err: 'Balancearte o jalar solo con los brazos.', marks: [['pt', 'S', 'Hombros activos'], ['pt', 'W', 'Agarre'], ['spine', '', 'Cuerpo firme']] },
    brazos: { ini: 'Codos pegados al cuerpo, muñecas neutras y torso quieto.', err: 'Balancear el cuerpo para mover el peso.', marks: [['pt', 'E', 'Codos fijos'], ['pt', 'W', 'Muñecas neutras'], ['spine', '', 'Torso quieto']] },
    core: { ini: 'Abdomen firme, espalda baja estable y respiración controlada.', err: 'Arquear la espalda baja o contener la respiración.', marks: [['spine', '', 'Cuerpo en línea'], ['pt', 'H', 'Cadera'], ['pt', 'S', 'Hombros']] },
    pantorrilla: { ini: 'De pie, pies paralelos y postura alta.', err: 'Rebotar en lugar de subir y bajar controlado.', marks: [['pt', 'A', 'Talones'], ['spine', '', 'Postura alta'], ['span', 'A', 'Pies paralelos']] },
    estiramiento: { ini: 'Posición estable, músculo relajado y respiración profunda.', err: 'Rebotar o estirar hasta sentir dolor.', marks: [['spine', '', 'Espalda larga'], ['pt', 'S', 'Hombros']] }
  };
  const _boca = { ini: 'Boca arriba, rodillas dobladas y pies a la anchura de caderas.', err: 'Arquear la espalda baja en vez de apretar el glúteo.', marks: [['pt', 'H', 'Cadera arriba'], ['spine', '', 'Línea hombro-rodilla'], ['pt', 'K', 'Rodillas alineadas']] };
  const _lagBase = { ini: 'Manos bajo los hombros y cuerpo recto de cabeza a talones.', err: 'Hundir la cadera o abrir los codos.' };
  const _colgar = { ini: 'Cuelga con brazos extendidos y hombros activos.', err: 'Balancearte o encoger los hombros hacia las orejas.' };
  const _espaldaPiso = { ini: 'Boca arriba, espalda baja pegada al piso y abdomen firme.', err: 'Arquear la espalda baja al mover las piernas.' };
  const _escal = { ini: 'Manos en el manillar, torso erguido y pies centrados en los pedales.', err: 'Colgarte del manillar o dar pasos cortos sin empujar el pedal.', marks: [['spine', '', 'Torso erguido'], ['pt', 'W', 'Agarre ligero'], ['pt', 'K', 'Rodillas alineadas']] };
  const GUIA_ID = {
    puente_gluteo: _boca, puente_1p: _boca, puente_miniband: _boca, hip_thrust_mancuerna: _boca,
    plancha: { ini: 'Antebrazos bajo los hombros, cuerpo en línea recta.', err: 'Hundir la cadera o levantarla demasiado.' },
    plancha_lateral: { ini: 'De lado, codo bajo el hombro y cadera elevada.', err: 'Dejar caer la cadera o girar el pecho.' },
    dead_bug: { ini: 'Boca arriba, brazos al techo y rodillas a 90°.', err: 'Despegar la espalda baja del piso.' },
    bird_dog: { ini: 'En cuatro apoyos, manos bajo hombros y rodillas bajo la cadera.', err: 'Girar la cadera al extender la pierna.' },
    crunch: { ini: 'Boca arriba, rodillas dobladas y manos suaves tras la cabeza.', err: 'Jalar el cuello con las manos.' },
    bicicleta: _espaldaPiso, elev_piernas: _espaldaPiso, hollow: _espaldaPiso,
    giro_ruso: { ini: 'Sentado, torso inclinado atrás y pecho abierto.', err: 'Girar solo los brazos y no el torso.' },
    giro_ruso_balon: { ini: 'Sentado, torso inclinado atrás y balón al frente.', err: 'Girar solo los brazos y no el torso.' },
    superman: { ini: 'Boca abajo, brazos estirados y mirada al piso.', err: 'Levantar la cabeza y arquear el cuello.' },
    ytw: { ini: 'Boca abajo, frente cerca del piso y brazos estirados.', err: 'Levantar la cabeza o encoger los hombros.' },
    lagartija_pared: { ini: 'De pie frente a la pared, manos a la altura del pecho.', err: 'Separar los talones o hundir la cadera.' },
    lagartija_inclinada: { ini: 'Manos en el borde firme y cuerpo en línea recta.', err: 'Hundir la cadera o abrir mucho los codos.' },
    lagartija_rodillas: { ini: 'Rodillas apoyadas, manos bajo los hombros y cuerpo recto.', err: 'Doblar la cadera en vez de bajar el pecho.' },
    lagartija: _lagBase, lagartija_diamante: _lagBase, lagartija_declinada: _lagBase, lagartija_trx: _lagBase,
    colgarse_barra: _colgar, dominada_negativa: _colgar, dominada_asistida: _colgar, dominada: _colgar,
    fondos_silla: { ini: 'Manos en el borde de la silla, cadera cerca y codos atrás.', err: 'Dejar caer los hombros o alejar la cadera de la silla.' },
    swing_kb: { ini: 'Pies más anchos que la cadera, kettlebell delante y espalda plana.', err: 'Hacer sentadilla y levantar con los brazos.' },
    burpee: { ini: 'De pie, pies al ancho de hombros y listo para bajar.', err: 'Hundir la cadera al llegar a la plancha.' },
    burpee_sin_salto: { ini: 'De pie, pies al ancho de hombros y listo para bajar.', err: 'Hundir la cadera al llegar a la plancha.' },
    saltar_cuerda: { ini: 'Codos pegados, muñecas sueltas y rodillas ligeras.', err: 'Saltar muy alto o abrir los codos.' },
    escaladores: { ini: 'En plancha alta, manos bajo hombros y cuerpo recto.', err: 'Subir la cadera al llevar las rodillas.' },
    gato_vaca: { ini: 'En cuatro apoyos, manos bajo hombros y rodillas bajo la cadera.', err: 'Mover solo el cuello y no toda la columna.' },
    sentadilla_pared: { ini: 'Espalda pegada a la pared y pies adelantados al ancho de hombros.', err: 'Rodillas más allá de la punta de los pies.' },
    sentadilla_silla: { ini: 'De pie frente a la silla, pies al ancho de hombros.', err: 'Dejarte caer sobre la silla.' },
    elev_laterales: { ini: 'De pie, mancuernas a los lados y codos ligeramente flexionados.', err: 'Subir con impulso o encoger los hombros.' },
    elev_laterales_liga: { ini: 'De pie, liga bajo los pies y codos ligeramente flexionados.', err: 'Subir con impulso o encoger los hombros.' },
    respiracion: { ini: 'Acostado o sentado, una mano sobre el abdomen.', err: 'Elevar los hombros al inhalar.' },
    postura_nino: { ini: 'De rodillas, glúteos hacia los talones y brazos al frente.', err: 'Levantar la cadera de los talones por tensión.' },
    cobra: { ini: 'Boca abajo, manos bajo los hombros y cadera en el piso.', err: 'Empujar con los brazos y arquear de más la zona lumbar.' },
    abrazo_rodillas: { ini: 'Boca arriba, lleva las rodillas hacia el pecho.', err: 'Levantar la cabeza y tensar el cuello.' },
    escaladora_constante: _escal, escaladora_hiit: _escal, escaladora_profundo: _escal, escaladora_lateral: _escal
  };
  function guiaDe(e) {
    const base = GUIA_PATRON[e.p] || GUIA_PATRON.core, o = GUIA_ID[e.id] || {};
    return { ini: o.ini || base.ini, eje: e.tip, err: o.err || base.err, marks: o.marks || base.marks };
  }
  X.forEach(e => { e.mus = parseMus(MUS_ID[e.id] || MUS_PATRON[e.p]); e.guia = guiaDe(e); });

  // ---------- Utilidades ----------
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  const LEVEL = { principiante: 1, intermedio: 2, avanzado: 3 };

  function permitido(e, ctx) {
    if (e.lv > ctx.lv) return false;
    if (e.ci.some(c => ctx.lesiones.includes(c))) return false;
    return e.eq.every(q => ctx.equipo.has(q));
  }

  function disponibles(ctx, fase) {
    return X.filter(e => e.f.includes(fase) && permitido(e, ctx));
  }

  // ---------- Plantillas de día ----------
  const DIAS = {
    full: { n: 'Cuerpo completo', pat: ['sentadilla', 'empuje_h', 'tiron_h', 'bisagra', 'empuje_v', 'tiron_v', 'core', 'zancada', 'gluteo', 'brazos', 'core', 'pantorrilla'] },
    superior: { n: 'Tren superior', pat: ['empuje_h', 'tiron_h', 'empuje_v', 'tiron_v', 'brazos', 'core', 'empuje_h', 'tiron_h', 'brazos', 'core'] },
    inferior: { n: 'Tren inferior', pat: ['sentadilla', 'bisagra', 'zancada', 'gluteo', 'core', 'pantorrilla', 'sentadilla', 'gluteo', 'bisagra', 'core'] },
    empuje: { n: 'Empuje (pecho, hombro, tríceps)', pat: ['empuje_h', 'empuje_v', 'empuje_h', 'brazos', 'core', 'empuje_v', 'core'] },
    tiron: { n: 'Tirón (espalda, bíceps)', pat: ['tiron_h', 'tiron_v', 'tiron_h', 'brazos', 'bisagra', 'core', 'tiron_v'] },
    piernas: { n: 'Piernas y glúteos', pat: ['sentadilla', 'bisagra', 'zancada', 'gluteo', 'pantorrilla', 'core', 'gluteo'] },
    movilidad: { n: 'Movilidad y control', pat: ['movilidad', 'core', 'gluteo', 'movilidad', 'tiron_h', 'movilidad', 'core', 'movilidad'] }
  };
  const SPLITS = { 2: ['full'], 3: ['full'], 4: ['superior', 'inferior'], 5: ['superior', 'inferior', 'empuje', 'tiron', 'piernas'], 6: ['empuje', 'tiron', 'piernas'] };

  // Parámetros por objetivo [principiante, intermedio, avanzado]
  const PARAMS = {
    grasa: { sets: [2, 3, 3], factor: 1.2, secs: 40, rest: 30, cardioCada: 2 },
    hipertrofia: { sets: [3, 3, 4], factor: 1.0, secs: 40, rest: 60, cardioCada: 0 },
    fuerza: { sets: [3, 4, 5], factor: 0.65, secs: 35, rest: 90, cardioCada: 0 },
    resistencia: { sets: [2, 3, 3], factor: 1.3, secs: 45, rest: 20, cardioCada: 2, porTiempo: true },
    movilidad: { sets: [1, 2, 2], factor: 0.8, secs: 40, rest: 15, cardioCada: 0, porTiempo: true }
  };

  function tipoDia(perfil, indiceSesion) {
    if (perfil.objetivo === 'movilidad') return 'movilidad';
    const split = SPLITS[Math.min(6, Math.max(2, +perfil.dias || 3))];
    return split[indiceSesion % split.length];
  }

  // Estima segundos de un bloque
  function duracionItem(it) {
    const work = it.mode === 'time' ? it.secs : it.reps * 3.5;
    // + 10 s de preparación (guía de postura) antes de cada ejercicio; el descanso final solo en bloque principal
    return it.sets * work + Math.max(0, it.sets - 1) * it.rest + (it.block === 'pri' ? it.rest : 0) + PREP_SECS;
  }

  // Aplica parámetros de objetivo, nivel y progresión a un ejercicio
  function prescribir(e, bloque, perfil, prog) {
    const lv = LEVEL[perfil.nivel] || 1;
    const P = PARAMS[perfil.objetivo] || PARAMS.hipertrofia;
    const adj = (prog && prog[e.id]) || null;
    const d = adj ? adj.d || 0 : 0;
    if (bloque !== 'pri') {
      return { id: e.id, block: bloque, sets: 1, mode: 'time', secs: e.t === 's' ? e.b : 35, reps: 0, rest: 10 };
    }
    const sets = P.sets[lv - 1];
    let mode = e.t === 's' || P.porTiempo ? 'time' : 'reps';
    let reps = 0, secs = 0;
    if (mode === 'reps') reps = Math.max(4, Math.round(e.b * P.factor * (lv === 3 ? 1.15 : lv === 1 ? 0.85 : 1)) + d);
    else secs = Math.max(15, Math.round((e.t === 's' ? e.b * (lv === 1 ? 0.85 : lv === 3 ? 1.25 : 1) : P.secs) / 5) * 5 + d * 3);
    let rest = P.rest;
    if (e.p === 'cardio' && P.rest > 45) rest = 45;
    if (perfil.objetivo === 'fuerza' && (e.p === 'core' || e.p === 'brazos' || e.p === 'pantorrilla')) rest = 60;
    return { id: e.id, block: 'pri', sets, mode, reps, secs, rest };
  }

  function pick(lista, r, usados, pesos, permiteRepetir) {
    const libres = lista.filter(e => !usados.has(e.id));
    const pool = libres.length ? libres : (permiteRepetir ? lista : []);
    if (!pool.length) return null;
    const w = pool.map(e => (pesos ? pesos(e) : 1));
    let total = w.reduce((a, b) => a + b, 0), x = r() * total;
    for (let i = 0; i < pool.length; i++) { x -= w[i]; if (x <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  /**
   * Genera una rutina.
   * @param {object} perfil   {edad, sexo, peso, estatura, nivel, dias, objetivo, lesiones[]}
   * @param {string[]} equipoIds
   * @param {object} op {duracion, indiceSesion, semilla, prog, recientes:Set}
   */
  function generarRutina(perfil, equipoIds, op = {}) {
    const dur = +op.duracion || 30;
    const ctx = { lv: LEVEL[perfil.nivel] || 1, lesiones: perfil.lesiones || [], equipo: new Set(['corporal'].concat(equipoIds || [])) };
    const r = rng(op.semilla != null ? op.semilla : hash(new Date().toDateString()));
    const dia = tipoDia(perfil, op.indiceSesion || 0);
    const plantilla = DIAS[dia];
    const P = PARAMS[perfil.objetivo] || PARAMS.hipertrofia;
    const usados = new Set();
    const recientes = op.recientes || new Set();
    const items = [];

    // Calentamiento y enfriamiento
    const nCal = dur <= 15 ? 3 : dur <= 30 ? 4 : dur <= 45 ? 5 : 6;
    const cal = disponibles(ctx, 'c');
    const prefer = (e) => (e.p === 'calentamiento' ? 2 : 1) * (e.eq.length ? 1.3 : 1);
    for (let i = 0; i < nCal; i++) { const e = pick(cal, r, usados, prefer); if (!e) break; usados.add(e.id); items.push(prescribir(e, 'cal', perfil, op.prog)); }
    const enf = disponibles(ctx, 'e');
    const enfItems = [];
    for (let i = 0; i < nCal; i++) { const e = pick(enf, r, usados); if (!e) break; usados.add(e.id); enfItems.push(prescribir(e, 'enf', perfil, op.prog)); }

    // Bloque principal
    const calSecs = items.concat(enfItems).reduce((a, it) => a + duracionItem(it), 0);
    let budget = dur * 60 - calSecs;
    const pri = disponibles(ctx, 'p');
    const extras = (op.extras || []).map(id => COMPAT_BY_ID[id]).filter(Boolean);
    const pesos = (e) => {
      let w = 1;
      if (e.eq.length && (perfil.objetivo === 'hipertrofia' || perfil.objetivo === 'fuerza')) w *= 1.8;
      if (perfil.objetivo === 'fuerza') w *= e.lv;
      if (recientes.has(e.id)) w *= 0.4;
      if (extras.some(c => c.test(e))) w *= 1.5;   // herramienta extra activa del usuario
      return w;
    };
    let pi = 0, guard = 0, desdeCardio = 0, fallos = 0;
    while (budget > 60 && guard++ < 40) {
      let patron = plantilla.pat[pi % plantilla.pat.length];
      if (P.cardioCada && desdeCardio >= P.cardioCada) { patron = 'cardio'; desdeCardio = -1; }
      pi += patron === 'cardio' && desdeCardio === -1 ? 0 : 1;
      desdeCardio++;
      const cand = pri.filter(e => e.p === patron);
      const e = pick(cand, r, usados, pesos, patron === 'cardio');
      if (!e) { if (++fallos > plantilla.pat.length * 2) break; continue; }
      const it = prescribir(e, 'pri', perfil, op.prog);
      const d = duracionItem(it);
      if (d > budget * 1.35 && items.some(x => x.block === 'pri')) break;
      usados.add(e.id); items.push(it); budget -= d;
      if (items.filter(x => x.block === 'pri').length >= 12) break;
    }
    // Si faltan ejercicios disponibles, completa el tiempo agregando series
    const principales = items.filter(x => x.block === 'pri');
    const maxSets = perfil.objetivo === 'fuerza' ? 6 : 5;
    let k = 0, sinCambio = 0;
    while (budget > 75 && principales.length && sinCambio < principales.length) {
      const it = principales[k++ % principales.length];
      if (it.sets >= maxSets) { sinCambio++; continue; }
      const antes = duracionItem(it); it.sets++; budget -= duracionItem(it) - antes; sinCambio = 0;
    }
    return {
      fecha: new Date().toISOString().slice(0, 10),
      dia, diaNombre: plantilla.n, duracion: dur, objetivo: perfil.objetivo, fuente: 'offline',
      items: items.concat(enfItems)
    };
  }

  // Cambia un ejercicio por otro equivalente (mismo patrón y fase)
  function alternativa(item, perfil, equipoIds, excluir) {
    const e = BY_ID[item.id];
    if (!e) return null;
    const ctx = { lv: LEVEL[perfil.nivel] || 1, lesiones: perfil.lesiones || [], equipo: new Set(['corporal'].concat(equipoIds || [])) };
    const fase = item.block === 'cal' ? 'c' : item.block === 'enf' ? 'e' : 'p';
    let cand = disponibles(ctx, fase).filter(x => x.id !== e.id && !excluir.has(x.id));
    let mismo = cand.filter(x => x.p === e.p);
    if (!mismo.length && fase === 'p') mismo = cand.filter(x => x.g === e.g);
    if (!mismo.length) mismo = cand;
    if (!mismo.length) return null;
    return mismo[Math.floor(Math.random() * mismo.length)];
  }

  function estimarMinutos(rutina) {
    return Math.round(rutina.items.reduce((a, it) => a + duracionItem(it), 0) / 60);
  }

  global.MiFitDB = {
    EQUIPO, EQUIPO_NOMBRE, LESIONES, COMPAT, COMPAT_BY_ID, MUSCULOS, PREP_SECS, parseMus, musNombres, guiaDe, OBJETIVOS, EJERCICIOS: X, BY_ID, DIAS, PARAMS,
    generarRutina, alternativa, prescribir, permitido, disponibles, estimarMinutos, duracionItem, hash, LEVEL
  };
})(window);
