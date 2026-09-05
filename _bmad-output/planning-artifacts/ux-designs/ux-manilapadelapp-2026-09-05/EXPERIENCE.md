---
status: final
updated: 2026-09-05
proyecto: manilapadelapp
alcance: Panel de pareja y de jugador, consultable desde cualquier punto del torneo
identidad_visual: DESIGN.md
---

# EXPERIENCE.md — Panel de pareja y jugador

## Foundation

**Forma.** Web responsiva instalable (PWA). Móvil primero, sin discusión: el escenario que manda es Rafael en el club, de pie, con una mano. El club usa lo mismo en computador; **no hay dos diseños**, solo un ancho máximo distinto.

**Sistema de UI.** shadcn/ui sobre Radix y Tailwind, ya instalado. La hoja se construye sobre `Dialog` de Radix (el proyecto no tiene `Sheet` ni `Drawer`) con estilos de hoja inferior. Radix ya resuelve foco atrapado, cierre con `Escape` y `aria-modal`; heredarlo es más seguro que escribirlo.

**Identidad visual.** `DESIGN.md`. Este documento no repite colores ni tamaños; los referencia como `{colors.ochre-dark}`.

**Realidad de los datos, que condiciona todo el diseño** (producción, 5 sep 2026):

| Hecho | Cifra |
| --- | --- |
| Partidos por pareja | mediana **2**, máximo 8 |
| Partidos por jugador | mediana **2**, máximo 14 |
| Parejas con más de un torneo | **15 de 195** |
| Parejas sin ningún partido | **3 de 5** en la 6ta de la liga vigente |
| Duplas duplicadas | **0** — `pareja.id` es identidad estable entre torneos |
| Clubes con torneos | **1** |

De ahí sale la regla que gobierna el resto: **el vacío es el estado primario, no el borde.** Cualquier diseño que asuma volumen de historial falla en la mayoría de las aperturas.

## Information Architecture

El panel no es una pantalla nueva en el mapa: es una capa sobre las que ya existen.

```
Torneo (grupos · llaves · cronograma · Copa Davis · resultados)
   │  toque sobre una pareja
   ▼
[hoja] Pareja
   │  toque sobre un jugador
   ▼
[hoja] Jugador          ← aquí se detiene
```

**Puertas de entrada.** Toda pareja visible es tocable, en las cinco superficies:

| Superficie | Componente | Hoy |
| --- | --- | --- |
| Grupos (jugador) | `PlayerTournamentGroups.tsx` | sin ningún gesto |
| Grupos (club) | `TournamentGroupsManager.tsx` | ícono de 14px, solo en liguilla |
| Llaves | `PlayerBracketManager` · `TournamentBracketManager` | nada |
| Cronograma | `TournamentChronogram` | nada |
| Copa Davis | `CopaDavisManager` | nada |
| Resultados | `TournamentResultsManager` · `GrupoMatchesList` | nada |

**Cierre de superficies.** Las tres preguntas de Rafael (¿ya jugamos contra ellos? · ¿quiénes son? · ¿qué han jugado?) se responden las tres en la capa de pareja. La cuarta (¿qué tan bueno es este tipo?) se responde en la capa de jugador. No queda ninguna pregunta declarada sin superficie, ni ninguna superficie sin pregunta.

**Direccionamiento.** El panel abierto tiene URL propia (`?pareja=<id>` y `?jugador=<id>` sobre la ruta del torneo). De eso se derivan tres requisitos, no tres opcionales:

1. El botón «atrás» de Android cierra el panel; **nunca** saca del torneo.
2. La URL se puede compartir por WhatsApp y abre el panel directamente.
3. El club puede pegar ese enlace al resolver un reclamo.

Abrir una URL de panel sin sesión lleva al login y, después de entrar, al panel — no a la portada.

**Fuera de alcance.** No hay vista pública ni anónima. Quien no tiene cuenta no ve nada: el club le responde mirando su propia pantalla.

## Voice and Tone

El panel **responde**, no reporta. La diferencia es toda la experiencia:

| No así | Así |
| --- | --- |
| «Historial: 1V - 0D» | «Les ganaste 1 de 1» |
| «Sin registros» | «Es la primera vez» |
| «0 partidos como pareja» | «Debutan juntos» |
| «Enfrentamientos directos» | «Ya se enfrentaron» |

Reglas:

- Se tutea. Es un club, la gente se conoce.
- El titular de cada bloque es una frase completa, no una etiqueta con dos puntos.
- Nunca se dice «el usuario» ni «la pareja seleccionada».
- El vacío explica **por qué** no hay nada y **hacia dónde** ir: «Es su primer torneo como pareja. Cada uno trae lo suyo — tócalos arriba.»
- Los conteos van en la etiqueta de sección, no en una línea aparte: «SUS 2 PARTIDOS».

