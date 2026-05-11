/// <reference types="vite/client" />

interface ElectronAPI {
  pickVaultFolder: () => Promise<string | null>
  getDeviceId: () => Promise<string>
  readVaultFiles: (vaultPath: string) => Promise<Array<{ path: string; content: string }>>
  onMainProcessMessage: (callback: (message: string) => void) => void
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
