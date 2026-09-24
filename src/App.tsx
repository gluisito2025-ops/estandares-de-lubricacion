import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BookOpen, Camera, ChevronLeft, ChevronRight, Database, FileUp, Gauge, LogOut, Menu, Settings, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { tonelloMachine } from './data/tonello'
import type { LubricationPoint } from './data/tonello'
import * as XLSX from 'xlsx'
import UsersView, { usersStorageKey, type ManagedUser } from './UsersView'
import { pullFromCloud, pushToCloud } from './lib/sync'
import './App.css'

const savedStandardKey = 'estandares-lubricacion:tonello-standard'
const adminPhotoKey = 'estandares-lubricacion:admin-photo'
const defaultAdmin = (): ManagedUser => ({ id: 'admin', name: 'Luis Garcia', email: 'luisromang@permoda.com.co', password: 'M4nt3nimineto#6166', role: 'Administrador', photo: localStorage.getItem(adminPhotoKey) ?? '/yo.png' })

function loadSavedStandard() {
  try {
    const saved = localStorage.getItem(savedStandardKey)
    return saved ? JSON.parse(saved) as { machine: typeof tonelloMachine; points: typeof tonelloMachine.points } : null
  } catch {
    return null
  }
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState('Vista general')
  const savedStandard = loadSavedStandard()
  const [machine, setMachine] = useState(savedStandard?.machine ?? tonelloMachine)
  const [selectedPoint, setSelectedPoint] = useState(1)
  const [editablePoints, setEditablePoints] = useState(savedStandard?.points ?? tonelloMachine.points)
  const importInput = useRef<HTMLInputElement>(null)
  const [importMessage, setImportMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [photoDragOver, setPhotoDragOver] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [loggedIn, setLoggedIn] = useState(true)
  const [currentUser, setCurrentUser] = useState<ManagedUser>(defaultAdmin)
  const [rememberUser, setRememberUser] = useState(true)
  const [email, setEmail] = useState('luisromang@permoda.com.co')
  const [password, setPassword] = useState('')
  const point = editablePoints.find((item) => item.id === selectedPoint) ?? editablePoints[0]
  const currentIndex = editablePoints.findIndex((item) => item.id === point.id)
  const updatePoint = (field: keyof typeof point, value: string) => setEditablePoints((items) => items.map((item) => item.id === selectedPoint ? { ...item, [field]: value } : item))
  const setPointPhoto = (file: File) => { if (!file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = () => updatePoint('photo', String(reader.result)); reader.readAsDataURL(file) }
  const setUserPhoto = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const photo = String(reader.result)
      setCurrentUser((user) => ({ ...user, photo }))
      if (currentUser.id === 'admin') { localStorage.setItem(adminPhotoKey, photo); return }
      let users: ManagedUser[] = []
      try { users = JSON.parse(localStorage.getItem(usersStorageKey) ?? '[]') as ManagedUser[] } catch { users = [] }
      void pushToCloud(usersStorageKey, JSON.stringify(users.map((item) => item.id === currentUser.id ? { ...item, photo } : item)))
    }
    reader.readAsDataURL(file)
  }
  const cloudHydrated = useRef(false)
  useEffect(() => {
    let cancelled = false
    void pullFromCloud().then(() => {
      if (cancelled) return
      const saved = loadSavedStandard()
      if (saved) {
        setMachine(saved.machine)
        setEditablePoints(saved.points)
      }
      cloudHydrated.current = true
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!cloudHydrated.current) return
    pushToCloud(savedStandardKey, JSON.stringify({ machine, points: editablePoints }))
  }, [machine, editablePoints])
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const handleLogout = () => {
    setShowProfile(false)
    setLoggedIn(false)
    setCurrentUser(defaultAdmin())
    setEmail('')
    setPassword('')
  }
  const handleLogin = () => {
    let users: ManagedUser[] = []
    try { users = JSON.parse(localStorage.getItem(usersStorageKey) ?? '[]') as ManagedUser[] } catch { users = [] }
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()
    const user = users.find((item) => item.email.toLowerCase() === normalizedEmail && item.password === normalizedPassword)
    const isAdmin = normalizedEmail === 'luisromang@permoda.com.co' && normalizedPassword === 'M4nt3nimineto#6166'
    if (user) {
      setCurrentUser(user)
      setLoggedIn(true)
      return
    }
    if (isAdmin) {
      setCurrentUser(defaultAdmin())
      setLoggedIn(true)
      return
    }
    window.alert('No se pudo iniciar sesión. Verifica el correo y la contraseña. Si el usuario fue creado antes de agregar el campo contraseña, elimínalo y créalo nuevamente.')
  }
  const importStandard = async (file: File) => {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null })
    const machineRow = rows.find((row) => row[0] === 'Nombre de máquina:') ?? []
    const headersIndex = rows.findIndex((row) => row[0] === 'Numero punto de lubricacion')
    const dataRows = rows.slice(headersIndex + 1).filter((row) => typeof row[0] === 'number')
    const points: LubricationPoint[] = dataRows.map((row, index) => ({ id: index + 1, component: String(row[2] ?? ''), reference: String(row[3] ?? ''), lubricant: String(row[4] ?? ''), procedure: String(row[5] ?? ''), tools: String(row[6] ?? ''), code: String(row[7] ?? ''), quantity: String(row[8] ?? ''), frequency: String(row[9] ?? ''), time: String(row[10] ?? ''), x: 20 + ((index * 23) % 65), y: 25 + ((index * 19) % 55) }))
    if (!points.length) { setImportMessage('No se encontraron puntos de lubricación en el archivo.'); return }
    const imported = { ...machine, name: String(machineRow[1] ?? file.name), model: String(machineRow[3] ?? ''), series: String(machineRow[6] ?? ''), plant: String(machineRow[9] ?? ''), sourceFile: file.name, points }
    setMachine(imported); setEditablePoints(points); setSelectedPoint(1); setImportMessage(`Estándar importado: ${file.name} · ${points.length} puntos`)
  }
  if (!loggedIn) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} rememberUser={rememberUser} setRememberUser={setRememberUser} onLogin={handleLogin} />
  return <div className="shell">
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand"><img className="sidebar-logo" src="/koaj.png" alt="KOAJ Permoda" /></div>
      <nav><p className="nav-caption">CENTRO DE CONTROL</p><NavItem icon={<Gauge />} label="Vista general" active={activeSection === 'Vista general'} collapsed={collapsed} onClick={() => setActiveSection('Vista general')} /><NavItem icon={<Database />} label="Máquinas" active={activeSection === 'Máquinas'} collapsed={collapsed} onClick={() => setActiveSection('Máquinas')} /><NavItem icon={<BookOpen />} label="Estándares" active={activeSection === 'Estándares'} collapsed={collapsed} onClick={() => setActiveSection('Estándares')} /><NavItem icon={<FileUp />} label="Importaciones" active={activeSection === 'Importaciones'} collapsed={collapsed} onClick={() => { setActiveSection('Importaciones'); importInput.current?.click() }} /><p className="nav-caption">SISTEMA</p><NavItem icon={<Users />} label="Usuarios" active={activeSection === 'Usuarios'} collapsed={collapsed} onClick={() => setActiveSection('Usuarios')} /><NavItem icon={<Settings />} label="Configuración" active={activeSection === 'Configuración'} collapsed={collapsed} onClick={() => setActiveSection('Configuración')} /></nav>
      <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Colapsar menú">{collapsed ? <ChevronRight /> : <ChevronLeft />}</button><div className="sidebar-footer"><div className="status-dot" />{!collapsed && <span>Sistema operativo</span>}</div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="breadcrumb"><span>Centro de control</span><b>/</b><strong>Vista general</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notificaciones"><Bell size={18} /><i /></button><button className="profile-trigger" onClick={() => setShowProfile(!showProfile)}><UserAvatar user={currentUser} /><span>{currentUser.name}<small>{currentUser.role}</small></span><ChevronRight size={15} /></button></div></header>
      <AnimatePresence>{showProfile && <motion.div className="profile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><div className="profile-menu-head"><UserAvatar user={currentUser} /><div><strong>{currentUser.name}</strong><span>{currentUser.role}</span></div></div><label className="profile-photo-option"><span className="profile-photo-btn"><Camera size={14} />{currentUser.photo ? 'Cambiar foto' : 'Agregar foto'}</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setUserPhoto(file); event.target.value = '' }} /></label><button onClick={handleLogout}><LogOut size={16} /> Cerrar sesión</button></motion.div>}</AnimatePresence>
      <input ref={importInput} className="hidden-file-input" type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importStandard(file); event.target.value = '' }} />
      {activeSection === 'Usuarios' ? <UsersView /> : <div className="content-wrap">
        <motion.section className="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><div><p className="eyebrow"><span className="live-dot" /> SISTEMA EN LÍNEA · 21 SEPT 2026</p><h1>{greeting}, {currentUser.name.split(' ')[0]}.</h1><p className="welcome-copy">Supervisa tus estándares y localiza cada punto crítico de lubricación.</p></div><img src="/koaj.png" className="client-logo" alt="Permoda" /></motion.section>
        <section className="metric-grid"><Metric icon={<Database />} value="01" label="Máquina importada" trend={machine.model} /><Metric icon={<Sparkles />} value={String(machine.points.length).padStart(2, '0')} label="Puntos de lubricación" trend="Desde estándar Excel" /><Metric icon={<FileUp />} value="01" label="Estándar importado" trend={machine.sourceFile} /><Metric icon={<ShieldCheck />} value="100%" label="Datos técnicos" trend="Información disponible" /></section>
        <div className="section-heading"><div><p className="eyebrow">{activeSection.toUpperCase()}</p><h2>Mapa de lubricación</h2>{importMessage && <p className="import-message">{importMessage}</p>}</div><button className="primary-btn" onClick={() => importInput.current?.click()}><FileUp size={16} /> Ingresar nuevo estándar</button></div>
        <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragOver(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOver(false) }} onDrop={(event) => { event.preventDefault(); setDragOver(false); const file = event.dataTransfer.files[0]; if (file) void importStandard(file) }}><FileUp size={22} /><div><strong>{dragOver ? 'Suelta el estándar aquí' : 'Arrastra y suelta un estándar'}</strong><span>Excel .xlsx o .xls · también puedes hacer clic para seleccionarlo</span></div><button type="button" onClick={() => importInput.current?.click()}>Elegir archivo</button></div>
        <section className="workspace-grid"><div className="machine-card"><div className="machine-toolbar"><div><span className="label">MÁQUINA IMPORTADA · {machine.plant.toUpperCase()}</span><h3>{machine.name} <ChevronRight size={16} /></h3><span className="machine-meta">Modelo {machine.model} · Serie {machine.series}</span></div><button className="select-btn" onClick={() => setActiveSection('Estándares')}>Ver estándar <ChevronRight size={15} /></button></div><div className="machine-stage"><img className="machine-photo" src="/lavbadpra.png" alt={machine.name} /></div><div className="machine-footer"><span><i className="legend-dot cyan" /> Fotografía principal</span><span><i className="legend-dot" /> Estándar importado</span><span className="stage-label"><span className="led" /> Estándar activo</span><span className="coords">{machine.points.length} puntos registrados</span></div></div>
          <AnimatePresence mode="wait"><motion.aside className="point-panel editor-panel" key={point.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}><div className="panel-header"><div><span className="eyebrow">EDICIÓN SECUENCIAL · {currentIndex + 1} DE {editablePoints.length}</span><h3><span className="number-badge">{String(point.id).padStart(2, '0')}</span><span>Punto de lubricación<small>{point.reference}</small></span></h3></div></div><div className="sequence-controls"><button disabled={currentIndex === 0} onClick={() => setSelectedPoint(editablePoints[currentIndex - 1].id)}><ChevronLeft size={15} /> Anterior</button><span>PUNTO {point.id} / {editablePoints.length}</span><button disabled={currentIndex === editablePoints.length - 1} onClick={() => setSelectedPoint(editablePoints[currentIndex + 1].id)}>Siguiente <ChevronRight size={15} /></button></div><label className={`photo-upload ${photoDragOver ? 'photo-drag-over' : ''}`} onDragEnter={(event) => { event.preventDefault(); setPhotoDragOver(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setPhotoDragOver(false) }} onDrop={(event) => { event.preventDefault(); setPhotoDragOver(false); const file = event.dataTransfer.files[0]; if (file) setPointPhoto(file) }}>Fotografía del punto<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPointPhoto(file); event.target.value = '' }} />{point.photo ? <img src={point.photo} alt={`Punto ${point.id}`} /> : <span>Arrastra la foto aquí o haz clic para seleccionar</span>}</label><div className="editable-fields"><EditableField label="Componente" value={point.component} onChange={(value) => updatePoint('component', value)} /><EditableField label="Referencia" value={point.reference} onChange={(value) => updatePoint('reference', value)} /><EditableField label="Tipo de grasa / lubricante" value={point.lubricant} accent onChange={(value) => updatePoint('lubricant', value)} /><EditableField label="Código" value={point.code} mono onChange={(value) => updatePoint('code', value)} /><EditableField label="Frecuencia" value={point.frequency} onChange={(value) => updatePoint('frequency', value)} /><EditableField label="Cantidad" value={point.quantity} onChange={(value) => updatePoint('quantity', value)} /><EditableField label="Tiempo" value={point.time} onChange={(value) => updatePoint('time', value)} /><EditableField label="Herramientas" value={point.tools} onChange={(value) => updatePoint('tools', value)} /><label className="procedure-field">Procedimiento completo<textarea value={point.procedure} onChange={(event) => updatePoint('procedure', event.target.value)} /></label></div><button className="procedure-btn" onClick={() => setImportMessage(`Cambios guardados en el punto ${point.id}`)}><BookOpen size={16} /> Guardar cambios del punto <ChevronRight size={15} /></button></motion.aside></AnimatePresence></section>
      </div>}
    </main>
  </div>
}

