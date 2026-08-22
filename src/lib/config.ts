import type { Macros, MealSlot } from '../types'

export const APP_VERSION = '3.34'

// ---------------------------------------------------------------------------
// Valores iniciales
//
// Aqui NO vive el plan del usuario. Sus comidas y su rutina son datos suyos:
// se crean desde la app y se guardan en el estado. Lo unico que queda aqui son
// los arranques neutros de una instalacion nueva y las constantes del algoritmo.
//
// Unica excepcion: ROUTINE_TEMPLATE, que NO se siembra y solo se materializa
// cuando el usuario toca "Cargar rutina".
// ---------------------------------------------------------------------------

/** Punto de partida antes de que el usuario defina el suyo en el onboarding. */
export const DEFAULT_TARGETS: Macros = { prot: 150, carb: 150, grasa: 60 }

export const SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'cena', label: 'Cena' },
  { id: 'extra', label: 'Extras' },
]

export const SLOT_LABEL: Record<MealSlot, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  extra: 'Extras',
}

/**
 * Reparto del objetivo diario entre comidas. Las tres principales suman 1;
 * los extras van aparte porque no siempre existen. Editable en Mi plan.
 */
export const DEFAULT_SLOT_SHARE: Record<MealSlot, number> = {
  desayuno: 0.2,
  almuerzo: 0.42,
  cena: 0.38,
  extra: 0.1,
}

export const DEFAULT_SLEEP_TARGET = 7.5

/** Margen para dar un dia por cumplido. */
export const DEFAULT_TOLERANCE = 0.12

/** Porciones del selector. */
export const PORTIONS = [0.5, 1, 1.5, 2] as const

/**
 * Umbrales del veredicto semanal. Son reglas del algoritmo, no preferencias:
 * viven juntas aqui para que ningun numero suelto quede escondido en la logica.
 */
export const RULES = {
  /** Dias sin registrar que disparan el modo "volvamos". */
  absenceDays: 4,
  /** Dias con comida registrada por debajo de los cuales no se juzga el plan. */
  minLoggedDays: 5,
  /** Fraccion de los dias registrados que debe caer en objetivo. */
  onTargetShare: 0.6,
  /** Dias que se muestran en el grafico de peso y en el de cintura. */
  weightChartDays: 30,
  waistChartDays: 90,
  /** Ventana para comparar fuerza contra la semana anterior. */
  strengthWindowDays: 7,
} as const

/**
 * Plantilla de rutina Upper/Lower (4 dias). **No se siembra nunca**: solo
 * existe detras del boton "Cargar rutina" de Mi plan, y a partir de ahi es
 * data del usuario que puede editar o borrar.
 *
 * Los ejercicios se guardan con el NOMBRE como id a proposito: el historial de
 * series del modelo viejo estaba indexado por nombre, asi que cargarla vuelve a
 * conectar esos pesos con su ejercicio.
 */
export const ROUTINE_TEMPLATE: { name: string; weekday: number; exercises: { name: string; sets: number; reps: string }[] }[] = [
  {
    name: 'Upper A', weekday: 1,
    exercises: [
      { name: 'Bench Press', sets: 3, reps: '6-8' },
      { name: 'Cable Row', sets: 3, reps: '8-10' },
      { name: 'OHP mancuernas', sets: 3, reps: '8-10' },
      { name: 'Lat Pulldown', sets: 3, reps: '10-12' },
      { name: 'Lateral Raise', sets: 3, reps: '12-15' },
    ],
  },
  {
    name: 'Lower A', weekday: 3,
    exercises: [
      { name: 'Leg Press', sets: 3, reps: '8-10' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
      { name: 'Leg Curl', sets: 3, reps: '10-12' },
      { name: 'Hip Thrust', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Upper B', weekday: 5,
    exercises: [
      { name: 'Lat Pulldown', sets: 3, reps: '8-10' },
      { name: 'Chest Press', sets: 3, reps: '8-10' },
      { name: 'Cable Row', sets: 3, reps: '10-12' },
      { name: 'Incline DB Curl', sets: 3, reps: '10-12' },
      { name: 'Tricep Pushdown', sets: 3, reps: '10-12' },
    ],
  },
  {
    name: 'Lower B', weekday: 6,
    exercises: [
      { name: 'Leg Press', sets: 3, reps: '10-12' },
      { name: 'Bulgarian Split Squat', sets: 3, reps: '8-10' },
      { name: 'Leg Extension', sets: 3, reps: '12-15' },
      { name: 'Cable Crunch', sets: 3, reps: '12-15' },
    ],
  },
]

export const MACRO_LABEL: Record<keyof Macros, string> = {
  prot: 'Proteina',
  carb: 'Carbo',
  grasa: 'Grasa',
}

/** kcal por gramo, para el total informativo */
export const KCAL_PER_G: Record<keyof Macros, number> = { prot: 4, carb: 4, grasa: 9 }

export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']

/** Veredicto semanal: una linea, no un parrafo. */
export const VERDICT_TEXT: Record<string, { title: string; note: string }> = {
  ok: { title: 'Cumpliendo y bajando', note: 'No cambies nada esta semana.' },
  ajustar: { title: 'Cumpliste, pero no bajaste', note: 'Toca bajar un poco el objetivo de carbo.' },
  ejecucion: { title: 'La semana no se cumplio', note: 'Primero cumplir el plan que ya tienes.' },
  regreso: { title: 'Llevas dias sin registrar', note: 'Empieza por pesarte manana. Nada mas.' },
  welcome: { title: 'Sin datos todavia', note: 'Registra unos dias y aparecen los graficos.' },
}
