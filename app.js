/**
 * Sprinto Dynamic CMS Controller
 * Automated Google Drive Uploads, Multi-Role Auth Guard & Centralized Admin API Sync
 */

// إعدادات النظام المركزية
const CONFIG = {
  // 🔴 ضع رابط الـ Web App الخاص بك هنا ليعمل تلقائياً لجميع المستخدمين والموظفين:
  DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbx_YOUR_SCRIPT_ID_HERE/exec',
  ADMIN_EMAIL: 'sprinto.coworkingspace@gmail.com'
};

const STATE = {
  apiUrl: localStorage.getItem('sprinto_api_url') || CONFIG.DEFAULT_API_URL,
  currentUser: JSON.parse(localStorage.getItem('sprinto_user') || 'null'),
  schemas: {},
  currentSheet: null,
  pendingImages: {},
  guardInterval: null
};

// DOM References
const DOM = {
  authWrapper: document.getElementById('authWrapper'),
  dashboardLayout: document.getElementById('dashboardLayout'),
  tabBtnLogin: document.getElementById('tabBtnLogin'),
  tabBtnRegister: document.getElementById('tabBtnRegister'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  userDisplayName: document.getElementById('userDisplayName'),
  userRoleBadge: document.getElementById('userRoleBadge'),
  userAvatarChar: document.getElementById('userAvatarChar'),
  adminMenuSection: document.getElementById('adminMenuSection'),
  btnStaffManagement: document.getElementById('btnStaffManagement'),
  staffTableBody: document.getElementById('staffTableBody'),
  btnRefreshStaff: document.getElementById('btnRefreshStaff'),
  btnLogout: document.getElementById('btnLogout'),
  dynamicNavMenu: document.getElementById('dynamicNavMenu'),
  btnOpenTabModal: document.getElementById('btnOpenTabModal'),
  btnSettingsNav: document.getElementById('btnSettingsNav'),
  btnRefresh: document.getElementById('btnRefresh'),
  schemaBuilderForm: document.getElementById('schemaBuilderForm'),
  columnsList: document.getElementById('columnsList'),
  btnAddColumnRow: document.getElementById('btnAddColumnRow'),
  newSheetName: document.getElementById('newSheetName'),
  dynamicRecordForm: document.getElementById('dynamicRecordForm'),
  dynamicFormFields: document.getElementById('dynamicFormFields'),
  dynamicTableHead: document.getElementById('dynamicTableHead'),
  dynamicTableBody: document.getElementById('dynamicTableBody'),
  recordCountBadge: document.getElementById('recordCountBadge'),
  formSectionTitle: document.getElementById('formSectionTitle'),
  tableSectionTitle: document.getElementById('tableSectionTitle'),
  pageTitle: document.getElementById('currentSectionTitle'),
  pageDesc: document.getElementById('currentSectionDesc'),
  apiUrlInput: document.getElementById('apiUrlInput'),
  apiSettingsForm: document.getElementById('apiSettingsForm'),
  btnTestApi: document.getElementById('btnTestApi'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  loadingMessage: document.getElementById('loadingMessage'),
  toastContainer: document.getElementById('toastContainer'),
  statusDot: document.getElementById('statusDot'),
  connectionStatus: document.getElementById('connectionStatus'),
  menuToggle: document.getElementById('menuToggle'),
  sidebar: document.getElementById('sidebar'),
  views: {
    schemaBuilder: document.getElementById('view-schema-builder'),
    dynamicContent: document.getElementById('view-dynamic-content'),
    settings: document.getElementById('view-settings'),
    staffManagement: document.getElementById('view-staff-management')
  }
};

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  // ضبط حقل الرابط الحالي
  if (DOM.apiUrlInput) {
    DOM.apiUrlInput.value = STATE.apiUrl;
  }

  // فحص الجلسة عند بدء التشغيل
  if (STATE.currentUser) {
    verifySessionAndLaunch();
  } else {
    showAuthGateway();
  }
});