## Component Patterns

Especificación visual en `DESIGN.md`; aquí el comportamiento.

### Pareja tocable
Envuelve el nombre de una pareja en cualquiera de las cinco superficies. Área táctil mínima **44×44**. Chevron `{colors.ochre-dark}` obligatorio — sin él la función es invisible, que es su falla actual. Si la pareja es un TBD o un bye (36 filas de `parejas` tienen un jugador nulo), **no** es tocable y no lleva chevron.

### Hoja
Abre desde abajo. El torneo queda detrás con scrim. Se cierra por: arrastrar hacia abajo, tocar el scrim, `Escape`, o «atrás» del sistema. **No lleva botón de cerrar en el encabezado**: ese espacio es del «atrás» de la capa de jugador, y dos controles parecidos en el mismo sitio confunden.

### Capa de jugador
Reemplaza el contenido de la misma hoja; no abre una segunda. El encabezado gana una línea «‹ Cristian / Carlos» que devuelve a la pareja. La hoja **no** cambia de alto al cambiar de capa — un salto ahí se siente como que se abrió otra cosa.

### Bloque de cara a cara
Primero, siempre. Compara la pareja mirada contra la pareja de quien mira **en ese torneo**. Se oculta por completo cuando quien mira no es jugador inscrito en ese torneo (club, o jugador que solo observa). No se reemplaza por nada: el panel simplemente arranca en «Los jugadores».

### Fila de jugador
Tocable, lleva a la capa de jugador. Muestra puesto en el ranking del club y total de partidos. En la capa de jugador, la lista «Con quién ha jugado» usa la misma fila **pero sin chevron y sin toque**: la navegación se detiene aquí.

### Fila de partido
No es tocable. Rival, fecha, marcador. En la capa de jugador agrega «· con Carlos», porque un jugador cambia de compañero y sin eso el marcador no se puede interpretar.

## State Patterns

Los estados vacíos son el corazón de este diseño, no su apéndice.

| Estado | Cuándo | Qué muestra |
| --- | --- | --- |
| **Pareja sin partidos** | El caso más frecuente | «Debutan juntos» + empuje a los jugadores |
| **Nunca se enfrentaron** | Común | «Es la primera vez» + «Los dos en 6ta, así que van parejos» |
| **Jugador sin partidos** | Recién registrado | «Todavía no ha jugado aquí» + categoría y club |
| **Ambos vacíos** | Pareja nueva de jugadores nuevos | Categoría y ranking, y nada más. Sin disculpas ni ilustración |
| **Cargando** | Siempre | Esqueleto con la forma final: encabezado, un bloque, dos filas. Nunca un spinner centrado |
| **Error** | Falla la consulta | «No se pudo cargar el historial» + reintentar. La hoja **no** se cierra sola |
| **Sin sesión** | URL compartida a alguien deslogueado | Login, y después el panel — no la portada |
| **Marcador ilegible** | Resultado que no se puede interpretar | Se muestra el texto crudo en `{colors.ink-soft}` y no cuenta para el win rate |

Ninguna sección vacía se oculta en silencio si el usuario podría esperarla. «Como pareja» aparece siempre, aunque sea para decir que debutan.

## Interaction Primitives

- **Abrir**: un toque en la fila de la pareja. Sin toque largo, sin menú contextual.
- **Cerrar**: arrastrar abajo · tocar el scrim · `Escape` · «atrás» del sistema.
- **Volver a la pareja**: «‹ Nombre de la pareja» en el encabezado, o «atrás» del sistema.
- **Transición**: 200 ms al subir, 150 ms al bajar. Bajo `prefers-reduced-motion`, aparece y desaparece sin deslizamiento.
- **Scroll**: solo el contenido. El encabezado queda fijo.
- **Cambio de capa**: fundido corto del contenido, sin mover la hoja.
- **Al abrir**, el foco va al título de la hoja, no al primer elemento tocable — así el lector de pantalla anuncia de quién se está hablando antes de ofrecer acciones.

## Accessibility Floor

- Área táctil de **44×44** en toda fila tocable.
- La hoja es `role="dialog"` con `aria-modal="true"` y `aria-labelledby` al título. Radix lo da hecho.
- Foco atrapado dentro de la hoja mientras esté abierta; al cerrar, vuelve **a la fila que se tocó**, no al principio de la tabla.
- El chevron es decorativo (`aria-hidden`); lo que se anuncia es el nombre de la pareja y su rol de botón.
- **El color nunca es el único portador de significado.** El marcador verde o rojo va acompañado del texto del bloque de cara a cara («Les ganaste», «Te ganaron»); un daltónico rojo-verde debe poder responder su pregunta sin distinguir los dos colores.
- Contraste mínimo AA: los metadatos de 9px van en `{colors.ink-soft}` sobre `{colors.paper-soft}`, verificado. No bajar la opacidad de ese texto.
- Se respeta `prefers-reduced-motion`.
- Todo lo tocable se alcanza por teclado y muestra foco visible — el club trabaja en computador.

