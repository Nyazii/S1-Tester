class MQTTDeviceS1 {
    constructor() {
        this.devices = new Map();
        this.validatedDevices = new Map();
        this.portTimeouts = new Map();
        
        // Verificar se a API segura está disponível
        if (!window.electronAPI) {
            throw new Error('API Electron não disponível - problema de seguranca!');
        }
        
        this.initializeUI();
        this.setupEventListeners();
        this.setupMQTTListeners();
        this.loadValidatedDevices();

        setInterval(() => this.refreshDevices(), 30000);// Verifica os devices online
        electronAPI.console.log('Monitor iniciado');
    }

    initializeUI() {
        this.elements = {
            connectionStatus: document.getElementById('connection-status'),
            devicesGrid: document.getElementById('devices-grid'),
            totalDevices: document.getElementById('total-devices'),
            validatedDevices: document.getElementById('validated-devices'),
            deviceModal: document.getElementById('device-modal'),
            modalClose: document.getElementById('modal-close'),
            modalDeviceName: document.getElementById('modal-device-name'),
            modalBody: document.getElementById('modal-body'),
            validatedDevicesList: document.getElementById('validated-devices-list'),
            exportValidatedBtn: document.getElementById('export-validated-btn')
        };
    }

    setupEventListeners() {
        this.elements.modalClose.addEventListener('click', () => {
            this.closeModal();
        });

        this.elements.deviceModal.addEventListener('click', (e) => {
            if (e.target === this.elements.deviceModal) {
                this.closeModal();
            }
        });

        this.elements.exportValidatedBtn.addEventListener('click', () => {
            this.exportValidatedDevices();
        });

        this.elements.modalBody.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'sendButton') {
                // Obter o deviceId
                const deviceId = this.getCurrentDeviceId();
                if (deviceId) {
                    const toggleInput = document.getElementById('portsToggle');
                    if (toggleInput) {
                        const activePort = toggleInput.checked;
                        // Define equipamento como offline
                        const device = this.devices.get(deviceId);
                        device.online = false;
                        this.sendConfig(deviceId, activePort);
                    }
                }
            this.renderDevices();
            this.closeModal();
            }
        });

        this.elements.devicesGrid.addEventListener('click', (e) => {
            if (e.target.closest('.validate-device-btn')) {
                e.stopPropagation();
                const button = e.target.closest('.validate-device-btn');
                const deviceId = button.getAttribute('data-device-id');
                this.validatedDevice(deviceId);
                return;
            }

            const card = e.target.closest('.device-card');
            if (card) {
                const deviceId = card.dataset.deviceId;
                this.showDeviceConfig(deviceId);
            }
        });

        
        this.elements.validatedDevicesList.addEventListener('click', (e) => {
            if (e.target.closest('.remove-validated-btn')) {
                const button = e.target.closest('.remove-validated-btn');
                const deviceId = button.getAttribute('data-device-id');
                this.removeValidatedDevice(deviceId);
            }
        });

        // Limpeza ao fechar
        window.addEventListener('beforeunload', () => {
            electronAPI.mqtt.removeListenersmqtt();
        });
    }

    setupMQTTListeners() {
        electronAPI.mqtt.onConnected(() => {
            electronAPI.console.log('Conectado ao broker')
            this,this.updateConnectionStatus('Conectado', 'online');
        })
        
        electronAPI.mqtt.onMessage((data) => {
            electronAPI.console.log('Mensagem recebida:', data);
            this.handleMessage(data.topic, data.message);
        });

        electronAPI.mqtt.onDisconnected(() => {
            electronAPI.console.log('Desconectado do broker');
            this.updateConnectionStatus('Desconectado', 'offline');
        });
    }

    setupDBListeners() {
        
    }

    handleMessage(topic, message) {        

        const topicParts = topic.split('/');
        const deviceId = topicParts[5];
        const type = topicParts[6];
        const port = topicParts[7];

        // Ignora log "Configuration data accepted!"
        if(message[0] == 'C')
            return;

        // Ignora dispositivos já validados
        if (this.validatedDevices.has(deviceId))
            return;

        if (type == 'log' || type == 'data'){
        // Inicializar dispositivo se não existir
            if (!this.devices.has(deviceId)) {
                this.devices.set(deviceId, {
                    id: deviceId,
                    online: true,
                    validated: false,
                    lastSeen: new Date(),
                    signals: {
                        '1': { enable: null, active: false, validated: false },
                        '2': { enable: null, active: false, validated: false },
                        '3': { enable: null, active: false, validated: false }
                    }
                });
            } else {
                const device = this.devices.get(deviceId);
                device.lastSeen = new Date();
                device.online = true;
                if(type == 'log'){
                    Object.keys(device.signals).forEach(channel => {
                        device.signals[channel].validated = false;
                    });
                }
            }
        }
        const device = this.devices.get(deviceId);
        if(type == 'data'){
            // Verifica qual porta foi ativada
            if (device.signals[port]) {
                device.signals[port] = {
                    active: true,
                    validated: true
                };
                device.lastSeen = new Date();
                device.online = true;
                
                const key = `${deviceId}-${port}`;
                //  Timeout de 2s para a porta
                if (this.portTimeouts.has(key)) {
                    clearTimeout(this.portTimeouts.get(key));
                }
                const timeout = setTimeout(() => {
                    const dev = this.devices.get(deviceId);
                    if (dev?.signals[port]) {
                        dev.signals[port].active = false;
                        this.renderDevices();
                        this.updateStats();
                    }
                    this.portTimeouts.delete(key);
                }, 1000);
                this.portTimeouts.set(key, timeout);
                
                electronAPI.console.log(`Dispositivo ${deviceId}, Porta ${port} Validada`);
            }
        }
        this.renderDevices();
        this.updateStats();
    }

    async sendConfig(deviceId, activePort) {
        try {
            // Enviar para o main o Device e a info da porta
            const result = await electronAPI.mqtt.publish(deviceId, activePort);         
            if (result.success) {
                electronAPI.console.log(`Comando enviado para ${deviceId}: ${activePort ? 'Ativar' : 'Desativar'} portas`);
            } else {
                throw new Error('Falha no envio MQTT');
            }
        } catch (error) {
            electronAPI.console.error('Erro ao enviar comando:', error);
            alert('Erro ao enviar comando para o dispositivo!');
        }
    }

    async validatedDevice(deviceId) {
        const device = this.devices.get(deviceId);
        device.validated = true;
        device.lastSeen = new Date();

        this.validatedDevices.set(deviceId, {
            ...device,
            validationDate: new Date()
        });

        //salva o device validado no db
        try{
            await electronAPI.app.dbSave(device);
        } catch (error){
            electronAPI.console.error('Erro ao salvar device:', error);
        }

        this.loadValidatedDevices();
        this.devices.delete(deviceId);
        this.renderDevices();
        this.updateStats();
        console.log(`Dispositivo ${deviceId} validado`);
    }

    async exportValidatedDevices() {
        const validatedArray = Array.from(this.validatedDevices.values());
        
        if (validatedArray.length === 0) {
            alert('Nenhum dispositivo validado para exportar!');
            return;
        }

        try {
            const result = await electronAPI.app.exportValidatedDevices(validatedArray);
            
            if (result.success) {
                alert(`Lista exportada com sucesso!\nArquivo salvo em: ${result.path}`);
            } else if (!result.canceled) {
                throw new Error(result.error || 'Erro desconhecido');
            }
        } catch (error) {
            electronAPI.console.error('Erro ao exportar:', error);
            alert('Erro ao exportar a lista!');
        }
    }

    async loadValidatedDevices() {
        try {
            const devices = await electronAPI.app.loadDevices();
            devices.forEach(device => {
                this.validatedDevices.set(device.id, {
                    ...device,
                    validationDate: device.lastSeen || new Date()
                });
            });
            this.renderValidatedDevices();
            electronAPI.console.log(`${devices.length} dispositivos validados carregados`);
        } catch (error) {
            electronAPI.console.error('Erro ao carregar dispositivos:', error);
        }
    }

    async removeValidatedDevice(deviceId) {
        try {
            await electronAPI.app.removeDevice(deviceId);
            this.validatedDevices.delete(deviceId);
            this.renderValidatedDevices();
            this.updateStats();
            electronAPI.console.log(`Dispositivo ${deviceId} desvalidado`);
        } catch (error) {
            electronAPI.console.error('Erro ao remover dispositivo:', error);
        }
    }

    renderDevices() {
        const sortDevices = Array.from(this.devices.values());        
        sortDevices.sort((a, b) => a.id.localeCompare(b.id));
        
        if (sortDevices.length === 0) {
            this.elements.devicesGrid.innerHTML = `
                <div class="no-devices">
                    <i class="fas fa-search"></i>
                    <p>${this.devices.size === 0 ? 'Nenhum dispositivo encontrado' : 'Nenhum dispositivo correspondente'}</p>
                </div>
            `;
            return;
        }

        this.elements.devicesGrid.innerHTML = sortDevices
            .map(device => this.createDeviceCard(device))
            .join('');
    }

    renderValidatedDevices() {
        const validatedArray = Array.from(this.validatedDevices.values());
        
        if (validatedArray.length === 0) {
            this.elements.validatedDevicesList.innerHTML = '<p class="no-validated">Nenhum dispositivo validado</p>';
            return;
        }

        this.elements.validatedDevicesList.innerHTML = validatedArray
            .map(device => `
                <div class="validated-device-item">
                    <div class="validated-device-info">
                        <div class="validated-device-name">${device.id}</div>
                        <div class="validated-device-date">${this.formatDate(new Date(device.validationDate))}</div>
                    </div>
                    <button class="remove-validated-btn" data-device-id="${device.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `)
            .join('');
    }

    getCurrentDeviceId() {
        return this.elements.modalDeviceName.textContent;
    }

    createDeviceCard(device) {
        const onlineClass = device.online ? 'online' : 'offline';
        
        // Verificar se todos os 3 sinais estão validados
        const allSignalsValidated = Object.values(device.signals).every(signal => signal.validated === true);
        
        return `
            <div class="device-card ${onlineClass}" data-device-id="${device.id}">
                <div class="device-header">
                    <div class="device-name">${device.id}</div>
                    <div class="device-status ${onlineClass}">${device.online ? 'Online' : 'Offline'}</div>
                </div>
                
                <div class="signals-container">
                    ${Object.entries(device.signals).map(([port, signal]) => `
                        <div class="signal-row ${signal.validated ? 'active' : ''}">
                            <div class="signal-info">
                                <span class="signal-label">Porta ${port}</span>
                                <span class="signal-indicator ${signal.active ? 'active' : ''}"></span>
                            </div>
                            <div class="signal-value">${signal.validated ? 'VERIFICADO' : 'PENDENTE'}</div>
                        </div>
                    `).join('')}
                </div>
                
                ${allSignalsValidated ? `
                    <div class="validation-section">
                        <button class="validate-device-btn" data-device-id="${device.id}">
                            <i class="fas fa-check-circle"></i>
                            Validar Dispositivo
                        </button>
                    </div>
                ` : ''}
                
                <div class="last-update">
                    Última atualização: ${device.lastSeen ? this.formatDate(device.lastSeen) : 'Nunca'}
                </div>
            </div>
        `;
    }

    updateStats() {
        const devices = Array.from(this.devices.values());
        const validatedDevices = devices.filter(device => device.validated);

        this.elements.totalDevices.textContent = devices.length;
        this.elements.validatedDevices.textContent = validatedDevices.length;
    }

    showDeviceConfig(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) return;

        this.elements.modalDeviceName.textContent = device.id;
        
        this.elements.modalBody.innerHTML = `
            <div class="device-controls">
                <div class="control-section">
                    <div class="control-header">
                        <h3 class="control-title">Ativar portas</h3>
                        <label class="toggle-switch">
                            <input type="checkbox" id="portsToggle">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="send-button" id="sendButton">
                        <i class="fas fa-paper-plane"></i> Enviar
                    </button>
                </div>
            </div>
        `;
        this.elements.deviceModal.classList.add('active');
    }

    closeModal() {
        this.elements.deviceModal.classList.remove('active');
    }

    refreshDevices() {
        // Verifica se o equipamento está online.
        const now = new Date();
        const timeoutMs = 29500;

        this.devices.forEach(device => {
            const timeSinceLastSeen = now - device.lastSeen;
            if (timeSinceLastSeen > timeoutMs) {
                device.online = false;
            }
        });

        this.renderDevices();
        this.updateStats();
    }

    updateConnectionStatus(text, status) {
        this.elements.connectionStatus.innerHTML = `
            <span class="status-indicator ${status}"></span>
            ${text}
        `;
    }

    formatDate(date) {
        if (!date) return 'Nunca';
        
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Agora mesmo';
        } else if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}min atrás`;
        } else {
            return date.toLocaleString('pt-BR');
        }
    }
}

let Monitor;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Verificar se ambiente é seguro
        if (!window.electronAPI) {
            throw new Error('Ambiente inseguro detectado!');
        }
        
        // Inicializar monitor
        Monitor = new MQTTDeviceS1();
        
        // Info da versão
        const version = await electronAPI.app.getVersion();
        electronAPI.console.log(`v${version}`);
        
    } catch (error) {
        console.error('Falha na inicialização:', error);
        document.body.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: red;">
                <h1>Erro de Seguranca</h1>
                <p>A aplicação não pode ser iniciada de forma segura.</p>
                <p>Erro: ${error.message}</p>
            </div>
        `;
    }
});