import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, UserPlus, Users } from 'lucide-react'
import { pullFromCloud, pushToCloud } from './lib/sync'

export type ManagedUser = {
  id: string
  name: string
  email: string
  password: string
  role: 'Administrador' | 'Técnico' | 'Consulta'
  photo?: string
}

export const usersStorageKey = 'estandares-lubricacion:users'

export default function UsersView() {
  const [users, setUsers] = useState<ManagedUser[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(usersStorageKey) ?? '[]') as ManagedUser[]
    } catch {
      return []
    }
  })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<ManagedUser['role']>('Consulta')
  const [photo, setPhoto] = useState('')
  const [message, setMessage] = useState('')
  const cloudHydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    void pullFromCloud().then(() => {
      if (cancelled) return
      try {
        const saved = localStorage.getItem(usersStorageKey)
        if (saved) setUsers(JSON.parse(saved) as ManagedUser[])
      } catch {
        /* el contenido local se conserva tal cual */
      }
      cloudHydrated.current = true
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!cloudHydrated.current) return
    void pushToCloud(usersStorageKey, JSON.stringify(users))
  }, [users])

  const pickPhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  const initials = (userName: string) => userName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  const addUser = () => {
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setMessage('Completa nombre, correo y contraseña.')
      return
    }

    if (users.some((user) => user.email.toLowerCase() === cleanEmail)) {
      setMessage('Ese correo ya está registrado.')
      return
    }

    setUsers((items) => [...items, {
      id: crypto.randomUUID(),
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role,
      photo: photo || undefined,
    }])
    setName('')
    setEmail('')
    setPassword('')
    setRole('Consulta')
    setPhoto('')
    setMessage('Usuario agregado correctamente.')
  }

  return (
    <div className="content-wrap users-view">
      <motion.section className="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <p className="eyebrow">ADMINISTRACIÓN DEL SISTEMA</p>
          <h1>Usuarios y roles</h1>
          <p className="welcome-copy">Gestiona el acceso de cada persona a los estándares de lubricación.</p>
        </div>
        <div className="users-count"><strong>{users.length}</strong><span>usuarios registrados</span></div>
      </motion.section>

      <section className="user-admin-grid">
        <div className="user-form-card">
          <div className="admin-card-heading"><div><span className="eyebrow">NUEVO USUARIO</span><h2>Agregar usuario</h2></div><UserPlus size={22} /></div>
          <label className="admin-photo-upload">
            <span className="admin-avatar-preview">{photo ? <img src={photo} alt="Fotografía" /> : initials(name || '?')}</span>
            <span><strong>Fotografía</strong><small>Opcional · toca aquí para elegir un archivo</small></span>
            <input type="file" accept="image/*" onChange={(event) => { pickPhoto(event.target.files?.[0]); event.target.value = '' }} />
          </label>
          <label className="admin-field">Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Ana Rodríguez" /></label>
          <label className="admin-field">Correo corporativo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@empresa.com" /></label>
          <label className="admin-field">Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Crea una contraseña" /></label>
          <label className="admin-field">Rol<select value={role} onChange={(event) => setRole(event.target.value as ManagedUser['role'])}><option>Administrador</option><option>Técnico</option><option>Consulta</option></select></label>
          <button className="primary-btn admin-add-button" onClick={addUser}><UserPlus size={16} /> Crear usuario</button>
          {message && <p className="admin-message">{message}</p>}
        </div>

        <div className="user-list-card">
          <div className="admin-card-heading"><div><span className="eyebrow">CONTROL DE ACCESOS</span><h2>Usuarios registrados</h2></div><Users size={22} /></div>
          {users.length === 0 ? <div className="empty-users"><Users size={28} /><strong>Aún no hay usuarios adicionales</strong><span>Agrega el primer usuario y asígnale un rol.</span></div> : <div className="user-table">
            <div className="user-table-head"><span>Usuario</span><span>Rol</span><span>Acción</span></div>
            {users.map((user) => <div className="user-row" key={user.id}><div className="user-cell"><span className="user-cell-avatar">{user.photo ? <img src={user.photo} alt={`Foto de ${user.name}`} /> : initials(user.name)}</span><div><strong>{user.name}</strong><span>{user.email}</span></div></div><span className="role-badge">{user.role}</span><button className="delete-user" onClick={() => setUsers((items) => items.filter((item) => item.id !== user.id))} aria-label={`Eliminar a ${user.name}`}><Trash2 size={15} /></button></div>)}
          </div>}
        </div>
      </section>
    </div>
  )
}
