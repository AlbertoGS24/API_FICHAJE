const state = {
  token: localStorage.getItem('fichar.idToken') || '',
  publicConfig: null,
  me: null,
  requests: [],
  documents: [],
  progress: null,
  notifications: [],
  myScheduleMonth: '',
  myScheduleEntries: [],
  myScheduleSelectedDate: '',
  adminRequests: [],
  adminPresence: [],
  adminUsers: [],
  adminScheduleMonth: '',
  adminScheduleEntries: [],
  adminScheduleTemplateEntries: [],
  adminScheduleUserId: '',
  auditLogs: [],
  backupStatus: null,
  productionStatus: null,
  openClawIntegration: null,
  openClawAccessLogs: [],
  whatsappIntegration: null,
  whatsappLogs: [],
  companyLocation: null,
  holidays: [],
  workplace: null,
  workplaces: [],
  selectedWorkplaceId: '',
  suspiciousShifts: [],
  shiftHistory: [],
  myProfile: null,
  adminProfileTargetUserId: null,
  selectedHolidayId: null,
  selectedDocumentId: null,
  signatureDirty: false,
  reviewTargetId: null,
  reviewAction: null,
  openShiftStartAt: null,
  currentPage: 'inicio',
  adminView: 'home',
  restoringSession: false,
  captcha: {
    enabled: false,
    siteKey: '',
    tokens: {
      selfRegister: '',
      activateAdmin: '',
    },
    widgets: {
      selfRegister: null,
      activateAdmin: null,
    },
  },
};

const STORAGE_KEYS = {
  firebaseApiKey: 'fichar.firebaseApiKey',
  demoEmployeeEmail: 'fichar.demo.employee.email',
  demoEmployeePassword: 'fichar.demo.employee.password',
  demoAdminEmail: 'fichar.demo.admin.email',
  demoAdminPassword: 'fichar.demo.admin.password',
};

let clearSignature = () => {};
let resizeSignatureCanvas = () => {};
let workTimerIntervalId = null;
let turnstileScriptPromise = null;
let flashIdCounter = 0;
const recentFlashKeys = new Map();

const FLASH_DURATION_MS = 12000;
const FLASH_EXIT_MS = 180;
const FLASH_DEDUPE_WINDOW_MS = 2500;

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const $ = (id) => document.getElementById(id);

const els = {
  flash: $('flash'),
  authView: $('authView'),
  appView: $('appView'),

  userBox: $('userBox'),
  userName: $('userName'),
  rolePill: $('rolePill'),
  logoutBtn: $('logoutBtn'),

  emailInput: $('emailInput'),
  passwordInput: $('passwordInput'),
  forgotPasswordBtn: $('forgotPasswordBtn'),
  devToolsSection: $('devToolsSection'),
  apiKeyInput: $('apiKeyInput'),
  demoEmployeeEmailInput: $('demoEmployeeEmailInput'),
  demoEmployeePasswordInput: $('demoEmployeePasswordInput'),
  demoAdminEmailInput: $('demoAdminEmailInput'),
  demoAdminPasswordInput: $('demoAdminPasswordInput'),
  saveAdvancedBtn: $('saveAdvancedBtn'),
  demoEmployeeBtn: $('demoEmployeeBtn'),
  demoAdminBtn: $('demoAdminBtn'),
  tokenInput: $('tokenInput'),
  loginBtn: $('loginBtn'),
  saveTokenBtn: $('saveTokenBtn'),
  selfRegisterSection: $('selfRegisterSection'),
  selfRegisterDisabledNote: $('selfRegisterDisabledNote'),
  selfRegisterCompanyCifInput: $('selfRegisterCompanyCifInput'),
  selfRegisterCompanyNameInput: $('selfRegisterCompanyNameInput'),
  selfRegisterAdminEmailInput: $('selfRegisterAdminEmailInput'),
  selfRegisterAdminNameInput: $('selfRegisterAdminNameInput'),
  selfRegisterCompanyLogoInput: $('selfRegisterCompanyLogoInput'),
  selfRegisterCaptchaWrap: $('selfRegisterCaptchaWrap'),
  selfRegisterCaptcha: $('selfRegisterCaptcha'),
  selfRegisterCompanyBtn: $('selfRegisterCompanyBtn'),
  activationKeyInput: $('activationKeyInput'),
  activationEmailInput: $('activationEmailInput'),
  activationNameInput: $('activationNameInput'),
  activateAdminCaptchaWrap: $('activateAdminCaptchaWrap'),
  activateAdminCaptcha: $('activateAdminCaptcha'),
  activateAdminBtn: $('activateAdminBtn'),

  shiftBadge: $('shiftBadge'),
  workTimer: $('workTimer'),
  workTimerLabel: $('workTimerLabel'),
  shiftDetail: $('shiftDetail'),
  geoNote: $('geoNote'),
  clockInBtn: $('clockInBtn'),
  clockOutBtn: $('clockOutBtn'),
  refreshShiftBtn: $('refreshShiftBtn'),
  refreshShiftHistoryBtn: $('refreshShiftHistoryBtn'),
  shiftHistoryBody: $('shiftHistoryBody'),

  requestType: $('requestType'),
  requestStart: $('requestStart'),
  requestEnd: $('requestEnd'),
  requestComment: $('requestComment'),
  createRequestBtn: $('createRequestBtn'),
  filterStatus: $('filterStatus'),
  filterType: $('filterType'),
  refreshRequestsBtn: $('refreshRequestsBtn'),
  requestsBody: $('requestsBody'),

  refreshProgressBtn: $('refreshProgressBtn'),
  refreshNotificationsBtn: $('refreshNotificationsBtn'),
  progressGroup: $('progressGroup'),
  progressInternship: $('progressInternship'),
  progressWeekly: $('progressWeekly'),
  progressVacation: $('progressVacation'),
  progressOvertimeBank: $('progressOvertimeBank'),
  progressSummary: $('progressSummary'),
  notificationsBody: $('notificationsBody'),
  scheduleMonthInput: $('scheduleMonthInput'),
  scheduleMonthLabel: $('scheduleMonthLabel'),
  schedulePrevMonthBtn: $('schedulePrevMonthBtn'),
  scheduleNextMonthBtn: $('scheduleNextMonthBtn'),
  refreshScheduleBtn: $('refreshScheduleBtn'),
  scheduleSelectedDateLabel: $('scheduleSelectedDateLabel'),
  mySickLeaveFromInput: $('mySickLeaveFromInput'),
  mySickLeaveToInput: $('mySickLeaveToInput'),
  mySickLeaveNotesInput: $('mySickLeaveNotesInput'),
  markMySickLeaveBtn: $('markMySickLeaveBtn'),
  scheduleCalendar: $('scheduleCalendar'),

  docFrom: $('docFrom'),
  docTo: $('docTo'),
  docTimezone: $('docTimezone'),
  createDocBtn: $('createDocBtn'),
  refreshDocsBtn: $('refreshDocsBtn'),
  docsBody: $('docsBody'),
  selectedDocLabel: $('selectedDocLabel'),
  signatureCanvas: $('signatureCanvas'),
  signaturePreview: $('signaturePreview'),
  clearSignBtn: $('clearSignBtn'),
  signDocBtn: $('signDocBtn'),

  refreshProfileBtn: $('refreshProfileBtn'),
  profileNameInput: $('profileNameInput'),
  profileEmailInput: $('profileEmailInput'),
  profilePhoneInput: $('profilePhoneInput'),
  profileBirthDateInput: $('profileBirthDateInput'),
  saveProfileBtn: $('saveProfileBtn'),
  deleteMyAccountBtn: $('deleteMyAccountBtn'),

  adminSection: $('adminSection'),
  adminHomeBtn: $('adminHomeBtn'),
  adminLeadText: $('adminLeadText'),
  adminSubpageTitle: $('adminSubpageTitle'),
  adminSubpageHeading: $('adminSubpageHeading'),
  adminSubpageDescription: $('adminSubpageDescription'),
  adminHomeGrid: $('adminHomeGrid'),
  dashboardStats: $('dashboardStats'),
  refreshAdminBtn: $('refreshAdminBtn'),
  runBackupNowBtn: $('runBackupNowBtn'),
  refreshProductionStatusBtn: $('refreshProductionStatusBtn'),
  productionOverallLabel: $('productionOverallLabel'),
  productionOkLabel: $('productionOkLabel'),
  productionWarningLabel: $('productionWarningLabel'),
  productionPendingLabel: $('productionPendingLabel'),
  productionStatusBody: $('productionStatusBody'),
  refreshBackupStatusBtn: $('refreshBackupStatusBtn'),
  backupLastLabel: $('backupLastLabel'),
  backupNextLabel: $('backupNextLabel'),
  backupStatusLabel: $('backupStatusLabel'),
  testEmailRecipientInput: $('testEmailRecipientInput'),
  sendTestEmailBtn: $('sendTestEmailBtn'),
  openClawEnabledLabel: $('openClawEnabledLabel'),
  openClawTokenPreviewLabel: $('openClawTokenPreviewLabel'),
  openClawLastUsedLabel: $('openClawLastUsedLabel'),
  openClawTokenOutput: $('openClawTokenOutput'),
  openClawAccessLogBody: $('openClawAccessLogBody'),
  refreshOpenClawIntegrationBtn: $('refreshOpenClawIntegrationBtn'),
  rotateOpenClawTokenBtn: $('rotateOpenClawTokenBtn'),
  revokeOpenClawBtn: $('revokeOpenClawBtn'),
  whatsappEnabledInput: $('whatsappEnabledInput'),
  whatsappDisplayPhoneInput: $('whatsappDisplayPhoneInput'),
  whatsappPhoneNumberIdInput: $('whatsappPhoneNumberIdInput'),
  whatsappBusinessAccountIdInput: $('whatsappBusinessAccountIdInput'),
  whatsappAllowClockInInput: $('whatsappAllowClockInInput'),
  whatsappAllowClockOutInput: $('whatsappAllowClockOutInput'),
  whatsappRequireLocationInput: $('whatsappRequireLocationInput'),
  whatsappStatusLabel: $('whatsappStatusLabel'),
  whatsappProviderReadyLabel: $('whatsappProviderReadyLabel'),
  whatsappLastInboundLabel: $('whatsappLastInboundLabel'),
  whatsappLastOutboundLabel: $('whatsappLastOutboundLabel'),
  refreshWhatsappIntegrationBtn: $('refreshWhatsappIntegrationBtn'),
  saveWhatsappIntegrationBtn: $('saveWhatsappIntegrationBtn'),
  whatsappTestPhoneInput: $('whatsappTestPhoneInput'),
  whatsappTestMessageInput: $('whatsappTestMessageInput'),
  sendWhatsappTestBtn: $('sendWhatsappTestBtn'),
  whatsappLogsBody: $('whatsappLogsBody'),
  adminExportFromInput: $('adminExportFromInput'),
  adminExportToInput: $('adminExportToInput'),
  exportCompanyExcelBtn: $('exportCompanyExcelBtn'),
  adminPdfUserSelect: $('adminPdfUserSelect'),
  adminPdfFromInput: $('adminPdfFromInput'),
  adminPdfToInput: $('adminPdfToInput'),
  exportEmployeePdfBtn: $('exportEmployeePdfBtn'),
  companyCountryInput: $('companyCountryInput'),
  companyRegionInput: $('companyRegionInput'),
  companyProvinceInput: $('companyProvinceInput'),
  companyMunicipalityInput: $('companyMunicipalityInput'),
  companyPostalCodeInput: $('companyPostalCodeInput'),
  saveCompanyLocationBtn: $('saveCompanyLocationBtn'),
  refreshCompanyLocationBtn: $('refreshCompanyLocationBtn'),
  holidayImportYearInput: $('holidayImportYearInput'),
  importOfficialHolidaysBtn: $('importOfficialHolidaysBtn'),
  holidayDateInput: $('holidayDateInput'),
  holidayNameInput: $('holidayNameInput'),
  holidayScopeSelect: $('holidayScopeSelect'),
  holidayCountryInput: $('holidayCountryInput'),
  holidayRegionInput: $('holidayRegionInput'),
  holidayProvinceInput: $('holidayProvinceInput'),
  holidayMunicipalityInput: $('holidayMunicipalityInput'),
  holidayNotesInput: $('holidayNotesInput'),
  saveHolidayBtn: $('saveHolidayBtn'),
  cancelHolidayBtn: $('cancelHolidayBtn'),
  refreshHolidaysBtn: $('refreshHolidaysBtn'),
  holidaysBody: $('holidaysBody'),
  adminScheduleUserSearchInput: $('adminScheduleUserSearchInput'),
  adminScheduleUserSearchResults: $('adminScheduleUserSearchResults'),
  adminScheduleSelectedUserLabel: $('adminScheduleSelectedUserLabel'),
  adminScheduleUserSelect: $('adminScheduleUserSelect'),
  adminScheduleMonthInput: $('adminScheduleMonthInput'),
  adminScheduleMonthLabel: $('adminScheduleMonthLabel'),
  adminSchedulePrevMonthBtn: $('adminSchedulePrevMonthBtn'),
  adminScheduleNextMonthBtn: $('adminScheduleNextMonthBtn'),
  adminScheduleCopySourceMonthInput: $('adminScheduleCopySourceMonthInput'),
  adminScheduleDateInput: $('adminScheduleDateInput'),
  adminScheduleRangeStartInput: $('adminScheduleRangeStartInput'),
  adminScheduleRangeEndInput: $('adminScheduleRangeEndInput'),
  adminScheduleTypeSelect: $('adminScheduleTypeSelect'),
  adminScheduleStartTimeInput: $('adminScheduleStartTimeInput'),
  adminScheduleEndTimeInput: $('adminScheduleEndTimeInput'),
  adminScheduleNotesInput: $('adminScheduleNotesInput'),
  saveAdminScheduleBtn: $('saveAdminScheduleBtn'),
  saveAdminScheduleRangeBtn: $('saveAdminScheduleRangeBtn'),
  saveAdminScheduleTemplateBtn: $('saveAdminScheduleTemplateBtn'),
  applyAdminScheduleTemplateBtn: $('applyAdminScheduleTemplateBtn'),
  copyAdminScheduleMonthBtn: $('copyAdminScheduleMonthBtn'),
  deleteAdminScheduleBtn: $('deleteAdminScheduleBtn'),
  refreshAdminScheduleBtn: $('refreshAdminScheduleBtn'),
  adminSchedulePresetWeekdaysBtn: $('adminSchedulePresetWeekdaysBtn'),
  adminSchedulePresetAllBtn: $('adminSchedulePresetAllBtn'),
  adminSchedulePresetClearBtn: $('adminSchedulePresetClearBtn'),
  adminScheduleWeekdayPicker: $('adminScheduleWeekdayPicker'),
  adminScheduleTemplateSummary: $('adminScheduleTemplateSummary'),
  adminScheduleTargetLabel: $('adminScheduleTargetLabel'),
  adminScheduleCalendar: $('adminScheduleCalendar'),
  adminAssignTargetLabel: $('adminAssignTargetLabel'),
  adminAssignTypeSelect: $('adminAssignTypeSelect'),
  adminAssignStartInput: $('adminAssignStartInput'),
  adminAssignEndInput: $('adminAssignEndInput'),
  adminAssignCommentInput: $('adminAssignCommentInput'),
  adminAssignSubmitBtn: $('adminAssignSubmitBtn'),
  statEmployees: $('statEmployees'),
  statInterns: $('statInterns'),
  statHours: $('statHours'),
  statPending: $('statPending'),
  statOpenShifts: $('statOpenShifts'),
  statPendingVacations: $('statPendingVacations'),
  statPendingOvertime: $('statPendingOvertime'),
  statSuspiciousWeek: $('statSuspiciousWeek'),
  statAbsencesToday: $('statAbsencesToday'),
  refreshAdminPresenceBtn: $('refreshAdminPresenceBtn'),
  refreshAdminRequestsBtn: $('refreshAdminRequestsBtn'),
  adminPresenceBody: $('adminPresenceBody'),
  adminRequestsBody: $('adminRequestsBody'),
  refreshAdminUsersBtn: $('refreshAdminUsersBtn'),
  refreshAuditLogsBtn: $('refreshAuditLogsBtn'),
  auditLogsBody: $('auditLogsBody'),
  workplaceNameInput: $('workplaceNameInput'),
  workplaceSelectInput: $('workplaceSelectInput'),
  newWorkplaceBtn: $('newWorkplaceBtn'),
  deleteWorkplaceBtn: $('deleteWorkplaceBtn'),
  workplaceAddressInput: $('workplaceAddressInput'),
  workplaceLatInput: $('workplaceLatInput'),
  workplaceLngInput: $('workplaceLngInput'),
  workplaceMunicipalityInput: $('workplaceMunicipalityInput'),
  workplaceProvinceInput: $('workplaceProvinceInput'),
  workplaceRadiusInput: $('workplaceRadiusInput'),
  workplaceMaxAccuracyInput: $('workplaceMaxAccuracyInput'),
  workplaceStrictInput: $('workplaceStrictInput'),
  workplacePrimaryInput: $('workplacePrimaryInput'),
  workplaceActiveInput: $('workplaceActiveInput'),
  saveWorkplaceBtn: $('saveWorkplaceBtn'),
  refreshWorkplaceBtn: $('refreshWorkplaceBtn'),
  refreshSuspiciousShiftsBtn: $('refreshSuspiciousShiftsBtn'),
  suspiciousShiftsBody: $('suspiciousShiftsBody'),
  mapModal: $('mapModal'),
  mapModalTitle: $('mapModalTitle'),
  mapModalSubtitle: $('mapModalSubtitle'),
  mapModalFrame: $('mapModalFrame'),
  mapModalExternalLink: $('mapModalExternalLink'),
  mapModalCloseBtn: $('mapModalCloseBtn'),
  adminCreateNameInput: $('adminCreateNameInput'),
  adminCreateEmailInput: $('adminCreateEmailInput'),
  adminCreatePhoneInput: $('adminCreatePhoneInput'),
  adminCreateRoleSelect: $('adminCreateRoleSelect'),
  adminCreateGroupSelect: $('adminCreateGroupSelect'),
  adminCreateHoursInput: $('adminCreateHoursInput'),
  adminCreateVacationDaysInput: $('adminCreateVacationDaysInput'),
  adminCreateOvertimeAdjustmentInput: $('adminCreateOvertimeAdjustmentInput'),
  adminCreateBtn: $('adminCreateBtn'),
  adminImportUsersFileInput: $('adminImportUsersFileInput'),
  exportUsersExcelBtn: $('exportUsersExcelBtn'),
  downloadImportTemplateBtn: $('downloadImportTemplateBtn'),
  adminImportUsersBtn: $('adminImportUsersBtn'),
  adminImportUsersResult: $('adminImportUsersResult'),
  activationCompanyCifInput: $('activationCompanyCifInput'),
  activationCompanyNameInput: $('activationCompanyNameInput'),
  activationAdminEmailInput: $('activationAdminEmailInput'),
  activationAdminNameInput: $('activationAdminNameInput'),
  activationCompanyLogoInput: $('activationCompanyLogoInput'),
  activationExpiresDaysInput: $('activationExpiresDaysInput'),
  createActivationKeyBtn: $('createActivationKeyBtn'),
  adminUsersBody: $('adminUsersBody'),
  pageSelect: $('pageSelect'),
  navAdminBtn: $('navAdminBtn'),
  pageAdminOption: $('pageAdminOption'),

  reviewModal: $('reviewModal'),
  reviewModalTitle: $('reviewModalTitle'),
  reviewCommentInput: $('reviewCommentInput'),
  reviewCancelBtn: $('reviewCancelBtn'),
  reviewConfirmBtn: $('reviewConfirmBtn'),

  adminUserProfileModal: $('adminUserProfileModal'),
  adminUserProfileName: $('adminUserProfileName'),
  adminUserProfileEmail: $('adminUserProfileEmail'),
  adminUserProfilePhone: $('adminUserProfilePhone'),
  adminUserProfileBirthDate: $('adminUserProfileBirthDate'),
  adminUserProfileRole: $('adminUserProfileRole'),
  adminUserProfileGroup: $('adminUserProfileGroup'),
  adminUserProfileCloseBtn: $('adminUserProfileCloseBtn'),
  adminUserDeleteBtn: $('adminUserDeleteBtn'),
};

