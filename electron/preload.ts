import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  pickVaultFolder: () => ipcRenderer.invoke('pick-vault-folder'),
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  readVaultFiles: (vaultPath: string) => ipcRenderer.invoke('read-vault-files', vaultPath),
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_event, message) => callback(message))
  },
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
})
