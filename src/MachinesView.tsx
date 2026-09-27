import { motion } from 'framer-motion'
import { Camera, ChevronRight, Database, FileUp, Images, Trash2 } from 'lucide-react'
import { machineInitials, type MachineRecord } from './data/machines'

type MachinesViewProps = {
  machines: MachineRecord[]
  activeId: string | null
  photoUrls: Record<string, string>
  onSelect: (machineId: string) => void
  onImport: () => void
  onDelete: (machine: MachineRecord) => void
  onPromotePhoto: (machine: MachineRecord, photoId: string) => void
  onUploadPhoto: (machine: MachineRecord, file: File) => void
  message: string
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function MachinesView({ machines, activeId, photoUrls, onSelect, onImport, onDelete, onPromotePhoto, onUploadPhoto, message }: MachinesViewProps) {
  const totalPoints = machines.reduce((total, machine) => total + machine.points.length, 0)
  const totalPhotos = machines.reduce((total, machine) => total + machine.points.filter((point) => point.photos?.length).length, 0)

  return (
    <div className="content-wrap machines-view">
      <motion.section className="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <p className="eyebrow"><span className="live-dot" /> MAQUINARIO EN LÍNEA</p>
          <h1>Máquinas</h1>
          <p className="welcome-copy">Selecciona una máquina para ver su estándar de lubricación, fotos y puntos de servicio.</p>
        </div>
        <button className="primary-btn" onClick={onImport}><FileUp size={16} /> Ingresar estándar</button>
      </motion.section>

      <section className="machines-summary">
        <div><Database size={16} /><span><strong>{String(machines.length).padStart(2, '0')}</strong> máquinas registradas</span></div>
        <div><Images size={16} /><span><strong>{String(totalPoints).padStart(2, '0')}</strong> puntos de lubricación</span></div>
        <div><Camera size={16} /><span><strong>{String(totalPhotos).padStart(2, '0')}</strong> puntos con fotografía</span></div>
      </section>

      {message && <p className="import-message">{message}</p>}

      {machines.length === 0 ? (
        <div className="machines-empty"><Database size={30} /><strong>Aún no hay máquinas registradas</strong><span>Importa un estándar en Excel para crear la primera máquina.</span><button className="primary-btn" onClick={onImport}><FileUp size={16} /> Ingresar estándar</button></div>
      ) : (
        <div className="machine-grid">
          {machines.map((machine) => {
            const withPhoto = machine.points.filter((point) => point.photos?.length).length
            const main = machine.photoId ? photoUrls[machine.photoId] : undefined
            return (
              <motion.article key={machine.id} className={`machine-tile ${activeId === machine.id ? 'active' : ''}`} whileHover={{ y: -3 }}>
                <button className="machine-tile-photo" onClick={() => onSelect(machine.id)} aria-label={`Ver estándar de ${machine.name}`}>
                  {main ? <img src={main} alt={machine.name} /> : <span className="machine-tile-initials">{machineInitials(machine.name)}</span>}
                  {activeId === machine.id && <i className="machine-tile-flag">ESTÁNDAR ACTIVO</i>}
                </button>
                {machine.photoIds.length > 1 && (
                  <div className="machine-tile-thumbs">
                    {machine.photoIds.map((photoId) => (
                      <button key={photoId} className={photoId === machine.photoId ? 'active' : ''} onClick={() => onPromotePhoto(machine, photoId)} title="Usar como foto principal" aria-label="Usar como foto principal">
                        {photoUrls[photoId] ? <img src={photoUrls[photoId]} alt="" /> : null}
                      </button>
                    ))}
                    <label className="machine-tile-upload" title="Subir foto de la máquina"><Camera size={13} /><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadPhoto(machine, file); event.target.value = '' }} /></label>
                  </div>
                )}
                <div className="machine-tile-body">
                  <span className="label">{(machine.plant || 'Sin planta').toUpperCase()}</span>
                  <h3>{machine.name}</h3>
                  <p className="machine-meta">Modelo {machine.model || '—'} · Serie {machine.series || '—'}</p>
                  <div className="machine-tile-stats"><span><strong>{machine.points.length}</strong> puntos</span><span><strong>{withPhoto}</strong> con foto</span><span>{dateFormatter.format(new Date(machine.importedAt))}</span></div>
                  <p className="machine-tile-source" title={machine.sourceFile}>{machine.sourceFile}</p>
                  <div className="machine-tile-actions">
                    <button className="select-btn" onClick={() => onSelect(machine.id)}>Ver estándar <ChevronRight size={15} /></button>
                    <button className="delete-machine" onClick={() => onDelete(machine)} aria-label={`Eliminar ${machine.name}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}
    </div>
  )
}