function showFlash(type, message) {
  if (!els.flash) return;

  let normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) return;

  let dedupeKey = `${type}:${normalizedMessage}`;
  if (/demasiadas peticiones/i.test(normalizedMessage)) {
    normalizedMessage =
      'Demasiadas peticiones al recargar. Espera unos segundos e inténtalo de nuevo.';
    dedupeKey = `${type}:rate-limit`;
  }

  const now = Date.now();
  const previous = recentFlashKeys.get(dedupeKey) || 0;
  if (now - previous < FLASH_DEDUPE_WINDOW_MS) {
    return;
  }
  recentFlashKeys.set(dedupeKey, now);

  const toast = document.createElement('div');
  toast.className = `flash ${type}`;
  toast.dataset.toastId = `flash-${Date.now()}-${flashIdCounter++}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const messageEl = document.createElement('div');
  messageEl.className = 'flash-message';
  messageEl.textContent = normalizedMessage;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'flash-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Cerrar aviso');
  closeBtn.textContent = '×';

  const removeToast = () => {
    if (!toast.isConnected || toast.classList.contains('is-leaving')) return;
    toast.classList.add('is-leaving');
    window.setTimeout(() => {
      toast.remove();
      if (!els.flash.childElementCount) {
        els.flash.hidden = true;
      }
    }, FLASH_EXIT_MS);
  };

  closeBtn.addEventListener('click', removeToast);

  toast.append(messageEl, closeBtn);
  els.flash.hidden = false;
  els.flash.appendChild(toast);
  window.setTimeout(removeToast, FLASH_DURATION_MS);
}

function hideFlash() {
  if (!els.flash) return;
  els.flash.innerHTML = '';
  els.flash.hidden = true;
}

function openMapModal({ title, subtitle, lat, lng }) {
  const embedUrl = mapEmbedUrlFor(lat, lng);
  const externalUrl = mapLinkFor(lat, lng);
  if (!embedUrl || !externalUrl || !els.mapModal) {
    showFlash('error', 'No se pudo abrir el mapa para esta ubicación.');
    return;
  }

  els.mapModalTitle.textContent = title || 'Mapa del fichaje';
  els.mapModalSubtitle.textContent = subtitle || 'Ubicación registrada.';
  els.mapModalFrame.src = embedUrl;
  els.mapModalExternalLink.href = externalUrl;
  els.mapModal.hidden = false;
}

function closeMapModal() {
  if (!els.mapModal) return;
  els.mapModal.hidden = true;
  if (els.mapModalFrame) {
    els.mapModalFrame.src = '';
  }
}

function normalizeErrorKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function translateErrorMessage(rawMessage, context = 'general') {
  const message = String(rawMessage || '').trim();
  if (!message) {
    if (context === 'login') return 'No se pudo iniciar sesión.';
    if (context === 'password-reset') {
      return 'No se pudo iniciar la recuperación de contraseña.';
    }
    return 'No se pudo completar la operación.';
  }

  const normalized = normalizeErrorKey(message);

  const exactMap = {
    INVALID_LOGIN_CREDENTIALS: 'Email o contraseña incorrectos.',
    INVALID_PASSWORD: 'Email o contraseña incorrectos.',
    EMAIL_NOT_FOUND: 'No existe ninguna cuenta con ese email.',
    INVALID_EMAIL: 'El email no tiene un formato válido.',
    MISSING_EMAIL: 'Debes indicar un email válido.',
    USER_DISABLED: 'Esta cuenta está desactivada.',
    TOO_MANY_ATTEMPTS_TRY_LATER:
      'Se han realizado demasiados intentos. Espera un momento y vuelve a intentarlo.',
    OPERATION_NOT_ALLOWED:
      'El acceso con email y contraseña no está habilitado en este proyecto.',
    EMAIL_EXISTS: 'Ya existe una cuenta con ese email.',
    INVALID_ID_TOKEN: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    TOKEN_EXPIRED: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN:
      'Tu sesión ya no es válida. Vuelve a iniciar sesión.',
    UNAUTHORIZED: 'Tu sesión ha caducado o no es válida. Vuelve a iniciar sesión.',
    FORBIDDEN: 'No tienes permisos para realizar esta acción.',
    INTERNAL_SERVER_ERROR: 'Ha ocurrido un error interno en el servidor.',
    FAILED_TO_FETCH:
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  };

  if (exactMap[normalized]) {
    return exactMap[normalized];
  }

  const containsMap = [
    ['INVALID_LOGIN_CREDENTIALS', 'Email o contraseña incorrectos.'],
    ['INVALID_PASSWORD', 'Email o contraseña incorrectos.'],
    ['EMAIL_NOT_FOUND', 'No existe ninguna cuenta con ese email.'],
    ['INVALID_EMAIL', 'El email no tiene un formato válido.'],
    [
      'TOO_MANY_ATTEMPTS_TRY_LATER',
      'Se han realizado demasiados intentos. Espera un momento y vuelve a intentarlo.',
    ],
    [
      'FAILED_TO_FETCH',
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    ],
    [
      'NETWORK_REQUEST_FAILED',
      'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    ],
    ['UNAUTHORIZED', 'Tu sesión ha caducado o no es válida. Vuelve a iniciar sesión.'],
    ['FORBIDDEN', 'No tienes permisos para realizar esta acción.'],
    ['INTERNAL_SERVER_ERROR', 'Ha ocurrido un error interno en el servidor.'],
    ['REQUEST_TO_RESET_YOUR_PASSWORD_HAS_EXPIRED', 'El enlace para restablecer la contraseña ha caducado. Solicita uno nuevo.'],
    ['LINK_HAS_ALREADY_BEEN_USED', 'Este enlace ya ha sido utilizado. Solicita uno nuevo.'],
    ['EXPIRED_OOB_CODE', 'El enlace para restablecer la contraseña ha caducado. Solicita uno nuevo.'],
    ['INVALID_OOB_CODE', 'El enlace para restablecer la contraseña no es válido o ya no puede usarse.'],
  ];

  for (const [pattern, friendly] of containsMap) {
    if (normalized.includes(pattern)) {
      return friendly;
    }
  }

  if (/failed to fetch/i.test(message)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  if (/invalid login credentials/i.test(message)) {
    return 'Email o contraseña incorrectos.';
  }

  return message;
}

function getFriendlyErrorMessage(error, context = 'general') {
  const rawMessage =
    error instanceof Error ? error.message : String(error || '');
  return translateErrorMessage(rawMessage, context);
}

function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('es-ES');
}

function formatDateOnly(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-ES');
}

function formatTimeOnly(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function dateLocalValue(dt = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function monthLocalValue(dt = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

function monthLabel(monthValue) {
  const parts = /^(\d{4})-(\d{2})$/.exec(String(monthValue || ''));
  if (!parts) return '-';
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, 1);
  const label = date.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonthValue(monthValue, delta) {
  const parts = /^(\d{4})-(\d{2})$/.exec(String(monthValue || ''));
  const base = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, 1)
    : new Date();
  base.setMonth(base.getMonth() + delta);
  return monthLocalValue(base);
}

function dateTimeLocalValue(dt = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function safeText(value) {
  if (value == null || value === '') return '-';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(6)
    : '-';
}

function mapLinkFor(lat, lng, zoom = 18) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(
    String(lat),
  )}&mlon=${encodeURIComponent(String(lng))}#map=${zoom}/${encodeURIComponent(
    String(lat),
  )}/${encodeURIComponent(String(lng))}`;
}

function mapEmbedUrlFor(lat, lng, delta = 0.0025) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  const marker = `${encodeURIComponent(String(lat))}%2C${encodeURIComponent(
    String(lng),
  )}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${marker}`;
}

function locationSummary(address, lat, lng) {
  if (address) return address;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `Lat ${formatCoordinate(lat)}, Lng ${formatCoordinate(lng)}`;
  }
  return '-';
}

function workplaceDisplayName(workplace) {
  if (!workplace) return '-';
  return workplace.name || workplace.addressLabel || workplace.id || '-';
}

function renderMapActionButton(params) {
  if (!Number.isFinite(params?.lat) || !Number.isFinite(params?.lng)) {
    return '-';
  }
  return `<button class="action-link" data-action="open-map" data-lat="${params.lat}" data-lng="${params.lng}" data-title="${safeText(
    params.title || 'Mapa del fichaje',
  )}" data-subtitle="${safeText(params.subtitle || '')}">Ver mapa</button>`;
}

