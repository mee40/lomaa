/* =========================
   CONFIGURACIÓN
========================= */
const DB_NAME = 'lomaa_db';
const DB_VERSION = 1;
const DEVICE_PREFIX = 'R';

/* =========================
   ABRIR BASE
========================= */
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      db = e.target.result;

      if (!db.objectStoreNames.contains('academias')) {
        db.createObjectStore('academias', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
}

/* =========================
   INICIALIZAR DB
========================= */
openDB();

/* =========================
   CONTADORES
========================= */
async function getNextId(key) {
  const tx = db.transaction('meta', 'readwrite');
  const store = tx.objectStore('meta');

  const req = store.get(key);

  return new Promise(resolve => {
    req.onsuccess = () => {
      let counter = req.result ? req.result.value : 1;
      store.put({ key, value: counter + 1 });
      resolve(`${DEVICE_PREFIX}-${counter}`);
    };
  });
}

/* =========================
   ACADEMIAS
========================= */
async function guardarAcademia(nombre) {
  const id = await getNextId('academia_counter');

  const tx = db.transaction('academias', 'readwrite');
  const store = tx.objectStore('academias');

  const academia = {
    id,
    nombre,
    alumnos: []
  };

  store.put(academia);
  return id;
}

function obtenerAcademias() {
  return new Promise(resolve => {
    const tx = db.transaction('academias', 'readonly');
    const store = tx.objectStore('academias');
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
  });
}

/* =========================
   ALUMNOS
========================= */
async function guardarAlumno(academiaId, nombre, telefono) {
  const alumnoId = await getNextId('alumno_counter');

  const tx = db.transaction('academias', 'readwrite');
  const store = tx.objectStore('academias');
  const req = store.get(academiaId);

  return new Promise(resolve => {
    req.onsuccess = () => {
      const academia = req.result;
      if (!academia) return resolve(null);

      const alumno = {
        id: alumnoId,
        nombre,
        telefono,
        pagos: []
      };

      academia.alumnos.push(alumno);
      store.put(academia);
      resolve(alumnoId);
    };
  });
}

/* =========================
   OBTENER ALUMNO POR ID
   (AJUSTADO – NECESARIO)
========================= */
function obtenerAlumnoPorId(alumnoId) {
  return new Promise(resolve => {
    const tx = db.transaction('academias', 'readonly');
    const store = tx.objectStore('academias');
    const req = store.openCursor();

    req.onsuccess = e => {
      const cursor = e.target.result;
      if (!cursor) return resolve(null);

      const academia = cursor.value;
      const alumno = (academia.alumnos || []).find(a => a.id === alumnoId);

      if (alumno) {
        alumno._academiaId = academia.id; // referencia útil
        return resolve(alumno);
      }

      cursor.continue();
    };
  });
}

/* =========================
   PAGOS (AJUSTADO)
========================= */
function agregarPagoAlumno(academiaId, alumnoId, pago) {
  return new Promise(resolve => {
    const tx = db.transaction('academias', 'readwrite');
    const store = tx.objectStore('academias');
    const req = store.get(academiaId);

    req.onsuccess = () => {
      const academia = req.result;
      if (!academia) return resolve(false);

      const alumno = academia.alumnos.find(a => a.id === alumnoId);
      if (!alumno) return resolve(false);

      if (!alumno.pagos) alumno.pagos = [];
      alumno.pagos.push(pago);

      store.put(academia);
      resolve(true);
    };
  });
}

/* =========================
   CANCELAR PAGO (FUTURO)
   (NO SE USA AÚN)
========================= */
function cancelarPagoAlumno(academiaId, alumnoId, pagoId) {
  return new Promise(resolve => {
    const tx = db.transaction('academias', 'readwrite');
    const store = tx.objectStore('academias');
    const req = store.get(academiaId);

    req.onsuccess = () => {
      const academia = req.result;
      if (!academia) return resolve(false);

      const alumno = academia.alumnos.find(a => a.id === alumnoId);
      if (!alumno || !alumno.pagos) return resolve(false);

      const pago = alumno.pagos.find(p => p.id === pagoId);
      if (!pago) return resolve(false);

      pago.cancelado = true;
      store.put(academia);
      resolve(true);
    };
  });
}
