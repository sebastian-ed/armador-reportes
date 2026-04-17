# Clean It · Armador de Reportes

Aplicación web estática, lista para GitHub Pages, conectada a Supabase para:

- login y creación de usuarios
- perfiles con rol `admin` o `supervisor`
- autogestión de alta de supervisores
- carga de reportes operativos
- fotos asociadas a cada reporte
- uso desde celular con opción de abrir cámara
- historial con filtros por fecha, supervisor y texto libre
- exportación de reportes a CSV y JSON
- impresión o guardado en PDF de un reporte, varios seleccionados o todo lo filtrado
- cambio de contraseña desde panel interno

## Estructura

- `index.html` → interfaz principal
- `styles.css` → diseño responsive y profesional
- `app.js` → lógica de autenticación, reportes, filtros, selección múltiple y exportación
- `supabase-config.js` → configuración del proyecto Supabase
- `schema.sql` → tablas, bucket, triggers y políticas RLS

## Implementación en Supabase

### 1) Crear proyecto

Creá un proyecto en Supabase.

### 2) Ejecutar SQL

Abrí el SQL Editor y pegá completo el contenido de `schema.sql`.

### 3) Configurar Auth

En `Authentication > Providers`, dejá Email habilitado.

En `Authentication > URL Configuration`:

- `Site URL`: la URL final de GitHub Pages
- `Redirect URLs`: agregá también la misma URL

### 4) Configurar frontend

Editá `supabase-config.js` y reemplazá:

- `REEMPLAZAR_CON_SUPABASE_URL`
- `REEMPLAZAR_CON_SUPABASE_ANON_KEY`

Con los datos de:

`Project Settings > API`

### 5) Subir a GitHub Pages

Subí estos archivos al repositorio y publicalos con GitHub Pages.

## Observaciones importantes

### Alta de usuarios

La app permite que cualquier persona cree cuenta desde la pantalla inicial. Eso sirve si querés autogestión.

Si querés un esquema más cerrado, hacé uno de estos cambios:

1. desactivar el formulario público de alta y dejar solo login
2. activar confirmación por email en Supabase
3. crear una Edge Function para que un admin dé de alta usuarios sin perder su sesión

### Rol admin

El rol se toma desde `user_metadata.role` al registrarse y se copia a `profiles`.

Si querés promover un usuario existente a admin, corré:

```sql
update public.profiles
set role = 'admin'
where email = 'tuusuario@empresa.com';
```

### Fotos

Las fotos se guardan en el bucket público `report-photos` y también quedan vinculadas al reporte en la tabla `report_photos`.

### Qué queda cubierto

- trazabilidad del reporte
- evidencia fotográfica unificada
- filtrado operativo rápido
- descarga de reportes
- salida lista para imprimir o guardar en PDF desde botones del historial
- móvil y escritorio
- panel personal para contraseña

## Uso de impresión / PDF

Desde **Reportes** ahora tenés tres caminos:

- **Imprimir / PDF** dentro de cada tarjeta → saca un reporte puntual
- **Imprimir / PDF filtrados** → toma exactamente lo que quedó visible por fechas, supervisor o búsqueda
- **Imprimir / PDF seleccionados** → toma solo los reportes tildados manualmente

La salida abre el diálogo de impresión del navegador. Ahí podés:

- imprimir en papel
- o elegir **Guardar como PDF**

Eso evita meter librerías pesadas de PDF y mantiene mejor calidad en textos largos, fotos y saltos de página.


## Recomendación de negocio

No te conviene dejar “admin” abierto en el alta pública. Es una mala práctica básica de control interno. Para producción, dejá el alta pública en `supervisor` y promové admins manualmente desde Supabase o con una Edge Function.


## Limitación técnica deliberada

Esta versión está preparada para GitHub Pages sin backend propio. Por eso:

- el alta pública de supervisores funciona directo con `auth.signUp()`
- el admin puede ver usuarios existentes, pero no crear otros usuarios desde la misma sesión sin una capa server-side

Eso no es un bug. Es una restricción real de seguridad de Supabase en frontend puro. Venderlo como “resuelto” sería humo.