function normalizeCif(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isValidSpanishCif(cif) {
  const normalized = normalizeCif(cif);
  if (!/^[A-Z]\d{7}[0-9A-Z]$/.test(normalized)) return false;

  const letter = normalized[0];
  const digits = normalized.slice(1, 8);
  const control = normalized[8];

  let sumEven = 0;
  let sumOdd = 0;

  for (let i = 0; i < digits.length; i += 1) {
    const n = Number(digits[i]);
    const position = i + 1;
    if (position % 2 === 0) {
      sumEven += n;
    } else {
      const doubled = n * 2;
      sumOdd += Math.floor(doubled / 10) + (doubled % 10);
    }
  }

  const total = sumEven + sumOdd;
  const controlDigit = (10 - (total % 10)) % 10;
  const controlDigitChar = String(controlDigit);
  const controlLetterChar = 'JABCDEFGHI'[controlDigit];

  if ('ABEH'.includes(letter)) return control === controlDigitChar;
  if ('KPQS'.includes(letter)) return control === controlLetterChar;
  return control === controlDigitChar || control === controlLetterChar;
}

function validateEmailInput(input) {
  if (!input) return true;
  const value = input.value.trim();
  if (!value) {
    input.setCustomValidity('');
    input.classList.remove('input-error');
    return true;
  }

  const ok = isValidEmail(value);
  input.setCustomValidity(ok ? '' : 'Email inválido');
  input.classList.toggle('input-error', !ok);
  return ok;
}

function normalizeInternationalPhoneInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let normalized = raw.replace(/[\s().-]+/g, '');
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }
  if (/^[6789]\d{8}$/.test(normalized)) {
    normalized = `+34${normalized}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error(
      'El teléfono debe estar en formato internacional. Ejemplo: +34600111222',
    );
  }

  return normalized;
}

function bindEmailValidation() {
  const emailInputs = Array.from(document.querySelectorAll('input[type="email"]'));
  emailInputs.forEach((input) => {
    input.addEventListener('input', () => validateEmailInput(input));
    input.addEventListener('blur', () => validateEmailInput(input));
  });
}

function validateCifInput(input) {
  if (!input) return true;
  input.value = normalizeCif(input.value);
  if (!input.value) {
    input.setCustomValidity('');
    input.classList.remove('input-error');
    return true;
  }
  const ok = isValidSpanishCif(input.value);
  input.setCustomValidity(ok ? '' : 'CIF inválido');
  input.classList.toggle('input-error', !ok);
  return ok;
}

function bindCifValidation() {
  const cifInputs = [
    els.selfRegisterCompanyCifInput,
    els.activationCompanyCifInput,
  ].filter(Boolean);

  cifInputs.forEach((input) => {
    input.addEventListener('input', () => validateCifInput(input));
    input.addEventListener('blur', () => validateCifInput(input));
  });
}

function parseAppRoute() {
  const url = new URL(window.location.href);
  return {
    page: url.searchParams.get('page') || 'inicio',
    adminView: url.searchParams.get('adminView') || 'home',
  };
}

function updateAppRouteInUrl(page, adminView = 'home', mode = 'replace') {
  const url = new URL(window.location.href);
  url.searchParams.set('page', page);

  if (page === 'admin' && adminView && adminView !== 'home') {
    url.searchParams.set('adminView', adminView);
  } else {
    url.searchParams.delete('adminView');
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (mode === 'push') {
    window.history.pushState(null, '', nextUrl);
  } else {
    window.history.replaceState(null, '', nextUrl);
  }
}

function reloadToPage(page, adminView = 'home') {
  const url = new URL(window.location.href);
  url.searchParams.set('page', page);

  if (page === 'admin' && adminView && adminView !== 'home') {
    url.searchParams.set('adminView', adminView);
  } else {
    url.searchParams.delete('adminView');
  }

  window.location.assign(`${url.pathname}${url.search}${url.hash}`);
}

function initializeRouteState() {
  const route = parseAppRoute();
  state.currentPage = route.page;
  state.adminView = route.adminView;
}

const ADMIN_VIEW_META = {
  home: {
    heading: 'Índice administrador',
    description: 'Selecciona el bloque que quieres abrir.',
  },
  resumen: {
    heading: 'Resumen general',
    description:
      'Indicadores clave de personal, horas, solicitudes, ausencias y actividad.',
  },
  operaciones: {
    heading: 'Operaciones del sistema',
    description:
      'Backups, verificación de correo y exportaciones Excel/PDF de empresa.',
  },
  festivos: {
    heading: 'Festivos y ubicación administrativa',
    description:
      'Ubicación base de empresa, importación oficial y gestión manual de festivos.',
  },
  cuadrante: {
    heading: 'Cuadrante y asignaciones',
    description:
      'Planificación mensual, plantillas, copia entre meses y asignación directa.',
  },
  geolocalizacion: {
    heading: 'Geolocalización y centros',
    description:
      'Centros de trabajo, radios permitidos y revisión de fichajes sospechosos.',
  },
  fichajes: {
    heading: 'Fichajes del día',
    description:
      'Seguimiento diario del personal con estado, horarios y mapa.',
  },
  solicitudes: {
    heading: 'Solicitudes del personal',
    description:
      'Revisión, aprobación y rechazo de solicitudes con comentarios.',
  },
  personal: {
    heading: 'Gestión de personal',
    description:
      'Altas, roles, grupos, vacaciones, bolsa de horas y accesos.',
  },
  onboarding: {
    heading: 'Alta de nuevas empresas',
    description:
      'Claves de activación y preparación del primer administrador.',
  },
  integraciones: {
    heading: 'Integraciones externas',
    description:
      'Configuración de OpenClaw y WhatsApp Business por empresa.',
  },
  auditoria: {
    heading: 'Auditoría de cambios',
    description:
      'Trazabilidad de acciones administrativas y cambios sensibles.',
  },
};

function uniqueElements(list) {
  return [...new Set(list.filter(Boolean))];
}

function getAdminViewElements(view) {
  const map = {
    resumen: [els.dashboardStats],
    operaciones: [
      els.refreshProductionStatusBtn?.closest('.card'),
      els.runBackupNowBtn?.closest('.card'),
      els.sendTestEmailBtn?.closest('.card'),
      els.exportCompanyExcelBtn?.closest('.card'),
      els.exportEmployeePdfBtn?.closest('.card'),
    ],
    festivos: [els.saveCompanyLocationBtn?.closest('.card')],
    cuadrante: [
      els.saveAdminScheduleBtn?.closest('.card'),
      els.adminAssignSubmitBtn?.closest('.card'),
    ],
    geolocalizacion: [
      els.saveWorkplaceBtn?.closest('.card'),
      els.refreshSuspiciousShiftsBtn?.closest('.card-head'),
      els.suspiciousShiftsBody?.closest('.table-wrap'),
    ],
    fichajes: [
      els.refreshAdminPresenceBtn?.closest('.card-head'),
      els.adminPresenceBody?.closest('.table-wrap'),
    ],
    solicitudes: [
      els.refreshAdminRequestsBtn?.closest('.card-head'),
      els.adminRequestsBody?.closest('.table-wrap'),
    ],
    personal: [
      els.refreshAdminUsersBtn?.closest('.card-head'),
      els.adminCreateBtn?.closest('.card'),
      els.adminImportUsersBtn?.closest('.card'),
      els.adminUsersBody?.closest('.table-wrap'),
    ],
    onboarding: [els.createActivationKeyBtn?.closest('.card')],
    integraciones: [
      els.rotateOpenClawTokenBtn?.closest('.card'),
      els.saveWhatsappIntegrationBtn?.closest('.card'),
    ],
    auditoria: [
      els.refreshAuditLogsBtn?.closest('.card-head'),
      els.auditLogsBody?.closest('.table-wrap'),
    ],
  };

  return uniqueElements(map[view] || []);
}

function setAdminView(nextView = 'home') {
  const allowed = new Set(Object.keys(ADMIN_VIEW_META));
  const view = allowed.has(nextView) ? nextView : 'home';
  const isHome = view === 'home';
  state.adminView = view;

  if (els.adminHomeGrid) {
    els.adminHomeGrid.hidden = !isHome;
  }
  if (els.adminLeadText) {
    els.adminLeadText.hidden = !isHome;
  }
  if (els.adminHomeBtn) {
    els.adminHomeBtn.hidden = isHome;
  }
  if (els.adminSubpageTitle) {
    els.adminSubpageTitle.hidden = isHome;
  }
  if (!isHome) {
    const meta = ADMIN_VIEW_META[view];
    if (els.adminSubpageHeading) {
      els.adminSubpageHeading.textContent = meta.heading;
    }
    if (els.adminSubpageDescription) {
      els.adminSubpageDescription.textContent = meta.description;
    }
  }

  Object.keys(ADMIN_VIEW_META)
    .filter((item) => item !== 'home')
    .forEach((item) => {
      const visible = !isHome && item === view;
      getAdminViewElements(item).forEach((el) => {
        el.hidden = !visible;
      });
    });

  if (state.currentPage === 'admin') {
    updateAppRouteInUrl('admin', view, 'replace');
  }
}

function setCurrentPage(nextPage) {
  const allowed = new Set([
    'inicio',
    'solicitudes',
    'progreso',
    'cuadrante',
    'documentos',
    'perfil',
  ]);
  if (state.me?.role === 'ADMIN') allowed.add('admin');

  const page = allowed.has(nextPage) ? nextPage : 'inicio';
  const requestedPage = nextPage;
  state.currentPage = page;

  document.querySelectorAll('.app-page').forEach((el) => {
    el.hidden = el.dataset.page !== page;
  });

  document.querySelectorAll('.nav-page-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.pageNav === page);
  });

  if (els.pageSelect) {
    els.pageSelect.value = page;
  }

  if (page === 'admin' && state.me?.role === 'ADMIN') {
    const adminViewAllowed = Object.keys(ADMIN_VIEW_META).includes(
      state.adminView,
    )
      ? state.adminView
      : 'home';
    setAdminView(adminViewAllowed);
  } else {
    updateAppRouteInUrl(page, 'home', 'replace');
  }

  if (requestedPage !== page) {
    updateAppRouteInUrl(page, state.adminView, 'replace');
  }

  // El canvas de firma necesita redimensionarse cuando su sección pasa de oculta a visible.
  if (page === 'documentos') {
    requestAnimationFrame(() => resizeSignatureCanvas());
  }
}

function setSessionViews() {
  const hasSession = !!state.token && !!state.me;
  const restoring = !!state.restoringSession;
  els.authView.hidden = hasSession || restoring;
  els.appView.hidden = !hasSession;
  els.userBox.hidden = !hasSession;

  if (hasSession) {
    els.userName.textContent = state.me.name || state.me.email || state.me.firebaseUid;
    els.rolePill.textContent = roleLabel(state.me.role);
    const isAdmin = state.me.role === 'ADMIN';
    els.adminSection.hidden = !isAdmin;
    if (els.navAdminBtn) els.navAdminBtn.hidden = !isAdmin;
    if (els.pageAdminOption) {
      els.pageAdminOption.hidden = !isAdmin;
      els.pageAdminOption.disabled = !isAdmin;
    }
    if (!isAdmin && state.currentPage === 'admin') {
      state.currentPage = 'inicio';
    }
    setCurrentPage(state.currentPage);
    requestAnimationFrame(() => resizeSignatureCanvas());
  } else {
    els.adminSection.hidden = true;
    if (els.navAdminBtn) els.navAdminBtn.hidden = true;
    if (els.pageAdminOption) {
      els.pageAdminOption.hidden = true;
      els.pageAdminOption.disabled = true;
    }
    if (!restoring) {
      setCurrentPage('inicio');
    }
  }
}

function setToken(token) {
  state.token = token;
  localStorage.setItem('fichar.idToken', token);
}

function getStored(key) {
  return localStorage.getItem(key) || '';
}

function setStored(key, value) {
  if (!value) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, value);
}

function showAccessLinkPrompt(link) {
  if (!link) return;
  window.prompt('Copia este enlace de acceso completo:', link);
}

function showActivationKeyPrompt(key) {
  if (!key) return;
  window.prompt('Copia y guarda esta clave de activación:', key);
}

async function loadPublicConfig() {
  try {
    const res = await fetch('/config/public');
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') return;

    state.publicConfig = data;
    syncPublicOnboardingState();
    const backendKey = (data.firebaseApiKey || '').trim();
    if (!backendKey) return;

    setStored(STORAGE_KEYS.firebaseApiKey, backendKey);
    if (els.apiKeyInput) {
      els.apiKeyInput.value = backendKey;
    }
  } catch {
    // Si falla, mantenemos el flujo actual con localStorage/manual.
  }
}

function isCaptchaPublicEnabled() {
  return Boolean(state.publicConfig?.turnstileEnabled);
}

function isPublicCompanySelfRegisterEnabled() {
  return Boolean(state.publicConfig?.publicCompanySelfRegisterEnabled);
}

function isPublicDevToolsEnabled() {
  return Boolean(state.publicConfig?.publicDevToolsEnabled);
}

function syncPublicOnboardingState() {
  const selfRegisterEnabled = isPublicCompanySelfRegisterEnabled();
  if (els.selfRegisterSection) {
    els.selfRegisterSection.hidden = !selfRegisterEnabled;
  }
  if (els.selfRegisterDisabledNote) {
    els.selfRegisterDisabledNote.hidden = selfRegisterEnabled;
  }
  if (els.devToolsSection) {
    els.devToolsSection.hidden = !isPublicDevToolsEnabled();
  }
}

function toggleCaptchaVisibility(visible) {
  if (els.selfRegisterCaptchaWrap) {
    els.selfRegisterCaptchaWrap.hidden = !visible;
  }
  if (els.activateAdminCaptchaWrap) {
    els.activateAdminCaptchaWrap.hidden = !visible;
  }
}

function waitForTurnstile(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('No se pudo cargar Turnstile a tiempo.'));
      }
    }, 50);
  });
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-turnstile-script]');
    if (existing) {
      waitForTurnstile().then(resolve).catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.addEventListener('error', () => {
      reject(new Error('No se pudo cargar el script de Turnstile.'));
    });
    document.head.appendChild(script);
    waitForTurnstile().then(resolve).catch(reject);
  });

  return turnstileScriptPromise;
}

function resetCaptcha(formKey) {
  state.captcha.tokens[formKey] = '';
  const widgetId = state.captcha.widgets[formKey];
  if (!window.turnstile || widgetId == null) return;
  try {
    window.turnstile.reset(widgetId);
  } catch {
    // Ignoramos errores de reset para no bloquear el formulario.
  }
}

function getCaptchaTokenOrFail(formKey) {
  if (!state.captcha.enabled) return undefined;
  const token = state.captcha.tokens[formKey]?.trim();
  if (token) return token;
  showFlash('error', 'Completa la verificación anti-bots antes de continuar.');
  return null;
}

function renderCaptchaWidget(formKey, container, action) {
  if (!window.turnstile || !container || state.captcha.widgets[formKey] != null) {
    return;
  }

  state.captcha.widgets[formKey] = window.turnstile.render(container, {
    sitekey: state.captcha.siteKey,
    action,
    language: 'es',
    theme: 'light',
    callback: (token) => {
      state.captcha.tokens[formKey] = token;
    },
    'expired-callback': () => {
      state.captcha.tokens[formKey] = '';
    },
    'error-callback': () => {
      state.captcha.tokens[formKey] = '';
    },
  });
}

async function initCaptcha() {
  const siteKey = String(state.publicConfig?.turnstileSiteKey || '').trim();
  const enabled = isCaptchaPublicEnabled() && Boolean(siteKey);

  state.captcha.enabled = enabled;
  state.captcha.siteKey = siteKey;
  state.captcha.tokens.selfRegister = '';
  state.captcha.tokens.activateAdmin = '';

  toggleCaptchaVisibility(enabled);
  if (!enabled) return;

  try {
    await loadTurnstileScript();
    renderCaptchaWidget(
      'selfRegister',
      els.selfRegisterCaptcha,
      'self_register_company',
    );
    renderCaptchaWidget('activateAdmin', els.activateAdminCaptcha, 'activate_admin');
  } catch (error) {
    showFlash(
      'error',
      `No se pudo iniciar el CAPTCHA: ${error.message}.`,
    );
  }
}

function resolveFirebaseApiKey() {
  const backendKey = (state.publicConfig?.firebaseApiKey || '').trim();
  if (backendKey) return backendKey;

  const inputKey = (els.apiKeyInput.value || '').trim();
  if (inputKey) return inputKey;

  return (getStored(STORAGE_KEYS.firebaseApiKey) || '').trim();
}

function clearSession() {
  state.token = '';
  state.me = null;
  state.myProfile = null;
  state.backupStatus = null;
  state.productionStatus = null;
  state.companyLocation = null;
  state.holidays = [];
  state.adminProfileTargetUserId = null;
  state.selectedHolidayId = null;
  state.selectedDocumentId = null;
  state.adminView = 'home';
  state.shiftHistory = [];
  state.myScheduleEntries = [];
  state.myScheduleSelectedDate = '';
  state.adminScheduleEntries = [];
  state.adminScheduleTemplateEntries = [];
  state.adminScheduleUserId = '';
  renderShiftHistory();
  closeAdminUserProfileModal();
  stopWorkTimer();
  renderBackupStatus();
  renderProductionStatus();
  localStorage.removeItem('fichar.idToken');
  els.tokenInput.value = '';
  setSessionViews();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const init = { ...options, headers };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(path, init);
  const contentType = res.headers.get('content-type') || '';

  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await res.json().catch(() => null);
  } else {
    payload = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const message =
      payload?.message
        ? Array.isArray(payload.message)
          ? payload.message.join(', ')
          : payload.message
        : payload || `${res.status} ${res.statusText}`;
    throw new Error(translateErrorMessage(message, 'api'));
  }

  return payload;
}

async function loginWithFirebase() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  if (!email || !password) {
    showFlash('error', 'Completa email y contraseña.');
    return;
  }
  if (!validateEmailInput(els.emailInput)) {
    els.emailInput.reportValidity();
    return;
  }

  await loginWithCredentials(email, password);
}

async function loginWithCredentials(email, password) {
  const apiKey = resolveFirebaseApiKey();
  if (!apiKey) {
    showFlash(
      'error',
      'Falta la configuración de Firebase en el servidor. Define FIREBASE_WEB_API_KEY en el backend.',
    );
    return;
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.idToken) {
      throw new Error(
        translateErrorMessage(
          data?.error?.message || 'No se pudo iniciar sesión con Firebase.',
          'login',
        ),
      );
    }

    setToken(data.idToken);
    setStored(STORAGE_KEYS.firebaseApiKey, apiKey);
    await bootstrapSession();
    showFlash('success', 'Sesión iniciada correctamente.');
  } catch (error) {
    showFlash('error', getFriendlyErrorMessage(error, 'login'));
  }
}

async function requestPasswordReset() {
  const email = els.emailInput.value.trim();
  if (!email) {
    showFlash('error', 'Indica tu email para recuperar la contraseña.');
    return;
  }
  if (!validateEmailInput(els.emailInput)) {
    els.emailInput.reportValidity();
    return;
  }

  const apiKey = resolveFirebaseApiKey();
  if (!apiKey) {
    showFlash(
      'error',
      'Falta la configuración de Firebase en el servidor. Define FIREBASE_WEB_API_KEY en el backend.',
    );
    return;
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      },
    );

    const data = await res.json().catch(() => null);
    const firebaseError = data?.error?.message || '';
    if (!res.ok && firebaseError !== 'EMAIL_NOT_FOUND') {
      throw new Error(
        translateErrorMessage(
          firebaseError || 'No se pudo iniciar la recuperación',
          'password-reset',
        ),
      );
    }

    showFlash(
      'success',
      'Si el email existe en el sistema, recibirás un enlace para restablecer la contraseña.',
    );
  } catch (error) {
    showFlash('error', getFriendlyErrorMessage(error, 'password-reset'));
  }
}

function saveAdvancedConfig() {
  setStored(STORAGE_KEYS.firebaseApiKey, els.apiKeyInput.value.trim());
  setStored(
    STORAGE_KEYS.demoEmployeeEmail,
    els.demoEmployeeEmailInput.value.trim(),
  );
  setStored(
    STORAGE_KEYS.demoEmployeePassword,
    els.demoEmployeePasswordInput.value,
  );
  setStored(STORAGE_KEYS.demoAdminEmail, els.demoAdminEmailInput.value.trim());
  setStored(STORAGE_KEYS.demoAdminPassword, els.demoAdminPasswordInput.value);
  showFlash('success', 'Configuración avanzada guardada.');
}

async function loginWithDemo(role) {
  const isAdmin = role === 'admin';
  const email = getStored(
    isAdmin ? STORAGE_KEYS.demoAdminEmail : STORAGE_KEYS.demoEmployeeEmail,
  );
  const password = getStored(
    isAdmin ? STORAGE_KEYS.demoAdminPassword : STORAGE_KEYS.demoEmployeePassword,
  );

  if (!email || !password) {
    showFlash(
      'error',
      `Faltan credenciales demo de ${
        isAdmin ? 'admin' : 'empleado'
      }. Configúralas en opciones avanzadas.`,
    );
    return;
  }

  els.emailInput.value = email;
  els.passwordInput.value = password;
  await loginWithCredentials(email, password);
}

async function loginWithToken() {
  const token = els.tokenInput.value.trim();
  if (!token) {
    showFlash('error', 'Pega un token válido.');
    return;
  }

  try {
    setToken(token);
    await bootstrapSession();
    showFlash('success', 'Sesión iniciada con token.');
  } catch (error) {
    clearSession();
    showFlash('error', `Token inválido: ${error.message}`);
  }
}

async function selfRegisterCompany() {
  if (!isPublicCompanySelfRegisterEnabled()) {
    showFlash(
      'error',
      'El registro directo de empresa está deshabilitado. Usa el código de activación.',
    );
    return;
  }

  const companyCif = normalizeCif(els.selfRegisterCompanyCifInput.value);
  const companyName = els.selfRegisterCompanyNameInput.value.trim();
  const adminEmail = els.selfRegisterAdminEmailInput.value.trim();
  const adminName = els.selfRegisterAdminNameInput.value.trim();
  const companyLogoUrl = els.selfRegisterCompanyLogoInput.value.trim();

  if (!companyCif || !companyName || !adminEmail || !adminName) {
    showFlash(
      'error',
      'Debes completar CIF empresa, nombre empresa, email y nombre del administrador.',
    );
    return;
  }
  if (!isValidSpanishCif(companyCif)) {
    showFlash('error', 'CIF de empresa inválido.');
    return;
  }
  if (!validateEmailInput(els.selfRegisterAdminEmailInput)) {
    els.selfRegisterAdminEmailInput.reportValidity();
    return;
  }

  const captchaToken = getCaptchaTokenOrFail('selfRegister');
  if (captchaToken == null) return;

  try {
    const result = await api('/onboarding/self-register-company', {
      method: 'POST',
      body: {
        companyCif,
        companyName,
        adminEmail,
        adminName,
        companyLogoUrl: companyLogoUrl || undefined,
        captchaToken,
      },
    });

    els.emailInput.value = adminEmail;
    els.selfRegisterCompanyCifInput.value = '';
    els.selfRegisterCompanyNameInput.value = '';
    els.selfRegisterAdminEmailInput.value = '';
    els.selfRegisterAdminNameInput.value = '';
    els.selfRegisterCompanyLogoInput.value = '';

    const onboarding = result?.onboarding;
    let successMessage =
      onboarding?.message || 'Empresa y administrador registrados correctamente.';
    if (onboarding?.passwordSetupLink) {
      showAccessLinkPrompt(onboarding.passwordSetupLink);
      successMessage = `${successMessage} Se mostró enlace manual en pantalla.`;
    }

    if (state.captcha.enabled) {
      resetCaptcha('selfRegister');
    }
    showFlash('success', successMessage);
  } catch (error) {
    if (state.captcha.enabled) {
      resetCaptcha('selfRegister');
    }
    showFlash('error', `No se pudo registrar empresa: ${error.message}`);
  }
}

async function activateAdminWithKey() {
  const activationKey = els.activationKeyInput.value.trim();
  const email = els.activationEmailInput.value.trim();
  const name = els.activationNameInput.value.trim();

  if (!activationKey || !email || !name) {
    showFlash('error', 'Debes indicar clave de activación, email y nombre.');
    return;
  }
  if (!validateEmailInput(els.activationEmailInput)) {
    els.activationEmailInput.reportValidity();
    return;
  }

  const captchaToken = getCaptchaTokenOrFail('activateAdmin');
  if (captchaToken == null) return;

  try {
    const result = await api('/onboarding/activate-admin', {
      method: 'POST',
      body: {
        activationKey,
        email,
        name,
        captchaToken,
      },
    });

    els.emailInput.value = email;
    els.activationKeyInput.value = '';
    els.activationEmailInput.value = '';
    els.activationNameInput.value = '';

    const onboarding = result?.onboarding;
    let successMessage =
      onboarding?.message || 'Empresa y administrador activados correctamente.';
    if (onboarding?.passwordSetupLink) {
      showAccessLinkPrompt(onboarding.passwordSetupLink);
      successMessage = `${successMessage} Se mostró enlace manual en pantalla.`;
    }

    if (state.captcha.enabled) {
      resetCaptcha('activateAdmin');
    }
    showFlash('success', successMessage);
  } catch (error) {
    if (state.captcha.enabled) {
      resetCaptcha('activateAdmin');
    }
    showFlash('error', `No se pudo activar el administrador: ${error.message}`);
  }
}

async function loadCurrentRouteData() {
  const page = state.currentPage || 'inicio';

  if (page === 'inicio') {
    await Promise.all([loadShiftStatus(), loadShiftHistory()]);
    return;
  }

  if (page === 'solicitudes') {
    await loadRequests();
    return;
  }

  if (page === 'progreso') {
    await Promise.all([loadProgress(), loadNotifications()]);
    return;
  }

  if (page === 'cuadrante') {
    await loadMySchedule();
    return;
  }

  if (page === 'documentos') {
    await loadDocuments();
    return;
  }

  if (page === 'perfil') {
    await loadMyProfile();
    return;
  }

  if (page !== 'admin' || state.me?.role !== 'ADMIN') {
    return;
  }

  const adminView = state.adminView || 'home';

  if (adminView === 'home' || adminView === 'resumen') {
    await loadDashboard();
    return;
  }

  if (adminView === 'operaciones') {
    await Promise.all([loadProductionStatus(), loadBackupStatus(), loadAdminUsers()]);
    return;
  }

  if (adminView === 'festivos') {
    await Promise.all([loadCompanyLocation(), loadHolidays()]);
    return;
  }

  if (adminView === 'cuadrante') {
    await loadAdminUsers();
    await Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);
    return;
  }

  if (adminView === 'geolocalizacion') {
    await Promise.all([loadWorkplace(), loadSuspiciousShifts()]);
    return;
  }

  if (adminView === 'fichajes') {
    await loadAdminPresence();
    return;
  }

  if (adminView === 'solicitudes') {
    await loadAdminRequests();
    return;
  }

  if (adminView === 'personal') {
    await loadAdminUsers();
    return;
  }

  if (adminView === 'integraciones') {
    await Promise.all([loadOpenClawIntegration(), loadWhatsappIntegration()]);
    return;
  }

  if (adminView === 'auditoria') {
    await loadAuditLogs();
  }
}

async function bootstrapSession() {
  state.me = await api('/me');
  setSessionViews();
  syncTestEmailRecipient();
  await loadCurrentRouteData();
}

function geolocationErrorText(code) {
  if (code === 1) return 'Permiso de ubicación denegado. Se ficha sin coordenadas.';
  if (code === 2) return 'No se pudo determinar tu ubicación. Se ficha sin coordenadas.';
  if (code === 3) return 'Se agotó el tiempo al pedir ubicación. Se ficha sin coordenadas.';
  return 'Error de ubicación. Se ficha sin coordenadas.';
}

function formatElapsed(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;
}

function formatShiftHistoryDuration(shift) {
  const startAt = new Date(shift?.startAt ?? null);
  if (Number.isNaN(startAt.getTime())) return '-';

  if (shift?.isOpen || !shift?.endAt) {
    const elapsedSeconds = Math.floor((Date.now() - startAt.getTime()) / 1000);
    return `${formatElapsed(Math.max(0, elapsedSeconds))} (en curso)`;
  }

  const workedMinutesRaw =
    typeof shift?.workedMinutes === 'number'
      ? shift.workedMinutes
      : Math.floor((new Date(shift.endAt).getTime() - startAt.getTime()) / 60000);
  const workedMinutes = Math.max(0, Math.trunc(workedMinutesRaw));
  const hours = Math.floor(workedMinutes / 60);
  const minutes = workedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function renderShiftHistory() {
  if (!els.shiftHistoryBody) return;

  if (!state.shiftHistory.length) {
    els.shiftHistoryBody.innerHTML =
      '<tr><td colspan="7">Aún no hay fichajes registrados.</td></tr>';
    return;
  }

  els.shiftHistoryBody.innerHTML = state.shiftHistory
    .map((shift) => {
      const status = shift.isOpen ? 'Abierto' : 'Cerrado';
      const locationText = locationSummary(
        shift.startAddress || shift.endAddress,
        shift.startLat,
        shift.startLng,
      );
      return `<tr>
        <td>${safeText(formatDateTime(shift.startAt))}</td>
        <td>${safeText(formatDateTime(shift.endAt))}</td>
        <td>${safeText(workplaceDisplayName(shift.workplace))}</td>
        <td>${safeText(locationText)}</td>
        <td>${safeText(formatShiftHistoryDuration(shift))}</td>
        <td>${safeText(status)}</td>
        <td>${renderMapActionButton({
          lat: shift.startLat,
          lng: shift.startLng,
          title: 'Mapa del fichaje',
          subtitle: locationText,
        })}</td>
      </tr>`;
    })
    .join('');
}

async function loadShiftHistory(limit = 10) {
  try {
    state.shiftHistory = await api(`/shifts/me?limit=${encodeURIComponent(String(limit))}`);
    renderShiftHistory();
  } catch (error) {
    state.shiftHistory = [];
    renderShiftHistory();
    showFlash('error', `No se pudo cargar el historial de fichajes: ${error.message}`);
  }
}

function profileDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function applyProfileToForm(profile) {
  if (!els.profileNameInput) return;

  els.profileNameInput.value = profile?.name || '';
  els.profileEmailInput.value = profile?.email || '';
  els.profilePhoneInput.value = profile?.phone || '';
  els.profileBirthDateInput.value = profileDateInputValue(profile?.birthDate);
}

async function loadMyProfile(showSuccess = false) {
  try {
    state.myProfile = await api('/me/profile');
    applyProfileToForm(state.myProfile);
    syncTestEmailRecipient();
    if (showSuccess) {
      showFlash('success', 'Perfil actualizado en pantalla.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar tu perfil: ${error.message}`);
  }
}

async function saveMyProfile() {
  const email = els.profileEmailInput.value.trim();
  if (!email) {
    showFlash('error', 'El correo es obligatorio.');
    return;
  }
  if (!validateEmailInput(els.profileEmailInput)) {
    els.profileEmailInput.reportValidity();
    return;
  }

  let phone = '';
  try {
    phone = normalizeInternationalPhoneInput(els.profilePhoneInput.value);
  } catch (error) {
    showFlash('error', error.message);
    els.profilePhoneInput.focus();
    return;
  }

  const payload = {
    name: els.profileNameInput.value.trim(),
    email,
    phone: phone || null,
    birthDate: els.profileBirthDateInput.value || null,
  };

  try {
    const updated = await api('/me/profile', {
      method: 'POST',
      body: payload,
    });
    state.myProfile = updated;
    if (state.me) {
      state.me.name = updated?.name ?? state.me.name;
      state.me.email = updated?.email ?? state.me.email;
    }
    applyProfileToForm(updated);
    setSessionViews();
    showFlash('success', 'Perfil guardado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo guardar tu perfil: ${error.message}`);
  }
}

async function deleteMyAccount() {
  if (
    !confirm(
      'Vas a eliminar tu cuenta y todos tus datos de la plataforma. Esta acción no se puede deshacer. ¿Continuar?',
    )
  ) {
    return;
  }

  try {
    await api('/me', { method: 'DELETE' });
    clearSession();
    showFlash('success', 'Tu cuenta ha sido eliminada correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo eliminar tu cuenta: ${error.message}`);
  }
}

function closeAdminUserProfileModal() {
  state.adminProfileTargetUserId = null;
  if (!els.adminUserProfileModal) return;
  els.adminUserProfileModal.hidden = true;
}

function renderAdminUserProfileModal(profile) {
  if (!els.adminUserProfileModal) return;

  els.adminUserProfileName.value = profile?.name || '-';
  els.adminUserProfileEmail.value = profile?.email || '-';
  els.adminUserProfilePhone.value = profile?.phone || '-';
  els.adminUserProfileBirthDate.value = formatDateOnly(profile?.birthDate);
  els.adminUserProfileRole.value = profile?.role || '-';
  els.adminUserProfileGroup.value = profile?.workerGroup || '-';
  els.adminUserProfileModal.hidden = false;
}

async function openAdminUserProfileModal(id) {
  try {
    const profile = await api(`/admin/users/${id}/profile`);
    state.adminProfileTargetUserId = id;
    renderAdminUserProfileModal(profile);
  } catch (error) {
    showFlash('error', `No se pudo cargar el perfil del usuario: ${error.message}`);
  }
}

async function deleteAdminUser(id) {
  const target = id || state.adminProfileTargetUserId;
  if (!target) return;

  if (
    !confirm(
      'Se eliminará este usuario de la plataforma (incluyendo su cuenta de acceso). ¿Deseas continuar?',
    )
  ) {
    return;
  }

  try {
    await api(`/admin/users/${target}`, { method: 'DELETE' });
    closeAdminUserProfileModal();

    if (state.me?.id === target) {
      clearSession();
      showFlash(
        'success',
        'Tu usuario administrador fue eliminado. Se cerró la sesión.',
      );
      return;
    }

    await Promise.all([
      loadAdminUsers(),
      loadAdminPresence(),
      loadDashboard(),
      loadAuditLogs(),
    ]);
    await Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);
    showFlash('success', 'Usuario eliminado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo eliminar el usuario: ${error.message}`);
  }
}

function renderWorkTimer() {
  if (!state.openShiftStartAt) {
    els.workTimer.textContent = '00:00:00';
    els.workTimerLabel.textContent = 'No hay turno activo.';
    return;
  }

  const elapsedSec = Math.floor(
    (Date.now() - state.openShiftStartAt.getTime()) / 1000,
  );
  els.workTimer.textContent = formatElapsed(elapsedSec);
  els.workTimerLabel.textContent = 'Tiempo trabajado en el turno actual.';
}

function stopWorkTimer() {
  if (workTimerIntervalId) {
    clearInterval(workTimerIntervalId);
    workTimerIntervalId = null;
  }
  state.openShiftStartAt = null;
  renderWorkTimer();
}

function startWorkTimer(startAtIso) {
  const parsed = new Date(startAtIso);
  if (Number.isNaN(parsed.getTime())) {
    stopWorkTimer();
    return;
  }

  state.openShiftStartAt = parsed;
  renderWorkTimer();

  if (workTimerIntervalId) clearInterval(workTimerIntervalId);
  workTimerIntervalId = setInterval(renderWorkTimer, 1000);
}

async function getAutoLocation() {
  if (!navigator.geolocation) {
    return { payload: {}, note: 'Tu navegador no soporta geolocalización.' };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const payload = {
          lat: Number(position.coords.latitude.toFixed(7)),
          lng: Number(position.coords.longitude.toFixed(7)),
          accuracy: Number(position.coords.accuracy.toFixed(1)),
        };
        resolve({ payload, note: `Ubicación detectada (±${payload.accuracy}m).` });
      },
      (error) => resolve({ payload: {}, note: geolocationErrorText(error.code) }),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 },
    );
  });
}

async function loadShiftStatus() {
  try {
    const data = await api('/shifts/status');
    if (data.hasOpenShift) {
      els.shiftBadge.textContent = 'Turno abierto';
      els.shiftDetail.textContent = `Entrada: ${formatDateTime(data.openShift.startAt)}`;
      startWorkTimer(data.openShift.startAt);
    } else {
      els.shiftBadge.textContent = 'Fuera de turno';
      els.shiftDetail.textContent = 'No tienes un turno abierto.';
      stopWorkTimer();
    }
  } catch (error) {
    stopWorkTimer();
    showFlash('error', `No se pudo consultar el estado de fichaje: ${error.message}`);
  }
}

