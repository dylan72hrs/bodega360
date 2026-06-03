# Bodega360 - Versión Local HTML/JS

Bienvenido a la versión local de **Bodega360**, un sistema de consulta y gestión de materiales diseñado con enfoque "Buscador Interno" (tipo Google). Esta versión funciona directamente en el navegador sin backend.

---

## 🚀 Inicio Rápido

Para abrir la aplicación, tienes dos opciones:

### Opción A: Servidor Local Simple (Recomendado)
Para evitar problemas de CORS al cargar catálogos en JSON local:
1. Abre tu terminal.
2. Navega hasta esta carpeta (`bodega360-html-local`).
3. Ejecuta `python -m http.server 8000` (requiere Python).
4. Abre tu navegador y visita: `http://localhost:8000`

Si el PC corporativo no tiene Python instalado, tambien puedes abrir `index.html` con doble clic y cargar archivos manualmente desde Base Maestra. El prototipo HTML local no requiere npm, Docker, SQL ni backend.

### Opción B: Modo Offline Estricto
1. Haz doble clic en el archivo `index.html`.
   *Nota: Algunos navegadores bloquean la lectura automática de `data/catalogo-materiales.json` por seguridad en modo local. Deberás subirlo manualmente usando el botón "Seleccionar archivo" en la sección Base Maestra del admin.*

---

## 🏗️ Uso futuro en servidor interno (Arquitectura Escalable)

Actualmente, **Bodega360 HTML Local** utiliza el almacenamiento local del navegador (`localStorage`). Esto significa que los datos viven *sólo en la computadora y navegador* que se está usando.

**El objetivo a mediano plazo es alojar esto en un servidor interno accesible vía WiFi.**
Para facilitar esa transición sin tener que reescribir toda la aplicación, el código fuente en `app.js` fue diseñado con el patrón **StorageAdapter**:

*   **¿Qué es?** Es una capa intermedia de código. En vez de que las funciones guarden directamente en la memoria del navegador, le piden al `StorageAdapter` que lo haga.
*   **¿Por qué es útil?** Cuando el equipo de TI esté listo para conectar una base de datos central, **sólo** tendrán que cambiar las funciones dentro del `StorageAdapter` para que hagan llamadas (fetch/AJAX) a la nueva API. **El resto del frontend (HTML, estilos, lógica de búsqueda, renderizado, Levenshtein, etc.) quedará intacto.**

### Alternativas futuras recomendadas para TI:
1. **API Node local + JSON Central**: La ruta más fácil. Node.js lee y escribe un archivo JSON en el servidor.
2. **SQLite Local**: Un solo archivo de base de datos sin instalación pesada.
3. **PostgreSQL en servidor**: Si crece el volumen de usuarios simultáneos.
4. **Integración ERP**: Conectar el StorageAdapter directamente a los endpoints del sistema central.

---

## 🛡️ Checklist de QA / Pruebas Obligatorias

Antes de liberar esta versión a los usuarios de bodega, un administrador debe realizar estas 20 pruebas manuales:

1. [ ] **Abrir app**: Verificar que cargue con fondo blanco/azul sin errores visuales.
2. [ ] **Buscar sin base cargada**: Confirmar que aparece el aviso "No hay base de materiales".
3. [ ] **Búsqueda sin resultado**: Buscar "Tornillo Fantasma" y verificar comportamiento.
4. [ ] **Entrar Admin**: Click en "Modo Admin" (admin / admin).
5. [ ] **Agregar material manual**: Ir a 'Agregar Material', crear código "TEST-1" con algunos datos.
6. [ ] **Buscar material agregado**: Volver a inicio, buscar "TEST-1" y confirmar que aparece la etiqueta de "Coincidencia exacta".
7. [ ] **Ver detalle**: Hacer clic en "Ver Detalle" del material creado.
8. [ ] **Editar material**: En Admin > Materiales, editar "TEST-1" a "TEST-2".
9. [ ] **Historial de cambios**: Verificar en el código interno o exportando el respaldo que se guardó el cambio de código en `bodega360_change_logs`.
10. [ ] **Descargar plantilla CSV**: En Base Maestra, descargar CSV.
11. [ ] **Importar CSV**: Subir la plantilla y procesarla.
12. [ ] **Importar JSON de prueba**: Descargar la plantilla JSON y subirla.
13. [ ] **Detectar duplicados**: Intentar crear de nuevo "TEST-2" e invalidarlo.
14. [ ] **Revisar pendientes**: Ir a Pendientes, verificar que "Tornillo Fantasma" esté en la lista y las métricas no estén en cero.
15. [ ] **Crear material desde pendiente**: Hacer clic en "Crear material" al lado de "Tornillo Fantasma". Verificar que pre-llena el Nombre.
16. [ ] **Exportar respaldo**: Ir a Importar / Exportar y descargar el JSON total.
17. [ ] **Restaurar respaldo**: Usar el botón rojo para subir el JSON que acabas de descargar.
18. [ ] **Persistencia**: Recargar la página (F5) y comprobar que los datos siguen ahí.
19. [ ] **Consola limpia**: Presionar F12 y revisar la pestaña "Console" de desarrollador. No debe haber texto en rojo (errores de JS).
20. [ ] **Similitud Inteligente**: Escribir una palabra con un error ortográfico leve (ej: si existe "Bomba", buscar "Bonba"). Verificar si lo detecta como "Posible coincidencia".

