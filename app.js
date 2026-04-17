
import { supabase, supabaseConfigError, isSupabaseConfigured } from './supabase-config.js';

const state = {
  configOk: !!isSupabaseConfigured,
  session: null,
  profile: null,
  reports: [],
  profiles: [],
  pendingFiles: [],
  editingReportId: null,
  objectUrls: [],
  syncInProgress: false,
  syncToastShown: false,
  selectedReportIds: new Set(),
};

const els = {
  views: {
    auth: document.getElementById('authView'),
    dashboard: document.getElementById('dashboardView'),
    newReport: document.getElementById('newReportView'),
    reports: document.getElementById('reportsView'),
    admin: document.getElementById('adminView'),
    profile: document.getElementById('profileView'),
  },
  nav: document.getElementById('mainNav'),
  navLinks: [...document.querySelectorAll('.nav-link')],
  sessionBox: document.getElementById('sessionBox'),
  sessionUserName: document.getElementById('sessionUserName'),
  sessionUserRole: document.getElementById('sessionUserRole'),
  logoutBtn: document.getElementById('logoutBtn'),
  refreshDataBtn: document.getElementById('refreshDataBtn'),
  viewTitle: document.getElementById('viewTitle'),
  viewSubtitle: document.getElementById('viewSubtitle'),
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  reportForm: document.getElementById('reportForm'),
  passwordForm: document.getElementById('passwordForm'),
  editReportForm: document.getElementById('editReportForm'),
  reportEditModal: document.getElementById('reportEditModal'),
  closeEditModalBtn: document.getElementById('closeEditModalBtn'),
  cancelEditModalBtn: document.getElementById('cancelEditModalBtn'),
  photoLightbox: document.getElementById('photoLightbox'),
  closeLightboxBtn: document.getElementById('closeLightboxBtn'),
  lightboxImage: document.getElementById('lightboxImage'),
  reportSupervisorName: document.getElementById('reportSupervisorName'),
  photoInput: document.getElementById('photoInput'),
  cameraInput: document.getElementById('cameraInput'),
  photoPreview: document.getElementById('photoPreview'),
  latestReportsList: document.getElementById('latestReportsList'),
  qualitySummary: document.getElementById('qualitySummary'),
  reportsTableWrap: document.getElementById('reportsTableWrap'),
  usersTableWrap: document.getElementById('usersTableWrap'),
  profileSummary: document.getElementById('profileSummary'),
  filterFrom: document.getElementById('filterFrom'),
  filterTo: document.getElementById('filterTo'),
  filterSupervisor: document.getElementById('filterSupervisor'),
  filterSearch: document.getElementById('filterSearch'),
  reportSelectionSummary: document.getElementById('reportSelectionSummary'),
  selectFilteredBtn: document.getElementById('selectFilteredBtn'),
  clearSelectionBtn: document.getElementById('clearSelectionBtn'),
  exportFilteredPdfBtn: document.getElementById('exportFilteredPdfBtn'),
  exportSelectedPdfBtn: document.getElementById('exportSelectedPdfBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  statTotalReports: document.getElementById('statTotalReports'),
  statTodayReports: document.getElementById('statTodayReports'),
  statActiveSupervisors: document.getElementById('statActiveSupervisors'),
  statPhotos: document.getElementById('statPhotos'),
  toast: document.getElementById('toast'),
};

const MAX_UPLOAD_FILES = 10;
const IMAGE_COMPRESSION_THRESHOLD = 180 * 1024;
const DESKTOP_IMAGE_MAX_DIMENSION = 1280;
const MOBILE_IMAGE_MAX_DIMENSION = 900;
const DESKTOP_IMAGE_JPEG_QUALITY = 0.64;
const MOBILE_IMAGE_JPEG_QUALITY = 0.48;
const DESKTOP_IMAGE_TARGET_SIZE = 340 * 1024;
const MOBILE_IMAGE_TARGET_SIZE = 220 * 1024;
const REPORT_SAVE_TIMEOUT_MS = 45000;
const VERIFY_TIMEOUT_MS = 12000;
const PHOTO_UPLOAD_TIMEOUT_MS = 70000;
const SYNC_DB_NAME = 'cleanit-report-sync';
const SYNC_DB_VERSION = 1;
const SYNC_STORE = 'pendingReports';

const viewMeta = {
  auth: ['Acceso', 'Ingresá o creá tu cuenta para operar la plataforma.'],
  dashboard: ['Dashboard', 'Monitoreo ejecutivo de reportes, fotos y supervisión.'],
  'new-report': ['Nuevo reporte', 'Carga profesional de novedades operativas y evidencias.'],
  reports: ['Reportes', 'Historial consolidado, filtros y exportación.'],
  admin: ['Admin', 'Gestión básica de usuarios y parámetros de despliegue.'],
  profile: ['Mi cuenta', 'Perfil, seguridad y administración personal.'],
};

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || window.innerWidth <= 820;
}

function getNetworkProfile() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const saveData = Boolean(connection?.saveData);
  const slow = saveData || ['slow-2g', '2g', '3g'].includes(effectiveType);
  return { effectiveType, saveData, slow };
}

function getImageOptimizationProfile(file = null) {
  const source = file?.__source || '';
  const mobile = isMobileDevice() || source === 'camera';
  const network = getNetworkProfile();
  const slow = mobile || network.slow;
  return {
    maxDimension: slow ? MOBILE_IMAGE_MAX_DIMENSION : DESKTOP_IMAGE_MAX_DIMENSION,
    quality: slow ? MOBILE_IMAGE_JPEG_QUALITY : DESKTOP_IMAGE_JPEG_QUALITY,
    targetSize: slow ? MOBILE_IMAGE_TARGET_SIZE : DESKTOP_IMAGE_TARGET_SIZE,
  };
}

function ensureSupabaseReady() {
  if (isSupabaseConfigured && supabase && !supabase.__isStub) return true;
  showToast(supabaseConfigError || 'Falta configurar Supabase.', true);
  return false;
}