async function clockIn() {
  try {
    const geo = await getAutoLocation();
    els.geoNote.textContent = geo.note;
    await api('/shifts/clock-in', { method: 'POST', body: geo.payload });
    await Promise.all([loadShiftStatus(), loadShiftHistory()]);
    showFlash('success', 'Entrada registrada correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo fichar entrada: ${error.message}`);
  }
}

async function clockOut() {
  try {
    const geo = await getAutoLocation();
    els.geoNote.textContent = geo.note;
    await api('/shifts/clock-out', { method: 'POST', body: geo.payload });
    await Promise.all([loadShiftStatus(), loadShiftHistory()]);
    showFlash('success', 'Salida registrada correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo fichar salida: ${error.message}`);
  }
}

function requestQuery() {
  const qs = new URLSearchParams();
  if (els.filterStatus.value) qs.set('status', els.filterStatus.value);
  if (els.filterType.value) qs.set('type', els.filterType.value);
  const str = qs.toString();
  return str ? `?${str}` : '';
}

function renderRequests() {
  if (!state.requests.length) {
    els.requestsBody.innerHTML = '<tr><td colspan="6">No hay solicitudes.</td></tr>';
    return;
  }

  els.requestsBody.innerHTML = state.requests
    .map((r) => {
      const cancelButton =
        r.status === 'PENDING'
          ? `<button class="action-link" data-action="cancel-request" data-id="${r.id}">Cancelar</button>`
          : '-';

      return `<tr>
        <td>${safeText(requestTypeLabel(r.type))}</td>
        <td>${safeText(requestStatusLabel(r.status))}</td>
        <td>${safeText(formatDateTime(r.startAt))} - ${safeText(formatDateTime(r.endAt))}</td>
        <td>${safeText(r.comment)}</td>
        <td>${safeText(r.reviewComment)}</td>
        <td>${cancelButton}</td>
      </tr>`;
    })
    .join('');
}

async function loadRequests() {
  try {
    state.requests = await api(`/requests/me${requestQuery()}`);
    renderRequests();
  } catch (error) {
    showFlash('error', `No se pudieron cargar las solicitudes: ${error.message}`);
  }
}

async function createRequest() {
  if (!els.requestStart.value || !els.requestEnd.value) {
    showFlash('error', 'Debes indicar inicio y fin en la solicitud.');
    return;
  }

  const payload = {
    type: els.requestType.value,
    startAt: new Date(els.requestStart.value).toISOString(),
    endAt: new Date(els.requestEnd.value).toISOString(),
    comment: els.requestComment.value || undefined,
  };

  try {
    await api('/requests', { method: 'POST', body: payload });
    els.requestComment.value = '';
    await loadRequests();
    showFlash('success', 'Solicitud enviada correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo crear la solicitud: ${error.message}`);
  }
}

async function cancelRequest(id) {
  if (!confirm('¿Seguro que quieres cancelar esta solicitud?')) return;

  try {
    await api(`/requests/${id}/cancel`, { method: 'POST' });
    await loadRequests();
    showFlash('success', 'Solicitud cancelada.');
  } catch (error) {
    showFlash('error', `No se pudo cancelar: ${error.message}`);
  }
}

function renderProgress() {
  if (!state.progress) {
    els.progressGroup.textContent = '-';
    els.progressInternship.textContent = '-';
    els.progressWeekly.textContent = '-';
    els.progressVacation.textContent = '-';
    els.progressOvertimeBank.textContent = '-';
    els.progressSummary.textContent = 'Sin datos de progreso.';
    return;
  }

  const p = state.progress;
  els.progressGroup.textContent = workerGroupLabel(p.workerGroup);
  els.progressInternship.textContent = `${p.internship.consumedHours}h / ${p.internship.totalHours}h`;
  els.progressWeekly.textContent = `${p.weekly.workedHours}h / ${p.weekly.expectedHours ?? p.weekly.limitHours}h`;
  els.progressVacation.textContent = `${p.vacation.availableDays}d / ${p.vacation.allowanceDays}d`;
  els.progressOvertimeBank.textContent = `${p.overtimeBank.balanceHours}h`;

  if (p.workerGroup === 'INTERN') {
    els.progressSummary.textContent = p.internship.warningTriggered
      ? `Aviso: quedan ${p.internship.pendingHours}h de prácticas (umbral: 40h).`
      : `Te quedan ${p.internship.pendingHours}h de prácticas.`;
    return;
  }

  const pendingOvertime = Number(p.weekly.pendingOvertimeHours ?? 0);
  els.progressSummary.textContent = p.weekly.exceeded
    ? `Has superado el límite semanal (${p.weekly.limitHours}h). Balance semanal: ${p.weekly.balanceHours}h. Horas extra pendientes: ${pendingOvertime}h.`
    : pendingOvertime > 0
      ? `Horas extra pendientes de aprobación: ${pendingOvertime}h. Vacaciones disponibles: ${p.vacation.availableDays} días.`
      : `Dentro del límite semanal. Balance actual: ${p.weekly.balanceHours}h.`;
}

async function loadProgress() {
  try {
    state.progress = await api('/me/progress');
    renderProgress();
  } catch (error) {
    showFlash('error', `No se pudo cargar el progreso: ${error.message}`);
  }
}

function renderNotifications() {
  if (!state.notifications.length) {
    els.notificationsBody.innerHTML = '<tr><td colspan="4">No hay alertas.</td></tr>';
    return;
  }

  els.notificationsBody.innerHTML = state.notifications
    .map((n) => {
      const status = n.readAt ? 'Leída' : 'Pendiente';
      const action = n.readAt
        ? '-'
        : `<button class=\"action-link\" data-action=\"mark-notification-read\" data-id=\"${n.id}\">Marcar leída</button>`;

      return `<tr>
        <td>${status}</td>
        <td>${safeText(n.message)}</td>
        <td>${safeText(formatDateTime(n.createdAt))}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join('');
}

async function loadNotifications() {
  try {
    state.notifications = await api('/notifications/me');
    renderNotifications();
  } catch (error) {
    showFlash('error', `No se pudieron cargar alertas: ${error.message}`);
  }
}

async function markNotificationRead(id) {
  try {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    await loadNotifications();
    showFlash('success', 'Alerta marcada como leída.');
  } catch (error) {
    showFlash('error', `No se pudo marcar alerta: ${error.message}`);
  }
}

function scheduleTypeLabel(type) {
  if (type === 'WORK') return 'Trabajo';
  if (type === 'VACATION') return 'Vacaciones';
  if (type === 'SICK_LEAVE') return 'Baja';
  if (type === 'DAY_OFF') return 'Día libre';
  if (type === 'HOLIDAY') return 'Festivo';
  return 'Sin evento';
}

function requestTypeLabel(type) {
  if (type === 'VACATION') return 'Vacaciones';
  if (type === 'SICK_LEAVE') return 'Baja';
  if (type === 'DAY_OFF') return 'Día libre';
  if (type === 'OVERTIME') return 'Horas extra';
  if (type === 'CORRECTION') return 'Corrección';
  return type || '-';
}

function requestStatusLabel(status) {
  if (status === 'PENDING') return 'Pendiente';
  if (status === 'APPROVED') return 'Aprobada';
  if (status === 'REJECTED') return 'Rechazada';
  if (status === 'CANCELLED') return 'Cancelada';
  return status || '-';
}

function roleLabel(role) {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'EMPLOYEE') return 'Trabajador';
  return role || '-';
}

function holidayScopeLabel(scope) {
  if (scope === 'COMPANY') return 'Empresa';
  if (scope === 'LOCAL') return 'Local';
  if (scope === 'PROVINCIAL') return 'Provincial';
  if (scope === 'REGIONAL') return 'Autonómico';
  if (scope === 'NATIONAL') return 'Nacional';
  return scope || '-';
}

function scheduleTypeClass(type) {
  if (type === 'WORK') return 'work';
  if (type === 'VACATION') return 'vacation';
  if (type === 'SICK_LEAVE') return 'sick';
  if (type === 'DAY_OFF') return 'dayoff';
  if (type === 'HOLIDAY') return 'holiday';
  return 'empty';
}

function schedulePlannedTimeParts(entry) {
  if (!entry) return { start: '', end: '', duration: '' };

  return {
    start: entry.plannedStartTime || entry.startTime || '',
    end: entry.plannedEndTime || entry.endTime || '',
    duration: entry.plannedDurationLabel || '',
  };
}

function schedulePlannedTimeLabel(entry) {
  const { start, end } = schedulePlannedTimeParts(entry);
  if (start && end) return `Previsto: ${start} - ${end}`;
  if (entry?.type === 'WORK') return 'Trabajo sin horario previsto';
  return '';
}

function weekdayShortLabel(weekday) {
  if (weekday === 1) return 'Lunes';
  if (weekday === 2) return 'Martes';
  if (weekday === 3) return 'Miércoles';
  if (weekday === 4) return 'Jueves';
  if (weekday === 5) return 'Viernes';
  if (weekday === 6) return 'Sábado';
  if (weekday === 7) return 'Domingo';
  return `Día ${weekday}`;
}

function parseMonthParts(monthValue) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue || '');
  if (!match) return null;
  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
  };
}

function buildScheduleCalendar(monthValue, entries, options = {}) {
  const parts = parseMonthParts(monthValue);
  if (!parts) {
    return '<p class="muted">Selecciona un mes válido.</p>';
  }

  const { year, monthIndex } = parts;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const entryMap = new Map((entries || []).map((entry) => [entry.dateKey, entry]));
  const selectedDate = options.selectedDate || '';
  const interactive = options.interactive === true;
  const weekdayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    .map((label) => `<div class="schedule-weekday">${label}</div>`)
    .join('');
  const cells = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push('<div class="schedule-gap" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(
      2,
      '0',
    )}`;
    const entry = entryMap.get(dateKey) || null;
    const typeLabel = entry ? scheduleTypeLabel(entry.type) : 'Sin evento';
    const timeLabel = schedulePlannedTimeLabel(entry);
    const durationLabel = entry?.plannedDurationLabel
      ? `Duración prevista: ${entry.plannedDurationLabel}`
      : '';
    const notesLabel = entry?.notes ? safeText(entry.notes) : '';
    const classes = [
      'schedule-day',
      scheduleTypeClass(entry?.type),
      entry ? 'has-entry' : 'is-empty',
      interactive ? 'is-clickable' : '',
      selectedDate === dateKey ? 'is-selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const tag = interactive ? 'button' : 'div';
    const attrs = interactive
      ? ` type="button" data-date="${dateKey}" aria-label="Editar ${dateKey}"`
      : '';

    cells.push(
      `<${tag} class="${classes}"${attrs}>
        <span class="schedule-day-number">${day}</span>
        <span class="schedule-day-type">${safeText(typeLabel)}</span>
        ${timeLabel ? `<span class="schedule-day-time">${safeText(timeLabel)}</span>` : ''}
        ${durationLabel ? `<span class="schedule-day-duration">${safeText(durationLabel)}</span>` : ''}
        ${notesLabel ? `<span class="schedule-day-notes">${notesLabel}</span>` : ''}
      </${tag}>`,
    );
  }

  return `<div class="schedule-grid">${weekdayHeaders}${cells.join('')}</div>`;
}

function renderMySchedule() {
  if (!els.scheduleCalendar) return;
  if (els.scheduleMonthLabel) {
    els.scheduleMonthLabel.textContent = monthLabel(state.myScheduleMonth);
  }
  els.scheduleCalendar.innerHTML = buildScheduleCalendar(
    state.myScheduleMonth,
    state.myScheduleEntries,
    {
      interactive: true,
      selectedDate: state.myScheduleSelectedDate,
    },
  );
}

function syncMySickLeaveInputs(dateKey) {
  const nextDate = dateKey || '';
  if (els.mySickLeaveFromInput && nextDate) {
    els.mySickLeaveFromInput.value = nextDate;
  }
  if (els.mySickLeaveToInput && nextDate) {
    els.mySickLeaveToInput.value = nextDate;
  }
  if (els.scheduleSelectedDateLabel) {
    els.scheduleSelectedDateLabel.textContent = nextDate
      ? `Día seleccionado: ${nextDate}`
      : 'Selecciona un día del calendario o indica el rango.';
  }
}

async function loadMySchedule(showSuccess = false) {
  const month =
    els.scheduleMonthInput?.value || state.myScheduleMonth || monthLocalValue();

  try {
    const result = await api(`/schedule/me?month=${encodeURIComponent(month)}`);
    state.myScheduleMonth = result.month;
    state.myScheduleEntries = result.entries || [];
    if (els.scheduleMonthInput) {
      els.scheduleMonthInput.value = result.month;
    }
    if (
      !state.myScheduleSelectedDate ||
      !state.myScheduleSelectedDate.startsWith(`${result.month}-`)
    ) {
      state.myScheduleSelectedDate = `${result.month}-01`;
    }
    syncMySickLeaveInputs(state.myScheduleSelectedDate);
    renderMySchedule();
    if (showSuccess) {
      showFlash('success', 'Cuadrante actualizado.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar tu cuadrante: ${error.message}`);
  }
}

async function markMySickLeave() {
  const fromDate = els.mySickLeaveFromInput?.value || '';
  const toDate = els.mySickLeaveToInput?.value || '';
  const notes = els.mySickLeaveNotesInput?.value?.trim() || '';

  if (!fromDate || !toDate) {
    showFlash('error', 'Debes indicar fecha inicial y final para la baja médica.');
    return;
  }

  try {
    await api('/schedule/me/sick-leave', {
      method: 'POST',
      body: {
        fromDate,
        toDate,
        notes: notes || undefined,
      },
    });
    await loadMySchedule();
    showFlash('success', 'Baja médica registrada en tu cuadrante.');
  } catch (error) {
    showFlash('error', `No se pudo registrar la baja médica: ${error.message}`);
  }
}

function getAdminSchedulableUsers() {
  return state.adminUsers;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function formatAdminSchedulableUserLabel(user) {
  const primary = (user?.name || '').trim() || user?.email || user?.id || 'Empleado';
  if (user?.email && primary !== user.email) {
    return `${primary} · ${user.email}`;
  }
  return primary;
}

function renderAdminEmployeePdfUserOptions() {
  if (!els.adminPdfUserSelect) return;

  const users = getAdminSchedulableUsers();
  if (!users.length) {
    els.adminPdfUserSelect.innerHTML =
      '<option value="">No hay personas disponibles</option>';
    return;
  }

  const preferredUserId =
    state.adminScheduleUserId && users.some((user) => user.id === state.adminScheduleUserId)
      ? state.adminScheduleUserId
      : users[0].id;
  const currentValue =
    users.find((user) => user.id === els.adminPdfUserSelect.value)?.id ||
    preferredUserId;

  els.adminPdfUserSelect.innerHTML = users
    .map((user) => {
      const rolePart = user.role ? ` · ${user.role}` : '';
      return `<option value="${user.id}">${safeText(
        `${formatAdminSchedulableUserLabel(user)}${rolePart}`,
      )}</option>`;
    })
    .join('');

  els.adminPdfUserSelect.value = currentValue;
}

function getSelectedAdminSchedulableUser() {
  return getAdminSchedulableUsers().find((user) => user.id === state.adminScheduleUserId) || null;
}

function renderAdminScheduleSelectedUser(forceSearchValue = false) {
  const user = getSelectedAdminSchedulableUser();

  if (els.adminScheduleSelectedUserLabel) {
    els.adminScheduleSelectedUserLabel.textContent = user
      ? `Persona seleccionada: ${formatAdminSchedulableUserLabel(user)}`
      : 'Selecciona una persona para editar su cuadrante.';
  }

  if (
    els.adminScheduleUserSearchInput &&
    (forceSearchValue ||
      !els.adminScheduleUserSearchInput.value ||
      document.activeElement !== els.adminScheduleUserSearchInput)
  ) {
    els.adminScheduleUserSearchInput.value = user
      ? formatAdminSchedulableUserLabel(user)
      : '';
  }

  if (els.adminAssignTargetLabel) {
    els.adminAssignTargetLabel.textContent = user
      ? `La asignación directa se aplicará a: ${formatAdminSchedulableUserLabel(user)}`
      : 'Selecciona una persona en el buscador del cuadrante.';
  }
}

function hideAdminScheduleSearchResults() {
  if (!els.adminScheduleUserSearchResults) return;
  els.adminScheduleUserSearchResults.hidden = true;
  els.adminScheduleUserSearchResults.innerHTML = '';
}

function renderAdminScheduleSearchResults() {
  if (!els.adminScheduleUserSearchInput || !els.adminScheduleUserSearchResults) return;

  const query = normalizeSearchText(els.adminScheduleUserSearchInput.value);
  if (query.length < 2) {
    hideAdminScheduleSearchResults();
    return;
  }

  const matches = getAdminSchedulableUsers()
    .filter((user) =>
      normalizeSearchText(
        [user.name || '', user.email || '', user.workerGroup || ''].join(' '),
      ).includes(query),
    )
    .slice(0, 8);

  if (!matches.length) {
    els.adminScheduleUserSearchResults.hidden = false;
    els.adminScheduleUserSearchResults.innerHTML =
      '<div class="search-result-meta" style="padding: 10px 12px;">No se han encontrado usuarios.</div>';
    return;
  }

  els.adminScheduleUserSearchResults.hidden = false;
  els.adminScheduleUserSearchResults.innerHTML = matches
    .map((user) => {
      const primary = safeText((user.name || '').trim() || user.email || user.id);
      const meta = safeText(
        [user.email || '', user.workerGroup || ''].filter(Boolean).join(' · '),
      );
      return `<button class="search-result-btn" type="button" data-schedule-user-id="${user.id}">
        <div class="search-result-main">${primary}</div>
        <div class="search-result-meta">${meta || '&nbsp;'}</div>
      </button>`;
    })
    .join('');
}

function selectAdminScheduleUser(userId, { load = true } = {}) {
  const user = getAdminSchedulableUsers().find((item) => item.id === userId) || null;
  if (!user) return;

  state.adminScheduleUserId = user.id;
  if (els.adminScheduleUserSelect) {
    els.adminScheduleUserSelect.value = user.id;
  }

  renderAdminScheduleSelectedUser(true);
  hideAdminScheduleSearchResults();

  if (load) {
    Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);
  } else {
    renderAdminSchedule();
    renderAdminScheduleTemplateSummary();
  }
}

function setAdminScheduleWeekdays(days) {
  if (!els.adminScheduleWeekdayPicker) return;
  const selected = new Set(days.map(String));
  els.adminScheduleWeekdayPicker
    .querySelectorAll('[data-weekday]')
    .forEach((button) => {
      button.classList.toggle('is-active', selected.has(button.dataset.weekday));
    });
}

function getAdminScheduleWeekdays() {
  if (!els.adminScheduleWeekdayPicker) return [];
  return [...els.adminScheduleWeekdayPicker.querySelectorAll('[data-weekday].is-active')]
    .map((button) => Number(button.dataset.weekday))
    .filter((value) => Number.isInteger(value));
}

function monthBoundaryValues(monthValue) {
  const [yearStr, monthStr] = String(monthValue || '').split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    const now = new Date();
    return monthBoundaryValues(monthLocalValue(now));
  }

  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);

  return {
    fromDate: dateLocalValue(first),
    toDate: dateLocalValue(last),
  };
}

function previousMonthValue(monthValue) {
  const parts = parseMonthParts(monthValue);
  if (!parts) {
    const now = new Date();
    return monthLocalValue(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  }

  return monthLocalValue(new Date(parts.year, parts.monthIndex - 1, 1));
}

function syncAdminScheduleRangeInputs(monthValue) {
  const { fromDate, toDate } = monthBoundaryValues(monthValue);
  if (els.adminScheduleRangeStartInput) {
    els.adminScheduleRangeStartInput.value = fromDate;
  }
  if (els.adminScheduleRangeEndInput) {
    els.adminScheduleRangeEndInput.value = toDate;
  }
  if (els.adminScheduleCopySourceMonthInput) {
    els.adminScheduleCopySourceMonthInput.value = previousMonthValue(monthValue);
  }
}

function renderAdminScheduleUserOptions() {
  if (!els.adminScheduleUserSelect) return;

  const users = getAdminSchedulableUsers();
  if (!users.length) {
    state.adminScheduleUserId = '';
    els.adminScheduleUserSelect.innerHTML =
      '<option value="">No hay usuarios disponibles</option>';
    renderAdminScheduleSelectedUser(true);
    hideAdminScheduleSearchResults();
    return;
  }

  if (!users.some((user) => user.id === state.adminScheduleUserId)) {
    state.adminScheduleUserId = users[0].id;
  }

  els.adminScheduleUserSelect.innerHTML = users
    .map((user) => {
      const label = user.name || user.email || user.id;
      return `<option value="${user.id}">${safeText(label)}</option>`;
    })
    .join('');

  els.adminScheduleUserSelect.value = state.adminScheduleUserId;
  renderAdminScheduleSelectedUser();
}

function renderAdminScheduleTemplateSummary() {
  if (!els.adminScheduleTemplateSummary) return;

  const user = getSelectedAdminSchedulableUser();
  if (!user) {
    els.adminScheduleTemplateSummary.innerHTML =
      '<p class="muted tiny">Selecciona una persona para ver su plantilla semanal.</p>';
    return;
  }

  if (!state.adminScheduleTemplateEntries.length) {
    els.adminScheduleTemplateSummary.innerHTML =
      '<p class="muted tiny">Sin plantilla semanal guardada para esta persona.</p>';
    return;
  }

  const rows = [...state.adminScheduleTemplateEntries]
    .sort((a, b) => a.weekday - b.weekday)
    .map((entry) => {
      const timeLabel =
        schedulePlannedTimeLabel(entry) ||
        (entry.type === 'WORK'
          ? 'Trabajo sin horario previsto'
          : 'Sin horario previsto');
      const durationLabel = entry.plannedDurationLabel
        ? ` · ${entry.plannedDurationLabel}`
        : '';
      const notes = entry.notes
        ? `<div class="search-result-meta">${safeText(entry.notes)}</div>`
        : '';
      return `<div class="schedule-template-item">
        <strong>${safeText(weekdayShortLabel(entry.weekday))}</strong>
        <div>${safeText(scheduleTypeLabel(entry.type))} · ${safeText(timeLabel)}${safeText(durationLabel)}</div>
        ${notes}
      </div>`;
    })
    .join('');

  els.adminScheduleTemplateSummary.innerHTML = `
    <div class="schedule-template-list">
      ${rows}
    </div>
  `;
}

function fillAdminScheduleForm(dateKey, entry = null) {
  if (els.adminScheduleDateInput) {
    els.adminScheduleDateInput.value = dateKey;
  }
  if (els.adminScheduleTypeSelect) {
    els.adminScheduleTypeSelect.value = entry?.type || 'WORK';
  }
  if (els.adminScheduleStartTimeInput) {
    els.adminScheduleStartTimeInput.value = entry?.startTime || '';
  }
  if (els.adminScheduleEndTimeInput) {
    els.adminScheduleEndTimeInput.value = entry?.endTime || '';
  }
  if (els.adminScheduleNotesInput) {
    els.adminScheduleNotesInput.value = entry?.notes || '';
  }
  syncAdminSchedulePlannedTimeControls();
}

function syncAdminSchedulePlannedTimeControls() {
  const isWork = els.adminScheduleTypeSelect?.value === 'WORK';
  const fields = [
    els.adminScheduleStartTimeInput,
    els.adminScheduleEndTimeInput,
  ].filter(Boolean);

  fields.forEach((field) => {
    field.disabled = !isWork;
    field.title = isWork
      ? 'Hora prevista de fichaje para días de trabajo'
      : 'Solo se usa en días de trabajo';
    if (!isWork) {
      field.value = '';
    }
  });
}

function validateAdminSchedulePlannedTimes() {
  if (els.adminScheduleTypeSelect?.value !== 'WORK') return true;

  const startTime = els.adminScheduleStartTimeInput?.value || '';
  const endTime = els.adminScheduleEndTimeInput?.value || '';

  if (!!startTime !== !!endTime) {
    showFlash(
      'error',
      'Indica entrada prevista y salida prevista, o deja ambas vacías.',
    );
    return false;
  }

  if (startTime && endTime && endTime <= startTime) {
    showFlash(
      'error',
      'La salida prevista debe ser posterior a la entrada prevista.',
    );
    return false;
  }

  return true;
}

function renderAdminSchedule() {
  if (!els.adminScheduleCalendar || !els.adminScheduleTargetLabel) return;
  if (els.adminScheduleMonthLabel) {
    els.adminScheduleMonthLabel.textContent = monthLabel(state.adminScheduleMonth);
  }

  const users = getAdminSchedulableUsers();
  if (!users.length) {
    els.adminScheduleTargetLabel.textContent =
      'No hay usuarios disponibles para cuadrante.';
    els.adminScheduleCalendar.innerHTML =
      '<p class="muted">No hay usuarios para mostrar.</p>';
    return;
  }

  const currentUser =
    users.find((user) => user.id === state.adminScheduleUserId) || users[0];
  const currentDate = els.adminScheduleDateInput?.value || '';

  els.adminScheduleTargetLabel.textContent = `Cuadrante de ${
    currentUser.name || currentUser.email || currentUser.id
  }`;
  els.adminScheduleCalendar.innerHTML = buildScheduleCalendar(
    state.adminScheduleMonth,
    state.adminScheduleEntries,
    {
      interactive: true,
      selectedDate: currentDate,
    },
  );
}

async function loadAdminSchedule(showSuccess = false) {
  if (!els.adminScheduleMonthInput) return;

  renderAdminScheduleUserOptions();
  if (!state.adminScheduleUserId) {
    renderAdminSchedule();
    return;
  }

  const month =
    els.adminScheduleMonthInput.value ||
    state.adminScheduleMonth ||
    monthLocalValue();

  try {
    const params = new URLSearchParams({
      userId: state.adminScheduleUserId,
      month,
    });
    const result = await api(`/admin/schedule?${params.toString()}`);
    state.adminScheduleMonth = result.month;
    state.adminScheduleEntries = result.entries || [];
    state.adminScheduleUserId = result.user?.id || state.adminScheduleUserId;
    els.adminScheduleMonthInput.value = result.month;
    renderAdminScheduleUserOptions();
    renderAdminSchedule();
    if (showSuccess) {
      showFlash('success', 'Cuadrante de administración actualizado.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar el cuadrante del empleado: ${error.message}`);
  }
}

async function loadAdminScheduleTemplate(showSuccess = false) {
  if (!state.adminScheduleUserId) {
    state.adminScheduleTemplateEntries = [];
    renderAdminScheduleTemplateSummary();
    return;
  }

  try {
    const params = new URLSearchParams({ userId: state.adminScheduleUserId });
    const result = await api(`/admin/schedule/template?${params.toString()}`);
    state.adminScheduleTemplateEntries = result.entries || [];
    renderAdminScheduleTemplateSummary();
    if (showSuccess) {
      showFlash('success', 'Plantilla semanal actualizada.');
    }
  } catch (error) {
    state.adminScheduleTemplateEntries = [];
    renderAdminScheduleTemplateSummary();
    showFlash('error', `No se pudo cargar la plantilla semanal: ${error.message}`);
  }
}

async function saveAdminSchedule() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const date = els.adminScheduleDateInput?.value || '';

  if (!userId || !date) {
    showFlash('error', 'Debes seleccionar empleado y día para guardar el cuadrante.');
    return;
  }
  if (!validateAdminSchedulePlannedTimes()) return;

  try {
    await api('/admin/schedule', {
      method: 'POST',
      body: {
        userId,
        date,
        type: els.adminScheduleTypeSelect.value,
        startTime: els.adminScheduleStartTimeInput.value || undefined,
        endTime: els.adminScheduleEndTimeInput.value || undefined,
        notes: els.adminScheduleNotesInput.value || undefined,
      },
    });
    await loadAdminSchedule();
    showFlash('success', 'Día de cuadrante guardado.');
  } catch (error) {
    showFlash('error', `No se pudo guardar el cuadrante: ${error.message}`);
  }
}

async function saveAdminScheduleRange() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const fromDate = els.adminScheduleRangeStartInput?.value || '';
  const toDate = els.adminScheduleRangeEndInput?.value || '';
  const weekdays = getAdminScheduleWeekdays();

  if (!userId) {
    showFlash('error', 'Debes seleccionar una persona para aplicar el cuadrante.');
    return;
  }
  if (!fromDate || !toDate) {
    showFlash('error', 'Debes indicar fecha inicial y final para aplicar el rango.');
    return;
  }
  if (!weekdays.length) {
    showFlash('error', 'Selecciona al menos un día de la semana.');
    return;
  }
  if (!validateAdminSchedulePlannedTimes()) return;

  try {
    const result = await api('/admin/schedule/bulk', {
      method: 'POST',
      body: {
        userId,
        fromDate,
        toDate,
        weekdays,
        type: els.adminScheduleTypeSelect.value,
        startTime: els.adminScheduleStartTimeInput.value || undefined,
        endTime: els.adminScheduleEndTimeInput.value || undefined,
        notes: els.adminScheduleNotesInput.value || undefined,
      },
    });
    await loadAdminSchedule();
    showFlash(
      'success',
      `Cuadrante aplicado en ${result.affected} día(s) del rango seleccionado.`,
    );
  } catch (error) {
    showFlash('error', `No se pudo aplicar el cuadrante por rango: ${error.message}`);
  }
}

async function saveAdminScheduleTemplate() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const weekdays = getAdminScheduleWeekdays();

  if (!userId) {
    showFlash('error', 'Debes seleccionar una persona para guardar la plantilla.');
    return;
  }
  if (!weekdays.length) {
    showFlash('error', 'Selecciona al menos un día de la semana para la plantilla.');
    return;
  }
  if (!validateAdminSchedulePlannedTimes()) return;

  try {
    const result = await api('/admin/schedule/template', {
      method: 'POST',
      body: {
        userId,
        weekdays,
        type: els.adminScheduleTypeSelect.value,
        startTime: els.adminScheduleStartTimeInput.value || undefined,
        endTime: els.adminScheduleEndTimeInput.value || undefined,
        notes: els.adminScheduleNotesInput.value || undefined,
      },
    });
    state.adminScheduleTemplateEntries = result.entries || [];
    renderAdminScheduleTemplateSummary();
    showFlash('success', 'Plantilla semanal guardada.');
  } catch (error) {
    showFlash('error', `No se pudo guardar la plantilla: ${error.message}`);
  }
}

async function applyAdminScheduleTemplate() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const month = els.adminScheduleMonthInput?.value || state.adminScheduleMonth || '';

  if (!userId || !month) {
    showFlash('error', 'Debes seleccionar persona y mes para aplicar la plantilla.');
    return;
  }

  if (
    !confirm(
      'Se aplicará la plantilla semanal sobre el mes seleccionado y se sobrescribirán esos días. ¿Continuar?',
    )
  ) {
    return;
  }

  try {
    const result = await api('/admin/schedule/template/apply', {
      method: 'POST',
      body: { userId, month },
    });
    await Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);
    showFlash(
      'success',
      `Plantilla aplicada en ${result.affected} día(s) del mes ${result.month}.`,
    );
  } catch (error) {
    showFlash('error', `No se pudo aplicar la plantilla: ${error.message}`);
  }
}

async function copyAdminScheduleMonth() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const sourceMonth = els.adminScheduleCopySourceMonthInput?.value || '';
  const targetMonth = els.adminScheduleMonthInput?.value || state.adminScheduleMonth || '';

  if (!userId || !sourceMonth || !targetMonth) {
    showFlash('error', 'Debes indicar persona, mes origen y mes destino.');
    return;
  }

  if (
    !confirm(
      `Se copiará el cuadrante de ${sourceMonth} a ${targetMonth} y se sobrescribirán los días coincidentes. ¿Continuar?`,
    )
  ) {
    return;
  }

  try {
    const result = await api('/admin/schedule/copy-month', {
      method: 'POST',
      body: { userId, sourceMonth, targetMonth },
    });
    await loadAdminSchedule();
    showFlash(
      'success',
      `Cuadrante copiado: ${result.copied} día(s) trasladados${result.skipped ? `, ${result.skipped} omitidos por no existir en el mes destino` : ''}.`,
    );
  } catch (error) {
    showFlash('error', `No se pudo copiar el cuadrante: ${error.message}`);
  }
}

async function submitAdminDirectAssignment() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const startAt = els.adminAssignStartInput?.value || '';
  const endAt = els.adminAssignEndInput?.value || '';
  const type = els.adminAssignTypeSelect?.value || '';
  const comment = els.adminAssignCommentInput?.value?.trim() || '';

  if (!userId) {
    showFlash('error', 'Debes seleccionar una persona antes de crear la asignación.');
    return;
  }
  if (!startAt || !endAt) {
    showFlash('error', 'Debes indicar inicio y fin para la asignación.');
    return;
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    showFlash('error', 'Inicio o fin inválidos.');
    return;
  }

  const endpointByType = {
    VACATION: '/admin/requests/assign-vacation',
    SICK_LEAVE: '/admin/requests/assign-sick-leave',
    DAY_OFF: '/admin/requests/assign-day-off',
    OVERTIME: '/admin/requests/assign-overtime',
  };

  const endpoint = endpointByType[type];
  if (!endpoint) {
    showFlash('error', 'Tipo de asignación no soportado.');
    return;
  }

  try {
    await api(endpoint, {
      method: 'POST',
      body: {
        userId,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        comment: comment || undefined,
      },
    });
    await Promise.all([loadAdminRequests(), loadDashboard(), loadAdminSchedule()]);
    els.adminAssignCommentInput.value = '';
    showFlash('success', 'Asignación registrada correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo registrar la asignación: ${error.message}`);
  }
}

async function deleteAdminSchedule() {
  const userId = state.adminScheduleUserId || els.adminScheduleUserSelect?.value || '';
  const date = els.adminScheduleDateInput?.value || '';

  if (!userId || !date) {
    showFlash('error', 'Debes indicar empleado y día para eliminar la entrada.');
    return;
  }

  try {
    const params = new URLSearchParams({ userId, date });
    await api(`/admin/schedule?${params.toString()}`, {
      method: 'DELETE',
    });
    fillAdminScheduleForm(date, null);
    await loadAdminSchedule();
    showFlash('success', 'Entrada de cuadrante eliminada.');
  } catch (error) {
    showFlash('error', `No se pudo eliminar la entrada del cuadrante: ${error.message}`);
  }
}

function renderDocuments() {
  if (!state.documents.length) {
    els.docsBody.innerHTML = '<tr><td colspan="4">No hay documentos.</td></tr>';
    return;
  }

  els.docsBody.innerHTML = state.documents
    .map((d) => {
      const selected = d.id === state.selectedDocumentId;
      const selectBtn =
        d.status === 'DRAFT'
          ? `<button class="action-link" data-action="select-doc" data-id="${d.id}">${selected ? 'Seleccionado' : 'Seleccionar para firmar'}</button>`
          : '-';
      const downloadBtn =
        d.status === 'SIGNED'
          ? `<button class="action-link" data-action="download-doc" data-id="${d.id}">Descargar</button>`
          : '<span class="muted tiny">Disponible al firmar</span>';

      return `<tr>
        <td>${safeText(d.status)}</td>
        <td>${safeText(formatDateTime(d.fromDate))} - ${safeText(formatDateTime(d.toDate))}</td>
        <td>${safeText(d.sha256 ? `${d.sha256.slice(0, 18)}...` : '-')}</td>
        <td>
          ${downloadBtn}
          ${selectBtn}
        </td>
      </tr>`;
    })
    .join('');

  els.selectedDocLabel.textContent = state.selectedDocumentId
    ? state.selectedDocumentId.slice(0, 8)
    : 'ninguno';
}

async function loadDocuments() {
  try {
    state.documents = await api('/documents/me');

    if (
      state.selectedDocumentId &&
      !state.documents.some((d) => d.id === state.selectedDocumentId && d.status === 'DRAFT')
    ) {
      state.selectedDocumentId = null;
    }

    renderDocuments();
  } catch (error) {
    showFlash('error', `No se pudieron cargar los documentos: ${error.message}`);
  }
}

async function createDocument() {
  if (!els.docFrom.value || !els.docTo.value) {
    showFlash('error', 'Debes indicar el rango de fechas del documento.');
    return;
  }

  try {
    const payload = {
      from: els.docFrom.value,
      to: els.docTo.value,
      timezone: els.docTimezone.value || Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const doc = await api('/documents/timesheet', { method: 'POST', body: payload });
    state.selectedDocumentId = doc.id;
    await loadDocuments();
    showFlash('success', 'Documento generado en borrador. Ya puedes firmarlo.');
  } catch (error) {
    showFlash('error', `No se pudo crear el documento: ${error.message}`);
  }
}

async function downloadDocument(id) {
  const doc = state.documents.find((item) => item.id === id);
  if (doc?.status !== 'SIGNED') {
    showFlash('error', 'No se puede descargar hasta que el documento esté firmado.');
    return;
  }

  try {
    const res = await fetch(`/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `document_${id}.pdf`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showFlash('success', 'Documento descargado.');
  } catch (error) {
    showFlash('error', `No se pudo descargar el documento: ${error.message}`);
  }
}

async function exportCompanyExcel() {
  const from = els.adminExportFromInput?.value || '';
  const to = els.adminExportToInput?.value || '';

  if (!from || !to) {
    showFlash('error', 'Debes indicar las fechas de inicio y fin para exportar el Excel.');
    return;
  }

  if (from > to) {
    showFlash('error', 'La fecha "desde" no puede ser posterior a la fecha "hasta".');
    return;
  }

  try {
    const params = new URLSearchParams({ from, to });
    const res = await fetch(`/admin/exports/company.xlsx?${params.toString()}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `company_${from}_to_${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showFlash('success', 'Excel exportado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo exportar el Excel: ${error.message}`);
  }
}

async function exportEmployeePdf() {
  const userId = els.adminPdfUserSelect?.value || '';
  const from = els.adminPdfFromInput?.value || '';
  const to = els.adminPdfToInput?.value || '';

  if (!userId) {
    showFlash('error', 'Debes seleccionar una persona para exportar el PDF.');
    return;
  }

  if (!from || !to) {
    showFlash('error', 'Debes indicar las fechas de inicio y fin para exportar el PDF.');
    return;
  }

  if (from > to) {
    showFlash('error', 'La fecha "desde" no puede ser posterior a la fecha "hasta".');
    return;
  }

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
    const params = new URLSearchParams({ userId, from, to });
    const res = await fetch(`/admin/exports/user.pdf?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${state.token}`,
        'x-timezone': timezone,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `${res.status} ${res.statusText}`);
    }

    const selectedUser = state.adminUsers.find((user) => user.id === userId);
    const safeName =
      ((selectedUser?.name || '').trim() || selectedUser?.email || 'empleado')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'empleado';

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${safeName}_${from}_${to}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showFlash('success', 'PDF individual exportado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo exportar el PDF: ${error.message}`);
  }
}

function initSignatureCanvas() {
  const canvas = els.signatureCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      clear: () => {},
      resize: () => {},
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(Math.floor(rect.width || 0), 400);
    const height = Math.max(Math.floor(rect.height || 0), 150);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f9f8f3';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1b2221';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
  }

  resize();
  window.addEventListener('resize', resize);

  let drawing = false;

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    state.signatureDirty = true;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    state.signatureDirty = true;
    els.signaturePreview.src = canvas.toDataURL('image/png');
    els.signaturePreview.hidden = false;
  });

  const stop = (e) => {
    if (e?.pointerId != null && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    drawing = false;
    ctx.closePath();
    if (state.signatureDirty) {
      els.signaturePreview.src = canvas.toDataURL('image/png');
      els.signaturePreview.hidden = false;
    }
  };

  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointerleave', stop);
  canvas.addEventListener('pointercancel', stop);

  const clear = () => {
    const width = canvas.clientWidth || 400;
    const height = canvas.clientHeight || 150;
    ctx.fillStyle = '#f9f8f3';
    ctx.fillRect(0, 0, width, height);
    state.signatureDirty = false;
    els.signaturePreview.hidden = true;
    els.signaturePreview.src = '';
  };

  return { clear, resize };
}