function setupEventListeners() {
  DOM.menuToggle.addEventListener('click', () => DOM.sidebar.classList.toggle('open'));

  // Auth Tabs
  DOM.tabBtnLogin.addEventListener('click', () => {
    DOM.tabBtnLogin.classList.add('active');
    DOM.tabBtnRegister.classList.remove('active');
    DOM.loginForm.classList.add('active');
    DOM.registerForm.classList.remove('active');
  });

  DOM.tabBtnRegister.addEventListener('click', () => {
    DOM.tabBtnRegister.classList.add('active');
    DOM.tabBtnLogin.classList.remove('active');
    DOM.registerForm.classList.add('active');
    DOM.loginForm.classList.remove('active');
  });

  // Authentication
  DOM.loginForm.addEventListener('submit', handleLogin);
  DOM.registerForm.addEventListener('submit', handleRegisterApply);
  DOM.btnLogout.addEventListener('click', handleLogout);

  // Staff Management (Admin Only)
  DOM.btnStaffManagement.addEventListener('click', () => {
    switchView('staffManagement');
    DOM.pageTitle.textContent = 'إدارة الموظفين والطلبات';
    DOM.pageDesc.textContent = 'مراجعة الموظفين وقبول أو فصل الكوادر في سبرينتو.';
    loadStaffList();
  });

  DOM.btnRefreshStaff.addEventListener('click', loadStaffList);

  // Schema Builder
  DOM.btnOpenTabModal.addEventListener('click', () => {
    switchView('schemaBuilder');
    DOM.pageTitle.textContent = 'إنشاء تبويب جديد';
    DOM.pageDesc.textContent = 'أضف قسماً مخصصاً بأعمدة وأنواع بيانات جديدة بالكامل.';
  });

  // Settings: مسموح للأدمن فقط برؤيتها والتعديل عليها
  DOM.btnSettingsNav.addEventListener('click', () => {
    if (STATE.currentUser && STATE.currentUser.email.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase()) {
      switchView('settings');
      DOM.pageTitle.textContent = 'إعدادات ربط النظام والـ API';
      DOM.pageDesc.textContent = 'تعديل وتحديث رابط Google Apps Script المركزي للنظام.';
    } else {
      showToast('عفواً، تعديل رابط الـ API متاح حصرياً لحساب الأدمن الرئيسي فقط!', 'error');
    }
  });

  // حفظ رابط الـ API المركزي للأدمن
  DOM.apiSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // التحقق من صلاحية الأدمن
    if (!STATE.currentUser || STATE.currentUser.email.toLowerCase() !== CONFIG.ADMIN_EMAIL.toLowerCase()) {
      showToast('لا تملك الصلاحية لتغيير رابط الـ API.', 'error');
      return;
    }

    const newUrl = DOM.apiUrlInput.value.trim();
    if (!newUrl.startsWith('https://script.google.com')) {
      showToast('الرابط يجب أن يبدأ بـ https://script.google.com', 'error');
      return;
    }

    STATE.apiUrl = newUrl;
    localStorage.setItem('sprinto_api_url', newUrl);

    setLoading(true, 'جاري مزامنة وتثبيت الرابط الجديد...');
    try {
      showToast('تم تحديث وتثبيت رابط الـ API بنجاح للأدمن والسيستم!', 'success');
      fetchSchemasAndInit();
    } catch (err) {
      showToast('تم الحفظ محلياً: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  DOM.btnTestApi.addEventListener('click', () => {
    fetchSchemasAndInit();
  });

  DOM.btnAddColumnRow.addEventListener('click', addColumnRow);

  DOM.columnsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-col')) {
      if (DOM.columnsList.children.length > 1) {
        e.target.closest('.column-item-row').remove();
      } else {
        showToast('يجب أن يحتوي التبويب على عمود واحد على الأقل.', 'error');
      }
    }
  });

  DOM.schemaBuilderForm.addEventListener('submit', handleCreateSchema);
  DOM.dynamicRecordForm.addEventListener('submit', handleInsertRecord);

  DOM.btnRefresh.addEventListener('click', () => {
    if (STATE.currentSheet) loadSheetRecords(STATE.currentSheet);
  });
}

function showAuthGateway() {
  clearInterval(STATE.guardInterval);
  DOM.authWrapper.style.display = 'flex';
  DOM.dashboardLayout.style.display = 'none';
}

function showDashboard(user) {
  DOM.authWrapper.style.display = 'none';
  DOM.dashboardLayout.style.display = 'flex';

  DOM.userDisplayName.textContent = user.name || 'موظف سبرينتو';
  DOM.userRoleBadge.textContent = user.role || 'Staff';
  DOM.userAvatarChar.textContent = (user.name || 'U').charAt(0).toUpperCase();

  // إظهار الأدوات الخاصة بالأدمن فقط
  const isAdmin = user.email.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase() || user.role === 'Admin';
  if (isAdmin) {
    DOM.adminMenuSection.style.display = 'block';
    DOM.btnSettingsNav.style.display = 'flex';
  } else {
    DOM.adminMenuSection.style.display = 'none';
    DOM.btnSettingsNav.style.display = 'none'; // إخفاء إعدادات الـ API تماماً عن الموظفين العاديين
  }

  fetchSchemasAndInit();
  startSessionLiveGuard();
}

