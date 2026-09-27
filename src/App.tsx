import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BookOpen, Camera, ChevronLeft, ChevronRight, Database, FileUp, Gauge, Images, LogOut, Menu, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import type { LubricationPoint } from './data/tonello'
import UsersView, { usersStorageKey, type ManagedUser } from './UsersView'
import MachinesView from './MachinesView'
import { getActiveMachineId, loadMachines, machineInitials, machinePhotoIds, machinePointPhotoIds, machinesStorageKey, readLegacyStandard, setActiveMachineId, type MachineRecord } from './data/machines'
import { ImportError, importStandardFile, seedMachine } from './lib/standardImport'
import { deleteImages, loadImages, putImage } from './lib/imageStore'
import { machinePhotoFrom, pointPhotoFrom } from './lib/imageResize'
import { pullFromCloud, pushToCloud } from './lib/sync'
import './App.css'

const adminPhotoKey = 'estandares-lubricacion:admin-photo'
const defaultAdmin = (): ManagedUser => ({ id: 'admin', name: 'Luis Garcia', email: 'luisromang@permoda.com.co', password: 'M4nt3nimiento#6166', role: 'Administrador', photo: localStorage.getItem(adminPhotoKey) ?? '/yo.png' })

async function migrateLegacyStandard(): Promise<MachineRecord[]> {
  const legacy = readLegacyStandard()
  if (!legacy) return [seedMachine()]
  const id = legacy.id || crypto.randomUUID()
  const points: LubricationPoint[] = []
  for (const point of legacy.points) {
    const dataUrl = (point as { photo?: string }).photo
    if (!dataUrl) { points.push({ ...point, photos: [] }); continue }
    const photoId = `punto:${id}:${point.id}:legacy`
    await putImage(photoId, dataUrl)
    points.push({ ...point, photos: [photoId] })
  }
  return [{
    id,
    name: legacy.machine.name,
    model: legacy.machine.model,
    series: legacy.machine.series,
    plant: legacy.machine.plant,
    sourceFile: legacy.machine.sourceFile,
    importedAt: Date.now(),
    photoIds: [],
    points,
  }]
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeSection, setActiveSection] = useState('Vista general')
  const [machines, setMachines] = useState<MachineRecord[]>([])
  const [activeMachineId, setActiveId] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState(1)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [importMessage, setImportMessage] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [photoDragOver, setPhotoDragOver] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [loggedIn, setLoggedIn] = useState(true)
  const [currentUser, setCurrentUser] = useState<ManagedUser>(defaultAdmin)
  const [rememberUser, setRememberUser] = useState(true)
  const [email, setEmail] = useState('luisromang@permoda.com.co')
  const [password, setPassword] = useState('')
  const importInput = useRef<HTMLInputElement>(null)

  const activeMachine = machines.find((item) => item.id === activeMachineId) ?? null
  const points = activeMachine?.points ?? []
  const point = points.find((item) => item.id === selectedPoint) ?? points[0]
  const currentIndex = point ? points.findIndex((item) => item.id === point.id) : -1
  const machinePhoto = activeMachine?.photoId ? photoUrls[activeMachine.photoId] : undefined

  const cloudHydrated = useRef(false)
  useEffect(() => {
    let cancelled = false
    void pullFromCloud()
      .then(migrateLegacyStandard)
      .then((fallback) => {
        if (cancelled) return
        const stored = loadMachines()
        const list = stored.length ? stored : fallback
        setMachines(list)
        const remembered = getActiveMachineId()
        setActiveId(remembered && list.some((item) => item.id === remembered) ? remembered : list[0]?.id ?? null)
        cloudHydrated.current = true
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!cloudHydrated.current) return
    void pushToCloud(machinesStorageKey, JSON.stringify(machines))
  }, [machines])

  useEffect(() => {
    let cancelled = false
    const ids = machines.flatMap(machinePhotoIds)
    if (activeMachine) ids.push(...machinePointPhotoIds(activeMachine))
    if (!ids.length) return
    void loadImages(ids).then((urls) => {
      if (cancelled) return
      setPhotoUrls((current) => {
        const next = { ...current, ...urls }
        return Object.keys(next).length === Object.keys(current).length ? current : next
      })
    })
    return () => { cancelled = true }
  }, [machines, activeMachine])

  const patchActiveMachine = (patch: (machine: MachineRecord) => MachineRecord) => {
    setMachines((items) => items.map((item) => item.id === activeMachineId ? patch(item) : item))
  }
  const updatePoint = (field: keyof LubricationPoint, value: string) => patchActiveMachine((machine) => ({ ...machine, points: machine.points.map((item) => item.id === point.id ? { ...item, [field]: value } : item) }))
  const updatePointPhotos = (patch: (current: string[]) => string[]) => patchActiveMachine((machine) => ({ ...machine, points: machine.points.map((item) => item.id === point.id ? { ...item, photos: patch(item.photos ?? []) } : item) }))

  const addPointPhotos = async (files: File[]) => {
    const usable = files.filter((file) => file.type.startsWith('image/'))
    if (!usable.length || !activeMachine) return
    const token = `${activeMachine.id}:${point.id}:${Date.now().toString(36)}`
    const ids = await Promise.all(usable.map(async (file, index) => {
      const photoId = `punto:${token}:${index}`
      await putImage(photoId, await pointPhotoFrom(file))
      return photoId
    }))
    updatePointPhotos((current) => [...current, ...ids])
  }
  const removePointPhoto = (photoId: string) => {
    void deleteImages([photoId])
    updatePointPhotos((current) => current.filter((id) => id !== photoId))
  }

  const runImport = async (file: File) => {
    setImportMessage(`Importando ${file.name}...`)
    try {
      const result = await importStandardFile(file, machines)
      setMachines((items) => {
        const index = items.findIndex((item) => item.id === result.machine.id)
        if (index === -1) return [...items, result.machine]
        const next = [...items]
        next[index] = result.machine
        return next
      })
      setActiveId(result.machine.id)
      setSelectedPoint(result.machine.points[0]?.id ?? 1)
      setActiveSection('Estándares')
      setImportMessage(`Estándar importado: ${file.name} · ${result.pointsCount} puntos · ${result.pointPhotos} fotos de puntos · ${result.machinePhotos} fotos de máquina`)
    } catch (error) {
      setImportMessage(error instanceof ImportError ? error.message : 'No se pudo leer el archivo. Verifica que sea un Excel válido con la tabla de lubricación.')
    }
  }

  const selectMachine = (machineId: string) => {
    setActiveId(machineId)
    setActiveMachineId(machineId)
    setSelectedPoint(1)
    setActiveSection('Estándares')
  }
  const uploadMachinePhoto = async (machine: MachineRecord, file: File) => {
    if (!file.type.startsWith('image/')) return
    const photoId = `maquina:${machine.id}:${Date.now().toString(36)}`
    await putImage(photoId, await machinePhotoFrom(file))
    setMachines((items) => items.map((item) => item.id === machine.id ? { ...item, photoId, photoIds: [photoId, ...item.photoIds] } : item))
  }
  const promoteMachinePhoto = (machine: MachineRecord, photoId: string) => {
    setMachines((items) => items.map((item) => item.id === machine.id ? { ...item, photoId, photoIds: [photoId, ...item.photoIds.filter((id) => id !== photoId)] } : item))
  }
  const deleteMachine = (machine: MachineRecord) => {
    if (!window.confirm(`¿Eliminar la maquina "${machine.name}"? También se borrarán sus fotografías.`)) return
    void deleteImages([...machinePhotoIds(machine), ...machinePointPhotoIds(machine)])
    setMachines((items) => items.filter((item) => item.id !== machine.id))
    if (activeMachineId === machine.id) { setActiveId(null); setActiveMachineId(null) }
  }

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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const handleLogout = () => { setShowProfile(false); setLoggedIn(false); setCurrentUser(defaultAdmin()); setEmail(''); setPassword('') }
  const handleLogin = () => {
    let users: ManagedUser[] = []
    try { users = JSON.parse(localStorage.getItem(usersStorageKey) ?? '[]') as ManagedUser[] } catch { users = [] }
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()
    const user = users.find((item) => item.email.toLowerCase() === normalizedEmail && item.password === normalizedPassword)
    const isAdmin = normalizedEmail === 'luisromang@permoda.com.co' && normalizedPassword === 'M4nt3nimiento#6166'
    if (user) { setCurrentUser(user); setLoggedIn(true); return }
    if (isAdmin) { setCurrentUser(defaultAdmin()); setLoggedIn(true); return }
    window.alert('No se pudo iniciar sesión. Verifica el correo y la contraseña. Si el usuario fue creado antes de agregar el campo contraseña, elimínalo y créalo nuevamente.')
  }

  if (!loggedIn) return <Login email={email} setEmail={setEmail} password={password} setPassword={setPassword} rememberUser={rememberUser} setRememberUser={setRememberUser} onLogin={handleLogin} />

  return <div className="shell">
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand"><img className="sidebar-logo" src="/koaj.png" alt="KOAJ Permoda" /></div>
      <nav><p className="nav-caption">CENTRO DE CONTROL</p><NavItem icon={<Gauge />} label="Vista general" active={activeSection === 'Vista general'} collapsed={collapsed} onClick={() => setActiveSection('Vista general')} /><NavItem icon={<Database />} label="Máquinas" active={activeSection === 'Máquinas'} collapsed={collapsed} badge={machines.length} onClick={() => setActiveSection('Máquinas')} /><NavItem icon={<BookOpen />} label="Estándares" active={activeSection === 'Estándares'} collapsed={collapsed} onClick={() => setActiveSection('Estándares')} /><NavItem icon={<FileUp />} label="Importaciones" active={activeSection === 'Importaciones'} collapsed={collapsed} onClick={() => { setActiveSection('Importaciones'); importInput.current?.click() }} /><p className="nav-caption">SISTEMA</p><NavItem icon={<Users />} label="Usuarios" active={activeSection === 'Usuarios'} collapsed={collapsed} onClick={() => setActiveSection('Usuarios')} /><NavItem icon={<Settings />} label="Configuración" active={activeSection === 'Configuración'} collapsed={collapsed} onClick={() => setActiveSection('Configuración')} /></nav>
      <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Colapsar menú">{collapsed ? <ChevronRight /> : <ChevronLeft />}</button><div className="sidebar-footer"><div className="status-dot" />{!collapsed && <span>Sistema operativo</span>}</div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu"><Menu size={20} /></button><div className="breadcrumb"><span>Centro de control</span><b>/</b><strong>{activeSection}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notificaciones"><Bell size={18} /><i /></button><button className="profile-trigger" onClick={() => setShowProfile(!showProfile)}><UserAvatar user={currentUser} /><span>{currentUser.name}<small>{currentUser.role}</small></span><ChevronRight size={15} /></button></div></header>
      <AnimatePresence>{showProfile && <motion.div className="profile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><div className="profile-menu-head"><UserAvatar user={currentUser} /><div><strong>{currentUser.name}</strong><span>{currentUser.role}</span></div></div><label className="profile-photo-option"><span className="profile-photo-btn"><Camera size={14} />{currentUser.photo ? 'Cambiar foto' : 'Agregar foto'}</span><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setUserPhoto(file); event.target.value = '' }} /></label><button onClick={handleLogout}><LogOut size={16} /> Cerrar sesión</button></motion.div>}</AnimatePresence>
      <input ref={importInput} className="hidden-file-input" type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void runImport(file); event.target.value = '' }} />
      {activeSection === 'Usuarios' ? <UsersView /> : activeSection === 'Máquinas' ? <MachinesView machines={machines} activeId={activeMachineId} photoUrls={photoUrls} message={importMessage} onSelect={selectMachine} onImport={() => importInput.current?.click()} onDelete={deleteMachine} onPromotePhoto={promoteMachinePhoto} onUploadPhoto={(machine, file) => void uploadMachinePhoto(machine, file)} /> : <div className="content-wrap">
        <motion.section className="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><div><p className="eyebrow"><span className="live-dot" /> SISTEMA EN LÍNEA</p><h1>{greeting}, {currentUser.name.split(' ')[0]}.</h1><p className="welcome-copy">Supervisa tus estándares y localiza cada punto crítico de lubricación.</p></div><img src="/koaj.png" className="client-logo" alt="Permoda" /></motion.section>
        <section className="metric-grid"><Metric icon={<Database />} value={String(machines.length).padStart(2, '0')} label="Máquinas registradas" trend={activeMachine ? activeMachine.name : 'Sin selección'} /><Metric icon={<Sparkles />} value={String(points.length).padStart(2, '0')} label="Puntos de lubricación" trend={activeMachine ? 'Desde estándar Excel' : 'Selecciona una máquina'} /><Metric icon={<Images />} value={String(points.filter((item) => item.photos?.length).length).padStart(2, '0')} label="Puntos con fotografía" trend={activeMachine?.sourceFile ?? '—'} /><Metric icon={<ShieldCheck />} value="100%" label="Datos técnicos" trend="Información disponible" /></section>
        <div className="section-heading"><div><p className="eyebrow">{activeSection.toUpperCase()}</p><h2>Mapa de lubricación</h2>{importMessage && <p className="import-message">{importMessage}</p>}</div><button className="primary-btn" onClick={() => importInput.current?.click()}><FileUp size={16} /> Ingresar nuevo estándar</button></div>
        <div className={`drop-zone ${dragOver ? 'drag-over' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragOver(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragOver(false) }} onDrop={(event) => { event.preventDefault(); setDragOver(false); const file = event.dataTransfer.files[0]; if (file) void runImport(file) }}><FileUp size={22} /><div><strong>{dragOver ? 'Suelta el estándar aquí' : 'Arrastra y suelta un estándar'}</strong><span>Excel .xlsx o .xls · las imágenes del archivo se cargan automáticamente</span></div><button type="button" onClick={() => importInput.current?.click()}>Elegir archivo</button></div>
        {!activeMachine || !point ? <section className="machines-empty machines-empty-inline"><Database size={28} /><strong>No hay un estándar activo</strong><span>Entra a Máquinas para seleccionar una, o importa un nuevo estándar.</span><button className="primary-btn" onClick={() => setActiveSection('Máquinas')}>Ver máquinas</button></section> : <section className="workspace-grid"><div className="machine-card"><div className="machine-toolbar"><div><span className="label">ESTÁNDAR ACTIVO · {(activeMachine.plant || 'Sin planta').toUpperCase()}</span><h3>{activeMachine.name} <ChevronRight size={16} /></h3><span className="machine-meta">Modelo {activeMachine.model || '—'} · Serie {activeMachine.series || '—'}</span></div><button className="select-btn" onClick={() => setActiveSection('Máquinas')}>Cambiar máquina <ChevronRight size={15} /></button></div><div className="machine-stage">{machinePhoto ? <img className="machine-photo" src={machinePhoto} alt={activeMachine.name} /> : <div className="machine-stage-empty"><span>{machineInitials(activeMachine.name)}</span><p>Sin fotografía de la máquina</p><label className="link-btn">Cargar imagen<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadMachinePhoto(activeMachine, file); event.target.value = '' }} /></label></div>}{activeMachine.photoIds.length > 1 && <div className="machine-stage-thumbs">{activeMachine.photoIds.map((photoId) => <button key={photoId} className={photoId === activeMachine.photoId ? 'active' : ''} onClick={() => promoteMachinePhoto(activeMachine, photoId)} title="Usar como foto principal" aria-label="Usar como foto principal">{photoUrls[photoId] ? <img src={photoUrls[photoId]} alt="" /> : null}</button>)}</div>}</div><div className="machine-footer"><span><i className="legend-dot cyan" /> Fotografía principal</span><span><i className="legend-dot" /> Estándar importado</span><span className="stage-label"><span className="led" /> Estándar activo</span><span className="coords">{points.length} puntos registrados</span></div></div>
          <AnimatePresence mode="wait"><motion.aside className="point-panel editor-panel" key={point.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}><div className="panel-header"><div><span className="eyebrow">EDICIÓN SECUENCIAL · {currentIndex + 1} DE {points.length}</span><h3><span className="number-badge">{String(point.id).padStart(2, '0')}</span><span>Punto de lubricación<small>{point.reference}</small></span></h3></div></div><div className="sequence-controls"><button disabled={currentIndex === 0} onClick={() => setSelectedPoint(points[currentIndex - 1].id)}><ChevronLeft size={15} /> Anterior</button><span>PUNTO {point.id} / {points.length}</span><button disabled={currentIndex === points.length - 1} onClick={() => setSelectedPoint(points[currentIndex + 1].id)}>Siguiente <ChevronRight size={15} /></button></div><label className={`photo-upload ${photoDragOver ? 'photo-drag-over' : ''}`} onDragEnter={(event) => { event.preventDefault(); setPhotoDragOver(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setPhotoDragOver(false) }} onDrop={(event) => { event.preventDefault(); setPhotoDragOver(false); void addPointPhotos(Array.from(event.dataTransfer.files)) }}>Fotografía del punto<input type="file" accept="image/*" multiple onChange={(event) => { void addPointPhotos(Array.from(event.target.files ?? [])); event.target.value = '' }} />{point.photos?.length ? <span className="photo-upload-count">{point.photos.length} {point.photos.length === 1 ? 'fotografía cargada' : 'fotografías cargadas'}</span> : <span>Arrastra la foto aquí o haz clic para seleccionar</span>}</label>{point.photos?.length ? <div className="point-gallery">{point.photos.map((photoId) => <div className="point-gallery-item" key={photoId}><img src={photoUrls[photoId]} alt={`Punto ${point.id}`} /><button onClick={() => removePointPhoto(photoId)} aria-label="Quitar fotografía"><X size={12} /></button></div>)}</div> : null}<div className="editable-fields"><EditableField label="Componente" value={point.component} onChange={(value) => updatePoint('component', value)} /><EditableField label="Referencia" value={point.reference} onChange={(value) => updatePoint('reference', value)} /><EditableField label="Tipo de grasa / lubricante" value={point.lubricant} onChange={(value) => updatePoint('lubricant', value)} /><EditableField label="Herramientas" value={point.tools} onChange={(value) => updatePoint('tools', value)} /><EditableField label="Código de identificación" value={point.code} onChange={(value) => updatePoint('code', value)} accent /><EditableField label="Cantidad a dosificar" value={point.quantity} onChange={(value) => updatePoint('quantity', value)} /><EditableField label="Frecuencia" value={point.frequency} onChange={(value) => updatePoint('frequency', value)} /><EditableField label="Tiempo" value={point.time} onChange={(value) => updatePoint('time', value)} mono /><label className="procedure-field">Paso a paso<textarea value={point.procedure} onChange={(event) => updatePoint('procedure', event.target.value)} /></label></div><button className="procedure-btn" onClick={() => importInput.current?.click()}><FileUp size={14} /> Importar estándar <ChevronRight size={14} /></button></motion.aside></AnimatePresence>
        </section>}
      </div>}
    </main>
  </div>
}

function NavItem({ icon, label, active, collapsed, badge, onClick }: { icon: ReactNode; label: string; active?: boolean; collapsed: boolean; badge?: number; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} title={collapsed ? label : undefined} data-label={collapsed ? label : undefined} onClick={onClick}>{icon}{!collapsed && <span>{label}</span>}{badge !== undefined && !collapsed && <em className="nav-badge">{String(badge).padStart(2, '0')}</em>}{active && <i />}</button> }
function Metric({ icon, value, label, trend }: { icon: ReactNode; value: string; label: string; trend: string }) { return <motion.div className="metric-card" whileHover={{ y: -3 }}><div className="metric-icon">{icon}</div><strong>{value}</strong><span>{label}</span><small>{trend}</small></motion.div> }
function EditableField({ label, value, onChange, accent, mono }: { label: string; value: string; onChange: (value: string) => void; accent?: boolean; mono?: boolean }) { return <label className={`editable-field ${accent ? 'accent' : ''} ${mono ? 'mono' : ''}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label> }
function UserAvatar({ user, className }: { user: ManagedUser; className?: string }) { if (user.photo) return <img src={user.photo} alt={user.name} className={className} />; const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(); return <span className={`avatar-placeholder ${className ?? ''}`}>{initials}</span> }
function Login({ email, setEmail, password, setPassword, rememberUser, setRememberUser, onLogin }: { email: string; setEmail: (value: string) => void; password: string; setPassword: (value: string) => void; rememberUser: boolean; setRememberUser: (value: boolean) => void; onLogin: () => void }) { return <main className="login-screen"><motion.div className="login-visual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .7 }}><div className="login-orbit" /><motion.img className="login-permoda-logo" src="/koaj.png" alt="KOAJ Permoda" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }} /><div className="login-message"><p className="eyebrow">PLATAFORMA INDUSTRIAL · v1.0</p><h1>Controla la precisión.<br /><em>Protege el movimiento.</em></h1><p>Identificación visual de puntos de lubricación para operaciones industriales Permoda.</p></div></motion.div><div className="login-form-wrap"><motion.div className="login-form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25, duration: .55 }}><motion.img src="/yo.png" className="login-avatar" alt="Luis Garcia" initial={{ scale: .8, x: 0 }} animate={{ scale: 1, x: [0, -16, 16, 0] }} transition={{ delay: .4, duration: 1.4, times: [0, .32, .68, 1], ease: 'easeInOut' }} /><p className="eyebrow">ACCESO SEGURO</p><h2>Bienvenido de nuevo</h2><p className="login-sub">Ingresa tus credenciales para continuar.</p><label>Correo corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" /></label><label className="remember"><input type="checkbox" checked={rememberUser} onChange={(event) => setRememberUser(event.target.checked)} /><span>Recordar usuario</span></label><button className="login-btn" onClick={onLogin}>Iniciar sesión <ChevronRight size={17} /></button><div className="login-footer"><span><ShieldCheck size={14} /> Conexión protegida</span></div></motion.div></div></main> }

export default App
