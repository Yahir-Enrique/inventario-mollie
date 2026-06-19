const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_DIR = __dirname;
const _rawSecret = process.env.JWT_SECRET;
if (!_rawSecret) {
  console.warn('⚠️  JWT_SECRET no configurado. Define esta variable de entorno en producción.');
}
const JWT_SECRET = _rawSecret || ('dev-only-' + Math.random().toString(36).slice(2));

// HÍBRIDO: Usar PostgreSQL en Vercel/Producción si Neon/Vercel inyecta una URL,
// de lo contrario usar SQLite3 para desarrollo local.
const postgresEnvCandidates = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NO_SSL'
];
const activePostgresEnvName = postgresEnvCandidates.find((name) => process.env[name]);
const DATABASE_URL = activePostgresEnvName ? process.env[activePostgresEnvName] : '';
const isPostgres = !!DATABASE_URL;

let dbInstance;
const db = {
  serialize(callback) {
    if (isPostgres) {
      callback();
    } else {
      dbInstance.serialize(callback);
    }
  },
  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];
    
    if (isPostgres) {
      let paramIndex = 1;
      let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
      
      if (pgSql.trim().toUpperCase().startsWith('INSERT ')) {
        pgSql += ' RETURNING id';
      }
      
      dbInstance.query(pgSql, params, (err, res) => {
        if (callback) {
          if (err) return callback(err);
          const context = {
            changes: res.rowCount,
            lastID: res.rows && res.rows[0] ? res.rows[0].id : null
          };
          callback.call(context, null);
        }
      });
    } else {
      dbInstance.run(sql, params, function(err) {
        if (callback) {
          callback.call(this, err);
        }
      });
    }
  },
  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    if (isPostgres) {
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      dbInstance.query(pgSql, params, (err, res) => {
        if (callback) {
          if (err) return callback(err);
          callback(null, res.rows[0] || null);
        }
      });
    } else {
      dbInstance.get(sql, params, callback);
    }
  },
  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    params = params || [];

    if (isPostgres) {
      let paramIndex = 1;
      const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
      dbInstance.query(pgSql, params, (err, res) => {
        if (callback) {
          if (err) return callback(err);
          callback(null, res.rows || []);
        }
      });
    } else {
      dbInstance.all(sql, params, callback);
    }
  },
  prepare(sql, callback) {
    if (isPostgres) {
      return {
        run(val, cb) {
          let paramIndex = 1;
          const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
          dbInstance.query(pgSql, [val], cb);
        },
        finalize(cb) {
          if (cb) cb();
        }
      };
    } else {
      return dbInstance.prepare(sql, callback);
    }
  }
};

if (isPostgres) {
  const { Pool } = require('pg');
  console.log(`🔌 Conectando a base de datos PostgreSQL usando ${activePostgresEnvName}...`);
  dbInstance = new Pool({
    connectionString: DATABASE_URL,
    ssl: activePostgresEnvName === 'POSTGRES_URL_NO_SSL' ? false : {
      rejectUnauthorized: false
    }
  });
  dbInstance.on('error', (err) => {
    console.error('Error inesperado en cliente PostgreSQL:', err);
  });
} else if (process.env.VERCEL) {
  console.error(
    'No se encontró una URL de Postgres en Vercel. Variables revisadas: ' +
    postgresEnvCandidates.join(', ')
  );
} else {
  const sqlite3 = require('sqlite3').verbose();
  const DATA_DIR = process.env.DATA_DIR || __dirname;
  const DB_FILE = path.join(DATA_DIR, 'mollie.sqlite');
  console.log(`🔌 Conectando a base de datos SQLite local: ${DB_FILE}`);
  dbInstance = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
      console.error('Error abriendo la base de datos SQLite:', err.message);
      process.exit(1);
    }
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(STATIC_DIR, {
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

let dbReady;

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

app.use('/api', async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    console.error('Base de datos no disponible:', err.message);
    res.status(500).json({ error: 'Base de datos no disponible' });
  }
});