## Key Flows

### Rafael pregunta antes de entrar a cancha

Rafael Sabogal, 6ta, juega en veinte minutos y está sentado en la banca del club con el celular en una mano.

1. Abre LIGA PÁDEL DEL RÍO 2026-II y cae en su grupo. Su pareja está marcada «TÚ».
2. Ve el chevron en las otras tres filas y entiende, sin que nadie le explique, que se pueden tocar.
3. Toca «Cristian / Carlos». La hoja sube; el grupo se queda asomado arriba.
4. **El clímax:** lo primero que lee, antes que cualquier estadística, es **«Les ganaste 1 de 1 — 6-1, 6-3 · 4 jul»**. Ya tiene lo que vino a buscar y no pasaron tres segundos.
5. Con curiosidad, toca a Cristian. La hoja cambia de contenido: 12 partidos, 58 % ganados, y que él y Rafael se han cruzado dos veces con 1-1.
6. Toca «‹ Cristian / Carlos» y vuelve. Arrastra la hoja hacia abajo. Está otra vez en su grupo, en la misma fila donde iba.

Nunca salió del torneo. Nunca vio una pantalla de carga completa.

### Ana resuelve un reclamo

Ana atiende el club desde el computador. Un jugador reclama que en la liga pasada jugó más partidos de los que le contaron.

1. Abre el torneo y va a la tabla de la categoría.
2. Toca la pareja del que reclama. Se abre el mismo panel de Rafael, sin el bloque de cara a cara — Ana no juega.
3. Ve «SUS 6 PARTIDOS» con fechas y rivales, y toca al jugador para ver los que jugó con otro compañero.
4. Copia la URL y se la manda por WhatsApp. El jugador abre el enlace, entra con su cuenta y ve exactamente el mismo panel.

Si quien pregunta no tiene cuenta, Ana le responde de viva voz leyendo su pantalla. No existe enlace público.

### Rafael abre una pareja que debuta

1. Toca «Daniel / Arturo», los últimos del grupo.
2. La hoja dice **«Es la primera vez»** — nunca se enfrentaron.
3. Abajo, donde esperaba el historial, lee **«Debutan juntos»** y que cada uno trae lo suyo.
4. Toca a Daniel Escobar: 24 partidos, #9 del club. La pareja es nueva; el jugador no.

El panel no tenía nada que mostrar como pareja y aun así respondió. Esta es la prueba de fuego del diseño, porque es la apertura más frecuente.

## Responsive & Platform

- **Móvil** (superficie principal): hoja pegada a los bordes, hasta 88 % del alto.
- **Escritorio** (club): misma hoja, centrada, `max-width: 480px`. No se convierte en modal centrado ni en panel lateral — un solo comportamiento que mantener.
- **Android**: «atrás» cierra el panel. Requisito duro; sin esto la función se siente rota desde el primer uso.
- **iOS PWA**: respetar `safe-area-inset-bottom` para que la última fila no quede bajo la barra de gestos.
- **Sin conexión**: la hoja no abre en blanco. Si no hay datos, muestra el error con reintentar.

## Notas de implementación

Consecuencias técnicas de las decisiones, para quien construya:

- **`pareja.id` sirve como identidad entre torneos.** Verificado: 319 duplas, cero duplicadas. No hay que emparejar por jugadores.
- **El cara a cara necesita saber la pareja de quien mira** en ese torneo. Si no la tiene, el bloque no se renderiza; no es un error.
- **La lógica ya existe** en `src/app/(dashboard)/club/torneos/[id]/pareja/[parejaId]/page.tsx` y en `src/components/ParejaHistorial.tsx`. Hay que sacarla de la guardia `rol === 'admin_club'` y exponerla en modo lectura para jugador, no reescribirla.
- **Ojo con el caché de Next.** El cliente de Supabase ya va con `cache: 'no-store'` (`src/utils/supabase/server.ts`); no reintroducir lecturas cacheadas en las consultas del panel.
- **Parejas con jugador nulo** (36 filas hoy) son byes o TBD: no tocables.
- **Un solo club tiene torneos.** El alcance «todos los torneos del club» es hoy equivalente a «todos los torneos». Cuando entre un segundo club habrá que decidir si el historial cruza clubes; queda anotado, no resuelto.

---

*Documento hermano: `DESIGN.md`. En conflicto con cualquier mockup, mandan estos dos.*
*Referencia visual: `.working/panel-pareja.html` — cuatro estados con datos reales.*