function NavItem({ icon, label, active, collapsed, onClick }: { icon: ReactNode; label: string; active?: boolean; collapsed: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} title={collapsed ? label : undefined} data-label={collapsed ? label : undefined} onClick={onClick}>{icon}{!collapsed && <span>{label}</span>}{active && <i />}</button> }
function Metric({ icon, value, label, trend }: { icon: ReactNode; value: string; label: string; trend: string }) { return <motion.div className="metric-card" whileHover={{ y: -3 }}><div className="metric-icon">{icon}</div><strong>{value}</strong><span>{label}</span><small>{trend}</small></motion.div> }
function EditableField({ label, value, onChange, accent, mono }: { label: string; value: string; onChange: (value: string) => void; accent?: boolean; mono?: boolean }) { return <label className={`editable-field ${accent ? 'accent' : ''} ${mono ? 'mono' : ''}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function UserAvatar({ user, className }: { user: ManagedUser; className?: string }) { if (user.photo) return <img src={user.photo} alt={user.name} className={className} />; const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); return <span className={`avatar-placeholder ${className ?? ''}`}>{initials}</span> }
function Login({ email, setEmail, password, setPassword, rememberUser, setRememberUser, onLogin }: { email: string; setEmail: (value: string) => void; password: string; setPassword: (value: string) => void; rememberUser: boolean; setRememberUser: (value: boolean) => void; onLogin: () => void }) { return <main className="login-screen"><motion.div className="login-visual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .7 }}><div className="login-orbit" /><motion.img className="login-permoda-logo" src="/koaj.png" alt="KOAJ Permoda" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }} /><div className="login-message"><p className="eyebrow">PLATAFORMA INDUSTRIAL · v1.0</p><h1>Controla la precisión.<br /><em>Protege el movimiento.</em></h1><p>Identificación visual de puntos de lubricación para operaciones industriales Permoda.</p></div></motion.div><div className="login-form-wrap"><motion.div className="login-form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25, duration: .55 }}><motion.img src="/yo.png" className="login-avatar" alt="Luis Garcia" initial={{ scale: .8, x: 0 }} animate={{ scale: 1, x: [0, -16, 16, 0] }} transition={{ delay: .4, duration: 1.4, times: [0, .32, .68, 1], ease: 'easeInOut' }} /><p className="eyebrow">ACCESO SEGURO</p><h2>Bienvenido de nuevo</h2><p className="login-sub">Ingresa tus credenciales para continuar.</p><label>Correo corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" /></label><label className="remember"><input type="checkbox" checked={rememberUser} onChange={(event) => setRememberUser(event.target.checked)} /><span>Recordar usuario</span></label><button className="login-btn" onClick={onLogin}>Iniciar sesión <ChevronRight size={17} /></button><div className="login-footer"><span><ShieldCheck size={14} /> Conexión protegida</span></div></motion.div></div></main> }

export default App