// ============================================================
// Database Initialization
// ============================================================
async function initDatabase() {
  if (!isPostgres && process.env.VERCEL) {
    throw new Error(
      'No se encontró una URL de Postgres en Vercel. Revisa que Neon esté vinculado al proyecto y haz redeploy.'
    );
  }

  await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT,
      categoria TEXT,
      marca TEXT,
      detalle TEXT,
      imagen TEXT,
      etiqueta TEXT,
      anexo TEXT,
      contenido TEXT,
      medida TEXT,
      stock INTEGER
    )
  `);

  // Insert default categories if table is empty.
  const categoriesRow = await getAsync('SELECT COUNT(*) AS count FROM categories');
  if (Number(categoriesRow.count) === 0) {
    const defaultCategories = [
      'Herramientas',
      'Dispositivos Eléctricos',
      'Sistemas de Medición',
      'Repuestos'
    ];
    for (const name of defaultCategories) {
      await runAsync('INSERT INTO categories (name) VALUES (?)', [name]);
    }
  }

  // Create default admin users if no users exist.
  const usersRow = await getAsync('SELECT COUNT(*) AS count FROM users');
  if (Number(usersRow.count) === 0) {
    const user1 = (process.env.ADMIN_USER1 || 'bycarlos').trim().toLowerCase();
    const pass1 = process.env.ADMIN_PASS1 || null;
    const user2 = (process.env.ADMIN_USER2 || 'adminjefe').trim().toLowerCase();
    const pass2 = process.env.ADMIN_PASS2 || null;

    const randomPass = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';
    const finalPass1 = pass1 || randomPass();
    const finalPass2 = pass2 || randomPass();

    const hash1 = await bcrypt.hash(finalPass1, 10);
    const hash2 = await bcrypt.hash(finalPass2, 10);
    await runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [user1, hash1, 'admin']);
    await runAsync('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [user2, hash2, 'admin']);

    console.log('✅ Usuarios administradores creados:');
    console.log(`   Usuario: ${user1} / Contraseña: ${finalPass1}`);
    console.log(`   Usuario: ${user2} / Contraseña: ${finalPass2}`);
    if (!pass1 || !pass2) {
      console.log('⚠️  GUARDA estas contraseñas. No se mostrarán de nuevo.');
      console.log('   Define ADMIN_PASS1 y ADMIN_PASS2 en tus variables de entorno para controlarlas.');
    }
  }
}

// ============================================================
// Auth Helpers
// ============================================================
function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '8h'
  });
}

function getTokenFromHeader(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

function authenticate(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

// ============================================================
// Auth Routes
// ============================================================
// Registro deshabilitado — solo acceso por credenciales predefinidas
app.post('/api/register', (req, res) => {
  return res.status(403).json({ error: 'El registro de nuevos usuarios está deshabilitado.' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  const normalizedUser = username.trim().toLowerCase();
  db.get('SELECT * FROM users WHERE username = ?', [normalizedUser], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Error en la base de datos' });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    return res.json({ username: user.username, role: user.role, token });
  });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// ============================================================
// Admin User Management
// ============================================================
app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  db.all('SELECT id, username, role FROM users ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error cargando usuarios' });
    res.json(rows);
  });
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos' });
  }
  const normalizedUser = username.trim().toLowerCase();
  db.get('SELECT * FROM users WHERE username = ?', [normalizedUser], async (err, existing) => {
    if (err) return res.status(500).json({ error: 'Error en la base de datos' });
    if (existing) return res.status(409).json({ error: 'El usuario ya existe' });
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [normalizedUser, hashedPassword, role], function (err) {
        if (err) return res.status(500).json({ error: 'Error guardando usuario' });
        res.json({ id: this.lastID, username: normalizedUser, role });
      });
    } catch (e) {
      res.status(500).json({ error: 'Error procesando la solicitud' });
    }
  });
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  db.run('DELETE FROM users WHERE id = ?', [userId], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando usuario' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true });
  });
});

// ============================================================
// Categories
// ============================================================
app.get('/api/categories', authenticate, (req, res) => {
  db.all('SELECT id, name FROM categories ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error cargando categorías' });
    res.json(rows);
  });
});

app.post('/api/categories', authenticate, requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre de categoría es requerido' });
  const normalizedName = name.trim();
  db.run('INSERT INTO categories (name) VALUES (?)', [normalizedName], function (err) {
    if (err) {
      if (err.code === '23505' || err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'La categoría ya existe' });
      }
      return res.status(500).json({ error: 'Error guardando categoría' });
    }
    db.all('SELECT id, name FROM categories ORDER BY name', (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error cargando categorías' });
      res.json(rows);
    });
  });
});

app.delete('/api/categories/:id', authenticate, requireAdmin, (req, res) => {
  const categoryId = Number(req.params.id);
  db.run('DELETE FROM categories WHERE id = ?', [categoryId], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando categoría' });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    db.all('SELECT id, name FROM categories ORDER BY name', (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error cargando categorías' });
      res.json(rows);
    });
  });
});

// ============================================================
// Inventory
// ============================================================
app.get('/api/inventory', authenticate, (req, res) => {
  db.all('SELECT * FROM inventory ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error cargando inventario' });
    res.json(rows);
  });
});

app.post('/api/inventory', authenticate, requireAdmin, (req, res) => {
  const { codigo, categoria, marca, detalle, imagen, etiqueta, anexo, contenido, medida, stock } = req.body;
  if (!codigo || !categoria || !marca || !detalle || !etiqueta || !contenido || !medida || stock == null) {
    return res.status(400).json({ error: 'Faltan datos obligatorios del inventario' });
  }
  db.run(
    `INSERT INTO inventory (codigo, categoria, marca, detalle, imagen, etiqueta, anexo, contenido, medida, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [codigo, categoria, marca, detalle, imagen || '', etiqueta, anexo || '', contenido, medida, Number(stock)],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error guardando producto' });
      db.get('SELECT * FROM inventory WHERE id = ?', [this.lastID], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error cargando producto' });
        res.json(row);
      });
    }
  );
});

app.put('/api/inventory/:id', authenticate, requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  const { codigo, categoria, marca, detalle, imagen, etiqueta, anexo, contenido, medida, stock } = req.body;
  db.run(
    `UPDATE inventory SET codigo = ?, categoria = ?, marca = ?, detalle = ?, imagen = ?, etiqueta = ?, anexo = ?, contenido = ?, medida = ?, stock = ?
      WHERE id = ?`,
    [codigo, categoria, marca, detalle, imagen || '', etiqueta, anexo || '', contenido, medida, Number(stock), itemId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error actualizando producto' });
      if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
      db.get('SELECT * FROM inventory WHERE id = ?', [itemId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error cargando producto' });
        res.json(row);
      });
    }
  );
});

app.delete('/api/inventory/:id', authenticate, requireAdmin, (req, res) => {
  const itemId = Number(req.params.id);
  db.run('DELETE FROM inventory WHERE id = ?', [itemId], function (err) {
    if (err) return res.status(500).json({ error: 'Error eliminando producto' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ success: true });
  });
});

// ============================================================
// Fallback
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

dbReady = initDatabase();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor activo en http://localhost:${PORT}`);
  });
}

module.exports = app;
