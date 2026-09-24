const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('lubricacion', { machines: () => ipcRenderer.invoke('machines:list'), points: (machineId) => ipcRenderer.invoke('points:list', machineId) })
