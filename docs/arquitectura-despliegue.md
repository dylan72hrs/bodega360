# Arquitectura de despliegue Bodega360

## Proposito

Bodega360 debe servir primero como sistema interno de bodega. Render queda disponible como alternativa de demostracion o despliegue temporal, pero no reemplaza el objetivo principal: operar dentro de la empresa, con datos controlados por la empresa.

## Tres caminos

### A. Prototipo HTML Local

Ubicacion: `bodega360-html-local/`

Archivos esperados:

- `index.html`
- `styles.css`
- `app.js`
- `README_LOCAL.md`

Caracteristicas:

- Sin Docker.
- Sin SQL.
- Sin backend.
- Sin dependencias de servidor.
- Usa `localStorage`.
- Usa `StorageAdapter` como capa de acceso a datos.
- Sirve para demo, validacion con bodega y pruebas de flujo.
- Puede usar fotos como rutas relativas en `assets/fotos/` o como imagen comprimida en base64 para pruebas puntuales.

Limitacion principal:

`localStorage` vive en el navegador de cada usuario. Si dos PCs abren la misma carpeta o una pagina publicada en red, cada navegador puede tener datos distintos. Por eso el prototipo HTML local no es una base compartida multiusuario.

Las fotos en base64 dentro de `localStorage` aumentan rapido el tamano del respaldo y pueden llenar el almacenamiento del navegador. En el prototipo se prioriza:

1. Ruta relativa si existe foto en `assets/fotos/`.
2. Imagen comprimida WEBP/JPEG solo para prueba local.
3. Migracion futura a carpeta central de fotos.

### B. Servidor Interno Futuro

Este es el camino principal para produccion interna.

Arquitectura recomendada:

```text
navegador usuarios -> servidor interno LAN/WiFi -> API local -> almacenamiento centralizado
```

Caracteristicas esperadas:

- Acceso desde la misma red o WiFi corporativa.
- API local administrada por TI o bodega.
- Almacenamiento centralizado.
- Carpeta central de fotos, por ejemplo `/data/fotos/CODIGO.webp`.
- La base de datos debe guardar solo la ruta de la foto, no la imagen completa.
- Usuarios reales y roles.
- Respaldos automaticos.
- Logs y auditoria centralizada.
- Operacion sin depender de Render ni de internet.
- Reportes calculados desde base central.
- Respaldos automaticos programados.
- Diagnostico ejecutable como tarea programada.
- Reportes enviados por correo si TI lo habilita en una fase futura.

Opciones futuras de almacenamiento:

1. Node.js + JSON central.
2. Node.js + SQLite.
3. Python/FastAPI + SQLite.
4. PostgreSQL local.
5. PostgreSQL con Docker cuando la empresa este lista.

### C. Render Cloud

Render es una opcion secundaria.

Sirve para:

- Demo externa.
- MVP alojado temporalmente.
- Pruebas cuando no hay servidor interno disponible.

No es el destino final si la empresa exige:

- Datos solo internos.
- Operacion sin internet.
- Infraestructura administrada por TI local.
- Control total de respaldos y acceso.

Render requiere:

- `DATABASE_URL`.
- `JWT_SECRET`.
- `ADMIN_USER`.
- `ADMIN_PASSWORD`.
- `CORS_ORIGIN`.
- `VITE_API_URL`.

## Por que localStorage no sirve como base compartida

`localStorage` es almacenamiento del navegador. No existe una base comun entre equipos. Cada usuario puede tener:

- materiales distintos,
- historial distinto,
- respaldos distintos,
- pendientes distintos,
- estado administrativo distinto.

Por eso es correcto para prototipo, pero no para uso multiusuario real.

## Como ayuda StorageAdapter

La version HTML local usa `StorageAdapter` para aislar el acceso a datos. En vez de que toda la aplicacion lea y escriba directamente en `localStorage`, la logica pasa por una capa intermedia.

Ese enfoque permite migrar gradualmente:

```text
StorageAdapterLocal -> localStorage
StorageAdapterApiFuture -> fetch('/api/materiales')
StorageAdapterApiFuture -> fetch('/api/search-logs')
StorageAdapterApiFuture -> fetch('/api/fotos/CODIGO')
```

La idea es conservar pantallas y flujos tanto como sea posible, cambiando el adaptador cuando exista una API interna.

## Recomendacion

Orden recomendado:

1. Validar con `bodega360-html-local`.
2. Cargar datos reales de bodega en piloto.
3. Medir busquedas, pendientes y calidad de datos.
4. Preparar servidor interno con API local.
5. Migrar almacenamiento desde `localStorage` hacia almacenamiento central.
6. Usar Render solo si se necesita demo externa o prueba cloud temporal.