// تسجيل الدخول مع حماية طوارئ للأدمن
async function handleLogin(e) {
  e.preventDefault();
  const email = DOM.loginEmail.value.trim();
  const password = DOM.loginPassword.value.trim();

  // إذا كان الرابط غير مضبوط وداخل بإيميل الأدمن المعتمد، يفتح له فوراً لتعديل الرابط
  if ((!STATE.apiUrl || STATE.apiUrl.includes('YOUR_SCRIPT_ID_HERE')) && email.toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase()) {
    const adminUser = {
      name: 'الأدمن الرئيسي',
      email: CONFIG.ADMIN_EMAIL,
      role: 'Admin',
      status: 'Active'
    };
    STATE.currentUser = adminUser;
    localStorage.setItem('sprinto_user', JSON.stringify(adminUser));
    showToast('تم تسجيل الدخول في وضع الطوارئ (Emergency Mode) لضبط رابط الـ API ⚙️', 'success');
    showDashboard(adminUser);
    switchView('settings');
    return;
  }

  if (!STATE.apiUrl || STATE.apiUrl.includes('YOUR_SCRIPT_ID_HERE')) {
    showToast('النظام غير مربوط بالـ API حالياً. يرجى انتظار قيام الأدمن بضبط الرابط.', 'error');
    return;
  }

  setLoading(true, 'جاري التحقق من بيانات الدخول مع Google Sheets...');

  try {
    const res = await fetch(STATE.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        email: email,
        password: password
      })
    });

    const json = await res.json();
    if (json.status === 'success') {
      STATE.currentUser = json.user;
      localStorage.setItem('sprinto_user', JSON.stringify(json.user));
      showToast(`أهلاً بك يا ${json.user.name} 👋`, 'success');
      DOM.loginForm.reset();
      showDashboard(json.user);
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// طلب التوظيف
async function handleRegisterApply(e) {
  e.preventDefault();
  if (!STATE.apiUrl || STATE.apiUrl.includes('YOUR_SCRIPT_ID_HERE')) {
    showToast('النظام غير متصل بالسيرفر حالياً.', 'error');
    return;
  }

  const fullName = document.getElementById('regFullName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();

  setLoading(true, 'جاري إرسال طلب الانضمام للأدمن...');

  try {
    const res = await fetch(STATE.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'apply_staff',
        fullName: fullName,
        email: email,
        password: password
      })
    });

    const json = await res.json();
    if (json.status === 'success') {
      showToast(json.message, 'success');
      DOM.registerForm.reset();
      DOM.tabBtnLogin.click();
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// الحماية اللحظية: طرد الموظف إن تم حذفه من الشيت
function startSessionLiveGuard() {
  clearInterval(STATE.guardInterval);
  STATE.guardInterval = setInterval(async () => {
    if (!STATE.currentUser || !STATE.apiUrl || STATE.apiUrl.includes('YOUR_SCRIPT_ID_HERE')) return;
    try {
      const res = await fetch(STATE.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'verify_session',
          email: STATE.currentUser.email
        })
      });
      const json = await res.json();
      if (json.status === 'terminated') {
        clearInterval(STATE.guardInterval);
        handleLogout();
        alert('⚠️️ تنبيه أمني: تم إيقاف أو فصل حسابك من قبل الأدمن في Google Sheets.');
      }
    } catch (e) { }
  }, 45000);
}

function verifySessionAndLaunch() {
  showDashboard(STATE.currentUser);
}

function handleLogout() {
  clearInterval(STATE.guardInterval);
  STATE.currentUser = null;
  localStorage.removeItem('sprinto_user');
  showToast('تم تسجيل الخروج بنجاح', 'success');
  showAuthGateway();
}

// قائمة الموظفين (للأدمن فقط)
async function loadStaffList() {
  if (!STATE.apiUrl || STATE.currentUser.role !== 'Admin') return;
  DOM.staffTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">جاري جلب أحدث بيانات الموظفين...</td></tr>';

  try {
    const res = await fetch(`${STATE.apiUrl}?action=get_users`);
    const json = await res.json();

    if (json.status === 'success' && Array.isArray(json.users)) {
      renderStaffTable(json.users);
    } else {
      DOM.staffTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">لا يوجد موظفون مسجلون.</td></tr>';
    }
  } catch (err) {
    DOM.staffTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">تعذر تحميل بيانات الموظفين.</td></tr>';
  }
}