function renderConfigError() {
  if (isSupabaseConfigured && supabase && !supabase.__isStub) return;
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-head">
      <h3>Configuración incompleta de Supabase</h3>
      <p>La app no puede inicializar la conexión.</p>
    </div>
    <div class="summary-box">
      <p><strong>Error detectado:</strong> ${escapeHtml(supabaseConfigError || 'Configuración inválida.')}</p>
      <p>Revisá <code>supabase-config.js</code> y confirmá que la URL quede con este formato: <code>https://TU-PROYECTO.supabase.co</code>.</p>
      <p>La anon key debe ser la clave pública del proyecto, sin comillas rotas, sin espacios y sin saltos de línea.</p>
    </div>
  `;
  els.authView?.prepend(card);
}

function showToast(message, isError = false, duration = 3200) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.style.background = isError ? '#7f1d1d' : '#0f172a';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), duration);
}

function showUploadProgress(done, total) {
  let bar = document.getElementById('uploadProgressBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'uploadProgressBar';
    bar.innerHTML = `
      <span id="uploadProgressLabel"></span>
      <div id="uploadProgressTrack"><div id="uploadProgressInner"></div></div>
    `;
    document.body.appendChild(bar);
  }
  bar.classList.remove('hidden');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('uploadProgressInner').style.width = `${pct}%`;
  document.getElementById('uploadProgressLabel').textContent =
    done === 0
      ? `Sincronizando ${total} foto${total !== 1 ? 's' : ''}…`
      : done < total
        ? `Fotos: ${done} de ${total}`
        : `Finalizando…`;
}

function hideUploadProgress() {
  const bar = document.getElementById('uploadProgressBar');
  if (bar) bar.classList.add('hidden');
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTimeoutLikeError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('tardó demasiado') || message.includes('timeout') || message.includes('timed out');
}

function isTransientNetworkError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    isTimeoutLikeError(error)
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('fetch')
    || message.includes('network')
  );
}

function isDuplicateKeyError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('duplicate key') || message.includes('already exists');
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR');
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setView(viewName) {
  Object.values(els.views).forEach((view) => {
    view?.classList.add('hidden');
    view?.classList.remove('active');
  });

  if (viewName === 'new-report') {
    els.views.newReport?.classList.remove('hidden');
    els.views.newReport?.classList.add('active');
  } else {
    const target = els.views[viewName];
    if (!target) return;
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  els.navLinks.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewName));
  const meta = viewMeta[viewName] || ['Panel', ''];
  if (els.viewTitle) els.viewTitle.textContent = meta[0];
  if (els.viewSubtitle) els.viewSubtitle.textContent = meta[1];
}

function getBadgeClass(status) {
  const danger = ['critico', 'grave', 'faltantes', 'ausencias', 'regular'];
  const warn = ['bueno', 'moderada', 'ajustada', 'leve', 'completo_demoras', 'incompleto', 'suficiente'];
  const success = ['excelente', 'muy_bueno', 'sin_novedad', 'optima', 'completo_puntual', 'no_aplica'];
  if (danger.includes(status)) return 'danger';
  if (warn.includes(status)) return 'warn';
  if (success.includes(status)) return 'success';
  return 'neutral';
}

function prettifyEnum(value) {
  return String(value || '-')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function setButtonLoading(button, isLoading, loadingText = 'Procesando...') {
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : button.dataset.originalText;
}

function hydrateSessionUI() {
  const authenticated = Boolean(state.session?.user);
  els.nav?.classList.toggle('hidden', !authenticated);
  els.sessionBox?.classList.toggle('hidden', !authenticated);
  els.refreshDataBtn?.classList.toggle('hidden', !authenticated);

  if (!authenticated) {
    if (els.sessionUserName) els.sessionUserName.textContent = '-';
    if (els.sessionUserRole) els.sessionUserRole.textContent = '-';
    if (els.reportSupervisorName) els.reportSupervisorName.value = '';
    setView('auth');
    return;
  }

  if (els.sessionUserName) els.sessionUserName.textContent = state.profile?.full_name || state.session.user.email;
  if (els.sessionUserRole) els.sessionUserRole.textContent = prettifyEnum(state.profile?.role || 'supervisor');
  if (els.reportSupervisorName) els.reportSupervisorName.value = state.profile?.full_name || state.session.user.email;

  document.querySelectorAll('.admin-only').forEach((el) => {
    el.classList.toggle('hidden', state.profile?.role !== 'admin');
  });
}

async function ensureProfile(user, meta = null) {
  const role = meta?.role || user.user_metadata?.role || 'supervisor';
  const fullName = meta?.full_name || user.user_metadata?.full_name || user.email;

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    state.profile = existing;
    return existing;
  }

  const payload = {
    id: user.id,
    email: user.email,
    full_name: fullName,
    role,
  };

  const { data, error } = await supabase.from('profiles').upsert(payload).select().single();
  if (error) throw error;
  state.profile = data;
  return data;
}

function idbRequest(requestOrTx) {
  return new Promise((resolve, reject) => {
    requestOrTx.onsuccess = () => resolve(requestOrTx.result);
    requestOrTx.oncomplete = () => resolve(true);
    requestOrTx.onerror = () => reject(requestOrTx.error || new Error('No se pudo acceder al almacenamiento local.'));
    requestOrTx.onabort = () => reject(requestOrTx.error || new Error('La operación local fue cancelada.'));
  });
}

async function openSyncDb() {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        const store = db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la base local.'));
  });
}

async function putPendingReport(record) {
  if (!('indexedDB' in window)) return;
  const db = await openSyncDb();
  try {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    tx.objectStore(SYNC_STORE).put(record);
    await idbRequest(tx);
  } finally {
    db.close();
  }
}

async function getPendingReportsForUser(userId) {
  if (!('indexedDB' in window) || !userId) return [];
  const db = await openSyncDb();
  try {
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const store = tx.objectStore(SYNC_STORE);
    const all = await idbRequest(store.getAll());
    return (all || [])
      .filter((item) => item.userId === userId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  } finally {
    db.close();
  }
}

async function deletePendingReport(id) {
  if (!('indexedDB' in window)) return;
  const db = await openSyncDb();
  try {
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    tx.objectStore(SYNC_STORE).delete(id);
    await idbRequest(tx);
  } finally {
    db.close();
  }
}

function normalizePendingRecord(payload, files = []) {
  return {
    id: payload.id,
    userId: payload.user_id,
    payload,
    files,
    reportInserted: false,
    uploadedPhotos: [],
    photosLinked: false,
    attempts: 0,
    lastError: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function bootstrap() {
  bindEvents();

  if (els.cameraInput) {
    els.cameraInput.removeAttribute('multiple');
  }

  if (!ensureSupabaseReady()) {
    renderConfigError();
    hydrateSessionUI();
    setView('auth');
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    state.session = data.session;
    if (state.session?.user) {
      await ensureProfile(state.session.user);
      hydrateSessionUI();
      await loadAppData();
      setView('dashboard');
      void syncPendingReports({ silent: true });
    } else {
      hydrateSessionUI();
    }
  } catch (error) {
    showToast(error.message || 'No se pudo iniciar la app.', true);
    hydrateSessionUI();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    try {
      state.session = session;
      if (session?.user) {
        await ensureProfile(session.user);
        hydrateSessionUI();
        await loadAppData();
        setView('dashboard');
        void syncPendingReports({ silent: true });
      } else {
        state.profile = null;
        state.reports = [];
        state.profiles = [];
        hydrateSessionUI();
      }
    } catch (error) {
      showToast(error.message || 'No se pudo actualizar la sesión.', true);
    }
  });
}

function bindEvents() {
  els.navLinks.forEach((btn) => btn.addEventListener('click', () => {
    const requested = btn.dataset.view;
    if (requested === 'admin' && state.profile?.role !== 'admin') {
      showToast('No tenés permisos para acceder a Admin.', true);
      return;
    }
    setView(requested);
  }));

  els.loginForm?.addEventListener('submit', handleLogin);
  els.signupForm?.addEventListener('submit', handleSignup);
  els.reportForm?.addEventListener('submit', handleReportSubmit);
  els.passwordForm?.addEventListener('submit', handlePasswordUpdate);
  els.editReportForm?.addEventListener('submit', handleEditReportSubmit);
  els.logoutBtn?.addEventListener('click', handleLogout);
  els.refreshDataBtn?.addEventListener('click', async () => {
    await loadAppData();
    void syncPendingReports({ silent: true });
  });
  els.photoInput?.addEventListener('change', handleFilesSelected);
  els.cameraInput?.addEventListener('change', handleFilesSelected);
  els.filterFrom?.addEventListener('input', renderReportsTable);
  els.filterTo?.addEventListener('input', renderReportsTable);
  els.filterSupervisor?.addEventListener('change', renderReportsTable);
  els.filterSearch?.addEventListener('input', renderReportsTable);
  els.selectFilteredBtn?.addEventListener('click', selectFilteredReports);
  els.clearSelectionBtn?.addEventListener('click', clearReportSelection);
  els.exportFilteredPdfBtn?.addEventListener('click', () => exportReportsPdf({ scope: 'filtered' }));
  els.exportSelectedPdfBtn?.addEventListener('click', () => exportReportsPdf({ scope: 'selected' }));
  els.exportCsvBtn?.addEventListener('click', exportReportsCsv);
  els.exportJsonBtn?.addEventListener('click', exportReportsJson);
  els.closeEditModalBtn?.addEventListener('click', closeEditModal);
  els.cancelEditModalBtn?.addEventListener('click', closeEditModal);
  els.closeLightboxBtn?.addEventListener('click', closeLightbox);
  els.reportsTableWrap?.addEventListener('click', handleReportsActionClick);
  els.reportsTableWrap?.addEventListener('change', handleReportsSelectionChange);
  window.addEventListener('online', () => void syncPendingReports({ silent: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncPendingReports({ silent: true });
    }
  });
}

async function handleLogin(event) {
  if (!ensureSupabaseReady()) return;
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '').trim();

  try {
    setButtonLoading(submitBtn, true, 'Ingresando...');
    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      30000,
      'El ingreso tardó demasiado. Revisá tu conexión e intentá otra vez.'
    );
    if (error) throw error;
    form.reset();
    showToast('Sesión iniciada correctamente.');
  } catch (error) {
    showToast(error.message || 'No se pudo iniciar sesión.', true);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function handleSignup(event) {
  if (!ensureSupabaseReady()) return;
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const payload = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || '').trim(),
    options: {
      data: {
        full_name: String(formData.get('full_name') || '').trim(),
        role: String(formData.get('role') || 'supervisor').trim(),
      },
    },
  };

  try {
    setButtonLoading(submitBtn, true, 'Creando...');
    const { data, error } = await withTimeout(
      supabase.auth.signUp(payload),
      30000,
      'La creación de la cuenta tardó demasiado. Intentá de nuevo.'
    );
    if (error) throw error;

    form.reset();
    const requiresConfirmation = !data.session;
    showToast(requiresConfirmation
      ? 'Cuenta creada. Revisá el email para confirmar el acceso.'
      : 'Cuenta creada correctamente. Ya podés ingresar.');
  } catch (error) {
    showToast(error.message || 'No se pudo crear la cuenta.', true);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function handleFilesSelected(event) {
  const input = event.currentTarget;
  const files = [...(input.files || [])];
  if (!files.length) return;

  const availableSlots = Math.max(0, MAX_UPLOAD_FILES - state.pendingFiles.length);
  if (!availableSlots) {
    input.value = '';
    showToast(`Máximo ${MAX_UPLOAD_FILES} fotos por reporte.`, true);
    return;
  }

  const source = input.id === 'cameraInput' ? 'camera' : 'gallery';
  const acceptedFiles = files.slice(0, availableSlots).map((file) => {
    try {
      Object.defineProperty(file, '__source', { value: source, configurable: true });
    } catch {
      file.__source = source;
    }
    return file;
  });

  if (files.length > availableSlots) {
    showToast(`Se tomarán solo ${acceptedFiles.length} foto${acceptedFiles.length !== 1 ? 's' : ''} para evitar demoras.`, true);
  } else {
    showToast(`${acceptedFiles.length} foto${acceptedFiles.length !== 1 ? 's' : ''} listas para subir.`);
  }

  state.pendingFiles = [...state.pendingFiles, ...acceptedFiles];
  input.value = '';
  renderPhotoPreview();
}

async function loadImageSource(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // fallback below
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
      img.src = objectUrl;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

async function optimizeImageFile(file) {
  const profile = getImageOptimizationProfile(file);
  const needsCompression = file.size > IMAGE_COMPRESSION_THRESHOLD || file.__source === 'camera' || isMobileDevice();
  if (!needsCompression || !(file.type || '').startsWith('image/')) return file;

  let imageSource = null;
  try {
    imageSource = await Promise.race([
      loadImageSource(file),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
    ]);

    let width = imageSource.width || imageSource.naturalWidth;
    let height = imageSource.height || imageSource.naturalHeight;
    if (!width || !height) return file;

    const initialScale = Math.min(1, profile.maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * initialScale));
    height = Math.max(1, Math.round(height * initialScale));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;

    let quality = profile.quality;
    let bestBlob = null;

    for (let pass = 0; pass < 5; pass += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(imageSource, 0, 0, width, height);

      const blob = await Promise.race([
        new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
      ]);

      if (blob) {
        bestBlob = blob;
        if (blob.size <= profile.targetSize) break;
      }

      quality = Math.max(0.38, quality - 0.08);
      width = Math.max(560, Math.round(width * 0.8));
      height = Math.max(560, Math.round(height * 0.8));
    }

    if (!bestBlob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto';
    const newFile = new File([bestBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    try {
      Object.defineProperty(newFile, '__source', { value: file.__source || '', configurable: true });
    } catch {
      newFile.__source = file.__source || '';
    }
    return newFile;
  } catch {
    return file;
  } finally {
    if (imageSource && typeof imageSource.close === 'function') {
      try { imageSource.close(); } catch {}
    }
  }
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderPhotoPreview() {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];

  if (!els.photoPreview) return;

  if (!state.pendingFiles.length) {
    els.photoPreview.innerHTML = '';
    return;
  }

  const mobile = isMobileDevice();
  els.photoPreview.innerHTML = state.pendingFiles.map((file, index) => {
    const sizeLabel = formatFileSize(file.size);
    if (mobile || file.size > 2 * 1024 * 1024) {
      return `
        <article class="photo-item">
          <div style="padding:14px;">
            <strong>Foto ${index + 1}</strong>
            <span>${escapeHtml(file.name)} · ${sizeLabel}</span>
          </div>
        </article>
      `;
    }

    const url = URL.createObjectURL(file);
    state.objectUrls.push(url);
    return `
      <article class="photo-item">
        <img src="${url}" alt="Vista previa ${index + 1}" />
        <span>${escapeHtml(file.name)} · ${sizeLabel}</span>
      </article>
    `;
  }).join('');
}

function resetReportForm() {
  state.pendingFiles = [];
  renderPhotoPreview();
  els.reportForm?.reset();
  if (els.reportSupervisorName) {
    els.reportSupervisorName.value = state.profile?.full_name || state.session?.user?.email || '';
  }
}

async function uploadSingleFile(reportId, file, retries = 3) {
  const preparedFile = await optimizeImageFile(file);
  const ext = (preparedFile.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${state.session.user.id}/${reportId}/${crypto.randomUUID()}.${ext}`;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const { error } = await withTimeout(
        supabase.storage.from('report-photos').upload(path, preparedFile, {
          upsert: false,
          contentType: preparedFile.type || 'image/jpeg',
        }),
        PHOTO_UPLOAD_TIMEOUT_MS,
        'La foto tardó demasiado en subirse.'
      );
      if (error) throw error;

      const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
      return {
        report_id: reportId,
        file_name: preparedFile.name || file.name,
        storage_path: path,
        public_url: data.publicUrl,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(1200 * attempt);
      }
    }
  }

  throw lastError;
}

