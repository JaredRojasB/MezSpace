# MezSpace — Sistema de Reserva de Escritorios

**Meztal** | Gestión de escritorios compartidos

---

## Estructura de archivos

```
mezspace/
├── index.html        ← Vista empleados (página principal)
├── admin.html        ← Panel de administración (protegido por PIN)
├── assets/
│   ├── style.css     ← Estilos globales
│   └── app.js        ← Lógica de la aplicación
└── README.md
```

## Subir a GitHub Pages

1. Crea un repositorio en GitHub (puede ser público o privado con GitHub Pro)
2. Sube todos los archivos al repositorio
3. Ve a **Settings → Pages → Source**: selecciona `main` branch y carpeta `/root`
4. Tu sitio estará disponible en `https://[tu-usuario].github.io/[nombre-repo]/`

## Acceso

| Vista | URL | Acceso |
|-------|-----|--------|
| Empleados | `/index.html` | Libre — solo nombre y correo |
| Administración | `/admin.html` | PIN: `meztal2024` |

## Cambiar el PIN de administrador

Abre `assets/app.js` y modifica la primera línea:

```js
const ADMIN_PIN = 'meztal2024';  // ← cambia aquí
```

## Regla de reservas por semana

- Los empleados pueden reservar escritorios de la **semana actual** en cualquier momento
- La **siguiente semana** se desbloquea el **sábado por la noche**
- Esto permite que los empleados planeen su asistencia durante el fin de semana

## Escritorios disponibles (55 en total)

| Sección | Escritorios | ID ejemplo |
|---------|------------|-----------|
| Meztal Teams 1 | 15 (5×3) | `MT1-1A` … `MT1-3E` |
| Meztal Teams 2 | 15 (5×3) | `MT2-1A` … `MT2-3E` |
| Watermark 1    | 12 (4×3) | `WM1-1A` … `WM1-3D` |
| Watermark 2    | 12 (4×3) | `WM2-1A` … `WM2-3D` |
| NE             |  1       | `NE-1A`             |

El área administrativa (Meztal HQ) aparece en el plano pero **no es reservable**.

## Almacenamiento

Los datos se guardan en `localStorage` del navegador. Son **por dispositivo/navegador**.

Para un sistema multi-dispositivo compartido en la nube, el siguiente paso sería integrar [Supabase](https://supabase.com) (gratuito) o un backend PHP+MySQL.

---

*MezSpace v1.0 · Meztal 2025*
