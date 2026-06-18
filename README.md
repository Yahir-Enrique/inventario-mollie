# Inventario Mollie Aspen

Inventario Mollie Aspen con frontend estático, backend Node.js + Express y base de datos híbrida:

- SQLite para desarrollo local.
- PostgreSQL para producción en Vercel, Neon, Supabase u otro proveedor compatible.

## Instalar y ejecutar

1. Abrir terminal en la carpeta del proyecto.
2. Ejecutar:
   ```bash
   npm install
   npm start
   ```
3. Abrir en el navegador:
   ```
   http://localhost:3000
   ```

## Roles
- El primer usuario registrado se convierte en `admin`.
- Los siguientes usuarios se crean como `cajero`.

## Nota
La aplicación usa SQLite localmente para poder trabajar rápido en desarrollo. En producción debes configurar una base PostgreSQL persistente, porque el filesystem de Vercel no conserva cambios de SQLite entre despliegues.

## Deploy en Vercel

1. Sube el proyecto a GitHub.
2. Crea una base PostgreSQL en Vercel Postgres, Neon o Supabase.
3. En Vercel, importa el repositorio y configura estas variables en `Settings > Environment Variables`:
   ```bash
   JWT_SECRET=una_clave_larga_y_segura
   ADMIN_USER1=bycarlos
   ADMIN_PASS1=una_contrasena_segura
   ADMIN_USER2=adminjefe
   ADMIN_PASS2=otra_contrasena_segura
   DATABASE_URL=postgresql://...
   ```
4. Deploy.

No subas `.env`, `node_modules` ni `mollie.sqlite`; ya están ignorados por Git.
