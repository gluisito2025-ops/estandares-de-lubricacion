export type LubricationPoint = {
  id: number
  photos: string[]
  component: string
  reference: string
  lubricant: string
  procedure: string
  tools: string
  code: string
  quantity: string
  frequency: string
  time: string
  x: number
  y: number
}

export const tonelloMachine = {
  name: 'LAVADORA MARCA TONELLO G1 510 MD2',
  model: 'G1 510 MD2',
  series: '8156',
  plant: 'Lavanderia',
  sourceFile: 'estandar lavadora tonello.xlsx',
  points: [
    { id: 1, photos: [], component: 'Bomba hidraulica de cargue y descargue (posterior)', reference: 'Tanque de aceite', lubricant: 'Shell tellus oil 68', procedure: 'Verifique el nivel y el estado del aceite lubricante. Desacople el tanque o recipiente del sistema y drene completamente el lubricante usado. Posteriormente, realice la limpieza interna del tanque, los filtros y la bomba de lubricación, eliminando residuos, sedimentos y contaminantes acumulados. Una vez finalizada la limpieza, reinstale y acople nuevamente todos los componentes. Luego, suministre el lubricante nuevo hasta alcanzar el nivel recomendado y verifique que el sistema opere correctamente.', tools: 'No especificada en el estándar', code: 'AE-H-68-SH', quantity: 'Capacidad: 4 lt. Utilizado: 3,5 litros', frequency: 'Semestral', time: '40 min', x: 22, y: 31 },
    { id: 2, photos: [], component: 'Rodamiento interno bocin del tambor (interno)', reference: 'Rodamientos (eje central de transmision) cantidad: 2', lubricant: 'Marca: SKF System 24 · Referencia: grasa LAGD 125/WA2', procedure: 'Se visualizan los recipientes y, de ser necesario, se cambian.', tools: 'Solo se cambia', code: 'G-R-LGWA2-SKF', quantity: 'Capacidad: 125 ml. Utilizado: 0,7 mililitros diarios', frequency: 'Según lo regulado al sistema', time: '5 min', x: 49, y: 38 },
    { id: 3, photos: [], component: 'Rodamiento interno bocin del tambor (externo)', reference: 'Rodamiento', lubricant: 'Marca: SKF System 24 · Referencia: grasa LAGD 125/WA2', procedure: 'Rodamientos (eje central de transmision) cantidad: 2', tools: 'Solo se cambia', code: 'G-R-LGWA2-SKF', quantity: 'Capacidad: 125 ml. Utilizado: 0,7 mililitros diarios', frequency: 'Según lo regulado al sistema', time: '5 min', x: 36, y: 44 },
    { id: 4, photos: [], component: 'Puntos de lubricacion frontal-posterior', reference: 'Rodamientos delantero y trasero del motor eléctrico', lubricant: 'SKF LGHP2', procedure: 'Retirar las tapas delantera y posterior del motor, luego aspirar cuidadosamente el interior para proteger el devanado y los campos magnéticos, eliminando la acumulación de polvo y contaminación. Posteriormente, soplar con aire comprimido a baja presión para remover la polución residual sin afectar los componentes internos. Después, limpiar el área expuesta con desengrasante adecuado. Finalmente, colocar el pico del inyector (adaptador) en los puntos previamente marcados y mencionados, aplicar la cantidad de lubricante especificada y retirar cualquier exceso de grasa.', tools: 'Engrasadora manual 400 cc', code: 'G-R-LGWA2-SKF', quantity: '80 bombazos (60 gr)', frequency: 'Trimestral', time: '40 min', x: 38, y: 70 },
    { id: 5, photos: [], component: 'Soporte de inclinación (lateral izquierdo e interno) de la lavadora', reference: 'Soporte', lubricant: 'SKF LGWA 2', procedure: 'Colocar el pico del inyector (adaptador) en los puntos ya marcados y mencionados. Luego limpiar con desengrasante el área expuesta.', tools: 'Engrasadora manual 400 cc', code: 'G-R-LGWA2-SKF', quantity: '2 bombazos (1,5 gr.)', frequency: 'Bimestral', time: '2 min', x: 68, y: 68 },
    { id: 6, photos: [], component: 'Soporte de inclinación (lateral derecho e interno) de la lavadora', reference: 'Soporte', lubricant: 'Marca: SKF · Referencia: grasa LAGD 125/WA2', procedure: 'Colocar el pico del inyector (adaptador) en los puntos ya marcados y mencionados. Luego limpiar con desengrasante el área expuesta.', tools: 'Engrasadora manual 400 cc', code: 'G-R-LGWA2-SKF', quantity: '2 bombazos (1,5 gr.)', frequency: 'Bimestral', time: '2 min', x: 28, y: 56 },
    { id: 7, photos: [], component: 'Cilindro hidraulico de elevación (posterior-inferior)', reference: 'Cilindro hidráulico', lubricant: 'Marca: SKF · Referencia: grasa LAGD 125/WA2', procedure: 'Colocar el pico del inyector (adaptador) en los puntos ya marcados y mencionados. Luego limpiar con desengrasante el área expuesta.', tools: 'Engrasadora manual 400 cc', code: 'G-R-LGWA2-SKF', quantity: '2 bombazos (1,5 gr.)', frequency: 'Bimestral', time: '2 min', x: 82, y: 54 },
    { id: 8, photos: [], component: 'Cilindro hidraulico de elevación (posterior-superior)', reference: 'Cilindro hidráulico', lubricant: 'Marca: SKF · Referencia: grasa LAGD 125/WA2', procedure: 'Colocar el pico del inyector (adaptador) en los puntos ya marcados y mencionados. Luego limpiar con desengrasante el área expuesta.', tools: 'Engrasadora manual 400 cc', code: 'G-R-LGWA2-SKF', quantity: '2 bombazos (1,5 gr.)', frequency: 'Bimestral', time: '2 min', x: 58, y: 78 },
  ] as LubricationPoint[],
}