function renderStaffTable(users) {
  if (users.length === 0) {
    DOM.staffTableBody.innerHTML = '<tr><td colspan="7" class="empty-cell">لا توجد حسابات.</td></tr>';
    return;
  }

  DOM.staffTableBody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    let badgeClass = 'badge-pending';
    if (u.Status === 'Active') badgeClass = 'badge-active';
    if (u.Status === 'Fired' || u.Status === 'Rejected') badgeClass = 'badge-fired';

    const isSelf = (u.Email || '').toLowerCase() === STATE.currentUser.email.toLowerCase();

    let actionsHtml = '';
    if (!isSelf) {
      if (u.Status === 'Pending') {
        actionsHtml = `
          <button class="btn-success-sm" onclick="manageStaff('${u.ID}', 'approve')">قبول وتعيين ✅</button>
          <button class="btn-danger-sm" onclick="manageStaff('${u.ID}', 'reject')">رفض الطلب ✕</button>
        `;
      } else if (u.Status === 'Active') {
        actionsHtml = `
          <button class="btn-warning-sm" onclick="manageStaff('${u.ID}', 'fire')">فصل الموظف ⛔</button>
          <button class="btn-danger-sm" onclick="manageStaff('${u.ID}', 'delete')">حذف نهائي 🗑️</button>
        `;
      } else {
        actionsHtml = `
          <button class="btn-success-sm" onclick="manageStaff('${u.ID}', 'approve')">إعادة تعيين وتفعيل 🔄</button>
          <button class="btn-danger-sm" onclick="manageStaff('${u.ID}', 'delete')">حذف نهائي 🗑️</button>
        `;
      }
    } else {
      actionsHtml = '<span class="badge">حسابك الحالي (الأدمن)</span>';
    }

    tr.innerHTML = `
      <td><strong>${u.ID}</strong></td>
      <td>${u['Full Name']}</td>
      <td>${u.Email}</td>
      <td><span class="badge">${u.Role}</span></td>
      <td><span class="badge ${badgeClass}">${u.Status}</span></td>
      <td>${u['Created At'] || '-'}</td>
      <td class="table-actions">${actionsHtml}</td>
    `;
    DOM.staffTableBody.appendChild(tr);
  });
}

window.manageStaff = async function (userId, actionType) {
  let confirmMsg = 'هل أنت متأكد من تنفيذ هذا القرار؟';
  if (actionType === 'fire') confirmMsg = 'هل أنت متأكد من فصل هذا الموظف؟ سيتم سحب صلاحياته وطرده فوراً.';
  if (actionType === 'delete') confirmMsg = 'هل تريد مسح هذا الحساب نهائياً من قاعدة البيانات؟';

  if (!confirm(confirmMsg)) return;

  setLoading(true, 'جاري تطبيق الإجراء وتحديث Google Sheets...');

  try {
    const res = await fetch(STATE.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'manage_user',
        adminEmail: STATE.currentUser.email,
        targetUserId: userId,
        subAction: actionType
      })
    });

    const json = await res.json();
    if (json.status === 'success') {
      showToast(json.message, 'success');
      loadStaffList();
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(false);
  }
};

function addColumnRow() {
  const row = document.createElement('div');
  row.className = 'column-item-row';
  row.innerHTML = `
    <input type="text" class="col-name" placeholder="اسم العمود (مثال: صورة الغرفة أو السعر)" required>
    <select class="col-type">
      <option value="text">نص عادي (Text)</option>
      <option value="textarea">نص طويل / وصف (Paragraph)</option>
      <option value="number">رقم (Number)</option>
      <option value="image">📁 رفع صورة (تخزين تلقائي على Drive)</option>
      <option value="url">رابط ويب أو استمارة (Link)</option>
      <option value="date">تاريخ (Date)</option>
    </select>
    <button type="button" class="btn-remove-col" title="حذف">✕</button>
  `;
  DOM.columnsList.appendChild(row);
}

