# Checklist de no regresion Bodega360

Usar este checklist antes de entregar cambios o mover el proyecto entre ambientes.

## HTML local

- [ ] Abrir `bodega360-html-local/index.html`.
- [ ] Confirmar que carga la pantalla principal.
- [ ] Probar busqueda con base vacia.
- [ ] Probar busqueda con un material cargado.
- [ ] Entrar a Modo Admin con `admin/admin`.
- [ ] Probar Base Maestra.
- [ ] Probar importacion de datos.
- [ ] Probar exportacion de respaldo JSON.
- [ ] Probar restauracion de respaldo JSON con un archivo de prueba.
- [ ] Probar historial de busquedas.
- [ ] Probar pendientes.
- [ ] Probar que una busqueda con resultado queda registrada.
- [ ] Probar que una busqueda sin resultado queda registrada.
- [ ] Probar que Nombre/RUT de consultante es opcional y no bloquea la busqueda.
- [ ] Probar crear un codigo real desde admin y buscarlo luego en modo normal.
- [ ] Probar diccionario de busqueda.
- [ ] Probar categorias.
- [ ] Probar tickets/solicitudes.
- [ ] Abrir Reportes desde admin.
- [ ] Probar cambio de periodo en Reportes.
- [ ] Probar metricas sin datos y confirmar que no hay errores.
- [ ] Generar busquedas con y sin resultado y confirmar graficos actualizados.
- [ ] Revisar Top 10 Problemas.
- [ ] Exportar reporte ejecutivo HTML.
- [ ] Exportar CSV de busquedas sin resultado.
- [ ] Abrir Diagnostico.
- [ ] Exportar diagnostico JSON.
- [ ] Verificar recordatorio de respaldo cuando corresponda.
- [ ] Confirmar que usuario normal no ve Reportes ni Diagnostico.
- [ ] Probar subida de foto desde archivo local o tablet.
- [ ] Probar material sin foto y confirmar placeholder `Sin foto`.
- [ ] Confirmar que material sin foto no bloquea busqueda, guardado ni importacion.
- [ ] Probar ruta relativa de foto en `assets/fotos/CODIGO.webp`.
- [ ] Probar compresion WEBP o fallback JPEG al subir/tomar foto.
- [ ] Confirmar advertencia antes de guardar imagen pesada/base64.
- [ ] Entrar a Modo Inventario.
- [ ] Buscar material en Modo Inventario.
- [ ] Marcar validado sin subir foto.
- [ ] Guardar ubicacion/stock desde Modo Inventario.
- [ ] Confirmar que `StorageAdapter` sigue usando localStorage.
- [ ] Recargar la pagina y confirmar persistencia en localStorage.
- [ ] Revisar consola del navegador y confirmar que no hay errores JavaScript.

## Version API/Web

- [ ] Ejecutar `npm run dev`.
- [ ] Confirmar que la API responde en `/health`.
- [ ] Confirmar que la web abre en Vite.
- [ ] Probar login local.
- [ ] Crear un material desde admin/bodega.
- [ ] Buscar el material creado.
- [ ] Confirmar que la busqueda queda en historial.

## Comandos de calidad

- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npx prisma validate`.

## Secrets y variables

- [ ] Confirmar que `.env` esta en `.gitignore`.
- [ ] Confirmar que `.env.example` solo contiene placeholders.
- [ ] Confirmar que `render.yaml` no contiene secretos reales.
- [ ] Confirmar que `ADMIN_PASSWORD`, `JWT_SECRET` y `DATABASE_URL` vienen desde variables en produccion.

## Despliegue

- [ ] Confirmar que Render sigue documentado como opcion secundaria.
- [ ] Confirmar que servidor interno LAN/WiFi sigue documentado como camino principal.
- [ ] Confirmar que el prototipo HTML local no fue eliminado ni reemplazado.
