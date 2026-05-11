import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  pickVaultFolder: () => ipcRenderer.invoke('pick-vault-folder'),
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  readVaultFiles: (vaultPath: string) => ipcRenderer.invoke('read-vault-files', vaultPath),
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_event, message) => callback(message))
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates') as Promise<{ hasUpdate: boolean; version?: string | null; error?: string }>,
  downloadAndInstallUpdate: () => ipcRenderer.invoke('download-and-install-update'),
  writeVaultFile: (filePath: string, content: string) => ipcRenderer.invoke('write-vault-file', filePath, content) as Promise<{ ok: boolean; error?: string }>,
  getFileMtime: (filePath: string) => ipcRenderer.invoke('get-file-mtime', filePath) as Promise<number | null>,
  encryptData: (data: string) => ipcRenderer.invoke('encrypt-data', data) as Promise<string>,
  decryptData: (data: string) => ipcRenderer.invoke('decrypt-data', data) as Promise<string>,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
})