async function fetchSingleReport(reportId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*, report_photos(*)')
    .eq('id', reportId)
    .single();

  if (error) throw error;
  return data;
}

function upsertReportInState(report) {
  const idx = state.reports.findIndex((item) => item.id === report.id);
  if (idx >= 0) {
    state.reports[idx] = { ...state.reports[idx], ...report };
  } else {
    state.reports.unshift(report);
  }
  state.reports.sort((a, b) => {
    const dateDiff = String(b.service_date || '').localeCompare(String(a.service_date || ''));
    if (dateDiff !== 0) return dateDiff;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function removeReportFromState(reportId) {
  state.reports = state.reports.filter((item) => item.id !== reportId);
  state.selectedReportIds.delete(reportId);
}

function refreshDataViews() {
  sanitizeSelectedReportIds();
  renderDashboard();
  renderReportsTable();
  renderUsersTable();
  renderProfile();
  populateSupervisorFilter();
}

async function reportExistsRemote(reportId) {
  const { data, error } = await withTimeout(
    supabase.from('reports').select('id').eq('id', reportId).maybeSingle(),
    VERIFY_TIMEOUT_MS,
    'La verificación del reporte tardó demasiado.'
  );
  if (error) throw error;
  return Boolean(data?.id);
}

async function photosAlreadyLinked(reportId, uploadedPhotos = []) {
  if (!uploadedPhotos.length) return true;
  const { data, error } = await withTimeout(
    supabase.from('report_photos').select('storage_path').eq('report_id', reportId),
    VERIFY_TIMEOUT_MS,
    'La verificación de fotos tardó demasiado.'
  );
  if (error) throw error;
  const existing = new Set((data || []).map((item) => item.storage_path));
  return uploadedPhotos.every((photo) => existing.has(photo.storage_path));
}

async function saveReportRecordWithRecovery(payload) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const existsBefore = await reportExistsRemote(payload.id).catch(() => false);
      if (existsBefore) return { recovered: true };

      const { error } = await withTimeout(
        supabase.from('reports').insert(payload),
        REPORT_SAVE_TIMEOUT_MS,
        'El guardado del reporte tardó demasiado.'
      );
      if (error) throw error;
      return { recovered: false };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return { recovered: true };
      }

      const existsAfter = await reportExistsRemote(payload.id).catch(() => false);
      if (existsAfter) {
        return { recovered: true };
      }

      if (attempt < 3 && isTransientNetworkError(error)) {
        await sleep(1200 * attempt);
        continue;
      }

      throw error;
    }
  }

  return { recovered: false };
}

