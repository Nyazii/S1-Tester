const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const { dialog } = require('electron');

// Injetando Dados .env
const getConfig = () => {
  if (process.env.NODE_ENV !== 'production' && !process.resourcesPath) {
    require('dotenv').config();
  }
  
  return {
    MQTT_HOST: process.env.MQTT_HOST || '__MQTT_HOST__',
    MQTT_PORT: parseInt(process.env.MQTT_PORT || '__MQTT_PORT__'),
    MQTT_USERNAME: process.env.MQTT_USERNAME || '__MQTT_USERNAME__',
    MQTT_PASSWORD: process.env.MQTT_PASSWORD || '__MQTT_PASSWORD__',
    WIFI_SSID: process.env.WIFI_SSID || '__WIFI_SSID__',
    WIFI_PASSWORD: process.env.WIFI_PASSWORD || '__WIFI_PASSWORD__'
  };
};

const config = getConfig();

// Configurações de segurança
app.disableHardwareAcceleration();

let mainWindow;

// Gerenciador MQTT
class MQTTManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log('[MAIN] Iniciando conexao MQTT...');
      
      const mqttOptions = {
        host: config.MQTT_HOST || 'localhost',
        port: config.MQTT_PORT || 1883,
        username: config.MQTT_USERNAME,
        password: config.MQTT_PASSWORD,
        protocol: 'mqtts',
        connectTimeout: 5000,
        reconnectPeriod: 5000,
        keepalive: 60,
        clean: true,
        reconnectDelayMax: 30000,
        rejectUnauthorized: false
      };

      this.client = mqtt.connect(mqttOptions);

      // Timeout de segurança
      const timeout = setTimeout(() => {
        reject(new Error('TIMEOUT'));
        if (this.client) {
          this.client.end(true);
          this.client = null;
        }
      }, 10000);

      this.client.on('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        console.log('[MAIN] MQTT conectado');
        
        // Subscribe log
        this.client.subscribe('/dev/+/register/+/log', (err) => {
          if (err) {
            console.error('[MAIN] Erro no subscribe:', err);
            reject(err);
          } else {
            console.log('[MAIN] Subscribe log realizado');
          }
        });
        
        // Subscribe data
        this.client.subscribe('/dev/+/register/+/data/#', (err) => {
          if (err) {
            console.error('[MAIN] Erro no subscribe:', err);  
            reject(err);
          } else {
            console.log('[MAIN] Subscribe data realizado');
          }
        });
      });

      this.client.on('message', (topic, message, packet) => {
        // Enviar mensagens para o renderer de forma segura
        // if (packet.retain) return;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mqtt-message', {
            topic: topic,
            message: message.toString()
          });
        }
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        this.isConnected = false;
        console.error('[MAIN] Erro MQTT:', err.message);
        
        let userMessage = 'Erro de conexao';
        if (err.code === 'ECONNREFUSED') {
          userMessage = 'Broker indisponível';
        } else if (err.code === 'ENOTFOUND') {
          userMessage = 'Host não encontrado';
        }
        
        reject(new Error(userMessage));
        
        if (this.client) {
          this.client.end(true);
          this.client = null;
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
        console.log('[MAIN] Conexao MQTT fechada');
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mqtt-disconnected');
        }
      });
      resolve({ success: true });
    });
  }

  disconnect() {
    return new Promise((resolve) => {
      console.log('[MAIN] Desconectando MQTT...');
      
      if (this.client) {
        this.client.removeAllListeners();
        this.client.end(true);
        this.client = null;
      }
      
      this.isConnected = false;
      resolve({ success: true });
    });
  }

  publish(topic, message) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        reject(new Error('Não conectado'));
        return;
      }

      this.client.publish(topic, message, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }
}

const mqttManager = new MQTTManager();

// Função para obter o caminho correto para os dados da aplicação
function getDataPath() {
  const userDataPath = app.getPath('userData');
  
  // Garante que o diretório existe
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  return path.join(userDataPath, 'dbDevices.json');
}

// Atualiza o caminho do banco de dados
const dbPath = getDataPath();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,          // Desabilita Node.js no renderer
      contextIsolation: true,          // Isola contextos
      enableRemoteModule: false,       // Desabilita remote
      webSecurity: true,              // Habilita verificações web
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js') // Script ponte seguro
    },
    show: false,
    icon: path.join(__dirname, 'assets/icon.ico')
  });

  mainWindow.loadFile('index.html');

  // Verifica se está no modo --dev
  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.send('mqtt-connected');
    mainWindow.show();
    if (process.argv.includes('--dev')) {
      console.log('Modo desenvolvimento detectado - abrindo DevTools...');
      mainWindow.webContents.openDevTools();
    } else {
      Menu.setApplicationMenu(null);
    }
    
    // Log do caminho do banco de dados para debug
    console.log('[MAIN] Caminho do banco de dados:', dbPath);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Carrega os devices salvos
