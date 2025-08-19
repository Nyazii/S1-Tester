const { contextBridge, ipcRenderer } = require('electron');

//Expõe apenas APIs necessárias
contextBridge.exposeInMainWorld('electronAPI', {
  // Conexão MQTT
  mqtt: {
    publish: (topic, message) => {
      return ipcRenderer.invoke('mqtt-publish', topic, message)
    },
    // Listeners para eventos
    onConnected: (callback) => {
      ipcRenderer.on('mqtt-connected', () => callback());
    },
    onMessage: (callback) => {
      ipcRenderer.on('mqtt-message', (event, data) => callback(data));
    },
    onDisconnected: (callback) => {
      ipcRenderer.on('mqtt-disconnected', () => callback());
    },
    
    // Limpeza de listeners
    removeListenersmqtt: () => {
      ipcRenderer.removeAllListeners('mqtt-connected');
      ipcRenderer.removeAllListeners('mqtt-message');
      ipcRenderer.removeAllListeners('mqtt-disconnected');
    }
  },
  
  // Utilitários da aplicação
  app: {
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    
    dbSave: (device) => ipcRenderer.invoke('dbsave', device),

    loadDevices: () => ipcRenderer.invoke('load-devices'),

    removeDevice: (deviceId) => ipcRenderer.invoke('remove-device', deviceId),

    exportValidatedDevices: (devices) => ipcRenderer.invoke('export-validated-devices', devices)
  },
  
  // Sistema (apenas o necessário)
  system: {
    platform: process.platform,
    arch: process.arch
  },
  
  // Console seguro para debug
  console: {
    log: (...args) => console.log('[RENDERER]', ...args),
    error: (...args) => console.error('[RENDERER]', ...args),
    warn: (...args) => console.warn('[RENDERER]', ...args)
  }
});

//VALIDAÇÃO DE SEGURANÇA
console.log('Preload script carregado com seguranca');
console.log('Context isolation:', process.contextIsolated);
console.log('Node integration:', process.env.NODE_INTEGRATION);

// Listener para debug (removível em produção)
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado com seguranca');
  });
}