async function syncPendingReports({ silent = true } = {}) {
  if (state.syncInProgress) return;
  if (!state.session?.user) return;

  state.syncInProgress = true;
  let syncedCount = 0;
  let hadError = false;

  try {
    const queue = await getPendingReportsForUser(state.session.user.id);
    if (!queue.length) return;

    if (!silent && !state.syncToastShown) {
      state.syncToastShown = true;
      showToast('Sincronizando reportes pendientes…', false, 2200);
      setTimeout(() => { state.syncToastShown = false; }, 2500);
    }

    for (const item of queue) {
      try {
        await processPendingReport(item);
        syncedCount += 1;
      } catch (error) {
        hadError = true;
        await putPendingReport({
          ...item,
          attempts: Number(item.attempts || 0) + 1,
          lastError: String(error?.message || error || 'Error desconocido'),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    hadError = true;
    if (!silent) {
      showToast(error.message || 'No se pudieron sincronizar los reportes pendientes.', true);
    }
  } finally {
    state.syncInProgress = false;
    hideUploadProgress();
  }

  if (syncedCount > 0) {
    showToast(
      syncedCount === 1
        ? 'Reporte sincronizado correctamente.'
        : `${syncedCount} reportes sincronizados correctamente.`
    );
  } else if (!silent && hadError) {
    showToast('Hay reportes pendientes. Se reintentará cuando haya mejor conexión.', true, 4200);
  }
}

async function processPendingReport(record) {
  let current = { ...record };

  if (!current.reportInserted) {
    const saveResult = await saveReportRecordWithRecovery(current.payload);
    current.reportInserted = true;
    current.lastError = '';
    current.updatedAt = new Date().toISOString();
    await putPendingReport(current);

    const reportInState = state.reports.find((item) => item.id === current.id);
    if (reportInState) {
      reportInState.__localPending = false;
      if (saveResult.recovered) reportInState.__recovered = true;
      refreshDataViews();
    }
  }

  const files = Array.isArray(current.files) ? current.files : [];
  if (files.length) {
    const uploadedPhotos = Array.isArray(current.uploadedPhotos) ? [...current.uploadedPhotos] : [];
    showUploadProgress(uploadedPhotos.length, files.length);

    for (let index = uploadedPhotos.length; index < files.length; index += 1) {
      const uploaded = await uploadSingleFile(current.id, files[index]);
      uploadedPhotos.push(uploaded);
      current = {
        ...current,
        uploadedPhotos,
        updatedAt: new Date().toISOString(),
      };
      await putPendingReport(current);
      showUploadProgress(uploadedPhotos.length, files.length);
    }

    const alreadyLinked = await photosAlreadyLinked(current.id, uploadedPhotos);
    if (!alreadyLinked && !current.photosLinked) {
      const { error } = await withTimeout(
        supabase.from('report_photos').insert(uploadedPhotos),
        30000,
        'No se pudieron vincular las fotos al reporte.'
      );
      if (error) throw error;
    }

    current.photosLinked = true;
    current.updatedAt = new Date().toISOString();
    await putPendingReport(current);
  }

  const fullReport = await fetchSingleReport(current.id).catch(() => null);
  if (fullReport) {
    fullReport.__localPending = false;
    upsertReportInState(fullReport);
    refreshDataViews();
  } else {
    const reportInState = state.reports.find((item) => item.id === current.id);
    if (reportInState) {
      reportInState.__localPending = false;
      refreshDataViews();
    }
  }

  await deletePendingReport(current.id);
}

async function handleReportSubmit(event) {
  if (!ensureSupabaseReady()) return;
  event.preventDefault();
  if (!state.session?.user) {
    showToast('Necesitás iniciar sesión.', true);
    return;
  }

  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const pendingFiles = [...state.pendingFiles];
  const reportId = crypto.randomUUID();

  payload.id = reportId;
  payload.user_id = state.session.user.id;
  payload.supervisor_id = state.session.user.id;
  payload.supervisor_name = state.profile?.full_name || payload.supervisor_name;
  payload.summary = String(payload.summary || '').trim();
  payload.observations = String(payload.observations || '').trim();

  try {
    setButtonLoading(submitBtn, true, 'Guardando reporte...');

    const optimisticReport = {
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      report_photos: [],
      __localPending: true,
    };

    const cached = normalizePendingRecord(payload, pendingFiles);
    await putPendingReport(cached);

    upsertReportInState(optimisticReport);
    refreshDataViews();

    resetReportForm();
    setView('reports');
    showToast(
      pendingFiles.length
        ? 'Reporte recibido. Se está enviando y las fotos se subirán en segundo plano.'
        : 'Reporte recibido. Se está enviando en segundo plano.'
    );
  } catch (error) {
    showToast(error.message || 'No se pudo preparar el reporte.', true);
    return;
  } finally {
    setButtonLoading(submitBtn, false);
  }

  void syncPendingReports({ silent: false });
}

async function handlePasswordUpdate(event) {
  if (!ensureSupabaseReady()) return;
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const password = String(formData.get('password') || '').trim();

  try {
    setButtonLoading(submitBtn, true, 'Actualizando...');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    form.reset();
    showToast('Contraseña actualizada.');
  } catch (error) {
    showToast(error.message || 'No se pudo actualizar la contraseña.', true);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function handleLogout() {
  if (!ensureSupabaseReady()) return;
  const button = els.logoutBtn;
  try {
    setButtonLoading(button, true, 'Cerrando...');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showToast('Sesión cerrada.');
  } catch (error) {
    showToast(error.message || 'No se pudo cerrar la sesión.', true);
  } finally {
    setButtonLoading(button, false);
  }
}

async function loadAppData() {
  if (!ensureSupabaseReady()) return;
  if (!state.session?.user) return;

  const reportsQuery = supabase
    .from('reports')
    .select('*, report_photos(*)')
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false });

  const profilesQuery = supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  const [{ data: reports, error: reportsError }, { data: profiles, error: profilesError }] = await Promise.all([
    reportsQuery,
    profilesQuery,
  ]);

  if (reportsError) return showToast(reportsError.message || 'No se pudieron cargar los reportes.', true);
  if (profilesError) return showToast(profilesError.message || 'No se pudieron cargar los perfiles.', true);

  state.reports = reports || [];
  state.profiles = profiles || [];

  if (!state.profile) {
    state.profile = state.profiles.find((profile) => profile.id === state.session.user.id) || null;
    hydrateSessionUI();
  }

  const pending = await getPendingReportsForUser(state.session.user.id).catch(() => []);
  pending.forEach((item) => {
    const existing = state.reports.find((report) => report.id === item.id);
    if (existing) {
      existing.__localPending = true;
      return;
    }

    state.reports.unshift({
      ...item.payload,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      report_photos: item.uploadedPhotos || [],
      __localPending: true,
    });
  });

  refreshDataViews();
}

function renderDashboard() {
  const totalReports = state.reports.length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayReports = state.reports.filter((item) => item.service_date === todayIso).length;
  const supervisors = new Set(state.reports.map((item) => item.supervisor_name).filter(Boolean));
  const photos = state.reports.reduce((acc, item) => acc + (item.report_photos?.length || 0), 0);

  if (els.statTotalReports) els.statTotalReports.textContent = String(totalReports);
  if (els.statTodayReports) els.statTodayReports.textContent = String(todayReports);
  if (els.statActiveSupervisors) els.statActiveSupervisors.textContent = String(supervisors.size);
  if (els.statPhotos) els.statPhotos.textContent = String(photos);

  const latest = state.reports.slice(0, 5);
  if (els.latestReportsList) {
    els.latestReportsList.innerHTML = latest.length
      ? latest.map((report) => `
        <article class="list-item">
          <h4>${escapeHtml(report.service_name)}</h4>
          <p>${formatDate(report.service_date)} · ${escapeHtml(report.supervisor_name)} · ${escapeHtml(report.location)}</p>
          <div class="report-card-meta">
            <div class="badge ${getBadgeClass(report.service_status)}">${prettifyEnum(report.service_status)}</div>
            ${report.__localPending ? '<div class="badge warn">Pendiente de sincronización</div>' : ''}
          </div>
        </article>
      `).join('')
      : 'Todavía no hay reportes.';
  }

  const distribution = state.reports.reduce((acc, item) => {
    acc[item.service_status] = (acc[item.service_status] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  if (els.qualitySummary) {
    els.qualitySummary.innerHTML = entries.length
      ? entries.map(([key, value]) => `
        <div class="quality-row">
          <span>${prettifyEnum(key)}</span>
          <strong>${value}</strong>
        </div>
      `).join('')
      : 'Sin datos aún.';
  }
}

function getFilteredReports() {
  const from = els.filterFrom?.value || '';
  const to = els.filterTo?.value || '';
  const supervisor = els.filterSupervisor?.value || '';
  const search = (els.filterSearch?.value || '').trim().toLowerCase();

  return state.reports.filter((report) => {
    const matchesFrom = !from || report.service_date >= from;
    const matchesTo = !to || report.service_date <= to;
    const matchesSupervisor = !supervisor || report.supervisor_name === supervisor;
    const text = [
      report.service_name,
      report.location,
      report.supervisor_name,
      report.summary,
      report.observations,
      report.service_status,
      report.incident_level,
      report.attendance_status,
      report.supplies_status,
      report.corrective_action,
    ].join(' ').toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesFrom && matchesTo && matchesSupervisor && matchesSearch;
  });
}

function sanitizeSelectedReportIds() {
  const validIds = new Set(state.reports.map((report) => report.id));
  [...state.selectedReportIds].forEach((reportId) => {
    if (!validIds.has(reportId)) {
      state.selectedReportIds.delete(reportId);
    }
  });
}

function getSelectedReports() {
  return state.reports.filter((report) => state.selectedReportIds.has(report.id));
}

function getActiveFiltersSummary() {
  const parts = [];
  if (els.filterFrom?.value || els.filterTo?.value) {
    const from = els.filterFrom?.value ? formatDate(els.filterFrom.value) : 'inicio';
    const to = els.filterTo?.value ? formatDate(els.filterTo.value) : 'hoy';
    parts.push(`Fechas: ${from} a ${to}`);
  }
  if (els.filterSupervisor?.value) {
    parts.push(`Supervisor: ${els.filterSupervisor.value}`);
  }
  if (els.filterSearch?.value?.trim()) {
    parts.push(`Búsqueda: ${els.filterSearch.value.trim()}`);
  }
  return parts.length ? parts.join(' · ') : 'Sin filtros aplicados';
}

function renderSelectionSummary(filteredRows = getFilteredReports()) {
  if (!els.reportSelectionSummary) return;
  const selectedCount = getSelectedReports().length;
  const filteredCount = filteredRows.length;
  const filtersText = getActiveFiltersSummary();
  els.reportSelectionSummary.textContent = `${selectedCount} seleccionados · ${filteredCount} filtrados · ${filtersText}`;
}

function selectFilteredReports() {
  const rows = getFilteredReports();
  if (!rows.length) {
    showToast('No hay reportes filtrados para seleccionar.', true);
    return;
  }
  rows.forEach((report) => state.selectedReportIds.add(report.id));
  renderReportsTable();
  showToast(rows.length === 1 ? '1 reporte filtrado seleccionado.' : `${rows.length} reportes filtrados seleccionados.`);
}

function clearReportSelection() {
  if (!state.selectedReportIds.size) {
    renderSelectionSummary();
    return;
  }
  state.selectedReportIds.clear();
  renderReportsTable();
  showToast('Selección limpiada.');
}

function buildPrintableReportsHtml(reports, title, subtitle) {
  const cards = reports.map((report, index) => `
    <section class="print-report ${index < reports.length - 1 ? 'page-break' : ''}">
      <header class="print-report-head">
        <div>
          <h2>${escapeHtml(report.service_name || 'Reporte')}</h2>
          <p>${formatDate(report.service_date)} · ${escapeHtml(report.location || '-')} · ${escapeHtml(report.supervisor_name || '-')}</p>
          <p>Última actualización: ${formatDateTime(report.updated_at || report.created_at)}</p>
        </div>
        <div class="print-badges">
          <span class="print-badge">Estado general: ${escapeHtml(prettifyEnum(report.service_status))}</span>
          <span class="print-badge">Incidencias: ${escapeHtml(prettifyEnum(report.incident_level))}</span>
          <span class="print-badge">Personal: ${escapeHtml(prettifyEnum(report.attendance_status))}</span>
          <span class="print-badge">Insumos: ${escapeHtml(prettifyEnum(report.supplies_status))}</span>
        </div>
      </header>

      <div class="print-grid">
        <article class="print-panel">
          <h3>Resumen ejecutivo</h3>
          <p>${escapeHtml(report.summary || '-').replace(/\n/g, '<br>')}</p>
        </article>

        ${report.observations
          ? `<article class="print-panel"><h3>Observaciones</h3><p>${escapeHtml(report.observations).replace(/\n/g, '<br>')}</p></article>`
          : ''}

        <article class="print-panel">
          <h3>Detalle operativo</h3>
          <ul>
            <li><strong>Turno:</strong> ${escapeHtml(prettifyEnum(report.shift))}</li>
            <li><strong>Acción correctiva:</strong> ${escapeHtml(prettifyEnum(report.corrective_action))}</li>
            <li><strong>Fotos adjuntas:</strong> ${(report.report_photos || []).length}</li>
          </ul>
        </article>
      </div>

      <section class="print-photos-section">
        <h3>Evidencia fotográfica</h3>
        ${(report.report_photos || []).length
          ? `<div class="print-photos">${(report.report_photos || []).map((photo, photoIndex) => `
              <figure class="print-photo-card">
                <img src="${photo.public_url}" alt="Foto ${photoIndex + 1} del reporte" />
                <figcaption>Foto ${photoIndex + 1}</figcaption>
              </figure>
            `).join('')}</div>`
          : '<div class="print-empty">Sin fotos adjuntas.</div>'}
      </section>
    </section>
  `).join('');

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          --line: #dbe3ef;
          --ink: #0f172a;
          --muted: #475569;
          --soft: #f8fafc;
          --brand: #0f766e;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          color: var(--ink);
          background: #fff;
          padding: 28px;
        }
        .print-shell {
          max-width: 1040px;
          margin: 0 auto;
        }
        .print-header {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 20px;
          background: var(--soft);
        }
        .print-header h1 {
          margin: 0 0 6px;
          font-size: 26px;
        }
        .print-header p {
          margin: 4px 0;
          color: var(--muted);
        }
        .print-report {
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 22px;
          margin-bottom: 18px;
          page-break-inside: avoid;
        }
        .print-report-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .print-report-head h2 {
          margin: 0 0 6px;
          font-size: 22px;
        }
        .print-report-head p {
          margin: 4px 0;
          color: var(--muted);
        }
        .print-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .print-badge {
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          background: #fff;
        }
        .print-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }
        .print-panel {
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          background: #fff;
        }
        .print-panel h3, .print-photos-section h3 {
          margin: 0 0 10px;
          font-size: 16px;
        }
        .print-panel p {
          margin: 0;
          line-height: 1.55;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .print-panel ul {
          margin: 0;
          padding-left: 18px;
          line-height: 1.55;
        }
        .print-photos-section {
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          background: var(--soft);
        }
        .print-photos {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .print-photo-card {
          margin: 0;
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          page-break-inside: avoid;
        }
        .print-photo-card img {
          display: block;
          width: 100%;
          height: auto;
          max-height: 420px;
          object-fit: contain;
          background: #fff;
        }
        .print-photo-card figcaption {
          padding: 10px 12px;
          font-size: 12px;
          color: var(--muted);
        }
        .print-empty {
          color: var(--muted);
          font-style: italic;
        }
        .page-break {
          page-break-after: always;
        }
        @page {
          size: A4;
          margin: 14mm;
        }
        @media print {
          body {
            padding: 0;
          }
          .print-shell {
            max-width: none;
          }
          .print-report,
          .print-header,
          .print-panel,
          .print-photos-section,
          .print-photo-card {
            box-shadow: none;
          }
        }
        @media (max-width: 860px) {
          body {
            padding: 16px;
          }
          .print-grid,
          .print-photos {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-shell">
        <header class="print-header">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
          <p>Total de reportes: ${reports.length}</p>
          <p>Generado: ${new Date().toLocaleString('es-AR')}</p>
        </header>
        ${cards}
      </div>
      <script>
        (() => {
          const triggerPrint = () => setTimeout(() => window.print(), 250);
          const images = Array.from(document.images || []);
          let fired = false;
          const finish = () => {
            if (fired) return;
            fired = true;
            triggerPrint();
          };
          if (!images.length) {
            finish();
          } else {
            let remaining = images.filter((img) => !img.complete).length;
            if (!remaining) {
              finish();
            } else {
              const timeout = setTimeout(finish, 5000);
              images.forEach((img) => {
                if (img.complete) return;
                const done = () => {
                  remaining -= 1;
                  if (remaining <= 0) {
                    clearTimeout(timeout);
                    finish();
                  }
                };
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
              });
            }
          }
          window.onafterprint = () => window.close();
        })();
      <\/script>
    </body>
  </html>`;
}

function openPrintWindow(html, title) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    showToast('El navegador bloqueó la ventana de impresión. Habilitá pop-ups para esta app.', true, 4500);
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  if (title) {
    try {
      printWindow.document.title = title;
    } catch {}
  }
  return true;
}

function exportReportsPdf({ scope = 'filtered', reportId = '' } = {}) {
  let rows = [];
  let title = 'Reportes de supervisión';
  let subtitle = getActiveFiltersSummary();
  const today = new Date().toISOString().slice(0, 10);

  if (scope === 'single') {
    const report = state.reports.find((item) => item.id === reportId);
    if (!report) {
      showToast('No se encontró el reporte seleccionado.', true);
      return;
    }
    rows = [report];
    title = `Reporte ${report.service_name || ''}`.trim();
    subtitle = `${formatDate(report.service_date)} · ${report.supervisor_name || '-'} · ${report.location || '-'}`;
  } else if (scope === 'selected') {
    rows = getSelectedReports();
    title = 'Reportes seleccionados';
    subtitle = `${getActiveFiltersSummary()} · Seleccionados manualmente`;
  } else {
    rows = getFilteredReports();
    title = 'Reportes filtrados';
  }

  if (!rows.length) {
    showToast(scope === 'selected' ? 'No hay reportes seleccionados para imprimir.' : 'No hay reportes para imprimir con esos filtros.', true);
    return;
  }

  const html = buildPrintableReportsHtml(rows, title, subtitle);
  const opened = openPrintWindow(html, `${title} ${today}`.trim());
  if (opened) {
    showToast(rows.length === 1 ? 'Se abrió el reporte para imprimir o guardar en PDF.' : `Se abrieron ${rows.length} reportes para imprimir o guardar en PDF.`);
  }
}

function renderReportsTable() {
  const rows = getFilteredReports();
  renderSelectionSummary(rows);
  if (!els.reportsTableWrap) return;

  if (!rows.length) {
    els.reportsTableWrap.innerHTML = '<div class="card" style="margin:0; box-shadow:none; border:none;">No hay reportes para esos filtros.</div>';
    return;
  }

  els.reportsTableWrap.innerHTML = `
    <div class="report-grid-list">
      ${rows.map((report) => {
        const isSelected = state.selectedReportIds.has(report.id);
        return `
          <article class="report-card ${isSelected ? 'is-selected' : ''}" data-report-id="${report.id}">
            <div class="report-card-head">
              <div class="report-card-title-row">
                <label class="report-selector">
                  <input type="checkbox" data-action="select-report" data-report-id="${report.id}" ${isSelected ? 'checked' : ''} />
                  <span>Seleccionar</span>
                </label>
                <div>
                  <h4>${escapeHtml(report.service_name)}</h4>
                  <p>${formatDate(report.service_date)} · ${escapeHtml(report.location)} · ${escapeHtml(report.supervisor_name)}</p>
                  <p>Última actualización: ${formatDateTime(report.updated_at || report.created_at)}</p>
                </div>
              </div>
              <div class="report-card-meta">
                <span class="badge ${getBadgeClass(report.service_status)}">Estado general del servicio: ${prettifyEnum(report.service_status)}</span>
                <span class="badge ${getBadgeClass(report.incident_level)}">Incidencias: ${prettifyEnum(report.incident_level)}</span>
                <span class="badge ${getBadgeClass(report.attendance_status)}">Cumplimiento del personal: ${prettifyEnum(report.attendance_status)}</span>
                <span class="badge ${getBadgeClass(report.supplies_status)}">Disponibilidad de insumos: ${prettifyEnum(report.supplies_status)}</span>
                ${report.__localPending ? '<span class="badge warn">Pendiente de sincronización</span>' : ''}
              </div>
            </div>

            <div class="report-card-body">
              <div class="report-card-text">
                <div class="report-card-text-block">
                  <strong>Resumen ejecutivo</strong>
                  <div>${escapeHtml(report.summary)}</div>
                </div>
                ${report.observations ? `
                  <div class="report-card-text-block">
                    <strong>Observaciones</strong>
                    <div>${escapeHtml(report.observations)}</div>
                  </div>
                ` : ''}
                <div class="report-card-text-block">
                  <strong>Detalle operativo</strong>
                  <div>Turno: ${escapeHtml(prettifyEnum(report.shift))}</div>
                  <div>Acción correctiva: ${escapeHtml(prettifyEnum(report.corrective_action))}</div>
                  <div>Fotos adjuntas: ${(report.report_photos || []).length}</div>
                </div>
              </div>

              <div>
                ${(report.report_photos || []).length
                  ? `
                    <div class="photo-gallery">
                      ${report.report_photos.map((photo, idx) => `
                        <div class="photo-thumb">
                          <img src="${photo.public_url}" alt="Foto ${idx + 1} del reporte" data-action="open-photo" data-photo-url="${photo.public_url}" />
                          <span>Foto ${idx + 1}</span>
                        </div>
                      `).join('')}
                    </div>
                  `
                  : '<div class="report-card-text-block"><strong>Fotos</strong><div>Sin fotos adjuntas.</div></div>'}
              </div>
            </div>

            <div class="report-actions">
              <button type="button" class="btn btn-primary btn-sm" data-action="pdf-report" data-report-id="${report.id}">Imprimir / PDF</button>
              <button type="button" class="btn btn-secondary btn-sm" data-action="edit-report" data-report-id="${report.id}">Editar</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete-report" data-report-id="${report.id}">Eliminar</button>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderUsersTable() {
  if (!els.usersTableWrap) return;
  if (state.profile?.role !== 'admin') {
    els.usersTableWrap.innerHTML = '';
    return;
  }

  els.usersTableWrap.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>Alta</th>
        </tr>
      </thead>
      <tbody>
        ${state.profiles.map((profile) => `
          <tr>
            <td>${escapeHtml(profile.full_name || '-')}</td>
            <td>${escapeHtml(profile.email || '-')}</td>
            <td>${prettifyEnum(profile.role)}</td>
            <td>${new Date(profile.created_at).toLocaleDateString('es-AR')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderProfile() {
  if (!els.profileSummary) return;
  if (!state.profile) {
    els.profileSummary.innerHTML = '<p>Sin datos de perfil.</p>';
    return;
  }

  els.profileSummary.innerHTML = `
    <p><strong>Nombre:</strong> ${escapeHtml(state.profile.full_name || '-')}</p>
    <p><strong>Email:</strong> ${escapeHtml(state.profile.email || '-')}</p>
    <p><strong>Rol:</strong> ${prettifyEnum(state.profile.role || 'supervisor')}</p>
    <p><strong>Usuario ID:</strong> ${escapeHtml(state.profile.id)}</p>
  `;
}

function populateSupervisorFilter() {
  if (!els.filterSupervisor) return;
  const unique = [...new Set(state.profiles.map((profile) => profile.full_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const current = els.filterSupervisor.value;
  els.filterSupervisor.innerHTML = '<option value="">Todos</option>' + unique.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  els.filterSupervisor.value = unique.includes(current) ? current : '';
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportReportsCsv() {
  const rows = getFilteredReports();
  if (!rows.length) {
    showToast('No hay reportes para exportar.', true);
    return;
  }

  const header = [
    'fecha', 'supervisor', 'servicio', 'ubicacion', 'turno', 'estado_general',
    'cumplimiento_personal', 'insumos', 'incidencias', 'accion_correctiva',
    'resumen', 'observaciones', 'cantidad_fotos'
  ];

  const csv = [header.join(',')].concat(rows.map((report) => [
    report.service_date,
    report.supervisor_name,
    report.service_name,
    report.location,
    report.shift,
    report.service_status,
    report.attendance_status,
    report.supplies_status,
    report.incident_level,
    report.corrective_action,
    JSON.stringify(report.summary || ''),
    JSON.stringify(report.observations || ''),
    report.report_photos?.length || 0,
  ].join(','))).join('\n');

  downloadFile(`reportes_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8;');
}

function exportReportsJson() {
  const rows = getFilteredReports();
  if (!rows.length) {
    showToast('No hay reportes para exportar.', true);
    return;
  }
  downloadFile(`reportes_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8;');
}

function openEditModal(reportId) {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) {
    showToast('No se encontró el reporte.', true);
    return;
  }

  state.editingReportId = reportId;
  const form = els.editReportForm;
  form.elements.id.value = report.id;
  form.elements.service_date.value = report.service_date || '';
  form.elements.supervisor_name.value = report.supervisor_name || '';
  form.elements.service_name.value = report.service_name || '';
  form.elements.location.value = report.location || '';
  form.elements.shift.value = report.shift || '';
  form.elements.service_status.value = report.service_status || '';
  form.elements.attendance_status.value = report.attendance_status || '';
  form.elements.supplies_status.value = report.supplies_status || '';
  form.elements.incident_level.value = report.incident_level || '';
  form.elements.corrective_action.value = report.corrective_action || '';
  form.elements.summary.value = report.summary || '';
  form.elements.observations.value = report.observations || '';
  els.reportEditModal?.showModal();
}

function closeEditModal() {
  state.editingReportId = null;
  els.editReportForm?.reset();
  els.reportEditModal?.close();
}

function openLightbox(url) {
  if (els.lightboxImage) els.lightboxImage.src = url;
  els.photoLightbox?.showModal();
}

function closeLightbox() {
  if (els.lightboxImage) els.lightboxImage.src = '';
  els.photoLightbox?.close();
}

async function handleEditReportSubmit(event) {
  if (!ensureSupabaseReady()) return;
  event.preventDefault();
  const form = event.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const reportId = String(formData.get('id') || state.editingReportId || '').trim();
  const payload = Object.fromEntries(formData.entries());
  delete payload.id;
  payload.summary = String(payload.summary || '').trim();
  payload.observations = String(payload.observations || '').trim();
  payload.supervisor_name = state.profile?.full_name || payload.supervisor_name;

  try {
    setButtonLoading(submitBtn, true, 'Guardando...');
    const { error } = await supabase.from('reports').update(payload).eq('id', reportId);
    if (error) throw error;
    const fullReport = await fetchSingleReport(reportId);
    upsertReportInState(fullReport);
    refreshDataViews();
    closeEditModal();
    showToast('Reporte actualizado correctamente.');
  } catch (error) {
    showToast(error.message || 'No se pudo actualizar el reporte.', true);
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

async function handleDeleteReport(reportId, button) {
  if (!ensureSupabaseReady()) return;
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) {
    showToast('No se encontró el reporte.', true);
    return;
  }

  const confirmed = window.confirm(`Se eliminará el reporte de ${report.service_name} del ${formatDate(report.service_date)}. Esta acción no se puede deshacer.`);
  if (!confirmed) return;

  try {
    setButtonLoading(button, true, 'Eliminando...');

    const photos = report.report_photos || [];
    if (photos.length) {
      const { error: deletePhotosError } = await supabase.from('report_photos').delete().eq('report_id', reportId);
      if (deletePhotosError) throw deletePhotosError;

      const paths = photos.map((photo) => photo.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from('report-photos').remove(paths);
        if (storageError) throw storageError;
      }
    }

    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) throw error;

    removeReportFromState(reportId);
    await deletePendingReport(reportId).catch(() => {});
    refreshDataViews();
    showToast('Reporte eliminado correctamente.');
  } catch (error) {
    showToast(error.message || 'No se pudo eliminar el reporte.', true);
  } finally {
    setButtonLoading(button, false);
  }
}

function handleReportsSelectionChange(event) {
  const input = event.target.closest('[data-action="select-report"]');
  if (!input) return;
  const reportId = input.dataset.reportId;
  if (!reportId) return;

  if (input.checked) {
    state.selectedReportIds.add(reportId);
  } else {
    state.selectedReportIds.delete(reportId);
  }
  renderSelectionSummary();
  const card = input.closest('.report-card');
  card?.classList.toggle('is-selected', input.checked);
}

function handleReportsActionClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const reportId = actionEl.dataset.reportId;

  if (action === 'pdf-report' && reportId) {
    exportReportsPdf({ scope: 'single', reportId });
    return;
  }

  if (action === 'edit-report' && reportId) {
    openEditModal(reportId);
    return;
  }

  if (action === 'delete-report' && reportId) {
    void handleDeleteReport(reportId, actionEl);
    return;
  }

  if (action === 'open-photo') {
    openLightbox(actionEl.dataset.photoUrl);
  }
}

bootstrap();
