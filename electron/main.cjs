const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const Database = require('better-sqlite3')

const dataDirectory = path.join(app.getPath('userData'), 'data')
fs.mkdirSync(dataDirectory, { recursive: true })
const database = new Database(path.join(dataDirectory, 'estandares.db'))
database.pragma('journal_mode = WAL')
database.exec(`CREATE TABLE IF NOT EXISTS Configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL); CREATE TABLE IF NOT EXISTS Maquinas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, modelo TEXT, serie TEXT, planta TEXT, imagen_principal TEXT); CREATE TABLE IF NOT EXISTS PuntosLubricacion (id INTEGER PRIMARY KEY AUTOINCREMENT, maquina_id INTEGER NOT NULL, numero INTEGER NOT NULL, componente TEXT, referencia TEXT, lubricante TEXT, procedimiento TEXT, herramientas TEXT, codigo TEXT, cantidad TEXT, frecuencia TEXT, tiempo TEXT, posicion_x REAL, posicion_y REAL);`)

function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 900, minHeight: 650, backgroundColor: '#081119', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } })
  if (process.env.VITE_DEV_SERVER_URL) window.loadURL(process.env.VITE_DEV_SERVER_URL)
  else window.loadFile(path.join(__dirname, '../dist/index.html'))
}
ipcMain.handle('machines:list', () => database.prepare('SELECT * FROM Maquinas ORDER BY nombre').all())
ipcMain.handle('points:list', (_, machineId) => database.prepare('SELECT * FROM PuntosLubricacion WHERE maquina_id = ? ORDER BY numero').all(machineId))
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