async function signSelectedDocument() {
  if (!state.selectedDocumentId) {
    showFlash('error', 'Selecciona un documento en estado DRAFT para firmar.');
    return;
  }

  if (!state.signatureDirty) {
    showFlash('error', 'Debes dibujar una firma antes de enviar.');
    return;
  }

  try {
    const signatureImageBase64 = els.signatureCanvas.toDataURL('image/png');
    await api(`/documents/${state.selectedDocumentId}/sign`, {
      method: 'POST',
      body: { signatureImageBase64 },
    });

    clearSignature();
    await loadDocuments();
    showFlash('success', 'Documento firmado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo firmar el documento: ${error.message}`);
  }
}

function renderBackupStatus() {
  if (!els.backupLastLabel || !els.backupNextLabel || !els.backupStatusLabel) {
    return;
  }

  const status = state.backupStatus;
  if (!status) {
    els.backupLastLabel.textContent = '-';
    els.backupNextLabel.textContent = '-';
    els.backupStatusLabel.textContent = '-';
    return;
  }

  const last = status.lastBackup;
  if (last?.fileName) {
    els.backupLastLabel.textContent = `${last.fileName} (${formatBytes(
      last.sizeBytes,
    )})`;
  } else {
    els.backupLastLabel.textContent = 'Sin backups';
  }

  els.backupNextLabel.textContent = status.nextAutoBackupAt
    ? formatDateTime(status.nextAutoBackupAt)
    : status.autoBackupEnabled
      ? 'Pendiente'
      : 'Auto desactivado';

  if (status.backupInProgress) {
    els.backupStatusLabel.textContent = 'En progreso';
    return;
  }

  if (status.lastBackupError) {
    els.backupStatusLabel.textContent = 'Error';
    return;
  }

  els.backupStatusLabel.textContent = status.autoBackupEnabled
    ? 'Activo'
    : 'Manual';
}

function productionStatusLabel(status) {
  if (status === 'ok') return 'Configurado';
  if (status === 'warning') return 'Revisar';
  if (status === 'missing') return 'Pendiente';
  if (status === 'disabled') return 'Desactivado';
  return status || '-';
}

function productionOverallLabel(status) {
  if (status === 'ready') return 'Preparado';
  if (status === 'review') return 'Revisar';
  if (status === 'pending') return 'Pendiente';
  return '-';
}

function renderProductionStatus() {
  if (
    !els.productionOverallLabel ||
    !els.productionOkLabel ||
    !els.productionWarningLabel ||
    !els.productionPendingLabel ||
    !els.productionStatusBody
  ) {
    return;
  }

  const status = state.productionStatus;
  if (!status) {
    els.productionOverallLabel.textContent = '-';
    els.productionOkLabel.textContent = '0';
    els.productionWarningLabel.textContent = '0';
    els.productionPendingLabel.textContent = '0';
    els.productionStatusBody.innerHTML =
      '<tr><td colspan="3">Pulsa revisar estado para comprobar la configuración.</td></tr>';
    return;
  }

  els.productionOverallLabel.textContent = productionOverallLabel(
    status.overallStatus,
  );
  els.productionOkLabel.textContent = String(status.summary?.ok ?? 0);
  els.productionWarningLabel.textContent = String(status.summary?.warnings ?? 0);
  els.productionPendingLabel.textContent = String(status.summary?.pending ?? 0);

  const items = Array.isArray(status.items) ? status.items : [];
  els.productionStatusBody.innerHTML = items.length
    ? items
        .map(
          (item) => `<tr>
            <td>${safeText(item.label)}</td>
            <td><span class="production-status-badge ${safeText(
              item.status,
            )}">${safeText(productionStatusLabel(item.status))}</span></td>
            <td>${safeText(item.detail)}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="3">No hay comprobaciones disponibles.</td></tr>';
}

async function loadProductionStatus(showSuccess = false) {
  try {
    state.productionStatus = await api('/admin/system/production-status');
    renderProductionStatus();
    if (showSuccess) {
      showFlash('success', 'Estado de producción actualizado.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar estado de producción: ${error.message}`);
  }
}

