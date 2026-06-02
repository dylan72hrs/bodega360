# Bodega360

App web interna para consulta y administracion de materiales de bodega.

## Stack

- Frontend: React + Vite.
- Backend: Express + TypeScript.
- Base de datos: PostgreSQL + Prisma.
- Archivos: fotos guardadas en `apps/api/uploads/materials`.

## Requisitos

- Node.js 24 o superior.
- Docker Desktop para levantar PostgreSQL local.

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
