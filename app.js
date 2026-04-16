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
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  statTotalReports: document.getElementById('statTotalReports'),
  statTodayReports: document.getElementById('statTodayReports'),
  statActiveSupervisors: document.getElementById('statActiveSupervisors'),
  statPhotos: document.getElementById('statPhotos'),
  toast: document.getElementById('toast'),
};

const MAX_UPLOAD_FILES = 6;
const IMAGE_COMPRESSION_THRESHOLD = 250 * 1024;
const DESKTOP_IMAGE_MAX_DIMENSION = 1280;
const MOBILE_IMAGE_MAX_DIMENSION = 960;
const DESKTOP_IMAGE_JPEG_QUALITY = 0.68;
const MOBILE_IMAGE_JPEG_QUALITY = 0.55;
const DESKTOP_IMAGE_TARGET_SIZE = 450 * 1024;
const MOBILE_IMAGE_TARGET_SIZE = 280 * 1024;

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

function getImageOptimizationProfile(file = null) {
  const source = file?.__source || '';
  const mobile = isMobileDevice() || source === 'camera';
  return {
    maxDimension: mobile ? MOBILE_IMAGE_MAX_DIMENSION : DESKTOP_IMAGE_MAX_DIMENSION,
    quality: mobile ? MOBILE_IMAGE_JPEG_QUALITY : DESKTOP_IMAGE_JPEG_QUALITY,
    targetSize: mobile ? MOBILE_IMAGE_TARGET_SIZE : DESKTOP_IMAGE_TARGET_SIZE,
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
  els.authView.prepend(card);
}

function showToast(message, isError = false) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.style.background = isError ? '#7f1d1d' : '#0f172a';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 3200);
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
      ? `Subiendo ${total} foto${total !== 1 ? 's' : ''}…`
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
  Object.values(els.views).forEach((view) => view.classList.add('hidden'));
  Object.values(els.views).forEach((view) => view.classList.remove('active'));

  if (viewName === 'new-report') {
    els.views.newReport.classList.remove('hidden');
    els.views.newReport.classList.add('active');
  } else {
    const target = els.views[viewName];
    if (!target) return;
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  els.navLinks.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewName));
  const meta = viewMeta[viewName] || ['Panel', ''];
  els.viewTitle.textContent = meta[0];
  els.viewSubtitle.textContent = meta[1];
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
  els.nav.classList.toggle('hidden', !authenticated);
  els.sessionBox.classList.toggle('hidden', !authenticated);
  els.refreshDataBtn.classList.toggle('hidden', !authenticated);

  if (!authenticated) {
    els.sessionUserName.textContent = '-';
    els.sessionUserRole.textContent = '-';
    els.reportSupervisorName.value = '';
    setView('auth');
    return;
  }

  els.sessionUserName.textContent = state.profile?.full_name || state.session.user.email;
  els.sessionUserRole.textContent = prettifyEnum(state.profile?.role || 'supervisor');
  els.reportSupervisorName.value = state.profile?.full_name || state.session.user.email;
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

async function bootstrap() {
  bindEvents();

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
  els.refreshDataBtn?.addEventListener('click', loadAppData);
  els.photoInput?.addEventListener('change', handleFilesSelected);
  els.cameraInput?.addEventListener('change', handleFilesSelected);
  els.filterFrom?.addEventListener('input', renderReportsTable);
  els.filterTo?.addEventListener('input', renderReportsTable);
  els.filterSupervisor?.addEventListener('change', renderReportsTable);
  els.filterSearch?.addEventListener('input', renderReportsTable);
  els.exportCsvBtn?.addEventListener('click', exportReportsCsv);
  els.exportJsonBtn?.addEventListener('click', exportReportsJson);
  els.closeEditModalBtn?.addEventListener('click', closeEditModal);
  els.cancelEditModalBtn?.addEventListener('click', closeEditModal);
  els.closeLightboxBtn?.addEventListener('click', closeLightbox);
  els.reportsTableWrap?.addEventListener('click', handleReportsActionClick);
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
      20000,
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
      20000,
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

    for (let pass = 0; pass < 4; pass += 1) {
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

      quality = Math.max(0.42, quality - 0.08);
      width = Math.max(640, Math.round(width * 0.82));
      height = Math.max(640, Math.round(height * 0.82));
    }

    if (!bestBlob || bestBlob.size >= file.size) return file;

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

function renderPhotoPreview() {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];

  if (!state.pendingFiles.length) {
    els.photoPreview.innerHTML = '';
    return;
  }

  els.photoPreview.innerHTML = state.pendingFiles.map((file, index) => {
    const url = URL.createObjectURL(file);
    state.objectUrls.push(url);
    const sizeKb = Math.round(file.size / 1024);
    return `
      <article class="photo-item">
        <img src="${url}" alt="Vista previa ${index + 1}" />
        <span>${escapeHtml(file.name)} · ${sizeKb} KB</span>
      </article>
    `;
  }).join('');
}

