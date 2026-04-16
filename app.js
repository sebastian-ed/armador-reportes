import { supabase } from './supabase-config.js';

const state = {
  session: null,
  profile: null,
  reports: [],
  profiles: [],
  pendingFiles: [],
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

const viewMeta = {
  auth: ['Acceso', 'Ingresá o creá tu cuenta para operar la plataforma.'],
  dashboard: ['Dashboard', 'Monitoreo ejecutivo de reportes, fotos y supervisión.'],
  'new-report': ['Nuevo reporte', 'Carga profesional de novedades operativas y evidencias.'],
  reports: ['Reportes', 'Historial consolidado, filtros y exportación.'],
  admin: ['Admin', 'Gestión básica de usuarios y parámetros de despliegue.'],
  profile: ['Mi cuenta', 'Perfil, seguridad y administración personal.'],
};

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.style.background = isError ? '#7f1d1d' : '#0f172a';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 3200);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('es-AR');
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
  const warn = ['bueno', 'moderada', 'ajustada'];
  const success = ['excelente', 'muy_bueno', 'sin_novedad', 'optima', 'completo_puntual'];
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

  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

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
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showToast(error.message, true);
    return;
  }

  state.session = data.session;
  if (state.session?.user) {
    await ensureProfile(state.session.user);
    hydrateSessionUI();
    await loadAppData();
    setView('dashboard');
  } else {
    hydrateSessionUI();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
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

  els.loginForm.addEventListener('submit', handleLogin);
  els.signupForm.addEventListener('submit', handleSignup);
  els.reportForm.addEventListener('submit', handleReportSubmit);
  els.passwordForm.addEventListener('submit', handlePasswordUpdate);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.refreshDataBtn.addEventListener('click', loadAppData);
  els.photoInput.addEventListener('change', handleFilesSelected);
  els.cameraInput.addEventListener('change', handleFilesSelected);
  els.filterFrom.addEventListener('input', renderReportsTable);
  els.filterTo.addEventListener('input', renderReportsTable);
  els.filterSupervisor.addEventListener('change', renderReportsTable);
  els.filterSearch.addEventListener('input', renderReportsTable);
  els.exportCsvBtn.addEventListener('click', exportReportsCsv);
  els.exportJsonBtn.addEventListener('click', exportReportsJson);
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = formData.get('email');
  const password = formData.get('password');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return showToast(error.message, true);
  event.currentTarget.reset();
  showToast('Sesión iniciada correctamente.');
}

async function handleSignup(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    email: String(formData.get('email')).trim(),
    password: String(formData.get('password')).trim(),
    options: {
      data: {
        full_name: String(formData.get('full_name')).trim(),
        role: String(formData.get('role')).trim(),
      },
    },
  };

  const { error } = await supabase.auth.signUp(payload);
  if (error) return showToast(error.message, true);

  event.currentTarget.reset();
  showToast('Cuenta creada. Revisá la confirmación por email si está habilitada en Supabase.');
}


function handleFilesSelected(event) {
  const files = [...event.target.files];
  if (!files.length) return;
  state.pendingFiles = [...state.pendingFiles, ...files];
  renderPhotoPreview();
  event.target.value = '';
}

function renderPhotoPreview() {
  if (!state.pendingFiles.length) {
    els.photoPreview.innerHTML = '';
    return;
  }

  els.photoPreview.innerHTML = state.pendingFiles.map((file, index) => {
    const url = URL.createObjectURL(file);
    return `
      <article class="photo-item">
        <img src="${url}" alt="Vista previa ${index + 1}" />
        <span>${escapeHtml(file.name)}</span>
      </article>
    `;
  }).join('');
}

async function uploadReportFiles(reportId) {
  if (!state.pendingFiles.length) return [];
  const uploads = [];

  for (const file of state.pendingFiles) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${state.session.user.id}/${reportId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('report-photos').upload(path, file, {
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (error) throw error;

    const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
    uploads.push({ report_id: reportId, file_name: file.name, storage_path: path, public_url: data.publicUrl });
  }

  const { error: photosError } = await supabase.from('report_photos').insert(uploads);
  if (photosError) throw photosError;
  return uploads;
}

async function handleReportSubmit(event) {
  event.preventDefault();
  if (!state.session?.user) return showToast('Necesitás iniciar sesión.', true);

  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.user_id = state.session.user.id;
  payload.supervisor_id = state.session.user.id;
  payload.supervisor_name = state.profile?.full_name || payload.supervisor_name;
  payload.summary = String(payload.summary || '').trim();
  payload.observations = String(payload.observations || '').trim();

  const { data, error } = await supabase.from('reports').insert(payload).select().single();
  if (error) return showToast(error.message, true);

  try {
    await uploadReportFiles(data.id);
  } catch (uploadError) {
    showToast(`Reporte guardado, pero falló la carga de fotos: ${uploadError.message}`, true);
  }

  state.pendingFiles = [];
  renderPhotoPreview();
  event.currentTarget.reset();
  els.reportSupervisorName.value = state.profile?.full_name || state.session.user.email;
  showToast('Reporte guardado correctamente.');
  await loadAppData();
  setView('reports');
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const password = String(formData.get('password')).trim();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return showToast(error.message, true);
  event.currentTarget.reset();
  showToast('Contraseña actualizada.');
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  if (error) return showToast(error.message, true);
  showToast('Sesión cerrada.');
}

async function loadAppData() {
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

  renderDashboard();
  renderReportsTable();
  renderUsersTable();
  renderProfile();
  populateSupervisorFilter();
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
    <table class="table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Supervisor</th>
          <th>Servicio</th>
          <th>Estado</th>
          <th>Incidencias</th>
          <th>Resumen</th>
          <th>Fotos</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((report) => `
          <tr>
            <td>${formatDate(report.service_date)}<small>${escapeHtml(report.shift)}</small></td>
            <td>${escapeHtml(report.supervisor_name)}</td>
            <td>
              <strong>${escapeHtml(report.service_name)}</strong>
              <small>${escapeHtml(report.location)}</small>
            </td>
            <td><span class="badge ${getBadgeClass(report.service_status)}">${prettifyEnum(report.service_status)}</span></td>
            <td><span class="badge ${getBadgeClass(report.incident_level)}">${prettifyEnum(report.incident_level)}</span></td>
            <td>
              ${escapeHtml(report.summary)}
              ${report.observations ? `<small>${escapeHtml(report.observations)}</small>` : ''}
            </td>
            <td>
              ${(report.report_photos || []).length
                ? report.report_photos.map((photo, idx) => `<a href="${photo.public_url}" target="_blank" rel="noopener">Foto ${idx + 1}</a>`).join('<br>')
                : '<span class="badge neutral">Sin fotos</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
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
  els.filterSupervisor.value = current;
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

bootstrap();
