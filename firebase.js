// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  updateProfile, 
  updatePassword, 
  sendPasswordResetEmail,
  sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// Konfigurasi Firebase (sudah tambah databaseURL untuk region asia-southeast1 agar hilang warning)
const firebaseConfig = {
  apiKey: "AIzaSyC0GKL--K2H1vQun5o86uubuq5bE5rbws0",
  authDomain: "webserver-1432a.firebaseapp.com",
  databaseURL: "https://webserver-1432a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "webserver-1432a",
  storageBucket: "webserver-1432a.firebasestorage.app",
  messagingSenderId: "428220064671",
  appId: "1:428220064671:web:1f7b33f3f4ef8f367253aa",
  measurementId: "G-DFB0XN5GV6"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Fungsi inisialisasi database monitoring (buat data default jika kosong)
async function initializeMonitoringDatabase() {
  try {
    const monitoringRef = ref(db, 'monitoring');
    onValue(monitoringRef, (snapshot) => {
      if (!snapshot.exists()) {
        const defaultData = {
          'init-2024': {
            suhu: 25.0,
            phAir: 7.0,
            kadarNutrisi: 1200,
            statusSistem: "normal",
            timestamp: new Date().toISOString()
          }
        };
        set(monitoringRef, defaultData)
          .then(() => console.log("Database monitoring diinisialisasi."))
          .catch((error) => console.error("Error inisialisasi DB:", error));
      } else {
        console.log("Database monitoring sudah ada.");
      }
    }, { onlyOnce: true });
  } catch (error) {
    console.error("Error inisialisasi database:", error);
  }
}

// Fungsi tambah data sensor ke Firebase
function addSensorData(suhu, phAir, kadarNutrisi, statusSistem) {
  try {
    const monitoringRef = ref(db, 'monitoring');
    const newDataRef = push(monitoringRef);
    const sensorData = {
      suhu, phAir, kadarNutrisi, statusSistem,
      timestamp: new Date().toISOString()
    };
    set(newDataRef, sensorData)
      .then(() => console.log("Data sensor ditambahkan:", sensorData))
      .catch((error) => console.error("Error add data:", error));
  } catch (error) {
    console.error("Error addSensorData:", error);
  }
}

// Fungsi simulasi data otomatis (untuk testing, jalankan setiap 5 detik)
function startAutoSimulation() {
  setInterval(() => {
    const suhu = 25 + (Math.random() - 0.5) * 2;
    const phAir = 7.0 + (Math.random() - 0.5) * 0.5;
    const kadarNutrisi = 1200 + (Math.random() - 0.5) * 200;
    const status = (phAir < 6.5 || phAir > 7.5 || suhu > 28) ? "warning" : "normal";
    addSensorData(suhu, phAir, kadarNutrisi, status);
  }, 5000);
}

// Fungsi listener real-time untuk update UI dashboard
function startRealtimeListener() {
  try {
    const monitoringRef = ref(db, 'monitoring');
    onValue(monitoringRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const entries = Object.values(data);
        const latest = entries[entries.length - 1]; // Ambil data terbaru
        const suhuEl = document.getElementById('suhu');
        const phEl = document.getElementById('ph-air');
        const tdsEl = document.getElementById('tds');
        const statusEl = document.getElementById('status-suhu');

        if (suhuEl) suhuEl.textContent = latest.suhu.toFixed(1);
        if (phEl) phEl.textContent = latest.phAir.toFixed(1);
        if (tdsEl) tdsEl.textContent = Math.round(latest.kadarNutrisi);
        
        // Update status (untuk semua sensor)
        if (statusEl) {
          statusEl.textContent = latest.statusSistem.charAt(0).toUpperCase() + latest.statusSistem.slice(1);
          statusEl.className = `status ${latest.statusSistem}`;
        }
        const statusPhEl = document.getElementById('status-ph');
        const statusTdsEl = document.getElementById('status-tds');
        if (statusPhEl) statusPhEl.className = `status ${latest.statusSistem}`;
        if (statusTdsEl) statusTdsEl.className = `status ${latest.statusSistem}`;

        // Update koneksi status
        const connEl = document.getElementById('conn');
        if (connEl) connEl.textContent = 'Terhubung ke Firebase';

        console.log("Data terbaru:", latest);
      } else {
        console.log("Tidak ada data di Firebase.");
      }
    });
  } catch (error) {
    console.error("Error listener realtime:", error);
  }
}

// Ekspor fungsi (untuk digunakan di file lain)
export { 
  app, auth, db, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, 
  signOut, updateProfile, updatePassword, sendPasswordResetEmail, sendEmailVerification,
  ref, set, initializeMonitoringDatabase, addSensorData, startAutoSimulation, startRealtimeListener 
};
