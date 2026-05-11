/// <reference types="vite/client" />

interface ElectronAPI {
  pickVaultFolder: () => Promise<string | null>
  getDeviceId: () => Promise<string>
  readVaultFiles: (vaultPath: string) => Promise<Array<{ path: string; content: string }>>
  onMainProcessMessage: (callback: (message: string) => void) => void
  checkForUpdates: () => Promise<{ hasUpdate: boolean; version?: string | null; error?: string }>
  downloadAndInstallUpdate: () => Promise<void>
  writeVaultFile: (filePath: string, content: string) => Promise<{ ok: boolean; error?: string }>
  getFileMtime: (filePath: string) => Promise<number | null>
  encryptData: (data: string) => Promise<string>
  decryptData: (data: string) => Promise<string>
  minimize: () => void
  maximize: () => void
  close: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
