const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')

const dataDirectory = process.env.APPDATA ? path.join(process.env.APPDATA, 'EstandaresDeLubricacion') : path.join(process.cwd(), 'data')
fs.mkdirSync(dataDirectory, { recursive: true })
const database = new Database(path.join(dataDirectory, 'estandares.db'))
database.pragma('journal_mode = WAL')
database.exec(`
  CREATE TABLE IF NOT EXISTS Usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, correo TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'Consulta', activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS Maquinas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, modelo TEXT, serie TEXT, planta TEXT, imagen_principal TEXT, creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS PuntosLubricacion (id INTEGER PRIMARY KEY AUTOINCREMENT, maquina_id INTEGER NOT NULL, numero INTEGER NOT NULL, componente TEXT, referencia TEXT, lubricante TEXT, procedimiento TEXT, herramientas TEXT, codigo TEXT, cantidad TEXT, frecuencia TEXT, tiempo TEXT, posicion_x REAL, posicion_y REAL, FOREIGN KEY (maquina_id) REFERENCES Maquinas(id));
  CREATE TABLE IF NOT EXISTS Fotografias (id INTEGER PRIMARY KEY AUTOINCREMENT, maquina_id INTEGER, punto_id INTEGER, ruta TEXT NOT NULL, tipo TEXT NOT NULL, FOREIGN KEY (maquina_id) REFERENCES Maquinas(id), FOREIGN KEY (punto_id) REFERENCES PuntosLubricacion(id));
  CREATE TABLE IF NOT EXISTS Lubricantes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, fabricante TEXT, especificacion TEXT);
  CREATE TABLE IF NOT EXISTS Procedimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, punto_id INTEGER NOT NULL, paso INTEGER NOT NULL, instruccion TEXT NOT NULL, FOREIGN KEY (punto_id) REFERENCES PuntosLubricacion(id));
  CREATE TABLE IF NOT EXISTS Herramientas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, referencia TEXT);
  CREATE TABLE IF NOT EXISTS Importaciones (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre_archivo TEXT NOT NULL, tipo TEXT NOT NULL, estado TEXT NOT NULL, creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS Configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
`)
console.log(`Base de datos lista: ${path.join(dataDirectory, 'estandares.db')}`)
database.close()
