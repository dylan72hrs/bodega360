# Bodega360 v1

## Alcance

Bodega360 es una plataforma web interna para consultar y administrar informacion de bodega: codigos, nombres, descripciones, fotos, ubicaciones, stock y costo promedio de materiales.

La primera etapa prioriza una busqueda rapida tipo "Google interno de bodega", ficha visual de material, carga de fotos durante inventario y administracion controlada por roles.

## Modulos

- Login.
- Buscador.
- Ficha de material.
- Panel encargado bodega.
- Importador Excel.
- Subida de fotos.
- Panel de pendientes.
- Historial de cambios.
- Historial de busquedas con y sin resultado.
- Exportacion de respaldo.
- Administracion de usuarios.

## Roles

- `ADMIN`: usuarios, roles, importacion, exportacion, historial y administracion completa.
- `WAREHOUSE`: crea, edita, sube fotos, valida y corrige materiales.
- `VIEWER`: busca, visualiza ficha y reporta errores.

## Modelo principal

`Material`

- codigo
- codigo alternativo
- nombre
- descripcion
- categoria
- marca
- modelo
- unidad de medida
- stock
- costo promedio
- moneda
- ubicacion
- estado
- foto principal
- validado
- fecha de ultima actualizacion

`IntegrationOutbox` queda separado para preparar integraciones futuras con ERP sin mezclar datos operativos con sincronizaciones externas.

## Endpoints principales

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/materials?search=...`
- `POST /api/materials`
- `PUT /api/materials/:id`
- `POST /api/materials/:id/photo`
- `POST /api/materials/:id/report-error`
- `POST /api/import/materials`
- `GET /api/export/materials.xlsx`
- `GET /api/audit`
- `GET /api/search-logs`
- `GET /api/users`
- `POST /api/users`

## Criterios Fase 2

- Toda busqueda no vacia queda registrada con cantidad de resultados.
- Las busquedas sin resultado tambien quedan registradas.
- Nombre y RUT del consultante son opcionales y no bloquean la consulta.
- Admin y encargado pueden crear un codigo real desde el panel de bodega.
- El codigo creado queda disponible inmediatamente para buscar por codigo, nombre, descripcion, categoria o ubicacion.

La credencial local `admin/admin` queda solo para desarrollo. Produccion debe usar contrasena configurada por ambiente, usuarios reales o Microsoft 365.

## Formato Excel sugerido

La primera hoja del archivo debe contener encabezados compatibles con:

- codigo
- codigo alternativo
- nombre
- descripcion
- categoria
- marca
- modelo
- unidad
- stock
- costo promedio
- moneda
- ubicacion
- estado
- validado

El importador acepta estados `activo`, `inactivo`, `obsoleto` y valores de validacion como `SI`, `NO`, `true`, `false`, `1` o `0`.
