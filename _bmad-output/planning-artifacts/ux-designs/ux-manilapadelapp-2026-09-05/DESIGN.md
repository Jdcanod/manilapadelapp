---
status: final
updated: 2026-09-05
proyecto: manilapadelapp
alcance: Panel de pareja y de jugador, consultable desde cualquier punto del torneo
hereda_de: tailwind.config.ts (paleta vintage Pádel Manía) + shadcn/ui
colors:
  paper: "#F5EFE0"
  paper-soft: "#EDE5D3"
  paper-dark: "#DDD2B7"
  olive: "#5E6118"
  olive-dark: "#3F3F10"
  olive-light: "#7A7E2A"
  ochre: "#A88A4B"
  ochre-dark: "#7E663C"
  ochre-soft: "#C6A674"
  ink: "#2A2A0A"
  ink-soft: "#4A4A20"
  victoria: "#046C4E"
  derrota: "#B42318"
typography:
  display: Georgia, "Times New Roman", serif
  cuerpo: system-ui, -apple-system, "Segoe UI", sans-serif
  etiqueta: system-ui, sans-serif
  cifra: system-ui con font-variant-numeric tabular-nums
rounded:
  hoja: 20px 20px 0 0
  tarjeta: 12px
  fila: 11px
  pastilla: 999px
spacing:
  hoja-padding: 14px
  bloque-gap: 11px
  fila-padding: 9px 10px
components:
  - hoja-inferior
  - bloque-cara-a-cara
  - fila-jugador
  - fila-partido
  - vacio-debutan
  - pastilla-dato
---

# DESIGN.md — Panel de pareja y jugador

## Brand & Style

Pádel Manía ya tiene identidad: papel crema, oliva, ocre y tinta casi negra. Vintage de club, no de app deportiva. **Este documento no propone una identidad nueva** — documenta cómo esa que ya existe se aplica a una superficie que todavía no existía: una hoja que se levanta sobre el torneo.

El principio que ordena todo lo demás: **la hoja es un visitante, no un destino.** El torneo se queda detrás, atenuado pero visible. Nada en la hoja debe sugerir que se cambió de lugar — ni una barra de navegación, ni un título de página, ni un botón de cerrar que parezca "volver".

Registro: sobrio y de club. Los datos son de gente que se conoce entre sí y se va a ver en la cancha en veinte minutos.

## Colors

Todos los valores vienen de `tailwind.config.ts`. Se agregan dos que hoy están dispersos en el código como literales y aquí quedan nombrados:

| Token | Valor | Uso |
| --- | --- | --- |
| `{colors.paper}` | `#F5EFE0` | Fondo de la hoja |
| `{colors.paper-soft}` | `#EDE5D3` | Filas, tarjetas dentro de la hoja |
| `{colors.paper-dark}` | `#DDD2B7` | Agarradera de la hoja, bordes apagados |
| `{colors.olive}` | `#5E6118` | Avatares, acento estructural |
| `{colors.olive-dark}` | `#3F3F10` | Títulos display |
| `{colors.ochre-dark}` | `#7E663C` | Etiquetas de sección, chevrons, todo lo tocable |
| `{colors.ink}` | `#2A2A0A` | Texto principal |
| `{colors.ink-soft}` | `#4A4A20` | Texto secundario, fechas, metadatos |
| `{colors.victoria}` | `#046C4E` | Marcador ganado |
| `{colors.derrota}` | `#B42318` | Marcador perdido |

**Regla de color del cara a cara.** El bloque superior es el único elemento de la hoja que se colorea por resultado: fondo `victoria` al 7 % si ganaste, `derrota` al 7 % si perdiste, `{colors.paper-soft}` si nunca se enfrentaron. Es deliberado que sea el único: si todo se colorea, nada resalta, y ese bloque es la respuesta a la única pregunta que Rafael trae.

**El ocre marca lo tocable.** En esta superficie el ocre no decora: chevron ocre = se puede tocar. Se sostiene sin excepciones, porque la afordancia es precisamente lo que falta hoy.

El scrim sobre el torneo es `{colors.ink}` al 42 % — suficiente para bajar el contraste de atrás, insuficiente para tapar dónde estás.

## Typography

Se hereda la pareja que ya usa la app: Georgia para display, system-ui para el resto.

| Rol | Familia | Tamaño / peso | Dónde |
| --- | --- | --- | --- |
| Título de hoja | `{typography.display}` | 16px / 700 | Nombre de la pareja o del jugador |
| Respuesta | `{typography.display}` | 14px / 700 | «Les ganaste 1 de 1», «Es la primera vez» |
| Etiqueta de sección | `{typography.etiqueta}` | 9px / 700, `letter-spacing: .13em`, mayúsculas | «LOS JUGADORES», «SUS 2 PARTIDOS» |
| Nombre en fila | `{typography.cuerpo}` | 12px / 600 | Jugadores, rivales |
| Metadato | `{typography.cuerpo}` | 9–10px / 400 | Fechas, ranking, compañero |
| Marcador | `{typography.cifra}` | 11px / 700 | `6-1, 6-3` |

