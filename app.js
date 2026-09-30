// Dieselben UUIDs wie im ESP32 Sketch
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID    = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleDevice;
let timerChar;

// UI Hilfsfunktion
function toggleFields() {
  const mode = document.getElementById('modeSelect').value;
  document.getElementById('metconFields').style.display = (mode === 'METCON') ? 'block' : 'none';
  document.getElementById('intervalFields').style.display = (mode === 'INTERVAL') ? 'block' : 'none';
}

// Web Bluetooth Verbindung
async function connectESP32() {
  const statusEl = document.getElementById('connStatus');
  try {
    statusEl.innerText = "Suche Gerät...";
    
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'LilyGo' }],
      optionalServices: [SERVICE_UUID]
    });

    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

    statusEl.innerText = "Verbinde...";
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    timerChar = await service.getCharacteristic(CHAR_UUID);

    // Notifications abonnieren (Empfängt Lock-Status vom LilyGo)
    await timerChar.startNotifications();
    timerChar.addEventListener('characteristicvaluechanged', handleESPMessage);

    statusEl.innerText = "Erfolgreich Verbunden";
    statusEl.className = "status text-connected";
    document.getElementById('sendBtn').disabled = false;

  } catch (error) {
    console.error("Bluetooth Fehler:", error);
    statusEl.innerText = "Verbindung fehlgeschlagen";
    statusEl.className = "status text-disconnected";
  }
}

// Nachrichten / Status vom ESP32 verarbeiten
function handleESPMessage(event) {
  const decoder = new TextDecoder('utf-8');
  const jsonString = decoder.decode(event.target.value);
  
  try {
    const data = JSON.parse(jsonString);
    if (data.hasOwnProperty('locked')) {
      document.getElementById('sendBtn').disabled = data.locked;
      document.getElementById('modeSelect').disabled = data.locked;
    }
  } catch (e) {
    console.error("JSON Parsing Fehler:", e);
  }
}

// Konfiguration per Bluetooth senden
async function sendConfig() {
  if (!timerChar) return;

  const mode = document.getElementById('modeSelect').value;
  let payload = { mode: mode };

  if (mode === 'METCON') {
    payload.duration = parseInt(document.getElementById('metconDuration').value);
  } else if (mode === 'INTERVAL') {
    payload.work = parseInt(document.getElementById('workTime').value);
    payload.rest = parseInt(document.getElementById('restTime').value);
    payload.rounds = parseInt(document.getElementById('rounds').value);
  }

  const encoder = new TextEncoder();
  try {
    await timerChar.writeValue(encoder.encode(JSON.stringify(payload)));
  } catch (err) {
    console.error("Fehler beim Senden:", err);
  }
}

function onDisconnected() {
  const statusEl = document.getElementById('connStatus');
  statusEl.innerText = "Verbindung getrennt";
  statusEl.className = "status text-disconnected";
  document.getElementById('sendBtn').disabled = true;
}