async function loadBackupStatus(showSuccess = false) {
  try {
    state.backupStatus = await api('/admin/system/backup-status');
    renderBackupStatus();
    if (showSuccess) {
      showFlash('success', 'Estado de backups actualizado.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar estado de backups: ${error.message}`);
  }
}

async function runBackupNow() {
  if (!confirm('Se va a generar una copia de seguridad ahora. ¿Continuar?')) {
    return;
  }

  try {
    const result = await api('/admin/system/backup', { method: 'POST' });
    await loadBackupStatus();
    const fileName = result?.backup?.fileName || 'backup.sql';
    showFlash('success', `Backup generado correctamente: ${fileName}`);
  } catch (error) {
    showFlash('error', `No se pudo generar backup: ${error.message}`);
  }
}

function selectedOpenClawScopes() {
  const selected = [...document.querySelectorAll('.openclaw-scope-input')]
    .filter((input) => input.checked)
    .map((input) => input.value);

  return selected.length
    ? selected
    : ['read:summary', 'read:requests', 'read:shifts', 'read:schedule'];
}

function syncOpenClawScopeInputs(scopes = []) {
  document.querySelectorAll('.openclaw-scope-input').forEach((input) => {
    input.checked = scopes.length ? scopes.includes(input.value) : true;
  });
}

function renderOpenClawIntegration() {
  const integration = state.openClawIntegration;
  if (!els.openClawEnabledLabel) return;

  els.openClawEnabledLabel.textContent = integration?.isEnabled
    ? 'Activo'
    : 'Inactivo';
  els.openClawTokenPreviewLabel.textContent =
    integration?.tokenPreview || 'Sin token';
  els.openClawLastUsedLabel.textContent = integration?.lastUsedAt
    ? formatDateTime(integration.lastUsedAt)
    : 'Sin uso';
  syncOpenClawScopeInputs(integration?.scopes || []);
}

function renderOpenClawAccessLogs() {
  if (!els.openClawAccessLogBody) return;
  const logs = Array.isArray(state.openClawAccessLogs)
    ? state.openClawAccessLogs
    : [];

  if (!logs.length) {
    els.openClawAccessLogBody.innerHTML =
      '<tr><td colspan="5">Sin accesos registrados.</td></tr>';
    return;
  }

  els.openClawAccessLogBody.innerHTML = logs
    .map(
      (log) => `<tr>
        <td>${safeText(formatDateTime(log.createdAt))}</td>
        <td>${safeText(log.status === 'ALLOWED' ? 'Permitido' : 'Denegado')}</td>
        <td>${safeText(`${log.method || ''} ${log.path || ''}`.trim())}</td>
        <td>${safeText(log.reason || '-')}</td>
        <td>${safeText(log.ip || '-')}</td>
      </tr>`,
    )
    .join('');
}

function renderWhatsappIntegration() {
  const integration = state.whatsappIntegration;
  if (!els.whatsappEnabledInput) return;

  els.whatsappEnabledInput.checked = !!integration?.isEnabled;
  els.whatsappDisplayPhoneInput.value = integration?.displayPhoneNumber || '';
  els.whatsappPhoneNumberIdInput.value = integration?.phoneNumberId || '';
  els.whatsappBusinessAccountIdInput.value =
    integration?.businessAccountId || '';
  els.whatsappAllowClockInInput.checked = integration?.allowClockIn !== false;
  els.whatsappAllowClockOutInput.checked = integration?.allowClockOut !== false;
  els.whatsappRequireLocationInput.checked =
    integration?.requireLocation !== false;

  if (els.whatsappStatusLabel) {
    els.whatsappStatusLabel.textContent = integration?.isEnabled
      ? 'Activo'
      : 'Inactivo';
  }
  if (els.whatsappProviderReadyLabel) {
    els.whatsappProviderReadyLabel.textContent = integration?.providerReady
      ? 'Listo'
      : 'Pendiente';
  }
  if (els.whatsappLastInboundLabel) {
    els.whatsappLastInboundLabel.textContent = integration?.lastInboundAt
      ? formatDateTime(integration.lastInboundAt)
      : 'Sin actividad';
  }
  if (els.whatsappLastOutboundLabel) {
    els.whatsappLastOutboundLabel.textContent = integration?.lastOutboundAt
      ? formatDateTime(integration.lastOutboundAt)
      : 'Sin actividad';
  }
}

function renderWhatsappLogs() {
  if (!els.whatsappLogsBody) return;
  const logs = Array.isArray(state.whatsappLogs) ? state.whatsappLogs : [];

  if (!logs.length) {
    els.whatsappLogsBody.innerHTML =
      '<tr><td colspan="6">Sin mensajes registrados.</td></tr>';
    return;
  }

  els.whatsappLogsBody.innerHTML = logs
    .map(
      (log) => `<tr>
        <td>${safeText(formatDateTime(log.createdAt))}</td>
        <td>${safeText(log.direction === 'OUTBOUND' ? 'Salida' : 'Entrada')}</td>
        <td>${safeText(log.status || '-')}</td>
        <td>${safeText(log.command || log.messageType || '-')}</td>
        <td>${safeText(log.user?.name || log.user?.email || log.toPhone || log.fromPhone || '-')}</td>
        <td>${safeText(log.errorMessage || log.body || '-')}</td>
      </tr>`,
    )
    .join('');
}

async function loadWhatsappLogs() {
  try {
    state.whatsappLogs = await api('/admin/integrations/whatsapp/logs?limit=30');
    renderWhatsappLogs();
  } catch (error) {
    state.whatsappLogs = [];
    renderWhatsappLogs();
    showFlash('error', `No se pudo cargar el log de WhatsApp: ${error.message}`);
  }
}

async function loadWhatsappIntegration(showSuccess = false) {
  try {
    const [integration] = await Promise.all([
      api('/admin/integrations/whatsapp'),
      loadWhatsappLogs(),
    ]);
    state.whatsappIntegration = integration;
    renderWhatsappIntegration();
    if (showSuccess) {
      showFlash('success', 'Integración WhatsApp actualizada.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar WhatsApp: ${error.message}`);
  }
}

async function saveWhatsappIntegration() {
  try {
    state.whatsappIntegration = await api('/admin/integrations/whatsapp', {
      method: 'POST',
      body: {
        isEnabled: !!els.whatsappEnabledInput?.checked,
        displayPhoneNumber: els.whatsappDisplayPhoneInput?.value.trim() || null,
        phoneNumberId: els.whatsappPhoneNumberIdInput?.value.trim() || null,
        businessAccountId:
          els.whatsappBusinessAccountIdInput?.value.trim() || null,
        allowClockIn: !!els.whatsappAllowClockInInput?.checked,
        allowClockOut: !!els.whatsappAllowClockOutInput?.checked,
        requireLocation: !!els.whatsappRequireLocationInput?.checked,
      },
    });
    renderWhatsappIntegration();
    showFlash('success', 'Configuración de WhatsApp guardada.');
  } catch (error) {
    showFlash('error', `No se pudo guardar WhatsApp: ${error.message}`);
  }
}

async function sendWhatsappTestMessage() {
  const toPhone = els.whatsappTestPhoneInput?.value.trim() || '';
  const message = els.whatsappTestMessageInput?.value.trim() || '';

  try {
    const result = await api('/admin/integrations/whatsapp/test-message', {
      method: 'POST',
      body: { toPhone, message },
    });
    await loadWhatsappLogs();
    showFlash('success', `Mensaje de prueba enviado a ${result.toPhone}.`);
  } catch (error) {
    showFlash(
      'error',
      `No se pudo enviar el WhatsApp de prueba: ${error.message}`,
    );
  }
}

async function loadOpenClawAccessLogs() {
  try {
    state.openClawAccessLogs = await api('/admin/integrations/openclaw/access-logs?limit=30');
    renderOpenClawAccessLogs();
  } catch (error) {
    state.openClawAccessLogs = [];
    renderOpenClawAccessLogs();
    showFlash('error', `No se pudo cargar auditoría OpenClaw: ${error.message}`);
  }
}

async function loadOpenClawIntegration(showSuccess = false) {
  try {
    const [integration] = await Promise.all([
      api('/admin/integrations/openclaw'),
      loadOpenClawAccessLogs(),
    ]);
    state.openClawIntegration = integration;
    renderOpenClawIntegration();
    if (showSuccess) {
      showFlash('success', 'Integración OpenClaw actualizada.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar OpenClaw: ${error.message}`);
  }
}

async function rotateOpenClawToken() {
  if (
    !confirm(
      'Se generará un nuevo token OpenClaw. El token anterior dejará de funcionar. ¿Continuar?',
    )
  ) {
    return;
  }

  try {
    const result = await api('/admin/integrations/openclaw/token', {
      method: 'POST',
      body: { scopes: selectedOpenClawScopes() },
    });
    state.openClawIntegration = result.integration;
    renderOpenClawIntegration();
    await loadOpenClawAccessLogs();

    if (els.openClawTokenOutput) {
      els.openClawTokenOutput.hidden = false;
      els.openClawTokenOutput.textContent = `TOKEN COMPLETO (guardar ahora):\n${result.token}`;
    }

    showFlash(
      'success',
      'Token OpenClaw generado. Guárdalo ahora: no se podrá volver a ver completo.',
    );
  } catch (error) {
    showFlash('error', `No se pudo generar token OpenClaw: ${error.message}`);
  }
}

async function revokeOpenClawIntegration() {
  if (!confirm('Se revocará el token OpenClaw actual. ¿Continuar?')) {
    return;
  }

  try {
    state.openClawIntegration = await api('/admin/integrations/openclaw/revoke', {
      method: 'POST',
    });
    renderOpenClawIntegration();
    await loadOpenClawAccessLogs();
    if (els.openClawTokenOutput) {
      els.openClawTokenOutput.hidden = true;
      els.openClawTokenOutput.textContent = '';
    }
    showFlash('success', 'Token OpenClaw revocado.');
  } catch (error) {
    showFlash('error', `No se pudo revocar OpenClaw: ${error.message}`);
  }
}

function syncTestEmailRecipient() {
  if (!els.testEmailRecipientInput) return;
  const preferredEmail =
    state.myProfile?.email?.trim() || state.me?.email?.trim() || '';
  if (!preferredEmail) return;
  if (!els.testEmailRecipientInput.value.trim()) {
    els.testEmailRecipientInput.value = preferredEmail;
  }
}

async function sendTestEmail() {
  const email = els.testEmailRecipientInput?.value.trim() || '';

  try {
    const result = await api('/admin/system/test-email', {
      method: 'POST',
      body: email ? { email } : {},
    });
    const recipient = result?.recipient || email || 'destino configurado';
    showFlash(
      result?.sent ? 'success' : 'error',
      result?.sent
        ? `Correo de prueba enviado a ${recipient}.`
        : result?.message || 'No se pudo enviar el correo de prueba.',
    );
  } catch (error) {
    showFlash(
      'error',
      `No se pudo enviar el correo de prueba: ${error.message}`,
    );
  }
}

async function loadDashboard() {
  try {
    const data = await api('/admin/dashboard');
    els.statEmployees.textContent = String(data.totalEmployees ?? 0);
    els.statInterns.textContent = String(data.totalInterns ?? 0);
    els.statHours.textContent = String(data.totalHoursWeek ?? 0);
    els.statPending.textContent = String(data.pendingRequests ?? 0);
    els.statOpenShifts.textContent = String(data.openShifts ?? 0);
    els.statPendingVacations.textContent = String(
      data.pendingVacationRequests ?? 0,
    );
    els.statPendingOvertime.textContent = String(
      data.pendingOvertimeRequests ?? 0,
    );
    els.statSuspiciousWeek.textContent = String(
      data.suspiciousShiftsWeek ?? 0,
    );
    const absencesToday =
      Number(data.onVacationToday ?? 0) +
      Number(data.onSickLeaveToday ?? 0) +
      Number(data.onDayOffToday ?? 0);
    els.statAbsencesToday.textContent = String(absencesToday);
  } catch (error) {
    showFlash('error', `No se pudo cargar el dashboard: ${error.message}`);
  }
}

function fillCompanyLocationForm(location) {
  if (!els.companyCountryInput) return;
  els.companyCountryInput.value = location?.country || '';
  els.companyRegionInput.value = location?.region || '';
  els.companyProvinceInput.value = location?.province || '';
  els.companyMunicipalityInput.value = location?.municipality || '';
  els.companyPostalCodeInput.value = location?.postalCode || '';
}

async function loadCompanyLocation(showSuccess = false) {
  try {
    state.companyLocation = await api('/admin/company/location');
    fillCompanyLocationForm(state.companyLocation);
    if (showSuccess) {
      showFlash('success', 'Ubicación administrativa cargada.');
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar la ubicación de empresa: ${error.message}`);
  }
}

async function saveCompanyLocation() {
  try {
    state.companyLocation = await api('/admin/company/location', {
      method: 'POST',
      body: {
        country: els.companyCountryInput.value || undefined,
        region: els.companyRegionInput.value || undefined,
        province: els.companyProvinceInput.value || undefined,
        municipality: els.companyMunicipalityInput.value || undefined,
        postalCode: els.companyPostalCodeInput.value || undefined,
      },
    });
    fillCompanyLocationForm(state.companyLocation);
    showFlash('success', 'Ubicación administrativa guardada.');
  } catch (error) {
    showFlash('error', `No se pudo guardar la ubicación de empresa: ${error.message}`);
  }
}

async function importOfficialHolidays() {
  const rawYear = String(els.holidayImportYearInput?.value || '').trim();
  const year = rawYear ? Number(rawYear) : new Date().getFullYear();

  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    showFlash('error', 'El año de importación no es válido.');
    return;
  }

  if (
    !confirm(
      `Se importarán los festivos oficiales de ${year} usando el municipio guardado en la empresa. ¿Continuar?`,
    )
  ) {
    return;
  }

  try {
    const result = await api('/admin/holidays/import-official', {
      method: 'POST',
      body: { year },
    });
    await Promise.all([loadHolidays(), loadAdminSchedule(), loadMySchedule()]);
    showFlash(
      'success',
      `Importación completada: ${result.imported} nuevos, ${result.skipped} ya existentes.`,
    );
    if (result.warning) {
      showFlash('error', result.warning);
    }
  } catch (error) {
    showFlash(
      'error',
      `No se pudieron importar los festivos oficiales: ${error.message}`,
    );
  }
}

function buildHolidayLocationText(holiday) {
  return [holiday.municipality, holiday.province, holiday.region, holiday.country]
    .filter(Boolean)
    .join(', ') || '-';
}

function fillHolidayForm(holiday = null) {
  state.selectedHolidayId = holiday?.id || null;
  els.holidayDateInput.value = holiday?.date ? dateLocalValue(new Date(holiday.date)) : '';
  els.holidayNameInput.value = holiday?.name || '';
  els.holidayScopeSelect.value = holiday?.scope || 'COMPANY';
  els.holidayCountryInput.value = holiday?.country || '';
  els.holidayRegionInput.value = holiday?.region || '';
  els.holidayProvinceInput.value = holiday?.province || '';
  els.holidayMunicipalityInput.value = holiday?.municipality || '';
  els.holidayNotesInput.value = holiday?.notes || '';
  if (els.saveHolidayBtn) {
    els.saveHolidayBtn.textContent = holiday ? 'Guardar cambios festivo' : 'Guardar festivo';
  }
}

function resetHolidayForm() {
  fillHolidayForm(null);
  if (els.holidayDateInput && !els.holidayDateInput.value) {
    els.holidayDateInput.value = dateLocalValue(new Date());
  }
  if (els.holidayScopeSelect) {
    els.holidayScopeSelect.value = 'COMPANY';
  }
}

function renderHolidays() {
  if (!els.holidaysBody) return;

  if (!state.holidays.length) {
    els.holidaysBody.innerHTML =
      '<tr><td colspan="6">No hay festivos registrados todavía.</td></tr>';
    return;
  }

  els.holidaysBody.innerHTML = state.holidays
    .map((holiday) => `<tr>
        <td>${safeText(formatDateOnly(holiday.date))}</td>
        <td>${safeText(holiday.name)}</td>
        <td>${safeText(holidayScopeLabel(holiday.scope))}</td>
        <td>${safeText(buildHolidayLocationText(holiday))}</td>
        <td>${safeText(holiday.notes || '-')}</td>
        <td>
          <button class="action-link" data-action="edit-holiday" data-id="${holiday.id}">Editar</button>
          <button class="action-link" data-action="delete-holiday" data-id="${holiday.id}">Eliminar</button>
        </td>
      </tr>`)
    .join('');
}

async function loadHolidays(showSuccess = false) {
  try {
    state.holidays = await api('/admin/holidays');
    renderHolidays();
    if (showSuccess) {
      showFlash('success', 'Festivos actualizados.');
    }
  } catch (error) {
    showFlash('error', `No se pudieron cargar los festivos: ${error.message}`);
  }
}

async function saveHoliday() {
  const date = els.holidayDateInput.value || '';
  const name = els.holidayNameInput.value.trim();

  if (!date || !name) {
    showFlash('error', 'Debes indicar fecha y nombre del festivo.');
    return;
  }

  const payload = {
    date,
    name,
    scope: els.holidayScopeSelect.value,
    country: els.holidayCountryInput.value || undefined,
    region: els.holidayRegionInput.value || undefined,
    province: els.holidayProvinceInput.value || undefined,
    municipality: els.holidayMunicipalityInput.value || undefined,
    notes: els.holidayNotesInput.value || undefined,
  };

  try {
    if (state.selectedHolidayId) {
      await api(`/admin/holidays/${state.selectedHolidayId}`, {
        method: 'POST',
        body: payload,
      });
    } else {
      await api('/admin/holidays', {
        method: 'POST',
        body: payload,
      });
    }

    resetHolidayForm();
    await Promise.all([loadHolidays(), loadMySchedule(), loadAdminSchedule()]);
    showFlash('success', 'Festivo guardado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo guardar el festivo: ${error.message}`);
  }
}

async function deleteHoliday(id) {
  if (!confirm('Se eliminará este festivo. ¿Continuar?')) {
    return;
  }

  try {
    await api(`/admin/holidays/${id}`, { method: 'DELETE' });
    if (state.selectedHolidayId === id) {
      resetHolidayForm();
    }
    await Promise.all([loadHolidays(), loadMySchedule(), loadAdminSchedule()]);
    showFlash('success', 'Festivo eliminado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo eliminar el festivo: ${error.message}`);
  }
}

function fillWorkplaceForm(workplace) {
  if (!els.workplaceLatInput) return;

  if (!workplace) {
    if (els.workplaceSelectInput) {
      els.workplaceSelectInput.value = '';
    }
    els.workplaceNameInput.value = '';
    els.workplaceAddressInput.value = '';
    els.workplaceLatInput.value = '';
    els.workplaceLngInput.value = '';
    els.workplaceMunicipalityInput.value = '';
    els.workplaceProvinceInput.value = '';
    els.workplaceRadiusInput.value = '200';
    els.workplaceMaxAccuracyInput.value = '80';
    els.workplaceStrictInput.value = 'false';
    els.workplacePrimaryInput.value = 'true';
    els.workplaceActiveInput.value = 'true';
    return;
  }

  if (els.workplaceSelectInput) {
    els.workplaceSelectInput.value = workplace.id || '';
  }
  els.workplaceNameInput.value = workplace.name || '';
  els.workplaceAddressInput.value = workplace.addressLabel || '';
  els.workplaceLatInput.value =
    workplace.lat == null ? '' : String(workplace.lat);
  els.workplaceLngInput.value =
    workplace.lng == null ? '' : String(workplace.lng);
  els.workplaceMunicipalityInput.value = workplace.municipality || '';
  els.workplaceProvinceInput.value = workplace.province || '';
  els.workplaceRadiusInput.value = String(workplace.radiusMeters ?? 200);
  els.workplaceMaxAccuracyInput.value =
    workplace.maxAllowedAccuracy == null
      ? ''
      : String(workplace.maxAllowedAccuracy);
  els.workplaceStrictInput.value = workplace.strictMode ? 'true' : 'false';
  els.workplacePrimaryInput.value = workplace.isPrimary ? 'true' : 'false';
  els.workplaceActiveInput.value = workplace.isActive === false ? 'false' : 'true';
}

function renderWorkplaceOptions() {
  if (!els.workplaceSelectInput) return;
  const options = ['<option value="">Nuevo centro</option>']
    .concat(
      state.workplaces.map((workplace) => {
        const label = [
          workplace.name || 'Centro sin nombre',
          workplace.isPrimary ? 'Principal' : null,
          workplace.isActive === false ? 'Inactivo' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return `<option value="${workplace.id}">${safeText(label)}</option>`;
      }),
    )
    .join('');
  els.workplaceSelectInput.innerHTML = options;
  els.workplaceSelectInput.value = state.selectedWorkplaceId || '';
}

function getSelectedWorkplace() {
  return state.workplaces.find((workplace) => workplace.id === state.selectedWorkplaceId) || null;
}

function selectWorkplace(id) {
  state.selectedWorkplaceId = id || '';
  state.workplace = getSelectedWorkplace();
  fillWorkplaceForm(state.workplace);
}

function prepareNewWorkplace() {
  state.selectedWorkplaceId = '';
  state.workplace = null;
  fillWorkplaceForm(null);
}

async function loadWorkplace(showSuccess = false) {
  try {
    state.workplaces = await api('/admin/workplaces');
    const nextSelectedId =
      state.selectedWorkplaceId &&
      state.workplaces.some((workplace) => workplace.id === state.selectedWorkplaceId)
        ? state.selectedWorkplaceId
        : state.workplaces.find((workplace) => workplace.isPrimary)?.id ||
          state.workplaces[0]?.id ||
          '';
    state.selectedWorkplaceId = nextSelectedId;
    state.workplace = getSelectedWorkplace();
    renderWorkplaceOptions();
    fillWorkplaceForm(state.workplace);
    if (showSuccess) {
      showFlash(
        'success',
        state.workplace
          ? 'Centros de trabajo cargados.'
          : 'No hay centros configurados todavía.',
      );
    }
  } catch (error) {
    showFlash('error', `No se pudo cargar zona de trabajo: ${error.message}`);
  }
}

async function saveWorkplace() {
  const lat = Number(els.workplaceLatInput.value);
  const lng = Number(els.workplaceLngInput.value);
  const radiusMeters = Number(els.workplaceRadiusInput.value);
  const rawMaxAccuracy = els.workplaceMaxAccuracyInput.value.trim();
  const maxAllowedAccuracy = rawMaxAccuracy === '' ? undefined : Number(rawMaxAccuracy);
  const strictMode = els.workplaceStrictInput.value === 'true';
  const name = els.workplaceNameInput.value.trim();
  const addressLabel = els.workplaceAddressInput.value.trim();
  const municipality = els.workplaceMunicipalityInput.value.trim();
  const province = els.workplaceProvinceInput.value.trim();
  const isPrimary = els.workplacePrimaryInput.value === 'true';
  const isActive = els.workplaceActiveInput.value === 'true';

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    showFlash('error', 'Latitud inválida.');
    return;
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    showFlash('error', 'Longitud inválida.');
    return;
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters < 1) {
    showFlash('error', 'El radio debe ser >= 1.');
    return;
  }
  if (
    maxAllowedAccuracy !== undefined &&
    (!Number.isFinite(maxAllowedAccuracy) || maxAllowedAccuracy < 0)
  ) {
    showFlash('error', 'La precisión máxima debe ser >= 0.');
    return;
  }

  try {
    const saved = await api('/admin/workplaces', {
      method: 'POST',
      body: {
        id: state.selectedWorkplaceId || undefined,
        name: name || undefined,
        addressLabel: addressLabel || undefined,
        municipality: municipality || undefined,
        province: province || undefined,
        lat,
        lng,
        radiusMeters: Math.round(radiusMeters),
        maxAllowedAccuracy,
        strictMode,
        isPrimary,
        isActive,
      },
    });

    state.workplace = saved;
    state.selectedWorkplaceId = saved.id;
    fillWorkplaceForm(saved);
    await loadWorkplace();
    await loadSuspiciousShifts();
    showFlash('success', 'Centro de trabajo guardado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo guardar zona: ${error.message}`);
  }
}

async function deleteWorkplace() {
  const target = getSelectedWorkplace();
  if (!target) {
    showFlash('error', 'Selecciona un centro para eliminarlo.');
    return;
  }

  if (!confirm(`Se eliminará el centro "${target.name || target.addressLabel || target.id}". ¿Continuar?`)) {
    return;
  }

  try {
    await api(`/admin/workplaces/${target.id}`, { method: 'DELETE' });
    prepareNewWorkplace();
    await Promise.all([loadWorkplace(), loadSuspiciousShifts()]);
    showFlash('success', 'Centro de trabajo eliminado.');
  } catch (error) {
    showFlash('error', `No se pudo eliminar el centro: ${error.message}`);
  }
}

function geofenceCellText(shift) {
  const start = shift.startInsideGeofence;
  const end = shift.endInsideGeofence;
  const startLabel = start == null ? 'inicio: ?' : start ? 'inicio: dentro' : 'inicio: fuera';
  const endLabel = end == null ? 'fin: ?' : end ? 'fin: dentro' : 'fin: fuera';
  return `${startLabel} | ${endLabel}`;
}

function renderSuspiciousShifts() {
  if (!els.suspiciousShiftsBody) return;

  if (!state.suspiciousShifts.length) {
    els.suspiciousShiftsBody.innerHTML =
      '<tr><td colspan="9">No hay fichajes sospechosos en el rango consultado.</td></tr>';
    return;
  }

  els.suspiciousShiftsBody.innerHTML = state.suspiciousShifts
    .map((shift) => {
      const employee = shift.user?.name || shift.user?.email || shift.userId || '-';
      const reasons = Array.isArray(shift.riskReasons) && shift.riskReasons.length
        ? shift.riskReasons.join(', ')
        : '-';
      const endAtLabel = shift.endAt ? formatDateTime(shift.endAt) : 'Turno abierto';
      const locationText = locationSummary(
        shift.startAddress || shift.endAddress,
        shift.startLat,
        shift.startLng,
      );

      return `<tr>
        <td>${safeText(employee)}</td>
        <td>${safeText(formatDateTime(shift.startAt))}</td>
        <td>${safeText(endAtLabel)}</td>
        <td>${safeText(workplaceDisplayName(shift.workplace))}</td>
        <td>${safeText(locationText)}</td>
        <td>${safeText(shift.riskScore)}</td>
        <td>${safeText(geofenceCellText(shift))}</td>
        <td>${safeText(reasons)}</td>
        <td>${renderMapActionButton({
          lat: shift.startLat,
          lng: shift.startLng,
          title: employee,
          subtitle: locationText,
        })}</td>
      </tr>`;
    })
    .join('');
}

async function loadSuspiciousShifts() {
  try {
    state.suspiciousShifts = await api('/admin/shifts/suspicious?limit=120');
    renderSuspiciousShifts();
  } catch (error) {
    showFlash('error', `No se pudieron cargar fichajes sospechosos: ${error.message}`);
  }
}

function renderAdminRequests() {
  if (!state.adminRequests.length) {
    els.adminRequestsBody.innerHTML = '<tr><td colspan="7">No hay solicitudes.</td></tr>';
    return;
  }

  els.adminRequestsBody.innerHTML = state.adminRequests
    .map((r) => {
      const actions =
        r.status === 'PENDING'
          ? `<button class="action-link" data-action="approve-request" data-id="${r.id}">Aprobar</button>
             <button class="action-link" data-action="reject-request" data-id="${r.id}">Rechazar</button>`
          : '-';

      return `<tr>
        <td>${safeText(r.user?.name || r.user?.email)}</td>
        <td>${safeText(requestTypeLabel(r.type))}</td>
        <td>${safeText(requestStatusLabel(r.status))}</td>
        <td>${safeText(formatDateTime(r.startAt))} - ${safeText(formatDateTime(r.endAt))}</td>
        <td>${safeText(r.comment)}</td>
        <td>${safeText(r.reviewComment)}</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join('');
}

function workerGroupLabel(value) {
  if (value === 'INTERN') return 'Prácticas';
  if (value === 'EMPLOYEE') return 'Trabajador';
  return value || '-';
}

function renderAdminPresence() {
  if (!els.adminPresenceBody) return;

  if (!state.adminPresence.length) {
    els.adminPresenceBody.innerHTML =
      '<tr><td colspan="8">No hay fichajes registrados hoy.</td></tr>';
    return;
  }

  els.adminPresenceBody.innerHTML = state.adminPresence
    .map((row) => {
      const employee = row.name || row.email || row.id || '-';
      const dotClass = row.isWorking ? 'online' : 'offline';
      const statusLabel = row.isWorking ? 'Trabajando' : 'Fuera de turno';
      const endAt = row.endAt ? formatTimeOnly(row.endAt) : '-';
      const locationText = locationSummary(
        row.startAddress || row.endAddress,
        row.startLat,
        row.startLng,
      );

      return `<tr>
        <td><span class="status-dot ${dotClass}" title="${safeText(
          statusLabel,
        )}"></span></td>
        <td>${safeText(employee)}</td>
        <td>${safeText(workerGroupLabel(row.workerGroup))}</td>
        <td>${safeText(formatTimeOnly(row.startAt))}</td>
        <td>${safeText(endAt)}</td>
        <td>${safeText(workplaceDisplayName(row.workplace))}</td>
        <td>${safeText(locationText)}</td>
        <td>${renderMapActionButton({
          lat: row.startLat,
          lng: row.startLng,
          title: employee,
          subtitle: locationText,
        })}</td>
      </tr>`;
    })
    .join('');
}

async function loadAdminPresence() {
  try {
    state.adminPresence = await api('/admin/shifts/today');
    renderAdminPresence();
  } catch (error) {
    showFlash('error', `No se pudo cargar el historial de fichajes de hoy: ${error.message}`);
  }
}

async function loadAdminRequests() {
  try {
    state.adminRequests = await api('/admin/requests');
    renderAdminRequests();
  } catch (error) {
    showFlash('error', `No se pudieron cargar solicitudes de admin: ${error.message}`);
  }
}

function renderAdminUsers() {
  if (!state.adminUsers.length) {
    els.adminUsersBody.innerHTML = '<tr><td colspan=\"7\">No hay usuarios.</td></tr>';
    return;
  }

  els.adminUsersBody.innerHTML = state.adminUsers
    .map((u) => {
      const roleOptions = ['EMPLOYEE', 'ADMIN']
        .map(
          (value) =>
            `<option value=\"${value}\" ${
              u.role === value ? 'selected' : ''
            }>${roleLabel(value)}</option>`,
        )
        .join('');
      const groupOptions = ['EMPLOYEE', 'INTERN']
        .map(
          (value) =>
            `<option value=\"${value}\" ${
              u.workerGroup === value ? 'selected' : ''
            }>${workerGroupLabel(value)}</option>`,
        )
        .join('');

      return `<tr>
        <td>${safeText(u.name || u.email || u.id)}</td>
        <td>
          <select class=\"admin-role-select\" data-user-id=\"${u.id}\">
            ${roleOptions}
          </select>
        </td>
        <td>
          <select class=\"admin-group-select\" data-user-id=\"${u.id}\">
            ${groupOptions}
          </select>
        </td>
        <td>
          <input class=\"admin-hours-input\" data-user-id=\"${u.id}\" type=\"number\" min=\"0\" value=\"${
            u.internshipTotalHours ?? 0
          }\" />
        </td>
        <td>
          <input class=\"admin-vacation-input\" data-user-id=\"${u.id}\" type=\"number\" min=\"0\" step=\"0.5\" value=\"${
            u.vacationAllowanceDays ?? u.vacationBalance?.allowanceDays ?? 22
          }\" />
          <div class="tiny muted">${safeText(
            `${u.vacationBalance?.availableDays ?? '-'} disponibles`,
          )}</div>
        </td>
        <td>
          <input class=\"admin-overtime-bank-input\" data-user-id=\"${u.id}\" type=\"number\" step=\"0.25\" value=\"${
            (((u.overtimeBankMinutesAdjustment ?? 0) / 60) || 0).toFixed(2)
          }\" />
          <div class="tiny muted">${safeText(
            `${u.overtimeBank?.balanceHours ?? 0}h saldo`,
          )}</div>
        </td>
        <td>
          <button class=\"action-link\" data-action=\"admin-save-user\" data-id=\"${
            u.id
          }\">Guardar cambios</button>
          <button class=\"action-link\" data-action=\"admin-send-access\" data-id=\"${
            u.id
          }\">Generar enlace acceso</button>
          <button class=\"action-link\" data-action=\"admin-view-profile\" data-id=\"${
            u.id
          }\">Ver perfil</button>
          <button class=\"action-link\" data-action=\"admin-delete-user\" data-id=\"${
            u.id
          }\">Eliminar</button>
        </td>
      </tr>`;
    })
    .join('');
}

async function loadAdminUsers() {
  try {
    state.adminUsers = await api('/admin/users');
    renderAdminUsers();
    renderAdminScheduleUserOptions();
    renderAdminEmployeePdfUserOptions();
    renderAdminScheduleTemplateSummary();
  } catch (error) {
    state.adminUsers = [];
    renderAdminUsers();
    renderAdminScheduleUserOptions();
    renderAdminEmployeePdfUserOptions();
    renderAdminScheduleTemplateSummary();
    showFlash('error', `No se pudo cargar gestión de usuarios: ${error.message}`);
  }
}

function auditActionLabel(action) {
  if (action === 'USER_SETTINGS_UPDATED') return 'Ajustes usuario';
  if (action === 'USER_ROLE_UPDATED') return 'Rol';
  if (action === 'USER_GROUP_UPDATED') return 'Grupo';
  if (action === 'USER_INTERNSHIP_HOURS_UPDATED') return 'Horas prácticas';
  return action || '-';
}

function renderAuditChangeItem(key, value) {
  const labels = {
    role: 'Rol',
    workerGroup: 'Grupo',
    internshipTotalHours: 'Horas prácticas',
    vacationAllowanceDays: 'Vacaciones anuales',
    overtimeBankMinutesAdjustment: 'Ajuste bolsa horas',
  };

  const label = labels[key] || key;
  const from = safeText(value?.from == null ? '-' : value.from);
  const to = safeText(value?.to == null ? '-' : value.to);
  return `${label}: ${from} -> ${to}`;
}

function renderAuditChanges(meta) {
  const changes = meta?.changes;
  if (!changes || typeof changes !== 'object') return '-';

  const entries = Object.entries(changes);
  if (!entries.length) return '-';

  return entries
    .map(([key, value]) => renderAuditChangeItem(key, value))
    .join(' | ');
}

function renderAuditLogs() {
  if (!state.auditLogs.length) {
    els.auditLogsBody.innerHTML =
      '<tr><td colspan="5">No hay registros de auditoría.</td></tr>';
    return;
  }

  els.auditLogsBody.innerHTML = state.auditLogs
    .map((log) => {
      const actor = log.actorUser?.name || log.actorUser?.email || '-';
      const target = log.targetUser?.name || log.targetUser?.email || '-';
      const changes = renderAuditChanges(log.meta);

      return `<tr>
        <td>${safeText(formatDateTime(log.createdAt))}</td>
        <td>${safeText(actor)}</td>
        <td>${safeText(target)}</td>
        <td>${safeText(auditActionLabel(log.action))}</td>
        <td>${changes}</td>
      </tr>`;
    })
    .join('');
}

async function loadAuditLogs() {
  try {
    state.auditLogs = await api('/admin/audit-logs?limit=80');
    renderAuditLogs();
  } catch (error) {
    showFlash('error', `No se pudo cargar auditoría: ${error.message}`);
  }
}

function syncAdminCreateHoursState() {
  if (!els.adminCreateGroupSelect || !els.adminCreateHoursInput) return;
  const isIntern = els.adminCreateGroupSelect.value === 'INTERN';
  els.adminCreateHoursInput.disabled = !isIntern;
  if (!isIntern) {
    els.adminCreateHoursInput.value = '0';
  }
}

async function createAdminUser() {
  const email = els.adminCreateEmailInput.value.trim();
  const name = els.adminCreateNameInput.value.trim();
  const phone = els.adminCreatePhoneInput.value.trim();
  const role = els.adminCreateRoleSelect.value;
  const workerGroup = els.adminCreateGroupSelect.value;
  const vacationAllowanceDays = Number(els.adminCreateVacationDaysInput.value || '22');
  const overtimeBankAdjustmentHours = Number(
    els.adminCreateOvertimeAdjustmentInput.value || '0',
  );

  if (!email) {
    showFlash('error', 'Debes indicar el email del nuevo empleado.');
    return;
  }
  if (!validateEmailInput(els.adminCreateEmailInput)) {
    els.adminCreateEmailInput.reportValidity();
    return;
  }

  let normalizedPhone = '';
  try {
    normalizedPhone = normalizeInternationalPhoneInput(phone);
  } catch (error) {
    showFlash('error', error.message);
    els.adminCreatePhoneInput.focus();
    return;
  }

  const payload = {
    email,
    name: name || undefined,
    phone: normalizedPhone || undefined,
    role,
    workerGroup,
    vacationAllowanceDays,
    overtimeBankMinutesAdjustment: Math.round(overtimeBankAdjustmentHours * 60),
    sendPasswordSetupEmail: true,
  };

  if (workerGroup === 'INTERN') {
    const internshipTotalHours = Number(els.adminCreateHoursInput.value);
    if (!Number.isInteger(internshipTotalHours) || internshipTotalHours < 0) {
      showFlash('error', 'Las horas de prácticas deben ser un entero >= 0.');
      return;
    }
    payload.internshipTotalHours = internshipTotalHours;
  }

  try {
    const created = await api('/admin/users', {
      method: 'POST',
      body: payload,
    });

    let successMessage = 'Usuario creado correctamente.';
    const onboarding = created?.onboarding;
    if (onboarding?.message) {
      successMessage = onboarding.message;
    }

    if (onboarding?.passwordSetupLink) {
      showAccessLinkPrompt(onboarding.passwordSetupLink);
      successMessage = `${successMessage} Se mostró enlace manual en pantalla.`;
    }

    els.adminCreateNameInput.value = '';
    els.adminCreateEmailInput.value = '';
    els.adminCreatePhoneInput.value = '';
    els.adminCreateRoleSelect.value = 'EMPLOYEE';
    els.adminCreateGroupSelect.value = 'EMPLOYEE';
    els.adminCreateVacationDaysInput.value = '22';
    els.adminCreateOvertimeAdjustmentInput.value = '0';
    syncAdminCreateHoursState();
    await Promise.all([loadAdminUsers(), loadAdminPresence(), loadDashboard()]);
    await Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);
    showFlash('success', successMessage);
  } catch (error) {
    showFlash('error', `No se pudo crear el usuario: ${error.message}`);
  }
}

function renderAdminImportUsersResult(result = null) {
  if (!els.adminImportUsersResult) return;

  if (!result) {
    els.adminImportUsersResult.innerHTML =
      '<p class="muted tiny">Aquí verás el resultado de la importación.</p>';
    return;
  }

  const createdItems = (result.created || [])
    .slice(0, 8)
    .map((item) => {
      const label = safeText(item.name || item.email || `Fila ${item.row}`);
      const meta = safeText(item.email || '');
      return `<div class="schedule-template-item"><strong>${label}</strong><div class="search-result-meta">${meta}</div></div>`;
    })
    .join('');

  const failedItems = (result.failed || [])
    .slice(0, 8)
    .map((item) => {
      const label = safeText(item.email || `Fila ${item.row}`);
      const meta = safeText(`Fila ${item.row}: ${item.error || 'Error'}`);
      return `<div class="schedule-template-item"><strong>${label}</strong><div class="search-result-meta">${meta}</div></div>`;
    })
    .join('');

  els.adminImportUsersResult.innerHTML = `
    <div class="schedule-template-list">
      <div class="schedule-template-item">
        <strong>Creados: ${safeText(result.createdCount ?? 0)}</strong>
        <div class="search-result-meta">Fallidos: ${safeText(
          result.failedCount ?? 0,
        )} · Vacíos omitidos: ${safeText(result.skippedEmptyRows ?? 0)}</div>
      </div>
      ${
        createdItems
          ? `<div class="schedule-template-item"><strong>Altas correctas</strong><div class="schedule-template-list">${createdItems}</div></div>`
          : ''
      }
      ${
        failedItems
          ? `<div class="schedule-template-item"><strong>Filas con incidencia</strong><div class="schedule-template-list">${failedItems}</div></div>`
          : ''
      }
    </div>
  `;
}

async function importAdminUsersFromExcel() {
  const file = els.adminImportUsersFileInput?.files?.[0];
  if (!file) {
    showFlash('error', 'Debes seleccionar un archivo Excel antes de importarlo.');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const result = await api('/admin/users/import', {
      method: 'POST',
      body: formData,
    });

    renderAdminImportUsersResult(result);
    els.adminImportUsersFileInput.value = '';
    await Promise.all([loadAdminUsers(), loadAdminPresence(), loadDashboard()]);
    await Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);

    const createdCount = Number(result?.createdCount || 0);
    const failedCount = Number(result?.failedCount || 0);
    const skipped = Number(result?.skippedEmptyRows || 0);
    showFlash(
      failedCount > 0 ? 'error' : 'success',
      `Importación terminada. Creados: ${createdCount}. Fallidos: ${failedCount}. Vacíos omitidos: ${skipped}.`,
    );
  } catch (error) {
    renderAdminImportUsersResult(null);
    showFlash('error', `No se pudo importar el Excel: ${error.message}`);
  }
}

async function downloadImportUsersTemplate() {
  try {
    const res = await fetch('/admin/users/import-template.xlsx', {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_importacion_empleados.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showFlash('success', 'Plantilla Excel descargada correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo descargar la plantilla: ${error.message}`);
  }
}

