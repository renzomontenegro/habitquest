# Plan de alimentacion

Documento vivo con el perfil, las reglas y el plan del usuario. Lo lee cualquier
sesion futura antes de tocar comidas, rutina u objetivos.

## Perfil

- Sexo / edad: M, 24
- Peso actual: 112 kg · Altura: 174 cm
- Entrenamiento: fuerza 4x/semana (Upper/Lower A/B)

## Objetivo

- Bajar grasa hasta **90 kg para el 1 de diciembre de 2026** (22 kg en ~16 semanas).
- Ritmo requerido: ~1.3 kg/semana. Es un deficit agresivo; lo sostenible es
  ~1 kg/semana. Se empieza fuerte y se vigila con la tendencia de peso de la app.

## Reglas alimentarias (las que pidio el usuario)

- **Como de todo**, pero solo entra al plan lo que se pueda **mealpreppear**.
- **Evitar lo que le genera gases**: brocoli, frejol (frijoles) y similares.
- Comida **casera y rapida**: freir un filete + arroz no debe tomar mas de 20 min.
- Tiene **proteina en polvo y creatina** disponibles.
- Las comidas de la mami (arroz con pollo verde, arroz con panceta) son las bases
  de almuerzo y cena; se guia por la **proporcion** de cada plato y completa con
  palta, ensalada o lo que falte para cuadrar el dia.

## Numeros del plan

Calculo con Mifflin-St Jeor + factor 1.5 (4x fuerza):

- BMR ≈ 2090 kcal · TDEE ≈ **3100 kcal**
- Objetivo diario ≈ **2115 kcal** (deficit ~1000 kcal)
- **Targets: proteina 185 g · carbo 175 g · grasa 75 g**

Reparto por comida (slotShare de la app): desayuno 20%, almuerzo 42%, cena 38%, extra 10%.

| Comida | P | C | G | kcal |
|---|---|---|---|---|
| Desayuno | 37 | 35 | 15 | 425 |
| Almuerzo | 78 | 74 | 32 | 900 |
| Cena | 70 | 66 | 28 | 800 |
| Extras | 19 | 18 | 8 | 220 |

> Estos refs los precarga la app sola al crear opciones nuevas. No hay que
> escribirlos a mano.

## Opciones del plan (por porcion normal)

Las proporciones van en el nombre: una porcion en la app = "1" en el selector.
Si tu plato real pesa distinto, ajusta los gramos del nombre y los macros en
Editar.

### Desayuno
| Nombre | P | C | G | kcal |
|---|---|---|---|---|
| Avena 80g + proteina 1 scoop | 34 | 57 | 8 | 445 |

### Almuerzo
| Nombre | P | C | G | kcal |
|---|---|---|---|---|
| Arroz verde 150g + pollo 200g | 48 | 42 | 15 | 495 |

### Cena
| Nombre | P | C | G | kcal |
|---|---|---|---|---|
| Arroz 100g + panceta 150g | 39 | 28 | 63 | 890 |

### Extras
| Nombre | P | C | G | kcal |
|---|---|---|---|---|
| Proteina en polvo 1 scoop | 25 | 4 | 2 | 135 |

### Notas
- Los macros son **estimados** segun la proporcion del nombre; al registrar los
  primeros dias se afinan en Editar si el dia no cierra.
- La panceta es muy grasa (~890 kcal la porcion): max 1-2x/semana mientras bajas.
- El arroz verde varia en grasa por el aceite del guiso: si la app lo marca alto,
  bajar G y sumar la palta por separado.
- La creatina no tiene macros: no se registra como comida, solo se toma (5 g/dia).

## Como cierra un dia tipico

Desayuno avena + proteina (P34 C57 G8) · almuerzo arroz verde + pollo
(P48 C42 G15) · cena arroz + panceta (P39 C28 G63) · extra proteina (P25 C4 G2)
→ **P146 C131 G88 ≈ 1900 kcal**.

Queda corto de proteina (~40 g) y algo bajo de kcal. Para cerrar:
- Subir el main de almuerzo a porcion **1.5** (arroz verde + pollo suma
  P72 C63 G23) o
- Los dias sin panceta, cambiar la cena por pollo a la plancha + arroz
  (P45 C50 G14) y cerrar la proteina con el extra.

> La regla del producto: un dia bajo se compensa con uno alto. Lo que decide es
> el acumulado semanal, no el dia exacto.

## Rutina actual (Upper/Lower 4 dias)

- **Lunes — Upper A** (enfasis empuje): Bench Press 3×6-8, Cable Row 3×8-10,
  OHP mancuernas 3×8-10, Lat Pulldown 3×10-12, Lateral Raise 3×12-15
- **Miercoles — Lower A**: Leg Press 3×8-10, Romanian Deadlift 3×8-10,
  Leg Curl 3×10-12, Hip Thrust 3×10-12
- **Viernes — Upper B** (enfasis jalon): Lat Pulldown 3×8-10, Chest Press 3×8-10,
  Cable Row 3×10-12, Incline DB Curl 3×10-12, Tricep Pushdown 3×10-12
- **Sabado — Lower B**: Leg Press 3×10-12, Bulgarian Split Squat 3×8-10,
  Leg Extension 3×12-15, Cable Crunch 3×12-15

Se carga en la app con "Mi plan → Entrenamiento → Cargar rutina Upper/Lower".
Los ejercicios usan el nombre como id, asi el historial de series sigue conectado.

## Como se ajusta (para futuras sesiones)

1. **Si no baja**: la app lo dice con el veredicto "Cumpliste, pero no bajaste".
   Bajar carbo ~10-15 g (mantener proteina).
2. **Si baja demasiado rapido** (>1.5 kg/sem): subir carbo para no perder fuerza.
3. **Si no llega a proteina**: la proteina en polvo en extras es el relleno;
   nunca bajar proteina primero.
4. **Cambiar comidas**: siempre respetando las reglas de arriba (mealprep, sin
   brocoli/frejol, <20 min). Las opciones viven en el estado de la app
   (Mi plan), no en el codigo.