function loadDevices() {
    if (fs.existsSync(dbPath)) {
        try {
            const raw = fs.readFileSync(dbPath, 'utf-8');
            if (raw.trim() === '') return [];
            return JSON.parse(raw);
        } catch (err) {
            console.error('[MAIN] Erro ao carregar devices:', err);
            return [];
        }
    }
    return [];
}

// Função para salvar devices de forma segura
function saveDevices(devices) {
    try {
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(dbPath, JSON.stringify(devices, null, 2), 'utf-8');
        console.log(`[MAIN] Devices salvos em: ${dbPath}`);
        return true;
    } catch (err) {
        console.error('[MAIN] Erro ao salvar devices:', err);
        return false;
    }
}

//IPC HANDLERS - Comunicação segura entre processos

ipcMain.handle('mqtt-publish', async (event, topic, message) => {
  message = +message; // false -> 0 / true -> 1
  const configData = {
            wifi: {
                ssid: config.WIFI_SSID || "DefaultNetwork",
                senha: config.WIFI_PASSWORD || "",
                device_password: "",
                timezone: -3,
                ap: 2,
                il: 180
            },
            mqtt: {
                painel: false,
                id: topic,
                nome: topic,
                porta: config.MQTT_PORT || 1883,
                client_id: "device/register",
                broker: config.MQTT_HOST || "localhost",
                usuario: config.MQTT_USERNAME || "",
                password: config.MQTT_PASSWORD || ""
            },
            pins: {
                p1: message,
                p2: message,
                p3: message,
                tv: 30,
                tc: 1000,
                vp: 200
            }
  };
  const commandCMD = `set.config(${JSON.stringify(configData)})`;
  try {
    const result = await mqttManager.publish(`/dev/device/register/${topic}/cmd`, commandCMD);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-data-path', () => {
  return dbPath;
});

ipcMain.handle('export-validated-devices', async (event, devices) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar lista de dispositivos validados',
      defaultPath: 'dispositivos_validados.txt',
      filters: [
        { name: 'Arquivo de Texto', extensions: ['txt'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });

    if (!canceled && filePath) {
      const content = devices.map(device => 
        `${device.id} - Validado em: ${new Date(device.validationDate).toLocaleString('pt-BR')}`
      ).join('\n');
      
      fs.writeFileSync(filePath, content, 'utf8');
      return { success: true, path: filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Processos do DB
ipcMain.handle('dbsave', async (event, device) => {
  if (device.validated) {
      const devices = loadDevices();
      // Verifica se o device já existe
      const exists = devices.some(d => d.id === device.id);
      if (!exists) {
          devices.push(device);
          const saved = saveDevices(devices);
          if (saved) {
              console.log(`[MAIN] Dispositivo ${device.id} salvo.`);
              return { success: true };
          } else {
              console.error(`[MAIN] Erro ao salvar dispositivo ${device.id}`);
              return { success: false, error: 'Erro ao salvar no banco de dados' };
          }
      }
  }
  return { success: true };
});

ipcMain.handle('load-devices', async () => {
  return loadDevices();
});

ipcMain.handle('remove-device', async (event, deviceId) => {
  const devices = loadDevices();
  const updatedDevices = devices.filter(device => device.id !== deviceId);
  const saved = saveDevices(updatedDevices);
  
  if (saved) {
      console.log(`[MAIN] Dispositivo ${deviceId} removido do banco.`);
      return { success: true };
  } else {
      console.error(`[MAIN] Erro ao remover dispositivo ${deviceId}`);
      return { success: false, error: 'Erro ao atualizar banco de dados' };
  }
});

// Ciclo de vida da aplicação
app.whenReady().then(async () => {
  await mqttManager.connect();
  createWindow();
});

app.on('window-all-closed', () => {
  mqttManager.disconnect();
  if (process.platform !== 'darwin') {
    app.quit();
  } else {
    isConnected = false;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    if (!isConnected) {
          mqttManager.connect().then(() => {
            isConnected = true;
          }).catch(error => {
            console.log('[MAIN] Erro ao reconectar:', error.message);
          });
        }  }
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Erro não tratado:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Promise rejeitada:', reason);
});