async function fetchSchemasAndInit() {
  if (!STATE.apiUrl || STATE.apiUrl.includes('YOUR_SCRIPT_ID_HERE')) return;
  setLoading(true, 'جاري مزامنة التبويبات...');

  try {
    const res = await fetch(`${STATE.apiUrl}?action=get_schemas`);
    const json = await res.json();

    if (json.status === 'success') {
      STATE.schemas = json.schemas || {};
      DOM.statusDot.classList.add('connected');
      DOM.connectionStatus.textContent = 'متصل بالسحابة وDrive';
      renderSidebarNav();

      const firstTab = Object.keys(STATE.schemas)[0];
      if (firstTab) {
        selectSheet(firstTab);
      } else {
        switchView('schemaBuilder');
      }
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    DOM.statusDot.classList.remove('connected');
    DOM.connectionStatus.textContent = 'غير متصل';
  } finally {
    setLoading(false);
  }
}

function renderSidebarNav() {
  DOM.dynamicNavMenu.innerHTML = '';
  const sheetNames = Object.keys(STATE.schemas);

  if (sheetNames.length === 0) {
    DOM.dynamicNavMenu.innerHTML = '<div class="nav-loading">لا توجد تبويبات حالياً. اضغط على "إنشاء تبويب جديد".</div>';
    return;
  }

  sheetNames.forEach(sheetName => {
    const btn = document.createElement('button');
    btn.className = `nav-item ${STATE.currentSheet === sheetName ? 'active' : ''}`;
    btn.innerHTML = `<span>📑 ${sheetName}</span>`;
    btn.addEventListener('click', () => selectSheet(sheetName));
    DOM.dynamicNavMenu.appendChild(btn);
  });
}

function selectSheet(sheetName) {
  STATE.currentSheet = sheetName;
  STATE.pendingImages = {};
  switchView('dynamicContent');

  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.textContent.includes(sheetName));
  });

  DOM.pageTitle.textContent = sheetName;
  DOM.pageDesc.textContent = `إدارة وتعديل السجلات الخاصة بـ ${sheetName}`;
  DOM.formSectionTitle.textContent = `إضافة سجل جديد في (${sheetName})`;
  DOM.tableSectionTitle.textContent = `سجلات (${sheetName})`;

  buildDynamicForm(STATE.schemas[sheetName]);
  loadSheetRecords(sheetName);
}

function buildDynamicForm(columns) {
  DOM.dynamicFormFields.innerHTML = '';
  if (!columns || !Array.isArray(columns)) return;

  columns.forEach(col => {
    const group = document.createElement('div');
    group.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = col.name;
    group.appendChild(label);

    if (col.type === 'image') {
      const uploadBox = document.createElement('div');
      uploadBox.className = 'image-upload-wrapper';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.className = 'image-file-input';

      const previewBox = document.createElement('div');
      previewBox.className = 'image-preview-box';
      const previewImg = document.createElement('img');
      previewBox.appendChild(previewImg);

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            STATE.pendingImages[col.name] = event.target.result;
            previewImg.src = event.target.result;
            previewBox.classList.add('active');
          };
          reader.readAsDataURL(file);
        }
      });

      uploadBox.appendChild(fileInput);
      uploadBox.appendChild(previewBox);
      group.appendChild(uploadBox);

    } else if (col.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.rows = 3;
      textarea.name = col.name;
      textarea.placeholder = `أدخل ${col.name}...`;
      group.appendChild(textarea);

    } else {
      const input = document.createElement('input');
      if (col.type === 'number') input.type = 'number';
      else if (col.type === 'date') input.type = 'date';
      else if (col.type === 'url') input.type = 'url';
      else input.type = 'text';

      input.name = col.name;
      input.placeholder = `أدخل ${col.name}...`;
      group.appendChild(input);
    }

    DOM.dynamicFormFields.appendChild(group);
  });
}

