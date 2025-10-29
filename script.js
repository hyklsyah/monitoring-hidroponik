// main.js
// -------------------------------------------------------
// Menampilkan data sensor & kontrol pompa otomatis (ppm)
// -------------------------------------------------------

import { db } from './firebase.js';
import {
  ref,
  onValue,
  set,
  push,
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js';

// =========================
// Konstanta & utilitas
// =========================
const LOW_PPM = 750;    // Pompa ON  jika ppm < 750
const HIGH_PPM = 1150;  // Pompa OFF jika ppm > 1150
const PUMP_PATH = 'actuators/pump';

const $ = (id) => document.getElementById(id);
const toISO = () => new Date().toISOString();

function logEvent(message, extra = {}) {
  try {
    const logsRef = ref(db, 'logs');
    push(logsRef, { message, ...extra, timestamp: toISO() });
    const logBox = $('log-entries');
    if (logBox) {
      const row = document.createElement('div');
      row.className = 'log-entry';
      row.innerHTML = `
        <span>${message}</span>
        <span class="timestamp">${new Date().toLocaleString()}</span>
      `;
      logBox.prepend(row);
    }
  } catch (e) {
    console.error('Log error:', e);
  }
}

// =========================
// Render UI Sensor
// =========================
function renderSensors(latest) {
  if (!latest) return;
  if ($('suhu')) $('suhu').textContent = Number(latest.suhu).toFixed(1);
  if ($('ph-air')) $('ph-air').textContent = Number(latest.phAir).toFixed(1);
  if ($('tds')) $('tds').textContent = Math.round(Number(latest.kadarNutrisi) || 0);

  const status = String(latest.statusSistem || 'normal');
  const statusEls = [$('status-suhu'), $('status-ph'), $('status-tds')];
  statusEls.forEach((el) => {
    if (!el) return;
    el.className = `status ${status}`;
    el.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  });

  const connEl = $('conn');
  if (connEl) connEl.textContent = 'Terhubung ke Firebase';
}

// =========================
// Kontrol Pompa Otomatis
// =========================
let lastAutoDecision = null; // 'ON' | 'OFF' | null

async function writePumpState(on, mode = 'AUTO', note = '') {
  try {
    await set(ref(db, PUMP_PATH), {
      on: !!on,
      mode,
      updatedAt: toISO(),
      ...(note ? { note } : {}),
    });
  } catch (e) {
    console.error('Gagal set status pompa:', e);
  }
}

function autoControlPump(ppm) {
  if (ppm == null || isNaN(ppm)) return;

  if (ppm < LOW_PPM && lastAutoDecision !== 'ON') {
    lastAutoDecision = 'ON';
    writePumpState(true, 'AUTO', `AUTO: ppm ${ppm} < ${LOW_PPM}`);
    logEvent(`Pompa ON (AUTO). ppm=${ppm} < ${LOW_PPM}`, { ppm, rule: 'LOW' });
  } else if (ppm > HIGH_PPM && lastAutoDecision !== 'OFF') {
    lastAutoDecision = 'OFF';
    writePumpState(false, 'AUTO', `AUTO: ppm ${ppm} > ${HIGH_PPM}`);
    logEvent(`Pompa OFF (AUTO). ppm=${ppm} > ${HIGH_PPM}`, { ppm, rule: 'HIGH' });
  }
  // Di rentang 750–1150, pertahankan state terakhir (hindari flip-flop)
}

// =========================
// Listener: Data Monitoring
// =========================
// Struktur data di 'monitoring' diambil paling baru
onValue(ref(db, 'monitoring'), (snapshot) => {
  const val = snapshot.val();
  if (!val) return;
  const entries = Object.values(val);
  if (entries.length === 0) return;

  const latest = entries[entries.length - 1];
  renderSensors(latest);

  const ppm = Math.round(Number(latest.kadarNutrisi) || 0);
  autoControlPump(ppm);
});

// =========================
// Listener: Status Pompa → UI
// =========================
onValue(ref(db, PUMP_PATH), (snapshot) => {
  const data = snapshot.val() || { on: false, mode: 'AUTO' };
  const isOn = !!data.on;

  if ($('status-pompa')) $('status-pompa').textContent = isOn ? 'Menyala' : 'Mati';

  const btnPompa = $('btn-pompa');
  if (btnPompa) {
    btnPompa.textContent = `Pompa Air: ${isOn ? 'ON' : 'OFF'}`;
    btnPompa.classList.toggle('active', isOn);
  }
});

// =========================
// Kontrol Manual (opsional)
// =========================
document.addEventListener('DOMContentLoaded', () => {
  const btnPompa = $('btn-pompa');
  const btnDownload = $('btn-download');

  // Toggle pompa MANUAL
  if (btnPompa) {
    btnPompa.addEventListener('click', async () => {
      const snap = await new Promise((res) =>
        onValue(ref(db, PUMP_PATH), (s) => res(s), { onlyOnce: true })
      );
      const curr = (snap.val() && !!snap.val().on) || false;
      const next = !curr;
      await writePumpState(next, 'MANUAL', `MANUAL toggle → ${next ? 'ON' : 'OFF'}`);
      logEvent(`Pompa ${next ? 'ON' : 'OFF'} (MANUAL)`);
    });
  }

  // Download CSV data monitoring
  if (btnDownload) {
    btnDownload.addEventListener('click', () => exportMonitoringCSV());
  }
});

// =========================
// Ekspor CSV
// =========================
function exportMonitoringCSV() {
  onValue(ref(db, 'monitoring'), (snapshot) => {
    const val = snapshot.val();
    if (!val) {
      alert('Tidak ada data untuk diunduh.');
      return;
    }
    const rows = Object.values(val);
    const header = ['timestamp', 'suhu', 'phAir', 'kadarNutrisi', 'statusSistem'];
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.timestamp || '',
          Number(r.suhu ?? '').toString().replace('.', ','),
          Number(r.phAir ?? '').toString().replace('.', ','),
          Number(r.kadarNutrisi ?? ''),
          r.statusSistem || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, { onlyOnce: true });
}
