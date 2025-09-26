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
  logger: {
    info: (msg) => ipcRenderer.send('log-info', msg),
    error: (msg) => ipcRenderer.send('log-error', msg)
  }
});