async function exportAdminUsersExcel() {
  try {
    const res = await fetch('/admin/users/export.xlsx', {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || `${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'personal_actual_empresa.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showFlash('success', 'Excel del personal exportado correctamente.');
  } catch (error) {
    showFlash('error', `No se pudo exportar el personal: ${error.message}`);
  }
}

async function createActivationKey() {
  const companyCif = normalizeCif(els.activationCompanyCifInput.value);
  const companyName = els.activationCompanyNameInput.value.trim();
  const adminEmail = els.activationAdminEmailInput.value.trim();
  const adminName = els.activationAdminNameInput.value.trim();
  const companyLogoUrl = els.activationCompanyLogoInput.value.trim();
  const expiresInDays = Number(els.activationExpiresDaysInput.value || '14');

  if (!companyCif || !companyName || !adminEmail || !adminName) {
    showFlash(
      'error',
      'Debes completar CIF empresa, nombre empresa, email y nombre del admin.',
    );
    return;
  }
  if (!isValidSpanishCif(companyCif)) {
    showFlash('error', 'CIF de empresa inválido.');
    return;
  }
  if (!validateEmailInput(els.activationAdminEmailInput)) {
    els.activationAdminEmailInput.reportValidity();
    return;
  }

  if (!Number.isInteger(expiresInDays) || expiresInDays < 1) {
    showFlash('error', 'La caducidad debe ser un entero >= 1.');
    return;
  }

  try {
    const result = await api('/admin/onboarding/activation-keys', {
      method: 'POST',
      body: {
        companyCif,
        companyName,
        adminEmail,
        adminName,
        companyLogoUrl: companyLogoUrl || undefined,
        expiresInDays,
      },
    });

    if (result?.activationKey) {
      showActivationKeyPrompt(result.activationKey);
    }

    els.activationCompanyCifInput.value = '';
    els.activationCompanyNameInput.value = '';
    els.activationAdminEmailInput.value = '';
    els.activationAdminNameInput.value = '';
    els.activationCompanyLogoInput.value = '';
    els.activationExpiresDaysInput.value = '14';

    const expiryText = result?.expiresAt
      ? new Date(result.expiresAt).toLocaleString('es-ES')
      : '-';
    showFlash(
      'success',
      `Clave creada para ${result?.companyCif || companyCif}. Caduca: ${expiryText}.`,
    );
  } catch (error) {
    showFlash('error', `No se pudo generar la clave: ${error.message}`);
  }
}

async function sendAdminUserAccess(id) {
  try {
    const result = await api(`/admin/users/${id}/send-access`, {
      method: 'POST',
    });

    const onboarding = result?.onboarding;
    let successMessage =
      onboarding?.message || 'Acceso enviado correctamente.';

    if (onboarding?.passwordSetupLink) {
      showAccessLinkPrompt(onboarding.passwordSetupLink);
      successMessage = `${successMessage} Se mostró enlace manual en pantalla.`;
    }

    showFlash('success', successMessage);
  } catch (error) {
    showFlash('error', `No se pudo enviar acceso: ${error.message}`);
  }
}

async function saveAdminUser(id) {
  const currentUser = state.adminUsers.find((u) => u.id === id);
  if (!currentUser) {
    showFlash('error', 'No se encontró el usuario en la tabla.');
    return;
  }

  const roleSelect = document.querySelector(
    `.admin-role-select[data-user-id=\"${id}\"]`,
  );
  const groupSelect = document.querySelector(
    `.admin-group-select[data-user-id=\"${id}\"]`,
  );
  const hoursInput = document.querySelector(
    `.admin-hours-input[data-user-id=\"${id}\"]`,
  );
  const vacationInput = document.querySelector(
    `.admin-vacation-input[data-user-id=\"${id}\"]`,
  );
  const overtimeBankInput = document.querySelector(
    `.admin-overtime-bank-input[data-user-id=\"${id}\"]`,
  );
  if (!roleSelect || !groupSelect || !hoursInput || !vacationInput || !overtimeBankInput) return;

  const role = roleSelect.value;
  const workerGroup = groupSelect.value;
  const hours = Number(hoursInput.value);
  const vacationAllowanceDays = Number(vacationInput.value);
  const overtimeBankAdjustmentHours = Number(overtimeBankInput.value);

  if (!Number.isInteger(hours) || hours < 0) {
    showFlash('error', 'Las horas de prácticas deben ser un entero >= 0.');
    return;
  }
  if (!Number.isFinite(vacationAllowanceDays) || vacationAllowanceDays < 0) {
    showFlash('error', 'Los días de vacaciones deben ser >= 0.');
    return;
  }
  if (!Number.isFinite(overtimeBankAdjustmentHours)) {
    showFlash('error', 'El ajuste de bolsa de horas no es válido.');
    return;
  }

  const payload = {};

  if (role !== currentUser.role) {
    payload.role = role;
  }

  if (workerGroup !== currentUser.workerGroup) {
    payload.workerGroup = workerGroup;
  }

  if (workerGroup === 'INTERN') {
    const currentHours =
      currentUser.internshipTotalHours == null
        ? 0
        : Number(currentUser.internshipTotalHours);
    if (hours !== currentHours) {
      payload.internshipTotalHours = hours;
    }
  }

  const currentVacationAllowance =
    currentUser.vacationAllowanceDays ?? currentUser.vacationBalance?.allowanceDays ?? 22;
  if (vacationAllowanceDays !== Number(currentVacationAllowance)) {
    payload.vacationAllowanceDays = vacationAllowanceDays;
  }

  const currentOvertimeAdjustmentHours = Number(
    ((currentUser.overtimeBankMinutesAdjustment ?? 0) / 60).toFixed(2),
  );
  if (Number(overtimeBankAdjustmentHours.toFixed(2)) !== currentOvertimeAdjustmentHours) {
    payload.overtimeBankMinutesAdjustment = Math.round(
      overtimeBankAdjustmentHours * 60,
    );
  }

  if (!Object.keys(payload).length) {
    showFlash('success', 'No hay cambios para guardar.');
    return;
  }

  const isSelfDemotion =
    state.me?.id === id && state.me?.role === 'ADMIN' && role !== 'ADMIN';

  try {
    await api(`/admin/users/${id}/settings`, {
      method: 'POST',
      body: payload,
    });

    if (isSelfDemotion) {
      state.me.role = role;
      setSessionViews();
      showFlash(
        'success',
        'Cambios guardados. Tu sesión ya no tiene acceso al panel admin.',
      );
      return;
    }

    await Promise.all([
      loadAdminUsers(),
      loadAdminPresence(),
      loadDashboard(),
      loadProgress(),
      loadNotifications(),
      loadAuditLogs(),
    ]);
    await Promise.all([loadAdminSchedule(), loadAdminScheduleTemplate()]);
    showFlash('success', 'Cambios de usuario guardados.');
  } catch (error) {
    showFlash('error', `No se pudieron guardar cambios: ${error.message}`);
  }
}

function openReviewModal(id, action) {
  state.reviewTargetId = id;
  state.reviewAction = action;
  const label = action === 'approve' ? 'Aprobar' : 'Rechazar';
  els.reviewModalTitle.textContent = `${label} solicitud`;
  els.reviewCommentInput.value = '';
  els.reviewModal.hidden = false;
  els.reviewCommentInput.focus();
}

function closeReviewModal() {
  state.reviewTargetId = null;
  state.reviewAction = null;
  els.reviewCommentInput.value = '';
  els.reviewModal.hidden = true;
}

async function submitReviewModal() {
  if (!state.reviewTargetId || !state.reviewAction) {
    closeReviewModal();
    return;
  }

  const id = state.reviewTargetId;
  const action = state.reviewAction;
  const label = action === 'approve' ? 'aprobar' : 'rechazar';
  const reviewComment = els.reviewCommentInput.value.trim();

  try {
    await api(`/admin/requests/${id}/${action}`, {
      method: 'POST',
      body: reviewComment ? { reviewComment } : {},
    });

    await loadAdminRequests();
    await loadDashboard();
    closeReviewModal();
    showFlash(
      'success',
      `Solicitud ${action === 'approve' ? 'aprobada' : 'rechazada'} correctamente.`,
    );
  } catch (error) {
    showFlash('error', `No se pudo ${label} la solicitud: ${error.message}`);
  }
}

function bindEvents() {
  els.loginBtn.addEventListener('click', loginWithFirebase);
  els.forgotPasswordBtn.addEventListener('click', requestPasswordReset);
  els.saveTokenBtn.addEventListener('click', loginWithToken);
  els.selfRegisterCompanyBtn.addEventListener('click', selfRegisterCompany);
  els.activateAdminBtn.addEventListener('click', activateAdminWithKey);
  els.saveAdvancedBtn.addEventListener('click', saveAdvancedConfig);
  els.demoEmployeeBtn.addEventListener('click', () => loginWithDemo('employee'));
  els.demoAdminBtn.addEventListener('click', () => loginWithDemo('admin'));

  els.logoutBtn.addEventListener('click', () => {
    clearSession();
    showFlash('success', 'Sesión cerrada.');
  });

  els.refreshShiftBtn.addEventListener('click', async () => {
    await Promise.all([loadShiftStatus(), loadShiftHistory()]);
  });
  els.refreshShiftHistoryBtn.addEventListener('click', () => loadShiftHistory());
  els.clockInBtn.addEventListener('click', clockIn);
  els.clockOutBtn.addEventListener('click', clockOut);

  els.createRequestBtn.addEventListener('click', createRequest);
  els.refreshRequestsBtn.addEventListener('click', loadRequests);
  els.filterStatus.addEventListener('change', loadRequests);
  els.filterType.addEventListener('change', loadRequests);
  els.refreshProgressBtn.addEventListener('click', loadProgress);
  els.refreshNotificationsBtn.addEventListener('click', loadNotifications);
  els.refreshScheduleBtn.addEventListener('click', () => loadMySchedule(true));
  els.schedulePrevMonthBtn.addEventListener('click', () => {
    els.scheduleMonthInput.value = shiftMonthValue(
      els.scheduleMonthInput.value || state.myScheduleMonth || monthLocalValue(),
      -1,
    );
    loadMySchedule();
  });
  els.scheduleNextMonthBtn.addEventListener('click', () => {
    els.scheduleMonthInput.value = shiftMonthValue(
      els.scheduleMonthInput.value || state.myScheduleMonth || monthLocalValue(),
      1,
    );
    loadMySchedule();
  });
  els.markMySickLeaveBtn.addEventListener('click', markMySickLeave);
  els.scheduleCalendar.addEventListener('click', (event) => {
    const day = event.target.closest('[data-date]');
    if (!day) return;
    const dateKey = day.dataset.date || '';
    state.myScheduleSelectedDate = dateKey;
    syncMySickLeaveInputs(dateKey);
    renderMySchedule();
  });

  els.createDocBtn.addEventListener('click', createDocument);
  els.refreshDocsBtn.addEventListener('click', loadDocuments);
  els.clearSignBtn.addEventListener('click', () => {
    clearSignature();
    showFlash('success', 'Firma limpiada.');
  });
  els.signDocBtn.addEventListener('click', signSelectedDocument);

  els.refreshProfileBtn.addEventListener('click', () => loadMyProfile(true));
  els.saveProfileBtn.addEventListener('click', saveMyProfile);
  els.deleteMyAccountBtn.addEventListener('click', deleteMyAccount);

  els.refreshAdminBtn.addEventListener('click', async () => {
    await loadCurrentRouteData();
    showFlash('success', 'Panel admin actualizado.');
  });
  els.refreshAdminPresenceBtn.addEventListener('click', loadAdminPresence);
  els.refreshAdminRequestsBtn.addEventListener('click', loadAdminRequests);
  els.refreshAdminUsersBtn.addEventListener('click', loadAdminUsers);
  els.refreshAuditLogsBtn.addEventListener('click', loadAuditLogs);
  els.adminHomeBtn.addEventListener('click', () => setAdminView('home'));
  els.refreshProductionStatusBtn.addEventListener('click', () =>
    loadProductionStatus(true),
  );
  els.runBackupNowBtn.addEventListener('click', runBackupNow);
  els.sendTestEmailBtn.addEventListener('click', sendTestEmail);
  els.refreshOpenClawIntegrationBtn.addEventListener('click', () =>
    loadOpenClawIntegration(true),
  );
  els.rotateOpenClawTokenBtn.addEventListener('click', rotateOpenClawToken);
  els.revokeOpenClawBtn.addEventListener('click', revokeOpenClawIntegration);
  els.refreshWhatsappIntegrationBtn.addEventListener('click', () =>
    loadWhatsappIntegration(true),
  );
  els.saveWhatsappIntegrationBtn.addEventListener('click', saveWhatsappIntegration);
  els.sendWhatsappTestBtn.addEventListener('click', sendWhatsappTestMessage);
  els.refreshBackupStatusBtn.addEventListener('click', () =>
    loadBackupStatus(true),
  );
  els.exportCompanyExcelBtn.addEventListener('click', exportCompanyExcel);
  els.exportEmployeePdfBtn.addEventListener('click', exportEmployeePdf);
  els.saveCompanyLocationBtn.addEventListener('click', saveCompanyLocation);
  els.refreshCompanyLocationBtn.addEventListener('click', () =>
    loadCompanyLocation(true),
  );
  els.importOfficialHolidaysBtn.addEventListener('click', importOfficialHolidays);
  els.saveHolidayBtn.addEventListener('click', saveHoliday);
  els.cancelHolidayBtn.addEventListener('click', resetHolidayForm);
  els.refreshHolidaysBtn.addEventListener('click', () => loadHolidays(true));
  els.refreshAdminScheduleBtn.addEventListener('click', async () => {
    await Promise.all([loadAdminSchedule(true), loadAdminScheduleTemplate()]);
  });
  els.saveAdminScheduleBtn.addEventListener('click', saveAdminSchedule);
  els.saveAdminScheduleRangeBtn.addEventListener('click', saveAdminScheduleRange);
  els.saveAdminScheduleTemplateBtn.addEventListener('click', saveAdminScheduleTemplate);
  els.applyAdminScheduleTemplateBtn.addEventListener('click', applyAdminScheduleTemplate);
  els.copyAdminScheduleMonthBtn.addEventListener('click', copyAdminScheduleMonth);
  els.adminAssignSubmitBtn.addEventListener('click', submitAdminDirectAssignment);
  els.deleteAdminScheduleBtn.addEventListener('click', deleteAdminSchedule);
  els.saveWorkplaceBtn.addEventListener('click', saveWorkplace);
  els.refreshWorkplaceBtn.addEventListener('click', () => loadWorkplace(true));
  els.workplaceSelectInput.addEventListener('change', () => {
    selectWorkplace(els.workplaceSelectInput.value);
  });
  els.newWorkplaceBtn.addEventListener('click', prepareNewWorkplace);
  els.deleteWorkplaceBtn.addEventListener('click', deleteWorkplace);
  els.refreshSuspiciousShiftsBtn.addEventListener('click', loadSuspiciousShifts);
  els.adminCreateGroupSelect.addEventListener('change', syncAdminCreateHoursState);
  els.adminCreateBtn.addEventListener('click', createAdminUser);
  els.exportUsersExcelBtn.addEventListener('click', exportAdminUsersExcel);
  els.downloadImportTemplateBtn.addEventListener(
    'click',
    downloadImportUsersTemplate,
  );
  els.adminImportUsersBtn.addEventListener('click', importAdminUsersFromExcel);
  els.createActivationKeyBtn.addEventListener('click', createActivationKey);
  els.reviewCancelBtn.addEventListener('click', closeReviewModal);
  els.reviewConfirmBtn.addEventListener('click', submitReviewModal);
  els.reviewModal.addEventListener('click', (event) => {
    if (event.target === els.reviewModal) {
      closeReviewModal();
    }
  });

  els.adminUserProfileCloseBtn.addEventListener('click', closeAdminUserProfileModal);
  els.adminUserDeleteBtn.addEventListener('click', () => deleteAdminUser());
  els.adminUserProfileModal.addEventListener('click', (event) => {
    if (event.target === els.adminUserProfileModal) {
      closeAdminUserProfileModal();
    }
  });
  els.mapModal.addEventListener('click', (event) => {
    if (event.target === els.mapModal) {
      closeMapModal();
    }
  });
  els.mapModalCloseBtn.addEventListener('click', closeMapModal);

  document.querySelectorAll('[data-admin-view-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      setAdminView(button.dataset.adminViewTarget || 'home');
      await loadCurrentRouteData();
    });
  });

  els.scheduleMonthInput.addEventListener('change', () => loadMySchedule());
  els.adminScheduleUserSearchInput.addEventListener('input', () => {
    renderAdminScheduleSearchResults();
  });
  els.adminScheduleUserSearchInput.addEventListener('focus', () => {
    renderAdminScheduleSearchResults();
  });
  els.adminScheduleUserSearchResults.addEventListener('click', (event) => {
    const button = event.target.closest('[data-schedule-user-id]');
    if (!button) return;
    selectAdminScheduleUser(button.dataset.scheduleUserId || '');
  });
  els.adminScheduleMonthInput.addEventListener('change', () => {
    syncAdminScheduleRangeInputs(els.adminScheduleMonthInput.value);
    loadAdminSchedule();
  });
  els.adminSchedulePrevMonthBtn.addEventListener('click', () => {
    els.adminScheduleMonthInput.value = shiftMonthValue(
      els.adminScheduleMonthInput.value ||
        state.adminScheduleMonth ||
        monthLocalValue(),
      -1,
    );
    syncAdminScheduleRangeInputs(els.adminScheduleMonthInput.value);
    loadAdminSchedule();
  });
  els.adminScheduleNextMonthBtn.addEventListener('click', () => {
    els.adminScheduleMonthInput.value = shiftMonthValue(
      els.adminScheduleMonthInput.value ||
        state.adminScheduleMonth ||
        monthLocalValue(),
      1,
    );
    syncAdminScheduleRangeInputs(els.adminScheduleMonthInput.value);
    loadAdminSchedule();
  });
  els.adminScheduleDateInput.addEventListener('change', () => renderAdminSchedule());
  els.adminScheduleTypeSelect.addEventListener('change', () =>
    syncAdminSchedulePlannedTimeControls(),
  );
  els.adminScheduleCalendar.addEventListener('click', (event) => {
    const day = event.target.closest('[data-date]');
    if (!day) return;
    const dateKey = day.dataset.date || '';
    const entry = state.adminScheduleEntries.find((item) => item.dateKey === dateKey) || null;
    fillAdminScheduleForm(dateKey, entry);
    renderAdminSchedule();
  });
  els.adminScheduleWeekdayPicker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-weekday]');
    if (!button) return;
    button.classList.toggle('is-active');
  });
  els.adminSchedulePresetWeekdaysBtn.addEventListener('click', () =>
    setAdminScheduleWeekdays([1, 2, 3, 4, 5]),
  );
  els.adminSchedulePresetAllBtn.addEventListener('click', () =>
    setAdminScheduleWeekdays([1, 2, 3, 4, 5, 6, 7]),
  );
  els.adminSchedulePresetClearBtn.addEventListener('click', () =>
    setAdminScheduleWeekdays([]),
  );

  if (els.pageSelect) {
    els.pageSelect.addEventListener('change', () => {
      const nextPage = els.pageSelect.value;
      reloadToPage(nextPage, nextPage === 'admin' ? 'home' : 'home');
    });
  }
  document.querySelectorAll('.nav-page-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextPage = btn.dataset.pageNav || 'inicio';
      reloadToPage(nextPage, nextPage === 'admin' ? 'home' : 'home');
    });
  });

  document.addEventListener('click', (event) => {
    if (
      event.target === els.adminScheduleUserSearchInput ||
      event.target.closest('#adminScheduleUserSearchResults')
    ) {
      return;
    }
    hideAdminScheduleSearchResults();
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === 'open-map') {
      openMapModal({
        title: button.dataset.title || 'Mapa del fichaje',
        subtitle: button.dataset.subtitle || '',
        lat: Number(button.dataset.lat),
        lng: Number(button.dataset.lng),
      });
      return;
    }

    if (!id) return;

    if (action === 'cancel-request') cancelRequest(id);
    if (action === 'select-doc') {
      state.selectedDocumentId = id;
      renderDocuments();
      showFlash('success', 'Documento seleccionado para firma.');
    }
    if (action === 'download-doc') downloadDocument(id);
    if (action === 'mark-notification-read') markNotificationRead(id);

    if (action === 'approve-request') openReviewModal(id, 'approve');
    if (action === 'reject-request') openReviewModal(id, 'reject');
    if (action === 'edit-holiday') {
      const holiday = state.holidays.find((item) => item.id === id) || null;
      if (holiday) {
        fillHolidayForm(holiday);
        showFlash('success', 'Festivo cargado en el formulario.');
      }
    }
    if (action === 'delete-holiday') deleteHoliday(id);
    if (action === 'admin-save-user') saveAdminUser(id);
    if (action === 'admin-send-access') sendAdminUserAccess(id);
    if (action === 'admin-view-profile') openAdminUserProfileModal(id);
    if (action === 'admin-delete-user') deleteAdminUser(id);
  });
}