function resetReportForm() {
  state.pendingFiles = [];
  renderPhotoPreview();
  els.reportForm.reset();
  els.reportSupervisorName.value = state.profile?.full_name || state.session?.user?.email || '';
}

async function uploadSingleFile(reportId, file, retries = 2) {
  const preparedFile = await optimizeImageFile(file);
  const ext = (preparedFile.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${state.session.user.id}/${reportId}/${crypto.randomUUID()}.${ext}`;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const { error } = await supabase.storage.from('report-photos').upload(path, preparedFile, {
        upsert: false,
        contentType: preparedFile.type || 'image/jpeg',
      });
      if (error) throw error;

      const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
      return {
        report_id: reportId,
        file_name: preparedFile.name || file.name,
        storage_path: path,
        public_url: data.publicUrl,
      };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, 700 * attempt));
      }
    }
  }
  throw lastError;
}

async function uploadReportFilesSequential(reportId, files = state.pendingFiles, onProgress = null) {
  if (!files.length) return [];

  const uploads = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const uploaded = await withTimeout(
      uploadSingleFile(reportId, file),
      45000,
      `La foto ${index + 1} tardó demasiado en subirse.`
    );
    uploads.push(uploaded);
    if (onProgress) onProgress(index + 1, files.length);
  }

  const { error: photosError } = await withTimeout(
    supabase.from('report_photos').insert(uploads),
    30000,
    'No se pudo vincular las fotos al reporte.'
  );
  if (photosError) throw photosError;
  return uploads;
}

async function uploadReportFilesInBackground(reportId, files = []) {
  if (!files.length) return;

  try {
    showUploadProgress(0, files.length);
    const uploads = await uploadReportFilesSequential(reportId, files, (done, total) => {
      showUploadProgress(done, total);
    });

    const report = state.reports.find((item) => item.id === reportId);
    if (report) {
      report.report_photos = [...(report.report_photos || []), ...uploads];
      report.updated_at = new Date().toISOString();
      refreshDataViews();
    } else {
      const fullReport = await fetchSingleReport(reportId);
      upsertReportInState(fullReport);
      refreshDataViews();
    }

    showToast('Reporte guardado y fotos cargadas correctamente.');
  } catch (error) {
    showToast(`Reporte guardado. Las fotos no se terminaron de subir: ${error.message}`, true);
  } finally {
    hideUploadProgress();
  }
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
    state.reports[idx] = report;
  } else {
    state.reports.unshift(report);
  }
  state.reports.sort((a, b) => {
    const dateDiff = String(b.service_date).localeCompare(String(a.service_date));
    if (dateDiff !== 0) return dateDiff;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

function removeReportFromState(reportId) {
  state.reports = state.reports.filter((item) => item.id !== reportId);
}

function refreshDataViews() {
  renderDashboard();
  renderReportsTable();
  renderUsersTable();
  renderProfile();
  populateSupervisorFilter();
}

async function handleReportSubmit(event) {
  if (!ensureSupabaseReady()) return;
  event.preventDefault();
  if (!state.session?.user) return showToast('Necesitás iniciar sesión.', true);

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

    const { error } = await withTimeout(
      supabase.from('reports').insert(payload),
      20000,
      'El guardado del reporte tardó demasiado. Probá de nuevo con mejor señal.'
    );
    if (error) throw error;

    const optimisticReport = {
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      report_photos: [],
    };
    upsertReportInState(optimisticReport);
    refreshDataViews();

    resetReportForm();
    setView('reports');
    showToast(
      pendingFiles.length
        ? 'Reporte guardado. Las fotos se subirán en segundo plano.'
        : 'Reporte guardado correctamente.'
    );
  } catch (error) {
    showToast(error.message || 'No se pudo guardar el reporte.', true);
    return;
  } finally {
    setButtonLoading(submitBtn, false);
  }

  if (pendingFiles.length) {
    void uploadReportFilesInBackground(reportId, pendingFiles);
  }
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

  if (reportsError) return showToast(reportsError.message, true);
  if (profilesError) return showToast(profilesError.message, true);

  state.reports = reports || [];
  state.profiles = profiles || [];

  if (!state.profile) {
    state.profile = state.profiles.find((profile) => profile.id === state.session.user.id) || null;
    hydrateSessionUI();
  }

  refreshDataViews();
}

function renderDashboard() {
  const totalReports = state.reports.length;
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayReports = state.reports.filter((item) => item.service_date === todayIso).length;
  const supervisors = new Set(state.reports.map((item) => item.supervisor_name).filter(Boolean));
  const photos = state.reports.reduce((acc, item) => acc + (item.report_photos?.length || 0), 0);

  els.statTotalReports.textContent = totalReports;
  els.statTodayReports.textContent = todayReports;
  els.statActiveSupervisors.textContent = supervisors.size;
  els.statPhotos.textContent = photos;

  const latest = state.reports.slice(0, 5);
  els.latestReportsList.innerHTML = latest.length
    ? latest.map((report) => `
      <article class="list-item">
        <h4>${escapeHtml(report.service_name)}</h4>
        <p>${formatDate(report.service_date)} · ${escapeHtml(report.supervisor_name)} · ${escapeHtml(report.location)}</p>
        <div class="badge ${getBadgeClass(report.service_status)}">${prettifyEnum(report.service_status)}</div>
      </article>
    `).join('')
    : 'Todavía no hay reportes.';

  const distribution = state.reports.reduce((acc, item) => {
    acc[item.service_status] = (acc[item.service_status] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  els.qualitySummary.innerHTML = entries.length
    ? entries.map(([key, value]) => `
      <div class="quality-row">
        <span>${prettifyEnum(key)}</span>
        <strong>${value}</strong>
      </div>
    `).join('')
    : 'Sin datos aún.';
}

function getFilteredReports() {
  const from = els.filterFrom.value;
  const to = els.filterTo.value;
  const supervisor = els.filterSupervisor.value;
  const search = els.filterSearch.value.trim().toLowerCase();

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

function renderReportsTable() {
  const rows = getFilteredReports();
  if (!rows.length) {
    els.reportsTableWrap.innerHTML = '<div class="card" style="margin:0; box-shadow:none; border:none;">No hay reportes para esos filtros.</div>';
    return;
  }

  els.reportsTableWrap.innerHTML = `
    <div class="report-grid-list">
      ${rows.map((report) => `
        <article class="report-card" data-report-id="${report.id}">
          <div class="report-card-head">
            <div>
              <h4>${escapeHtml(report.service_name)}</h4>
              <p>${formatDate(report.service_date)} · ${escapeHtml(report.location)} · ${escapeHtml(report.supervisor_name)}</p>
              <p>Última actualización: ${formatDateTime(report.updated_at || report.created_at)}</p>
            </div>
            <div class="report-card-meta">
              <span class="badge ${getBadgeClass(report.service_status)}">Estado general del servicio: ${prettifyEnum(report.service_status)}</span>
              <span class="badge ${getBadgeClass(report.incident_level)}">Incidencias: ${prettifyEnum(report.incident_level)}</span>
              <span class="badge ${getBadgeClass(report.attendance_status)}">Cumplimiento del personal: ${prettifyEnum(report.attendance_status)}</span>
              <span class="badge ${getBadgeClass(report.supplies_status)}">Disponibilidad de insumos: ${prettifyEnum(report.supplies_status)}</span>
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
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit-report" data-report-id="${report.id}">Editar</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-report" data-report-id="${report.id}">Eliminar</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderUsersTable() {
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
  if (!rows.length) return showToast('No hay reportes para exportar.', true);

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
  if (!rows.length) return showToast('No hay reportes para exportar.', true);
  downloadFile(`reportes_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2), 'application/json;charset=utf-8;');
}

function openEditModal(reportId) {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) return showToast('No se encontró el reporte.', true);

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
  els.reportEditModal.showModal();
}

function closeEditModal() {
  state.editingReportId = null;
  els.editReportForm.reset();
  els.reportEditModal.close();
}

function openLightbox(url) {
  els.lightboxImage.src = url;
  els.photoLightbox.showModal();
}

function closeLightbox() {
  els.lightboxImage.src = '';
  els.photoLightbox.close();
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
  if (!report) return showToast('No se encontró el reporte.', true);

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
    refreshDataViews();
    showToast('Reporte eliminado correctamente.');
  } catch (error) {
    showToast(error.message || 'No se pudo eliminar el reporte.', true);
  } finally {
    setButtonLoading(button, false);
  }
}

function handleReportsActionClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  const reportId = actionEl.dataset.reportId;

  if (action === 'edit-report' && reportId) {
    openEditModal(reportId);
    return;
  }

  if (action === 'delete-report' && reportId) {
    handleDeleteReport(reportId, actionEl);
    return;
  }

  if (action === 'open-photo') {
    openLightbox(actionEl.dataset.photoUrl);
  }
}

bootstrap();