async function handleInsertRecord(e) {
  e.preventDefault();
  if (!STATE.apiUrl || !STATE.currentSheet) return;

  const formData = new FormData(DOM.dynamicRecordForm);
  const data = {};
  formData.forEach((val, key) => data[key] = val);

  Object.keys(STATE.pendingImages).forEach(imgCol => {
    data[imgCol] = STATE.pendingImages[imgCol];
  });

  setLoading(true, 'جاري رفع الصورة إلى Google Drive وتحديث البيانات...');

  try {
    const res = await fetch(STATE.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'insert_record',
        sheetName: STATE.currentSheet,
        data: data
      })
    });

    const json = await res.json();
    if (json.status === 'success') {
      showToast('تمت الإضافة وحفظت الصورة على Google Drive بنجاح! 📁', 'success');
      DOM.dynamicRecordForm.reset();
      STATE.pendingImages = {};
      document.querySelectorAll('.image-preview-box').forEach(el => el.classList.remove('active'));
      loadSheetRecords(STATE.currentSheet);
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    showToast('فشل الحفظ: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadSheetRecords(sheetName) {
  DOM.dynamicTableHead.innerHTML = '';
  DOM.dynamicTableBody.innerHTML = '<tr><td class="empty-cell">جاري جلب أحدث السجلات...</td></tr>';

  try {
    const res = await fetch(`${STATE.apiUrl}?action=fetch_data&sheet=${encodeURIComponent(sheetName)}`);
    const json = await res.json();

    if (json.status === 'success' && Array.isArray(json.data)) {
      renderTable(json.data, STATE.schemas[sheetName]);
    } else {
      DOM.dynamicTableBody.innerHTML = '<tr><td class="empty-cell">لا توجد بيانات مسجلة.</td></tr>';
    }
  } catch (err) {
    DOM.dynamicTableBody.innerHTML = '<tr><td class="empty-cell">تعذر تحميل السجلات.</td></tr>';
  }
}

function renderTable(data, columns) {
  DOM.recordCountBadge.textContent = `${data.length} سجل`;

  if (data.length === 0) {
    DOM.dynamicTableBody.innerHTML = '<tr><td class="empty-cell">الجدول فارغ حتى الآن. أضف أول سجل من النموذج المجاور.</td></tr>';
    return;
  }

  const allHeaders = ['ID', ...columns.map(c => c.name), 'Created At'];
  let theadHtml = '<tr>';
  allHeaders.forEach(h => theadHtml += `<th>${h}</th>`);
  theadHtml += '</tr>';
  DOM.dynamicTableHead.innerHTML = theadHtml;

  DOM.dynamicTableBody.innerHTML = '';
  [...data].reverse().forEach(row => {
    const tr = document.createElement('tr');

    allHeaders.forEach(header => {
      const td = document.createElement('td');
      const val = row[header] || '';
      const colMeta = columns.find(c => c.name === header);

      if (colMeta && colMeta.type === 'image' && val.toString().startsWith('http')) {
        td.innerHTML = `
          <a href="${val}" target="_blank" title="عرض الصورة بالحجم الكامل">
            <img src="${val}" class="table-img-thumb" alt="Thumbnail" onerror="this.src='https://placehold.co/44x44?text=Img'">
          </a>`;
      } else if (colMeta && colMeta.type === 'url' && val.toString().startsWith('http')) {
        td.innerHTML = `<a href="${val}" target="_blank" class="badge">فتح الرابط ↗</a>`;
      } else {
        td.textContent = val;
      }
      tr.appendChild(td);
    });

    DOM.dynamicTableBody.appendChild(tr);
  });
}

async function handleCreateSchema(e) {
  e.preventDefault();
  const sheetName = DOM.newSheetName.value.trim();
  if (!sheetName) return;

  const rows = DOM.columnsList.querySelectorAll('.column-item-row');
  const columns = [];

  rows.forEach(r => {
    const name = r.querySelector('.col-name').value.trim();
    const type = r.querySelector('.col-type').value;
    if (name) columns.push({ name, type });
  });

  if (columns.length === 0) {
    showToast('يجب تحديد عمود واحد على الأقل.', 'error');
    return;
  }

  setLoading(true, `جاري إنشاء التبويب "${sheetName}" في Google Sheets...`);

  try {
    const res = await fetch(STATE.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'create_schema',
        sheetName: sheetName,
        columns: columns
      })
    });

    const json = await res.json();
    if (json.status === 'success') {
      showToast(json.message, 'success');
      DOM.newSheetName.value = '';
      await fetchSchemasAndInit();
      selectSheet(sheetName);
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    showToast('فشل إنشاء الجدول: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function switchView(viewName) {
  Object.values(DOM.views).forEach(v => v.classList.remove('active'));
  if (DOM.views[viewName]) {
    DOM.views[viewName].classList.add('active');
  }
  if (window.innerWidth <= 768) {
    DOM.sidebar.classList.remove('open');
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span> <span>${message}</span>`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function setLoading(isLoading, message = 'جاري التحميل...') {
  if (isLoading) {
    DOM.loadingMessage.textContent = message;
    DOM.loadingOverlay.classList.add('active');
  } else {
    DOM.loadingOverlay.classList.remove('active');
  }
}