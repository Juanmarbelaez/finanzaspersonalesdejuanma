# Plata de Juanma

App de finanzas personales para iPhone, inspirada en Copilot Money y construida con el Design System Fundamental.

- **Resumen:** cuánto te queda del presupuesto, con un ritmo que respeta los pagos fijos (el arriendo no cuenta como "ir rápido"), lo que falta por revisar, anillos por categoría, próximos pagos y el neto del mes.
- **Movimientos:** búsqueda, filtros y carga por partes.
- **Categorías:** presupuesto por categoría, barras de 12 meses, proyección al cierre.
- **Recurrentes:** arriendo, servicios y suscripciones se registran solos cuando se cobran y quedan por revisar.
- **Flujo de caja** y **Cuentas** con patrimonio neto.
- **Importar CSV** del banco (formatos colombianos: `1.234.567,89`, `dd/mm/aaaa`, débito/crédito), con categoría sugerida y sin duplicados.
- Respaldo en JSON y exportación a CSV.

Los datos viven solo en el dispositivo (localStorage). No hay servidor ni registro.

## Instalar en el iPhone

1. Abre la URL en **Safari**.
2. Toca **Compartir** → **Agregar a pantalla de inicio**.
3. Abre desde el ícono: pantalla completa, sin barra de Safari, y funciona sin internet.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica (montos, CSV, recurrentes, ritmo)
npm run build      # genera dist/
```

Stack: React 19 + Vite + TypeScript + Zustand. Sin backend.

Las reglas de diseño (sistema, principios premium, psicología sin trampas) están en [DESIGN.md](./DESIGN.md).
