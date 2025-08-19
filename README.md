# MQTT Device Monitor - S1 IoT

Um monitor profissional para dispositivos IoT desenvolvido com Electron, demonstrando arquitetura segura e padrões de desenvolvimento modernos.

## 🛠️ Tecnologias Utilizadas

- **Electron** - Framework para aplicações desktop com HTML, CSS e JavaScript
- **Node.js** - Runtime JavaScript server-side
- **MQTT.js** - Cliente MQTT para comunicação IoT
- **HTML5/CSS3** - Interface moderna com glassmorphism
- **JavaScript ES6+** - Programação assíncrona e orientada a eventos

## 🏗️ Arquitetura do Sistema

### Processo Principal (Main Process)
- Gerenciamento de conexões MQTT
- Persistência de dados local
- Comunicação segura entre processos (IPC)
- Controle do ciclo de vida da aplicação

### Processo de Renderização (Renderer Process)
- Interface de usuário reativa
- Manipulação de DOM moderna
- Padrões de design responsivo
- Estado de aplicação em tempo real

### Segurança (Security Layer)
- **Context Isolation** - Separação total entre contextos
- **Preload Scripts** - API bridge controlada e segura
- **IPC** - Comunicação inter-processos validada
- **CSP** - Content Security Policy implementada

## 🚀 Funcionalidades

### Monitoramento em Tempo Real
- Conexão MQTT com broker remoto
- Visualização instantânea do status dos dispositivos
- Indicadores visuais de atividade das portas
- Detecção automática de dispositivos online/offline

### Interface Moderna
- Design glassmorphism com efeitos visuais avançados
- Animações CSS suaves e responsivas
- Cards informativos com feedback visual
- Modal system para configuração de dispositivos

### Gerenciamento de Dispositivos
- Validação de dispositivos IoT
- Persistência local de dados validados
- Exportação de relatórios
- Configuração remota via MQTT

## 📋 Características Técnicas

### Padrões de Desenvolvimento
- **Arquitetura MVC** - Separação clara de responsabilidades
- **Event-Driven** - Sistema baseado em eventos
- **Async/Await** - Programação assíncrona moderna
- **Error Handling** - Tratamento robusto de erros
- **Memory Management** - Gerenciamento eficiente de recursos

### Performance
- Throttling de updates para otimização
- Cleanup automático de timeouts
- Lazy loading de componentes
- Debounce em filtros de busca

### Segurança Implementada
```javascript
// Context Isolation
nodeIntegration: false
contextIsolation: true
webSecurity: true

// CSP Header
"default-src 'self'; script-src 'self'"

// IPC Validation
ipcMain.handle('validated-action', async (event, data) => {
    // Validação de entrada
    // Sanitização de dados
    // Execução controlada
})
```

## 🔧 Instalação e Execução

### Pré-requisitos
```bash
Node.js >= 16.0.0
npm >= 8.0.0
```

### Instalação
```bash
# Clonar repositório
git clone [repository-url]

# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build
```

### Scripts Disponíveis
```json
{
  "start": "electron .",
  "dev": "electron . --dev",
  "build": "electron-builder",
  "build:win": "electron-builder --win",
  "build:portable": "electron-builder --win portable"
}
```

## 📁 Estrutura do Projeto

```
mqtt-device-monitor/
├── main.js              # Processo principal Electron
├── renderer.js          # Lógica do frontend
├── preload.js           # Bridge de segurança
├── index.html           # Interface principal
├── styles/              # Arquivos CSS
│   └── main.css
├── assets/              # Recursos estáticos
│   └── icons/
├── package.json         # Configurações do projeto
└── README.md           # Documentação
```

## 🎯 Conceitos Demonstrados

### Desenvolvimento Desktop
- Electron framework completo
- Distribuição multiplataforma
- Packaging e instaladores
- Auto-updater integration ready

### Comunicação IoT
- Protocolo MQTT implementado
- Subscribe/Publish patterns
- Conexão segura com TLS
- Reconnection handling

### Padrões de UI/UX
- Responsive design
- Loading states
- Error boundaries
- User feedback systems

### Engenharia de Software
- Clean code principles
- SOLID principles aplicados
- Design patterns (Observer, MVC)
- Error handling strategies

## 🔒 Segurança

Este projeto demonstra implementação completa de segurança em aplicações Electron:

- ✅ Context Isolation habilitado
- ✅ Node Integration desabilitado
- ✅ Preload scripts controlados
- ✅ CSP headers implementados
- ✅ IPC validation em todas as chamadas
- ✅ Sanitização de dados de entrada
- ✅ Remote module desabilitado

## 🌟 Destaques do Código

### Gerenciamento de Estado Reativo
```javascript
class MQTTDeviceManager {
    constructor() {
        this.devices = new Map();
        this.setupEventListeners();
        this.setupMQTTListeners();
    }
    
    handleMessage(topic, message) {
        // Processamento em tempo real
        this.updateDeviceState(deviceId, data);
        this.renderDevices();
    }
}
```

### Arquitetura de Segurança
```javascript
// preload.js - Bridge segura
contextBridge.exposeInMainWorld('electronAPI', {
    mqtt: {
        publish: (topic, message) => 
            ipcRenderer.invoke('mqtt-publish', topic, message)
    }
});
```

## 📈 Métricas de Performance

- Inicialização < 2s
- Resposta de UI < 100ms
- Memory footprint otimizado
- Conexão MQTT resiliente

## 🎓 Skills Demonstradas

- **Frontend**: HTML5, CSS3, JavaScript ES6+, DOM Manipulation
- **Backend**: Node.js, Event-driven programming, File system
- **Desktop**: Electron, Process management, Native integration
- **IoT**: MQTT protocol, Real-time communication
- **Security**: Context isolation, IPC validation, CSP
- **Architecture**: MVC, Observer pattern, Clean code
- **DevOps**: Build systems, Packaging, Distribution

---

**Desenvolvido como demonstração de capacidades técnicas em desenvolvimento desktop moderno e seguro.**