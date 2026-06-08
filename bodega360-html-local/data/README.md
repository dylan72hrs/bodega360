# Bodega360 JSON Modelo v1

Generado desde: `CODIGOS HOMOLOGADOS-CL-JFredes-31(2).xlsx`
Fecha generación: `2026-06-08T13:06:20`

## Uso recomendado

La web debe leer primero:

1. `data/manifest.json`
2. `data/index/search-index.json`
3. `data/normalized/materiales.json`

Los archivos `data/raw-sheets/*.json` son respaldo fiel por hoja del Excel. No son el modelo principal de búsqueda.

## Archivos principales

- `bodega360-db-master.json`: versión combinada para pruebas rápidas.
- `data/normalized/materiales.json`: catálogo enriquecido por código.
- `data/normalized/stock.json`: fuentes de stock parcial detectadas.
- `data/normalized/compras.json`: compras nacionales/extranjeras.
- `data/normalized/pendientes.json`: registros de S-A PEND ENTREGA.
- `data/index/search-index.json`: índice liviano para búsqueda tipo Google.
- `data/validation-report.json`: conteos, advertencias y duplicados.

## Advertencia técnica

`stock.actual` es stock detectado desde hojas parciales, no inventario global validado. 
Para inventario oficial completo se debe integrar AX/ERP o una hoja oficial de stock.

## Estadísticas

```json
{
  "sheetsDetected": 18,
  "rawRowsWithData": 17701,
  "rawCellsWithData": 258434,
  "materialsNormalized": 4547,
  "stockRecords": 229,
  "purchaseRecords": 3318,
  "pendingRecords": 7720,
  "costRecords": 1146,
  "projectReferences": 7720,
  "assetRecords": 8,
  "toolRecords": 41,
  "eppRecords": 5,
  "duplicateCodesInCodigos": 42
}
```
