const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mollie-secret-2026';
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'mollie.sqlite');

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Error abriendo la base de datos:', err.message);
    process.exit(1);
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ============================================================
// Database Initialization
// ============================================================
function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    db.run(`
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

    // Insert default categories if table is empty
    db.get('SELECT COUNT(*) AS count FROM categories', (err, row) => {
      if (err) {
        console.error('Error consultando categorías:', err.message);
        return;
      }
      if (row.count === 0) {
        const defaultCategories = [
          'Herramientas',
          'Dispositivos Eléctricos',
          'Sistemas de Medición',
          'Repuestos'
        ];
        const stmt = db.prepare('INSERT INTO categories (name) VALUES (?)');
        defaultCategories.forEach((name) => stmt.run(name));
        stmt.finalize();
      }
    });

    // Create a default admin user if no users exist
    db.get('SELECT COUNT(*) AS count FROM users', async (err, row) => {
      if (err) {
        console.error('Error consultando usuarios:', err.message);
        return;
      }
      if (row.count === 0) {
        try {
          const bycarlosHash = await bcrypt.hash('ByCarlos#2026!', 10);
          const adminjefeHash = await bcrypt.hash('AdminJefe#2026!', 10);
          db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['bycarlos', bycarlosHash, 'admin']);
          db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['adminjefe', adminjefeHash, 'admin']);
          console.log('✅ Usuarios creados:');
          console.log('   bycarlos  / ByCarlos#2026!  (Administrador)');
          console.log('   adminjefe / AdminJefe#2026! (Administrador)');
        } catch (e) {
          console.error('Error creando usuarios por defecto:', e.message);
        }
      }
    });
  });
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
      if (err.message.includes('UNIQUE')) {
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
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDatabase();

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
