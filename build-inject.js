// build-inject.js
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const injectEnvVariables = () => {
  console.log('Injetando variáveis de ambiente no build...');
  
  const mainJsPath = path.join(__dirname, 'main.js');
  
  if (!fs.existsSync(mainJsPath)) {
    console.error('Arquivo main.js não encontrado!');
    process.exit(1);
  }
  
  let mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
  
  //Mapeamento placeholders
  const envVars = {
    "'__MQTT_HOST__'": `'${process.env.MQTT_HOST || 'localhost'}'`,
    "'__MQTT_PORT__'": process.env.MQTT_PORT || '1883',
    "'__MQTT_USERNAME__'": `'${process.env.MQTT_USERNAME || ''}'`,
    "'__MQTT_PASSWORD__'": `'${process.env.MQTT_PASSWORD || ''}'`,
    "'__WIFI_SSID__'": `'${process.env.WIFI_SSID || 'DefaultNetwork'}'`,
    "'__WIFI_PASSWORD__'": `'${process.env.WIFI_PASSWORD || ''}'`
  };
  
  Object.keys(envVars).forEach(placeholder => {
    const value = envVars[placeholder];
    
    const occurrences = (mainJsContent.match(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    
    if (occurrences > 0) {
      mainJsContent = mainJsContent.split(placeholder).join(value);
      console.log(`${placeholder} -> ${value} (${occurrences} substituições)`);
    } else {
      console.log(`${placeholder} não encontrado no código`);
    }
  });
  
  fs.writeFileSync(mainJsPath, mainJsContent);
  console.log('Variáveis injetadas com sucesso!');
};

const restoreOriginal = () => {
  const backupPath = path.join(__dirname, 'main.js.backup');
  const mainJsPath = path.join(__dirname, 'main.js');
  
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, mainJsPath);
    fs.unlinkSync(backupPath);
    console.log('Arquivo original restaurado');
  } else {
    console.log('Backup não encontrado');
  }
};

const makeBackup = () => {
  const mainJsPath = path.join(__dirname, 'main.js');
  const backupPath = path.join(__dirname, 'main.js.backup');
  
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(mainJsPath, backupPath);
    console.log('Backup criado: main.js.backup');
  } else {
    console.log('Backup já existe');
  }
};

const command = process.argv[2];

if (command === 'inject') {
  makeBackup();
  injectEnvVariables();
} else if (command === 'restore') {
  restoreOriginal();
} else {
  console.log('Uso:');
  console.log('  node build-inject.js inject  - Injetar variáveis');
  console.log('  node build-inject.js restore - Restaurar original');
}