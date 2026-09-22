# TRUST Asesores · portal

Un solo repo / un solo deploy en Vercel (sitio estático, sin build).

| Ruta | Módulo |
|---|---|
| `/` | Inicio (tarjetas a cada módulo) |
| `/leads/index.html` | Lead Management (Berna / Álvaro) |
| `/leads/asesores.html` | Mis leads (asesores) |
| `/leads/tanhia.html?k=…` | Vista solo lectura para el desarrollador de Tanhia |
| `/cotizador/` | Cotizador |
| `/inventario/index.html` | Inventario (administración) |
| `/inventario/asesores.html` | Inventario (consulta) |

Todos los módulos comparten el diseño (crema, Poppins + Lora, logo TRUST) y un botón "← Inicio".
Datos: Supabase proyecto "Paneles" (tablas `leads`, `proyectos`, `unidades`).
