# Plata de Juanma: reglas de diseño

Cada cambio se revisa contra esta lista antes de subirlo.

## 1. El problema primero

- Para qué existe: saber en qué se va la plata y si voy bien en el mes, sin conexión con el banco.
- Lo más importante: **registrar un gasto en menos de 5 segundos** y ver **cuánto puedo gastar todavía**.
- Todo lo que no ayude a esas dos cosas va después.

## 2. Design System Fundamental

| Token | Valor | Uso |
| --- | --- | --- |
| Negro | `#000000` | Fondo principal (tema por defecto) |
| Blanco | `#FFFFFF` | Fondo alterno (tema claro) |
| Forest green | `#4CA626` | **Acento único**: botones, pestaña activa, anillos, puntos |
| Verde oscuro | `#376642` | Texto verde pequeño sobre blanco, etiquetas seleccionadas |
| Verde claro | `#A7C957` / `#D8EDDE` | Fondos suaves de acento |
| Grises | `#F5F5F5` · `#F0F0F0` · `#9A9A9A` | Superficies, bordes, texto medio |
| Cuerpo / suave | 70 % / 45 % del texto | Jerarquía de texto |

- **Solo Montserrat** (400–800), servida desde la app. **Nunca cursiva.**
- Interletrado **-0.05em** en todo. Única excepción: eyebrows (mayúsculas 9–11 px) en **+0.18em**, porque así lo define el sistema y en negativo no se leen.
- Escala: Display 800/32 · Section 700/22 · Subsection 600/14 · Body 400/13 · Caption 600/11–12 · Eyebrow 700/10.
- Espaciado 4/8/12/16/24/32/48/64.
- **Radios estilo Apple** (cambio pedido sobre el sistema original de 2–8 px): etiquetas 7 · chips 10 · botones y campos 14 · tarjetas 20 · hojas 32 · full para cápsulas. Esquinas continuas (`corner-shape: squircle`) donde el navegador lo soporte.
- Sin morado. Rojo y ámbar solo como estado funcional ("te pasaste", "cerca del límite"), siempre con texto al lado.

## 3. Principios premium

1. **Anticipar.** Valores por defecto inteligentes (hoy, última cuenta, categoría según el comercio), sugerencias y "puedes gastar $X por día".
2. **Feedback que se siente.** Cada acción tiene respuesta visible: la fila nueva entra con un destello, los números grandes suben contando y los anillos se dibujan. El toast es lo mínimo, no la meta.
3. **Saber cuándo no animar.** Escribir montos y nombres nunca espera a una animación. Se respeta `prefers-reduced-motion`.
4. **Consistencia extrema.** Una fuente, un grosor de ícono (1.75), una escala de espacios y radios. Si algo está 2 px fuera, se nota aunque nadie sepa por qué.
5. **Estados vacíos con intención.** Nunca un callejón sin salida: ilustración propia + qué hacer ahora.
6. **Errores que dicen cómo arreglarlo.** No "error", sino qué pasó y el siguiente paso.
7. **Recompensas por descubrir.** Momento "todo al día" al revisar, celebración al cerrar un mes por debajo del presupuesto.
8. **Craft invisible.** Puntos de miles al escribir, comercios colombianos que se reconocen solos, no duplicar al reimportar un extracto.
9. **Personalidad propia.** Ilustraciones con trazo grueso verde en el estilo de la marca, no genéricas.
10. **La primera versión es la línea de salida.** Antes de dar algo por terminado: ¿se puede hacer mejor?

## 4. Psicología, sin trampas

- Dar valor antes de pedir algo: sin registro, modo demo inmediato.
- No arrancar en 0 %: la configuración cuenta lo que ya viene hecho.
- Efecto IKEA: tus categorías, presupuestos, tarjetas y nombre.
- Pérdida, dicha con honestidad: "a este ritmo te pasas por $X", "tus datos solo viven en este teléfono".
- Contraste útil: el costo anual de cada suscripción junto al mensual.
- **Prohibido:** urgencia o escasez falsa, progreso inventado, botones que culpan ("lo arriesgo").

## 5. Rendimiento

- Lista de movimientos que carga por partes (120 filas y crece al hacer scroll).
- Cálculos memorizados; nada pesado en cada render.
- Funciona sin internet (service worker) y la fuente va incluida.
