# Bodega360

App web interna para consulta y administracion de materiales de bodega.

## Caminos de uso y despliegue

Bodega360 no queda orientado exclusivamente a cloud. El camino principal del proyecto es validar primero con bodega y luego alojar una version interna en infraestructura de la empresa.

### A. Prototipo HTML Local

- Carpeta: `bodega360-html-local`.
- No requiere Docker.
- No requiere SQL.
- No requiere backend.
- Usa `localStorage` mediante `StorageAdapter`.
- Sirve para demo, validacion funcional y pruebas con bodega.
- No es multiusuario real: cada navegador mantiene sus propios datos.

### B. Servidor Interno Futuro

- Camino principal para produccion interna si la empresa exige datos locales.
- Acceso desde la misma red LAN/WiFi.
- API local y almacenamiento centralizado.
- Usuarios reales, respaldos automaticos y administracion TI.
- Puede usar JSON central, SQLite o PostgreSQL segun infraestructura disponible.
- No depende de Render.

### C. Render Cloud

- Opcion secundaria para demo externa o MVP alojado mientras no exista servidor interno.
- Usa Render PostgreSQL y variables de entorno.
- No debe considerarse destino final si la empresa exige datos internos/locales.

Ver [docs/arquitectura-despliegue.md](docs/arquitectura-despliegue.md) para la comparacion completa y [docs/checklist-no-romper.md](docs/checklist-no-romper.md) para pruebas de no regresion.

## Stack

- Frontend: React + Vite.
- Backend: Express + TypeScript.
- Base de datos: PostgreSQL + Prisma.
- Archivos: fotos guardadas en `apps/api/uploads/materials`.

## Requisitos

- Node.js 24 o superior.
- PostgreSQL local, PostgreSQL en Render o Docker Desktop si quieres levantar PostgreSQL local.

## Puesta en marcha

1. Instalar dependencias:

```bash
npm install
```

2. Crear variables de entorno locales:

```bash
copy .env.example .env
```

3. Levantar PostgreSQL:

```bash
docker compose up -d
```

Si tu PC no permite Docker/PostgreSQL local, puedes usar la `External Database URL` o `Internal Database URL` de Render en `DATABASE_URL`. Para desarrollo desde tu PC normalmente corresponde la URL externa.

4. Crear tablas y cliente Prisma:

```bash
npm run db:migrate -- --name init
```

5. Crear usuario administrador inicial:

```bash
npm run db:seed
```

6. Ejecutar API y web:

```bash
npm run dev
```

La web queda en `http://localhost:5173` y la API en `http://localhost:4000`.

## Acceso inicial

- Usuario: `admin`
- Contrasena: `admin`

Estas credenciales son solo para desarrollo local. Antes de produccion deben reemplazarse por una contrasena en `.env`, usuarios reales o inicio de sesion corporativo como Microsoft 365.

## Respaldo manual o programado

Con PostgreSQL levantado en Docker:

```bash
npm run backup:db
```

El archivo queda en la carpeta `backups`. Para respaldo automatico en Windows, programa ese comando en el Programador de tareas con la frecuencia que defina la empresa.

## Documentacion

Ver [docs/arquitectura.md](docs/arquitectura.md) para alcance, roles, endpoints y formato Excel.

## Deploy en Render Opcional

Render queda como una opcion secundaria/demo externa. Para produccion interna, el camino recomendado es servidor interno LAN/WiFi con API local y almacenamiento centralizado.

Esta preparacion usa dos servicios Render separados: una API Node.js y un frontend estatico Vite. La base de datos es Render PostgreSQL.

### 1. Subir proyecto a GitHub

Crea un repositorio en GitHub y sube todo el proyecto, incluyendo `prisma/migrations`.

### 2. Crear PostgreSQL en Render

En Render, crea una base de datos PostgreSQL. Copia la `Internal Database URL`; esa es la que debe usar la API dentro de Render.

### 3. Crear Web Service para API

En Render crea un `Web Service` conectado al repositorio.

Configuracion recomendada:

- Root Directory: dejar vacio si Render toma la raiz del monorepo.
- Build Command:

```bash
npm install && npm run db:generate && npm run build -w apps/api && npx prisma migrate deploy
```

- Start Command:

```bash
npm run start:api
```

- Health Check Path:

```bash
/health
```

Variables de entorno para la API:

```bash
NODE_ENV=production
DATABASE_URL=Internal Database URL de Render PostgreSQL
ADMIN_USER=admin real
ADMIN_PASSWORD=contrasena segura
JWT_SECRET=secreto largo y unico
CORS_ORIGIN=https://URL-DEL-FRONTEND.onrender.com
```

Notas:

- En produccion se usa `npx prisma migrate deploy`.
- No uses `prisma migrate dev` en Render; ese comando es solo para desarrollo local.
- `ADMIN_USER` y `ADMIN_PASSWORD` no se usan automaticamente en cada arranque; se usan al ejecutar el seed.

### 4. Ejecutar migraciones

El Build Command anterior ya ejecuta:

```bash
npx prisma migrate deploy
```

Si necesitas correrlo manualmente desde Render Shell:

```bash
npm run prisma:migrate:deploy
```

### 5. Ejecutar seed admin

Despues del primer deploy de la API, abre Render Shell o crea un Job manual con:

```bash
npm run prisma:seed
```

El seed lee:

```bash
ADMIN_USER
ADMIN_PASSWORD
```

En desarrollo local puede usar `admin/admin` si esas variables no existen. En produccion deben existir; si faltan, el seed se detiene con un mensaje claro.

### 6. Crear frontend

En Render crea un `Static Site` conectado al mismo repositorio.

Configuracion recomendada:

- Root Directory: dejar vacio si Render toma la raiz del monorepo.
- Build Command:

```bash
npm install && npm run build:web
```

- Publish Directory:

```bash
apps/web/dist
```

Variable de entorno para el frontend:

```bash
VITE_API_URL=https://URL-DE-LA-API.onrender.com
```

En desarrollo Vite usa `http://localhost:4000`. En produccion debes configurar `VITE_API_URL`.

### 7. Configurar CORS

Cuando tengas la URL final del frontend, vuelve al servicio API y configura:

```bash
CORS_ORIGIN=https://URL-DEL-FRONTEND.onrender.com
```

En desarrollo la API permite `http://localhost:5173` y `http://127.0.0.1:5173`. No dejes CORS abierto en produccion salvo para diagnostico temporal.

### 8. Pruebas de aceptacion en Render

1. Abrir `https://URL-DE-LA-API.onrender.com/health` y confirmar respuesta `OK`.
2. Abrir el frontend.
3. Probar login con `ADMIN_USER` y `ADMIN_PASSWORD`.
4. Crear un material desde el panel de bodega.
5. Buscar el material por codigo.
6. Buscar el material por nombre.
7. Buscar un texto sin resultado.
8. Revisar historial de consultas.
9. Confirmar que busquedas con resultado y sin resultado quedan registradas.
10. Probar importacion Excel si aplica.
11. Probar exportacion de respaldo.

### 9. render.yaml opcional

El archivo [render.yaml](render.yaml) documenta una infraestructura esperada con:

- `bodega360-api`
- `bodega360-web`
- `bodega360-postgres`

Puedes usarlo como Blueprint o seguir los pasos manuales anteriores. En monorepos, a veces es mas claro crear los servicios manualmente para controlar variables y URLs finales.
