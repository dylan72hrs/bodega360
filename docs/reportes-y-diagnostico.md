# Reportes y diagnostico Bodega360

## Proposito

Los reportes son una herramienta de control y presentacion para administracion. No son la funcion principal de bodega y no aparecen para usuarios normales.

Sirven para demostrar valor con datos reales:

- busquedas atendidas,
- busquedas sin resultado,
- calidad de Base Maestra,
- materiales criticos,
- tickets,
- respaldo y salud del prototipo local.

## Como abrir reportes

1. Abrir `bodega360-html-local/index.html`.
2. Entrar a `Modo Admin` con `admin/admin`.
3. Ir a la pestana `Reportes`.

## Periodos

El panel permite seleccionar:

- Hoy.
- Ultimos 7 dias.
- Ultimos 30 dias.
- Mes actual.
- Rango personalizado.

Si no hay datos suficientes, el panel muestra cero o un mensaje simple, sin errores tecnicos.

## Metricas principales

El dashboard calcula desde `StorageAdapter` y `localStorage`:

- total de busquedas,
- busquedas con resultado,
- busquedas sin resultado,
- porcentaje de exito,
- materiales cargados,
- materiales validados,
- materiales sin foto,
- materiales sin ubicacion,
- materiales sin costo promedio,
- materiales con costo vencido,
- materiales criticos sin stock,
- tickets abiertos/resueltos,
- cambios/importaciones,
- calidad promedio del catalogo,
- tiempo estimado ahorrado.

El tiempo ahorrado usa la configuracion `minutosAhorroPorConsulta`, por defecto 2 minutos.

## Exportaciones

Desde Reportes se puede exportar:

- reporte ejecutivo HTML imprimible,
- busquedas del periodo CSV,
- top busquedas sin resultado CSV,
- materiales con datos incompletos CSV,
- materiales criticos sin stock CSV,
- tickets CSV.

Los CSV escapan valores que empiezan con `=`, `+`, `-` o `@` para reducir riesgo de CSV injection.

## Diagnostico

La pestana `Diagnostico` muestra:

- version local,
- estado de `StorageAdapter`,
- volumen de materiales, busquedas, tickets, cambios e importaciones,
- tamano aproximado de `localStorage`,
- ultimo respaldo,
- cambios desde ultimo respaldo,
- recursos externos detectados,
- fotos base64 locales,
- advertencias.

Tambien permite exportar diagnostico JSON o CSV.

## Respaldos

Si hay mas de 50 cambios desde el ultimo respaldo o mas de 7 dias sin respaldo, el admin vera:

`Se recomienda exportar respaldo.`

El aviso no bloquea el uso de la app.

## Servidor interno futuro

En un servidor interno futuro:

- los reportes deberian calcularse desde una base central,
- los respaldos podrian automatizarse,
- los reportes podrian enviarse por correo,
- el diagnostico podria ejecutarse programado,
- `StorageAdapter` permite migrar calculos a API sin rehacer la interfaz.

No se implementa envio automatico de correos en esta fase.
