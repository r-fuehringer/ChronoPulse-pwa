const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID    = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleDevice;
let timerChar;

function toggleFields() {
  const mode = document.getElementById('modeSelect').value;
  document.getElementById('metconFields').style.display = (mode === 'METCON') ? 'block' : 'none';
  document.getElementById('intervalFields').style.display = (mode === 'INTERVAL') ? 'block' : 'none';
}

// 1. Web Bluetooth Verbindung zum LilyGo ESP32
async function connectESP32() {
  const statusEl = document.getElementById('connStatus');
  try {
    statusEl.innerText = "Suche LilyGo...";
    
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'LilyGo' }],
      optionalServices: [SERVICE_UUID]
    });

    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

    statusEl.innerText = "Verbinde...";
    const server = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    timerChar = await service.getCharacteristic(CHAR_UUID);

    // Notifications abonnieren
    await timerChar.startNotifications();
    timerChar.addEventListener('characteristicvaluechanged', handleESPMessage);

    statusEl.innerText = "Erfolgreich Verbunden";
    statusEl.className = "status text-connected";
    
    // UI freischalten
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('modeSelect').disabled = false;
    document.getElementById('scanGarminBtn').disabled = false;

  } catch (error) {
    console.error("Bluetooth Fehler:", error);
    statusEl.innerText = "Verbindung fehlgeschlagen";
    statusEl.className = "status text-disconnected";
  }
}

// 2. Nachrichten / Status vom LilyGo empfangen
function handleESPMessage(event) {
  const decoder = new TextDecoder('utf-8');
  const jsonString = decoder.decode(event.target.value);
  
  try {
    const data = JSON.parse(jsonString);

    // Sperr-Status verarbeiten (vom ESP Button ausgelöst)
    if (data.hasOwnProperty('locked')) {
      document.getElementById('sendBtn').disabled = data.locked;
      document.getElementById('modeSelect').disabled = data.locked;
    }

    // Garmin Uhren-Scan Ergebnisse
    if (data.type === "GARMIN_FOUND") {
      const select = document.getElementById('garminSelect');
      let opt = document.createElement('option');
      opt.value = data.mac;
      opt.text = `${data.name} (${data.rssi} dBm)`;
      select.add(opt);
      
      select.style.display = 'block';
      document.getElementById('connectGarminBtn').style.display = 'block';
    } else if (data.type === "SCAN_FINISHED") {
      document.getElementById('garminScanStatus').innerText = "Suche beendet.";
    } else if (data.type === "GARMIN_CONNECTED") {
      document.getElementById('garminScanStatus').innerText = "Erfolgreich mit Garmin gekoppelt!";
    }

  } catch (e) {
    console.error("JSON Parsing Fehler:", e);
  }
}

// 3. Garmin Uhren-Scan am LilyGo anfordern
async function scanGarmin() {
  if (!timerChar) return;
  document.getElementById('garminScanStatus').innerText = "LilyGo sucht nach Garmin Uhren (5s)...";
  const select = document.getElementById('garminSelect');
  select.innerHTML = '';
  select.style.display = 'none';
  document.getElementById('connectGarminBtn').style.display = 'none';

  const encoder = new TextEncoder();
  await timerChar.writeValue(encoder.encode(JSON.stringify({ action: "SCAN_GARMIN" })));
}

// 4. Ausgewählte Garmin Uhr verbinden
async function connectSelectedGarmin() {
  const mac = document.getElementById('garminSelect').value;
  if (!mac || !timerChar) return;

  document.getElementById('garminScanStatus').innerText = "Sende Kopplungsbefehl an LilyGo...";
  const encoder = new TextEncoder();
  await timerChar.writeValue(encoder.encode(JSON.stringify({ action: "CONNECT_GARMIN", mac: mac })));
}

// 5. Timer Konfiguration senden
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
  document.getElementById('modeSelect').disabled = true;
  document.getElementById('scanGarminBtn').disabled = true;
}