**`tabular-nums` es obligatorio** en marcadores, puestos de ranking, conteos de partidos y porcentajes. Sin eso los marcadores bailan al alinearse en columna, que es justo lo que el ojo está escaneando.

La etiqueta de sección lleva el conteo dentro: «SUS 2 PARTIDOS», no «PARTIDOS». El número por adelantado le dice a Rafael si vale la pena bajar.

## Layout & Spacing

La hoja sube desde abajo y ocupa **como máximo 88 % del alto**. El 12 % que queda no es margen: es el torneo asomándose, y es lo que sostiene la promesa de no haberse ido.

Estructura vertical fija:

```
agarradera (34×4, centrada)
encabezado  ─ atrás (solo en capa de jugador) · título · metadato
────────────────────────────────────────────────────
contenido   ─ scroll propio, gap de 11px entre bloques
```

Solo el contenido hace scroll; el encabezado se queda. En una hoja corta eso no se nota, y en una larga es lo que impide perder de vista de quién se está hablando.

Ancho: la hoja se pega a los bordes en móvil. En escritorio se centra a `max-width: 480px` y conserva la forma de hoja — el club ve lo mismo que el jugador, y así no hay dos diseños que mantener.

## Elevation & Depth

Una sola sombra en toda la superficie: `0 -8px 26px rgba(0,0,0,.24)` en la hoja, dirigida hacia arriba. Es la que la despega del torneo.

Dentro de la hoja **no hay sombras**. Los bloques se separan por fondo (`paper-soft` sobre `paper`) y borde de 1px al 13–20 % de oliva. Apilar sombras adentro haría ver la hoja como una página, que es exactamente lo que no es.

Jerarquía de planos: torneo → scrim → hoja. Tres, y ninguno más. La capa de jugador **no** abre una segunda hoja encima: reemplaza el contenido de la misma.

## Shapes

- Hoja: `{rounded.hoja}` — redondeada arriba, recta abajo. Es lo que la lee como algo que subió.
- Tarjetas y bloques: `{rounded.tarjeta}`
- Filas de jugador y de partido: `{rounded.fila}`
- Pastillas de dato y categoría: `{rounded.pastilla}`
- Avatar: círculo de 28px, iniciales sobre `{colors.olive}`

El vacío «Debutan juntos» es el único elemento con **borde punteado**. Es su seña: dice «aquí no hay nada todavía» sin necesidad de escribirlo dos veces.

## Components

Las especificaciones de comportamiento están en `EXPERIENCE.md`; aquí va solo lo visual.

### hoja-inferior
Fondo `{colors.paper}`, radio `{rounded.hoja}`, sombra hacia arriba, agarradera `{colors.paper-dark}` de 34×4 centrada. Encabezado separado por 1px de oliva al 16 %.

### bloque-cara-a-cara
Radio `{rounded.tarjeta}`, padding 11×12. Tres variantes por resultado (ver Colors). Interior: etiqueta de 9px en mayúsculas → respuesta en display de 14px → detalle de 10px en `{colors.ink-soft}`.

### fila-jugador
Alto mínimo 44px. Avatar 28px → nombre y metadato → pastilla de categoría → chevron ocre. El metadato lleva puesto de ranking y partidos: `#14 del club · 12 partidos`.

### fila-partido
Sin avatar. Rival a la izquierda, fecha debajo en 9px, marcador a la derecha en `victoria` o `derrota`. Un empate o un marcador ilegible va en `{colors.ink-soft}`, nunca en rojo.

### vacio-debutan
Centrado, borde punteado de oliva al 32 %, fondo `{colors.paper-soft}`. Titular en display de 13px, explicación en 10px a dos líneas.

### pastilla-dato
Solo en la capa de jugador. Fila de pastillas con borde: `12 partidos` · `58 % ganados` · `2 torneos`. Cifras con `tabular-nums`.

## Do's and Don'ts

**Sí**

- Dejar ver el torneo por encima de la hoja, siempre.
- Colorear únicamente el bloque de cara a cara.
- Poner el conteo dentro de la etiqueta de sección.
- Chevron ocre en todo lo que se pueda tocar, sin excepción.
- `tabular-nums` en toda cifra.

**No**

- Sombras dentro de la hoja.
- Una segunda hoja encima de la primera para el jugador.
- Barra de navegación o título de página dentro de la hoja: la delataría como página.
- Rellenar el vacío con ceros (`0 % · 0 partidos`). Es la pantalla más frecuente y así queda muerta.
- Íconos grises de 14px al 40 % de opacidad como único acceso. Es lo que hay hoy y por eso no lo usa nadie.
- Colorear de rojo un empate o un resultado que no se pudo interpretar.

---

*Documento hermano: `EXPERIENCE.md`. En conflicto con cualquier mockup, mandan estos dos.*
*Referencia visual: `.working/panel-pareja.html`.*