function setDefaults() {
  const now = new Date();
  const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  els.requestStart.value = dateTimeLocalValue(now);
  els.requestEnd.value = dateTimeLocalValue(end);
  els.docFrom.value = dateLocalValue(now);
  els.docTo.value = dateLocalValue(now);
  els.scheduleMonthInput.value = monthLocalValue(now);
  state.myScheduleSelectedDate = dateLocalValue(now);
  syncMySickLeaveInputs(state.myScheduleSelectedDate);
  els.adminExportFromInput.value = dateLocalValue(now);
  els.adminExportToInput.value = dateLocalValue(now);
  if (els.adminPdfFromInput) {
    els.adminPdfFromInput.value = dateLocalValue(now);
  }
  if (els.adminPdfToInput) {
    els.adminPdfToInput.value = dateLocalValue(now);
  }
  els.holidayDateInput.value = dateLocalValue(now);
  if (els.holidayImportYearInput) {
    els.holidayImportYearInput.value = String(now.getFullYear());
  }
  els.adminScheduleMonthInput.value = monthLocalValue(now);
  els.adminScheduleDateInput.value = dateLocalValue(now);
  syncAdminScheduleRangeInputs(els.adminScheduleMonthInput.value);
  setAdminScheduleWeekdays([1, 2, 3, 4, 5]);
  els.adminAssignStartInput.value = dateTimeLocalValue(now);
  els.adminAssignEndInput.value = dateTimeLocalValue(end);
  els.docTimezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  els.tokenInput.value = state.token;
  els.apiKeyInput.value = getStored(STORAGE_KEYS.firebaseApiKey);
  els.demoEmployeeEmailInput.value = getStored(STORAGE_KEYS.demoEmployeeEmail);
  els.demoEmployeePasswordInput.value = getStored(
    STORAGE_KEYS.demoEmployeePassword,
  );
  els.demoAdminEmailInput.value = getStored(STORAGE_KEYS.demoAdminEmail);
  els.demoAdminPasswordInput.value = getStored(STORAGE_KEYS.demoAdminPassword);
  els.signaturePreview.hidden = true;
  syncAdminCreateHoursState();
}

async function init() {
  await loadPublicConfig();
  await initCaptcha();
  initializeRouteState();
  setDefaults();
  syncPublicOnboardingState();
  bindEmailValidation();
  bindCifValidation();
  bindEvents();
  const signatureTools = initSignatureCanvas();
  clearSignature = signatureTools.clear;
  resizeSignatureCanvas = signatureTools.resize;

  if (!state.token) {
    setSessionViews();
    return;
  }

  try {
    state.restoringSession = true;
    setSessionViews();
    hideFlash();
    await bootstrapSession();
    showFlash('success', 'Sesión recuperada correctamente.');
  } catch (error) {
    clearSession();
    showFlash('error', `No se pudo restaurar la sesión: ${error.message}`);
  } finally {
    state.restoringSession = false;
  }
}

init();