---

Bodega360 - 2026

---

## Acceso admin MVP

El acceso `admin / admin` se mantiene solo para pruebas locales y validacion con bodega. No debe usarse como seguridad real en produccion interna ni cloud.

Cuando Bodega360 pase a servidor interno, el login debe cambiar a usuarios reales, variables de entorno o autenticacion corporativa como Microsoft 365.

## Modulos locales incluidos

- Buscador con historial de consultas encontradas y sin resultado.
- Alta manual de materiales desde admin.
- Base Maestra por CSV/JSON.
- Subida local de foto con preview.
- Diccionario de busqueda.
- Categorias sugeridas.
- Pendientes con estados.
- Tickets/solicitudes locales.
- Reportes y diagnostico local.
- Respaldo JSON completo.
- Reportes admin por periodo, top problemas y reporte ejecutivo HTML.
- Diagnostico admin con advertencias de respaldo/localStorage.

## Reportes y diagnostico

Los reportes son solo para Admin. El usuario normal sigue viendo solamente la consulta simple de materiales.

Uso:

1. Entrar a `Modo Admin`.
2. Abrir `Reportes`.
3. Seleccionar periodo.
4. Revisar tarjetas, graficos simples y Top 10 Problemas.
5. Exportar reporte ejecutivo o CSV si se necesita presentar avance.

El reporte ejecutivo estima tiempo ahorrado con:

`busquedas con resultado x minutosAhorroPorConsulta`

Por defecto se usan 2 minutos por consulta. Si no hay historial suficiente, las metricas quedan en cero y no se inventan datos.

La pestana `Diagnostico` permite revisar estado local, tamano de `localStorage`, ultimo respaldo y advertencias. Si hay mas de 50 cambios desde el ultimo respaldo o mas de 7 dias sin respaldo, muestra un aviso para exportar respaldo.

Detalle tecnico en `docs/reportes-y-diagnostico.md`.

## Fotos opcionales por codigo

Las fotos no son obligatorias. La busqueda y la ficha funcionan aunque ningun material tenga imagen.

Convencion recomendada para fotos locales:

- Crear archivos dentro de `assets/fotos/`.
- Usar el codigo del material como nombre.
- Formatos recomendados: `.webp`, `.jpg`, `.png`.

Ejemplo:

Codigo: `001-ABC/20`

La app intentara buscar, sin bloquear nada:

- `assets/fotos/001-ABC/20.webp`
- `assets/fotos/001-ABC/20.jpg`
- `assets/fotos/001-ABC/20.png`
- `assets/fotos/001-ABC-20.webp`
- `assets/fotos/001-ABC-20.jpg`
- `assets/fotos/001-ABC-20.png`

Si no existe imagen, se muestra `Sin foto`. Esto no es error critico ni impide guardar, importar o consultar.

En admin se puede ingresar una ruta manual en `Foto Principal`, por ejemplo `assets/fotos/MD-001.webp`, o subir/tomar una foto desde tablet. Cuando se sube una imagen, la app intenta comprimirla a WEBP con lado mayor maximo de 1280px; si el navegador no soporta WEBP, usa JPEG comprimido.

Advertencia: guardar fotos como base64 dentro de `localStorage` es solo para prototipo. Muchas fotos pueden llenar el almacenamiento del navegador. Para uso real en servidor interno, las fotos deben vivir en una carpeta central, por ejemplo `/data/fotos/CODIGO.webp`, y la base solo debe guardar la ruta.

## Modo Inventario opcional

El Modo Inventario esta solo en admin y no reemplaza la consulta normal. Sirve para tablet durante inventario:

- buscar codigo/material,
- revisar ficha rapida,
- confirmar ubicacion,
- actualizar stock,
- tomar/subir foto opcional,
- marcar validado,
- guardar y pasar al siguiente.

Ninguno de esos pasos obliga a cargar foto.
