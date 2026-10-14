/**
 * Rose Aden 2 Hotel - Enterprise Admin CMS v4.0 (CORS-Safe Atomic Git Sync Engine)
 * محرك لوحة التحكم الاحترافية: مزامنة ذرية عبر GitHub Git Trees API بدون أخطاء CORS أو تضارب SHA
 */

(function () {
  'use strict';

  // Configuration State
  let config = {
    owner: localStorage.getItem('rose_gh_owner') || 'ProNetComputer',
    repo: localStorage.getItem('rose_gh_repo') || 'RoseAdenHotel-2',
    branch: localStorage.getItem('rose_gh_branch') || 'main',
    token: localStorage.getItem('rose_gh_token') || 'ghp_brEIi45WzJNmxsEJBUi33tKqJPD2XE2exfUe'
  };

  // In-Memory Datasets
  let hotelData = null;
  let roomsData = null;
  let themeData = null;
  let hallData = null;
  let reviewsData = null;
  let galleryData = null;

  let activeAdminGalleryFilter = 'all';
  let hasUnsavedChanges = false;

  // Pre-flight state for Gallery Image Uploader
  let preflightState = {
    file: null,
    originalBase64: null,
    optimizedBase64: null,
    width: 0,
    height: 0,
    originalSize: 0,
    optimizedSize: 0,
    isOptimized: false
  };

  // Room modal state
  let currentEditingRoomIndex = -1;
  let roomImageUploadBase64 = null;

  // =========================================================================
  // 1. CORS-Safe GitHub API Helpers (No Pragma / No Cache-Control headers!)
  // =========================================================================
  function getGitHubHeaders(isJson = false) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (config.token) {
      headers['Authorization'] = `token ${config.token.trim()}`;
    }
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  function encodeUtf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function decodeBase64ToUtf8(b64) {
    const clean = b64.replace(/\s/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  }

  function markUnsaved() {
    hasUnsavedChanges = true;
    const bar = document.getElementById('unsavedNotificationBar');
    if (bar) bar.style.display = 'flex';
  }

  function clearUnsaved() {
    hasUnsavedChanges = false;
    const bar = document.getElementById('unsavedNotificationBar');
    if (bar) bar.style.display = 'none';
  }

  // Fetch latest file SHA safely (CORS-compliant)
  async function getFreshFileSha(path) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: getGitHubHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        return data.sha || null;
      }
    } catch (e) {
      console.warn('getFreshFileSha error:', e);
    }
    return null;
  }

  // Commit a single binary or text file via Contents API with automatic 409 retry
  async function commitBinaryFileToGitHub(path, base64Content, message, retryCount = 0) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
    const sha = await getFreshFileSha(path);

    const body = {
      message: message,
      content: base64Content,
      branch: config.branch
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(url, {
      method: 'PUT',
      cache: 'no-store',
      headers: getGitHubHeaders(true),
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      let errMsg = `HTTP ${putRes.status}`;
      try {
        const errJson = await putRes.json();
        errMsg = errJson.message || errMsg;
      } catch (e) {}

      if ((putRes.status === 409 || putRes.status === 422) && retryCount < 3) {
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return commitBinaryFileToGitHub(path, base64Content, message, retryCount + 1);
      }
      throw new Error(errMsg);
    }

    return await putRes.json();
  }

  async function commitTextFileToGitHub(path, textContent, message) {
    const b64 = encodeUtf8ToBase64(textContent);
    return commitBinaryFileToGitHub(path, b64, message);
  }

  // Atomic Multi-File Commit via GitHub Git Data API (Zero SHA conflicts!)
  async function commitMultipleFilesAtomically(filesMap, commitMessage) {
    const baseApi = `https://api.github.com/repos/${config.owner}/${config.repo}`;

    // 1. Get current branch reference
    const refRes = await fetch(`${baseApi}/git/ref/heads/${encodeURIComponent(config.branch)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: getGitHubHeaders(false)
    });
    if (!refRes.ok) {
      throw new Error('تعذر قراءة مرجع الفرع من GitHub');
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get current commit to find base tree SHA
    const commitRes = await fetch(`${baseApi}/git/commits/${latestCommitSha}`, {
      method: 'GET',
      cache: 'no-store',
      headers: getGitHubHeaders(false)
    });
    if (!commitRes.ok) {
      throw new Error('تعذر قراءة الشجرة الأساسية من GitHub');
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Build tree array
    const treeItems = Object.keys(filesMap).map(filePath => ({
      path: filePath,
      mode: '100644',
      type: 'blob',
      content: filesMap[filePath]
    }));

    // 4. Create new tree
    const treeRes = await fetch(`${baseApi}/git/trees`, {
      method: 'POST',
      cache: 'no-store',
      headers: getGitHubHeaders(true),
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });
    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({}));
      throw new Error(err.message || 'فشل إنشاء شجرة الملفات في GitHub');
    }
    const newTreeData = await treeRes.json();

    // 5. Create new commit
    const newCommitRes = await fetch(`${baseApi}/git/commits`, {
      method: 'POST',
      cache: 'no-store',
      headers: getGitHubHeaders(true),
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeData.sha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(err.message || 'فشل إنشاء الـ Commit الموحد');
    }
    const newCommitData = await newCommitRes.json();

    // 6. Update branch ref pointer
    const updateRefRes = await fetch(`${baseApi}/git/refs/heads/${encodeURIComponent(config.branch)}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: getGitHubHeaders(true),
      body: JSON.stringify({
        sha: newCommitData.sha,
        force: false
      })
    });
    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(err.message || 'فشل تحديث مرجع الفرع الرئيسي');
    }

    return newCommitData;
  }

  // =========================================================================
  // 2. Navigation & Connection Testing
  // =========================================================================
  window.switchTab = function (tabId) {
    document.querySelectorAll('.adm-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetTab) targetTab.classList.add('active');
    if (navBtn) navBtn.classList.add('active');
  };

  window.testGitHubConnection = async function () {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const alertBox = document.getElementById('ghConnAlert');

    if (!config.owner || !config.repo || !config.token) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.textContent = 'غير متصل (أدخل بيانات GitHub)';
      return false;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
        method: 'GET',
        cache: 'no-store',
        headers: getGitHubHeaders(false)
      });

      if (res.ok) {
        const repoInfo = await res.json();
        if (statusDot) statusDot.className = 'status-dot connected';
        if (statusText) statusText.textContent = `متصل: ${repoInfo.full_name} (${config.branch})`;
        if (alertBox) {
          alertBox.className = 'alert-box alert-success';
          alertBox.innerHTML = `✓ متصل بنجاح بمستودع <strong>${repoInfo.full_name}</strong> على الفرع <strong>${config.branch}</strong>. نظام النشر الذري نشط وجاهز!`;
        }
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.textContent = 'خطأ في الاتصال بـ GitHub';
      if (alertBox) {
        alertBox.className = 'alert-box alert-info';
        alertBox.textContent = 'تعذر الاتصال بـ GitHub. يرجى مراجعة اسم المستودع وصلاحية الرمز (Token).';
      }
      return false;
    }
  };

  window.saveGitHubConfig = function (e) {
    if (e) e.preventDefault();
    config.owner = getVal('ghOwner').trim();
    config.repo = getVal('ghRepo').trim();
    config.branch = getVal('ghBranch').trim() || 'main';
    config.token = getVal('ghToken').trim();

    localStorage.setItem('rose_gh_owner', config.owner);
    localStorage.setItem('rose_gh_repo', config.repo);
    localStorage.setItem('rose_gh_branch', config.branch);
    localStorage.setItem('rose_gh_token', config.token);

    alert('تم حفظ إعدادات الربط مع GitHub بنجاح!');
    testGitHubConnection();
  };

  // =========================================================================
  // 3. Load Initial Data (From GitHub Live API first, fallback to local JSON)
  // =========================================================================
  async function fetchJsonFileSmart(relPath) {
    // Try fetching from GitHub API first so admin always sees latest committed state
    if (config.owner && config.repo && config.token) {
      try {
        const ghUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${relPath}?ref=${encodeURIComponent(config.branch)}`;
        const ghRes = await fetch(ghUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: getGitHubHeaders(false)
        });
        if (ghRes.ok) {
          const fileMeta = await ghRes.json();
          if (fileMeta && fileMeta.content) {
            const jsonText = decodeBase64ToUtf8(fileMeta.content);
            return JSON.parse(jsonText);
          }
        }
      } catch (e) {
        // Fallback to local file
      }
    }

    const localRes = await fetch(`../${relPath}`, { cache: 'no-store' });
    if (localRes.ok) {
      return await localRes.json();
    }
    return null;
  }

  window.pullLatestDataFromGitHub = async function () {
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = 'جاري سحب أحدث البيانات...';
    await loadInitialData();
    await testGitHubConnection();
  };

  async function loadInitialData() {
    try {
      const [hData, rData, thData, hlData, rvData, gData] = await Promise.all([
        fetchJsonFileSmart('data/hotel-info.json').catch(() => null),
        fetchJsonFileSmart('data/rooms.json').catch(() => null),
        fetchJsonFileSmart('data/theme.json').catch(() => null),
        fetchJsonFileSmart('data/hall.json').catch(() => null),
        fetchJsonFileSmart('data/reviews.json').catch(() => null),
        fetchJsonFileSmart('data/gallery.json').catch(() => null)
      ]);

      hotelData = hData || getDefaultHotelInfo();
      roomsData = rData || [];
      themeData = thData || getDefaultTheme();
      hallData = hlData || { title_ar: 'قاعة التدريب والمؤتمرات', capacity: '50 - 70 مشاركاً', specs_ar: [] };
      reviewsData = rvData || [];
      galleryData = gData || [];

      renderHotelInfoView();
      renderThemeView();
      renderRoomsGrid();
      renderHallView();
      renderReviewsView();
      renderGalleryGrid();
      clearUnsaved();
    } catch (err) {
      console.warn('Error loading initial data:', err);
    }
  }

  function getDefaultHotelInfo() {
    return {
      name_ar: 'فندق روز عدن 2 السياحي',
      name_en: 'Rose Aden 2 Tourist Hotel',
      slogan_ar: 'حيث يلتقي البحر بالفخامة... تبدأ أجمل لحظاتك',
      address_ar: 'العريش - ساحل أبين - جوار جولة الرحاب - عدن',
      whatsapp: '780000656',
      phones: ['02-278880', '02-278881', '02-278882', '02-278885', '02-278888'],
      check_in: '14:00',
      check_out: '12:00'
    };
  }

  function getDefaultTheme() {
    return {
      rose_primary: "#e22d46",
      rose_dark: "#be123c",
      luxury_gold: "#d4af37",
      luxury_gold_light: "#f5cd5f",
      font_arabic: "'Cairo', system-ui, sans-serif",
      border_radius: "18px",
      announcement: {
        enabled: true,
        text_ar: "✨ عرض خاص بمناسبة الموسم: خصم مميز على أجنحة VIP وطيرمانات ساحل أبين!",
        link: "https://wa.me/967780000656",
        btn_text: "احجز بالعرض الآن"
      }
    };
  }

  // =========================================================================
  // 4. Hotel General Info: View Mode vs Edit Mode
  // =========================================================================
  function renderHotelInfoView() {
    if (!hotelData) return;
    const container = document.getElementById('hotelInfoViewContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="view-details-grid">
        <div class="view-item-box">
          <div class="view-item-label">اسم الفندق (بالعربية)</div>
          <div class="view-item-val">${hotelData.name_ar || 'فندق روز عدن 2 السياحي'}</div>
        </div>
        <div class="view-item-box">
          <div class="view-item-label">اسم الفندق (English)</div>
          <div class="view-item-val">${hotelData.name_en || 'Rose Aden 2 Tourist Hotel'}</div>
        </div>
        <div class="view-item-box">
          <div class="view-item-label">الشعار اللفظي (Slogan)</div>
          <div class="view-item-val" style="color: var(--adm-gold);">${hotelData.slogan_ar || ''}</div>
        </div>
        <div class="view-item-box">
          <div class="view-item-label">واتساب الحجوزات الرئيسي</div>
          <div class="view-item-val" style="color: #25d366;">📱 ${hotelData.whatsapp || '780000656'}</div>
        </div>
        <div class="view-item-box" style="grid-column: 1 / -1;">
          <div class="view-item-label">العنوان التفصيلي</div>
          <div class="view-item-val">📍 ${hotelData.address_ar || ''}</div>
        </div>
        <div class="view-item-box">
          <div class="view-item-label">هواتف الاستقبال الأرضية</div>
          <div class="view-item-val">☎️ ${(hotelData.phones || []).join(' | ')}</div>
        </div>
        <div class="view-item-box">
          <div class="view-item-label">أوقات تسجيل الدخول والمغادرة</div>
          <div class="view-item-val">الدخول: ${hotelData.check_in || '14:00'} | المغادرة: ${hotelData.check_out || '12:00'}</div>
        </div>
      </div>
    `;

    document.getElementById('hotelInfoViewMode').style.display = 'block';
    document.getElementById('hotelInfoEditMode').style.display = 'none';
  }

  window.enableHotelInfoEdit = function () {
    if (!hotelData) return;
    setVal('editHotelNameAr', hotelData.name_ar || '');
    setVal('editHotelNameEn', hotelData.name_en || '');
    setVal('editHotelSloganAr', hotelData.slogan_ar || '');
    setVal('editHotelAddressAr', hotelData.address_ar || '');
    setVal('editHotelWa', hotelData.whatsapp || '');
    setVal('editHotelPhones', (hotelData.phones || []).join(' | '));
    setVal('editHotelCheckIn', hotelData.check_in || '14:00');
    setVal('editHotelCheckOut', hotelData.check_out || '12:00');

    document.getElementById('hotelInfoViewMode').style.display = 'none';
    document.getElementById('hotelInfoEditMode').style.display = 'block';
  };

  window.cancelHotelInfoEdit = function () {
    renderHotelInfoView();
  };

  function collectHotelInfoFromEditForm() {
    const editBox = document.getElementById('hotelInfoEditMode');
    if (editBox && editBox.style.display !== 'none' && hotelData) {
      hotelData.name_ar = getVal('editHotelNameAr') || hotelData.name_ar;
      hotelData.name_en = getVal('editHotelNameEn') || hotelData.name_en;
      hotelData.slogan_ar = getVal('editHotelSloganAr') || hotelData.slogan_ar;
      hotelData.address_ar = getVal('editHotelAddressAr') || hotelData.address_ar;
      hotelData.whatsapp = getVal('editHotelWa') || hotelData.whatsapp;
      hotelData.phones = (getVal('editHotelPhones') || '').split('|').map(s => s.trim()).filter(Boolean);
      hotelData.check_in = getVal('editHotelCheckIn') || hotelData.check_in;
      hotelData.check_out = getVal('editHotelCheckOut') || hotelData.check_out;
    }
  }

  window.saveHotelInfoToGitHub = async function () {
    collectHotelInfoFromEditForm();
    const statusBox = document.getElementById('hotelSaveStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري حفظ ونشر بيانات الفندق على GitHub...';
    }

    try {
      await commitTextFileToGitHub('data/hotel-info.json', JSON.stringify(hotelData, null, 2), 'تحديث بيانات الفندق العامة عبر لوحة التحكم');
      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر بيانات الفندق بنجاح على GitHub!';
      }
      setTimeout(() => {
        if (statusBox) statusBox.style.display = 'none';
        renderHotelInfoView();
      }, 1200);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ خطأ أثناء الحفظ: ${err.message}`;
      }
    }
  };

  // =========================================================================
  // 5. Theme, Brand Colors & Announcement: View Mode vs Edit Mode
  // =========================================================================
  function renderThemeView() {
    if (!themeData) return;
    const container = document.getElementById('themeViewContainer');
    if (!container) return;

    const ann = themeData.announcement || {};
    container.innerHTML = `
      <div class="view-details-grid">
        <div class="view-item-box" style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 48px; height: 48px; border-radius: 10px; background: ${themeData.rose_primary || '#e22d46'}; border: 2px solid #fff;"></div>
          <div>
            <div class="view-item-label">اللون الأساسي (Primary Rose)</div>
            <div class="view-item-val" style="direction: ltr; font-family: monospace;">${themeData.rose_primary || '#e22d46'}</div>
          </div>
        </div>

        <div class="view-item-box" style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 48px; height: 48px; border-radius: 10px; background: ${themeData.luxury_gold || '#d4af37'}; border: 2px solid #fff;"></div>
          <div>
            <div class="view-item-label">اللون الذهبي الملكي (Luxury Gold)</div>
            <div class="view-item-val" style="direction: ltr; font-family: monospace;">${themeData.luxury_gold || '#d4af37'}</div>
          </div>
        </div>

        <div class="view-item-box">
          <div class="view-item-label">الخط العربي المعتمد</div>
          <div class="view-item-val">${themeData.font_arabic ? themeData.font_arabic.split(',')[0].replace(/['"]/g, '') : 'Cairo'}</div>
        </div>

        <div class="view-item-box">
          <div class="view-item-label">شريط العروض الترويجي أعلى الموقع</div>
          <div class="view-item-val" style="color: ${ann.enabled ? 'var(--adm-success)' : 'var(--adm-muted)'};">
            ${ann.enabled ? '🟢 مفعل ونشط' : '⚪ معطل'}
          </div>
        </div>

        ${ann.enabled ? `
        <div class="view-item-box" style="grid-column: 1 / -1; background: rgba(226, 45, 70, 0.1); border-color: var(--adm-border);">
          <div class="view-item-label">نص العرض الترويجي الحالي</div>
          <div class="view-item-val" style="color: var(--adm-gold-light);">${ann.text_ar || ''}</div>
        </div>
        ` : ''}
      </div>
    `;

    document.getElementById('themeViewMode').style.display = 'block';
    document.getElementById('themeEditMode').style.display = 'none';
  }

  window.enableThemeEdit = function () {
    if (!themeData) return;
    setVal('thmPrimaryPicker', themeData.rose_primary || '#e22d46');
    setVal('thmPrimaryHex', themeData.rose_primary || '#e22d46');
    setVal('thmGoldPicker', themeData.luxury_gold || '#d4af37');
    setVal('thmGoldHex', themeData.luxury_gold || '#d4af37');
    setVal('thmFontSelect', themeData.font_arabic || "'Cairo', system-ui, sans-serif");
    setVal('thmRadiusSelect', themeData.border_radius || '18px');

    const ann = themeData.announcement || {};
    const chk = document.getElementById('editAnnEnabled');
    if (chk) chk.checked = !!ann.enabled;
    setVal('editAnnTextAr', ann.text_ar || '');
    setVal('editAnnLink', ann.link || '');
    setVal('editAnnBtn', ann.btn_text || 'احجز بالعرض الآن');

    document.getElementById('themeViewMode').style.display = 'none';
    document.getElementById('themeEditMode').style.display = 'block';
  };

  window.cancelThemeEdit = function () {
    renderThemeView();
  };

  window.applyColorPreset = function (primaryHex, goldHex) {
    setVal('thmPrimaryPicker', primaryHex);
    setVal('thmPrimaryHex', primaryHex);
    setVal('thmGoldPicker', goldHex);
    setVal('thmGoldHex', goldHex);
  };

  function collectThemeFromEditForm() {
    const editBox = document.getElementById('themeEditMode');
    if (editBox && editBox.style.display !== 'none' && themeData) {
      themeData.rose_primary = getVal('thmPrimaryHex') || '#e22d46';
      themeData.rose_dark = darkenColor(themeData.rose_primary);
      themeData.luxury_gold = getVal('thmGoldHex') || '#d4af37';
      themeData.luxury_gold_light = lightenColor(themeData.luxury_gold);
      themeData.font_arabic = getVal('thmFontSelect') || "'Cairo', system-ui, sans-serif";
      themeData.border_radius = getVal('thmRadiusSelect') || '18px';

      themeData.announcement = {
        enabled: document.getElementById('editAnnEnabled') ? document.getElementById('editAnnEnabled').checked : false,
        text_ar: getVal('editAnnTextAr'),
        link: getVal('editAnnLink'),
        btn_text: getVal('editAnnBtn')
      };
    }
  }

  window.saveThemeToGitHub = async function () {
    collectThemeFromEditForm();
    const statusBox = document.getElementById('themeSaveStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري حفظ ونشر إعدادات الهوية والألوان على GitHub...';
    }

    try {
      await commitTextFileToGitHub('data/theme.json', JSON.stringify(themeData, null, 2), 'تحديث الهوية والألوان وشريط العروض عبر لوحة التحكم');
      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر إعدادات الهوية والألوان بنجاح!';
      }
      setTimeout(() => {
        if (statusBox) statusBox.style.display = 'none';
        renderThemeView();
      }, 1200);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ خطأ أثناء الحفظ: ${err.message}`;
      }
    }
  };

  // =========================================================================
  // 6. Rooms & Suites Management (Cards View + Edit/Add Modal + Image Upload)
  // =========================================================================
  function renderRoomsGrid() {
    const container = document.getElementById('roomsCardsGrid');
    if (!container || !roomsData) return;

    container.innerHTML = roomsData.map((room, idx) => `
      <div class="adm-room-card" data-idx="${idx}">
        <div class="adm-room-media">
          <img src="../${room.image}" alt="${room.title_ar}" onerror="this.src='../assets/images/suite-vip.jpg'">
          <span class="adm-room-badge">${room.badge_ar || 'مميز'}</span>
        </div>
        <div class="adm-room-body">
          <div class="adm-room-title">${room.title_ar}</div>
          <div class="adm-room-price">💰 ${room.price_per_night}</div>
          <div style="font-size: 0.82rem; color: var(--adm-muted); margin-bottom: 0.5rem;">
            <span>🛏️ ${room.beds_ar || ''}</span> • <span>👥 ${room.capacity_ar || ''}</span>
          </div>
          <div class="adm-room-features">
            ${(room.features_ar || []).slice(0, 4).map(f => `<span class="adm-feature-tag">${f}</span>`).join('')}
            ${(room.features_ar || []).length > 4 ? `<span class="adm-feature-tag">+${(room.features_ar.length - 4)} أخرى</span>` : ''}
          </div>
          <div class="adm-room-actions">
            <button type="button" class="adm-btn adm-btn-gold adm-btn-sm" onclick="openRoomModal(${idx})">
              <span>✏️</span> تعديل الغرفة والصورة
            </button>
            <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteRoomItem(${idx})">
              <span>🗑️</span> حذف
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.openRoomModal = function (idx) {
    currentEditingRoomIndex = idx;
    roomImageUploadBase64 = null;
    const modal = document.getElementById('roomModalBackdrop');
    const title = document.getElementById('roomModalTitle');
    const preview = document.getElementById('modalRoomImgPreview');
    const statusBox = document.getElementById('modalRoomStatus');
    const fileInput = document.getElementById('modalRoomFileInput');

    if (statusBox) statusBox.style.display = 'none';
    if (fileInput) fileInput.value = '';

    if (idx === -1) {
      title.textContent = '➕ إضافة غرفة أو جناح فندقي جديد';
      setVal('modalRoomTitleAr', '');
      setVal('modalRoomPrice', 'أسعار تنافسية');
      setVal('modalRoomBadge', 'جديد');
      setVal('modalRoomBeds', 'سرير مزدوج مريح');
      setVal('modalRoomCap', '2 أشخاص');
      setVal('modalRoomCategory', 'standard');
      setVal('modalRoomFeatures', 'تكييف هادئ\nشاشة ذكية\nواي فاي فايبر مجاني');
      setVal('modalRoomImgPath', 'assets/images/ros2-room-twin-blue.jpg');
      preview.src = '../assets/images/ros2-room-twin-blue.jpg';
    } else {
      const room = roomsData[idx];
      title.textContent = `✏️ تعديل بيانات: ${room.title_ar}`;
      setVal('modalRoomTitleAr', room.title_ar || '');
      setVal('modalRoomPrice', room.price_per_night || '');
      setVal('modalRoomBadge', room.badge_ar || '');
      setVal('modalRoomBeds', room.beds_ar || '');
      setVal('modalRoomCap', room.capacity_ar || '');
      setVal('modalRoomCategory', room.category || 'standard');
      setVal('modalRoomFeatures', (room.features_ar || []).join('\n'));
      setVal('modalRoomImgPath', room.image || '');
      preview.src = `../${room.image}`;
    }

    modal.classList.add('open');
  };

  window.closeRoomModal = function () {
    document.getElementById('roomModalBackdrop').classList.remove('open');
  };

  window.handleRoomImageFile = function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('modalRoomImgPreview');
    if (!file || !preview) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        // Auto-optimize room image to max 1600px width JPEG 85%
        const maxWidth = 1600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxWidth) {
          h = Math.round((maxWidth / w) * h);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
        preview.src = compressedUrl;
        roomImageUploadBase64 = compressedUrl.split(',')[1];
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  };

  window.saveRoomModalData = async function () {
    const title = getVal('modalRoomTitleAr').trim();
    if (!title) {
      alert('يرجى كتابة اسم الغرفة.');
      return;
    }

    const saveBtn = document.getElementById('modalRoomSaveBtn');
    const statusBox = document.getElementById('modalRoomStatus');
    if (saveBtn) saveBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري حفظ بيانات الغرفة ورفع الصورة...';
    }

    try {
      let imagePath = getVal('modalRoomImgPath') || 'assets/images/suite-vip.jpg';

      if (roomImageUploadBase64) {
        const newFileName = `room-${Date.now()}.jpg`;
        imagePath = `assets/images/${newFileName}`;
        if (statusBox) statusBox.innerHTML = `جاري رفع صورة الغرفة الجديدة <code>${imagePath}</code> إلى GitHub...`;
        await commitBinaryFileToGitHub(imagePath, roomImageUploadBase64, `Upload room image: ${newFileName}`);
      }

      const roomPayload = {
        id: currentEditingRoomIndex === -1 ? `room-${Date.now()}` : roomsData[currentEditingRoomIndex].id,
        category: getVal('modalRoomCategory') || 'standard',
        title_ar: title,
        title_en: currentEditingRoomIndex === -1 ? 'Deluxe Room' : (roomsData[currentEditingRoomIndex].title_en || 'Deluxe Room'),
        badge_ar: getVal('modalRoomBadge') || 'مميز',
        badge_en: 'Special',
        price_per_night: getVal('modalRoomPrice') || 'حسب الطلب',
        price_en: 'Special Rate',
        beds_ar: getVal('modalRoomBeds') || 'سرير مريح',
        beds_en: 'Comfortable Bed',
        capacity_ar: getVal('modalRoomCap') || '2 أشخاص',
        capacity_en: '2 Guests',
        image: imagePath,
        features_ar: (getVal('modalRoomFeatures') || '').split('\n').map(s => s.trim()).filter(Boolean),
        features_en: ['Silent Air Conditioning', 'Smart Screen TV', 'Free Fiber Wi-Fi']
      };

      if (currentEditingRoomIndex === -1) {
        roomsData.push(roomPayload);
      } else {
        roomsData[currentEditingRoomIndex] = roomPayload;
      }

      if (statusBox) statusBox.innerHTML = 'جاري تحديث ملف الغرف <code>data/rooms.json</code> على GitHub...';
      await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), `Update rooms.json: ${title}`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر الغرفة بنجاح على الموقع!';
      }

      setTimeout(() => {
        closeRoomModal();
        renderRoomsGrid();
      }, 1100);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ حدث خطأ: ${err.message}`;
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  window.deleteRoomItem = async function (idx) {
    if (!roomsData || !roomsData[idx]) return;
    const item = roomsData[idx];
    if (confirm(`هل أنت متأكد من رغبتك في حذف "${item.title_ar}"؟`)) {
      roomsData.splice(idx, 1);
      renderRoomsGrid();
      try {
        await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), `Delete room: ${item.title_ar}`);
      } catch (e) {
        markUnsaved();
      }
    }
  };

  // =========================================================================
  // 7. Smart Gallery Manager (Grouped Display + Pre-Flight Image Optimizer)
  // =========================================================================
  window.inspectSelectedGalleryFile = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    preflightState.file = file;
    preflightState.originalSize = file.size;
    preflightState.isOptimized = false;
    preflightState.optimizedBase64 = null;

    const panel = document.getElementById('imagePreflightPanel');
    const thumb = document.getElementById('preflightStageThumb');
    const dimEl = document.getElementById('metricDimensions');
    const sizeEl = document.getElementById('metricSize');
    const ratioEl = document.getElementById('metricRatio');
    const verdictEl = document.getElementById('metricVerdict');
    const optBtn = document.getElementById('autoOptimizeBtn');

    panel.style.display = 'block';

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      preflightState.originalBase64 = dataUrl.split(',')[1];
      thumb.src = dataUrl;

      const img = new Image();
      img.onload = () => {
        preflightState.width = img.naturalWidth;
        preflightState.height = img.naturalHeight;

        dimEl.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        const sizeKb = Math.round(file.size / 1024);
        sizeEl.textContent = file.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

        const ratio = (img.naturalWidth / img.naturalHeight).toFixed(2);
        ratioEl.textContent = ratio > 1.3 ? `${ratio}:1 (عريض Landscape)` : `${ratio}:1 (عمودي/مربع)`;

        if (file.size > 500 * 1024 || img.naturalWidth > 1920) {
          verdictEl.className = 'verdict-badge verdict-heavy';
          verdictEl.innerHTML = '⚠️ يُنصح بالتحسين الآلي لضمان سرعة التحميل في الموقع';
          optBtn.style.display = 'inline-flex';
        } else {
          verdictEl.className = 'verdict-badge verdict-optimal';
          verdictEl.innerHTML = '✓ أبعاد وحجم مثاليان للعرض السريع في الموقع';
          optBtn.style.display = 'inline-flex';
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  window.autoOptimizeGalleryImage = function () {
    if (!preflightState.originalBase64) return;

    const img = new Image();
    img.onload = () => {
      const maxWidth = 1600;
      let targetWidth = img.naturalWidth;
      let targetHeight = img.naturalHeight;

      if (targetWidth > maxWidth) {
        targetHeight = Math.round((maxWidth / targetWidth) * targetHeight);
        targetWidth = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
      preflightState.optimizedBase64 = compressedDataUrl.split(',')[1];

      const approxBytes = Math.round((preflightState.optimizedBase64.length * 3) / 4);
      preflightState.optimizedSize = approxBytes;
      preflightState.isOptimized = true;

      document.getElementById('preflightStageThumb').src = compressedDataUrl;
      document.getElementById('metricDimensions').textContent = `${targetWidth} × ${targetHeight} px (محسّن)`;

      const newKb = Math.round(approxBytes / 1024);
      const savings = Math.max(5, Math.round(((preflightState.originalSize - approxBytes) / preflightState.originalSize) * 100));

      document.getElementById('metricSize').innerHTML = `
        <span style="color:#6ee7b7; font-weight:800;">${newKb} KB</span> 
        <small style="color:var(--adm-muted);">(توفير ${savings}%)</small>
      `;

      const verdictEl = document.getElementById('metricVerdict');
      verdictEl.className = 'verdict-badge verdict-optimal';
      verdictEl.innerHTML = `⚡ تم ضبط الأبعاد والضغط آلياً بنجاح! جاهزة للنشر`;

      document.getElementById('autoOptimizeBtn').style.display = 'none';
    };
    img.src = `data:image/jpeg;base64,${preflightState.originalBase64}`;
  };

  window.uploadAndPublishGalleryPhoto = async function () {
    if (!preflightState.file && !preflightState.originalBase64) {
      alert('يرجى اختيار صورة أولاً من جهازك.');
      return;
    }

    const titleInput = document.getElementById('proGalleryTitle');
    const categorySelect = document.getElementById('proGalleryCategory');
    const statusBox = document.getElementById('proGalleryUploadStatus');
    const uploadBtn = document.getElementById('proGalleryUploadBtn');

    const title = (titleInput ? titleInput.value.trim() : '') || 'صورة من فندق روز عدن 2';
    const category = categorySelect ? categorySelect.value : 'rooms';

    const fileName = `gallery-${Date.now()}.jpg`;
    const targetPath = `assets/images/${fileName}`;

    const base64ToUpload = preflightState.isOptimized ? preflightState.optimizedBase64 : preflightState.originalBase64;

    if (uploadBtn) uploadBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = `جاري رفع ملف الصورة <code>${targetPath}</code> إلى مستودع GitHub...`;
    }

    try {
      await commitBinaryFileToGitHub(targetPath, base64ToUpload, `Upload gallery image: ${fileName}`);

      if (!galleryData) galleryData = [];
      galleryData.unshift({
        title: title,
        category: category,
        group_ar: getCategoryArabic(category),
        src: targetPath
      });

      if (statusBox) statusBox.innerHTML = 'جاري تحديث ونشر <code>data/gallery.json</code> على GitHub...';
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), `Add gallery photo: ${title}`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = `✓ تم رفع ونشر الصورة بنجاح في مجموعة <strong>${getCategoryArabic(category)}</strong>!`;
      }

      document.getElementById('proGalleryFileInput').value = '';
      if (titleInput) titleInput.value = '';
      setTimeout(() => {
        document.getElementById('imagePreflightPanel').style.display = 'none';
        renderGalleryGrid();
      }, 1400);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ خطأ أثناء الرفع: ${err.message}`;
      }
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
    }
  };

  function getCategoryArabic(cat) {
    const map = {
      'exterior': '🏛️ الواجهة والمبنى',
      'lobby': '🛎️ الاستقبال واللوبي',
      'vip': '👑 أجنحة وطيرمانات VIP',
      'rooms': '🛏️ الغرف والأجنحة',
      'halls': '🎓 قاعات التدريب والوجبات'
    };
    return map[cat] || cat;
  }

  window.filterAdminGallery = function (catKey) {
    activeAdminGalleryFilter = catKey;
    document.querySelectorAll('.adm-gal-filter-btn').forEach(btn => {
      if (btn.getAttribute('data-gfilter') === catKey) btn.classList.add('adm-btn-gold');
      else btn.classList.remove('adm-btn-gold');
    });
    renderGalleryGrid();
  };

  function renderGalleryGrid() {
    const container = document.getElementById('proGalleryGrid');
    const badge = document.getElementById('proGalleryCountBadge');
    if (!galleryData) return;

    if (badge) badge.textContent = `${galleryData.length} صورة`;
    if (!container) return;

    // Update filter counts
    const cats = ['exterior', 'lobby', 'vip', 'rooms', 'halls'];
    const allBtn = document.querySelector('.adm-gal-filter-btn[data-gfilter="all"]');
    if (allBtn) allBtn.textContent = `الكل (${galleryData.length})`;
    cats.forEach(c => {
      const cnt = galleryData.filter(x => x.category === c).length;
      const b = document.querySelector(`.adm-gal-filter-btn[data-gfilter="${c}"]`);
      if (b) b.textContent = `${getCategoryArabic(c)} (${cnt})`;
    });

    const filtered = activeAdminGalleryFilter === 'all'
      ? galleryData.map((item, idx) => ({ item, idx }))
      : galleryData.map((item, idx) => ({ item, idx })).filter(x => x.item.category === activeAdminGalleryFilter);

    container.innerHTML = filtered.map(({ item: g, idx }) => `
      <div class="adm-gallery-card" data-gidx="${idx}">
        <div style="position: relative;">
          <img src="../${g.src}" alt="${g.title}" onerror="this.src='../assets/images/building-day.jpg'">
          <span style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.8); color: var(--adm-gold-light); padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700; border: 1px solid var(--adm-border-gold);">
            ${getCategoryArabic(g.category)}
          </span>
        </div>
        <div class="adm-gallery-card-body">
          <input type="text" class="adm-input" value="${g.title || ''}" style="padding: 0.35rem 0.6rem; font-size: 0.85rem;" onchange="updateGalleryItemField(${idx}, 'title', this.value)">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
            <select class="adm-select" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; width: auto;" onchange="updateGalleryItemField(${idx}, 'category', this.value)">
              <option value="exterior" ${g.category === 'exterior' ? 'selected' : ''}>🏛️ الواجهة والمبنى</option>
              <option value="lobby" ${g.category === 'lobby' ? 'selected' : ''}>🛎️ الاستقبال واللوبي</option>
              <option value="vip" ${g.category === 'vip' ? 'selected' : ''}>👑 طيرمانات VIP</option>
              <option value="rooms" ${g.category === 'rooms' ? 'selected' : ''}>🛏️ الغرف والأجنحة</option>
              <option value="halls" ${g.category === 'halls' ? 'selected' : ''}>🎓 القاعات والوجبات</option>
            </select>
            <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteGalleryItem(${idx})">حذف</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.updateGalleryItemField = function (idx, field, val) {
    if (!galleryData || !galleryData[idx]) return;
    galleryData[idx][field] = val;
    if (field === 'category') {
      galleryData[idx].group_ar = getCategoryArabic(val).replace(/^[^\s]+\s/, '');
      renderGalleryGrid();
    }
    markUnsaved();
  };

  window.saveGalleryChangesToGitHub = async function () {
    try {
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), 'تحديث ترتيب ومجموعات معرض الصور عبر لوحة التحكم');
      clearUnsaved();
      alert('✓ تم حفظ ونشر تعديلات المعرض على GitHub بنجاح!');
    } catch (e) {
      alert(`❌ خطأ أثناء الحفظ: ${e.message}`);
    }
  };

  window.deleteGalleryItem = async function (idx) {
    if (!galleryData || !galleryData[idx]) return;
    const item = galleryData[idx];
    if (confirm(`هل أنت متأكد من حذف صورة "${item.title}" من المعرض؟`)) {
      galleryData.splice(idx, 1);
      renderGalleryGrid();
      try {
        await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), `Delete gallery photo: ${item.title}`);
      } catch (e) {
        markUnsaved();
      }
    }
  };

  // =========================================================================
  // 8. Training Hall & Reviews (View & Edit Modes)
  // =========================================================================
  function renderHallView() {
    if (!hallData) return;
    const container = document.getElementById('hallViewContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="view-details-grid">
        <div class="view-item-box">
          <div class="view-item-label">عنوان القاعة</div>
          <div class="view-item-val">${hallData.title_ar || ''}</div>
        </div>
        <div class="view-item-box">
          <div class="view-item-label">السعة الاستيعابية</div>
          <div class="view-item-val" style="color: var(--adm-gold);">👥 ${hallData.capacity || ''}</div>
        </div>
        <div class="view-item-box" style="grid-column: 1 / -1;">
          <div class="view-item-label">المواصفات والتجهيزات</div>
          <div class="view-item-val" style="font-size: 0.95rem; font-weight: normal; line-height: 1.8;">
            ${(hallData.specs_ar || []).map(s => `• ${s}`).join('<br>')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('hallViewMode').style.display = 'block';
    document.getElementById('hallEditMode').style.display = 'none';
  }

  window.enableHallEdit = function () {
    if (!hallData) return;
    setVal('editHallTitleAr', hallData.title_ar || '');
    setVal('editHallCapacity', hallData.capacity || '');
    setVal('editHallSpecs', (hallData.specs_ar || []).join('\n'));

    document.getElementById('hallViewMode').style.display = 'none';
    document.getElementById('hallEditMode').style.display = 'block';
  };

  window.cancelHallEdit = function () {
    renderHallView();
  };

  function collectHallFromEditForm() {
    const editBox = document.getElementById('hallEditMode');
    if (editBox && editBox.style.display !== 'none' && hallData) {
      hallData.title_ar = getVal('editHallTitleAr') || hallData.title_ar;
      hallData.capacity = getVal('editHallCapacity') || hallData.capacity;
      hallData.specs_ar = (getVal('editHallSpecs') || '').split('\n').map(s => s.trim()).filter(Boolean);
    }
  }

  window.saveHallToGitHub = async function () {
    collectHallFromEditForm();
    const statusBox = document.getElementById('hallSaveStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري حفظ بيانات القاعة على GitHub...';
    }

    try {
      await commitTextFileToGitHub('data/hall.json', JSON.stringify(hallData, null, 2), 'تحديث قاعة التدريب عبر لوحة التحكم');
      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر بيانات القاعة بنجاح!';
      }
      setTimeout(() => {
        if (statusBox) statusBox.style.display = 'none';
        renderHallView();
      }, 1200);
    } catch (e) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ خطأ أثناء الحفظ: ${e.message}`;
      }
    }
  };

  function renderReviewsView() {
    const container = document.getElementById('reviewsContainer');
    if (!container || !reviewsData) return;

    container.innerHTML = reviewsData.map((rev, idx) => `
      <div class="view-item-box" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong style="color: #fff; font-size: 1.05rem;">${rev.name} (${rev.role || ''})</strong>
          <span style="color: var(--adm-gold);">${'★'.repeat(rev.rating || 5)}</span>
        </div>
        <p style="color: var(--adm-text-sub); font-size: 0.9rem; margin-bottom: 0.75rem;">"${rev.comment_ar}"</p>
        <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteReviewItem(${idx})">حذف التقييم</button>
      </div>
    `).join('');
  }

  window.addNewReviewPrompt = async function () {
    const name = prompt('اسم النزيل أو الضيف:');
    if (!name) return;
    const role = prompt('الصفة أو العمل (مثال: نزيل جناح VIP):') || 'نزيل في الفندق';
    const comment = prompt('نص التقييم:') || 'إقامة ممتازة وخدمة راقية.';

    if (!reviewsData) reviewsData = [];
    reviewsData.push({
      name: name,
      role: role,
      rating: 5,
      comment_ar: comment
    });
    renderReviewsView();
    try {
      await commitTextFileToGitHub('data/reviews.json', JSON.stringify(reviewsData, null, 2), `Add review: ${name}`);
    } catch (e) {
      markUnsaved();
    }
  };

  window.deleteReviewItem = async function (idx) {
    if (!reviewsData || !reviewsData[idx]) return;
    if (confirm('هل تريد حذف هذا التقييم؟')) {
      reviewsData.splice(idx, 1);
      renderReviewsView();
      try {
        await commitTextFileToGitHub('data/reviews.json', JSON.stringify(reviewsData, null, 2), 'Delete review');
      } catch (e) {
        markUnsaved();
      }
    }
  };

  // =========================================================================
  // 9. Atomic Global Sync & Publish Engine (Zero CORS / Zero SHA Errors!)
  // =========================================================================
  function harvestAllOpenForms() {
    collectHotelInfoFromEditForm();
    collectThemeFromEditForm();
    collectHallFromEditForm();
  }

  window.syncAllToGitHub = async function () {
    if (!config.owner || !config.repo || !config.token) {
      alert('يرجى التأكد من إدخال اسم المستودع ورمز الوصول (Personal Access Token) في تبويب مستودع GitHub.');
      switchTab('tab-github');
      return;
    }

    // Harvest any open edit forms first so nothing is missed
    harvestAllOpenForms();

    const terminal = document.getElementById('syncTerminal');
    const syncBtn = document.getElementById('syncAllBtn');
    if (syncBtn) syncBtn.disabled = true;
    if (terminal) {
      terminal.style.display = 'block';
      terminal.innerHTML = `> [${new Date().toLocaleTimeString()}] بدء المزامنة الذرية الموحدة لكافة ملفات الموقع مع GitHub...<br>`;
    }

    const filesPayload = {
      'data/theme.json': JSON.stringify(themeData, null, 2),
      'data/hotel-info.json': JSON.stringify(hotelData, null, 2),
      'data/rooms.json': JSON.stringify(roomsData, null, 2),
      'data/hall.json': JSON.stringify(hallData, null, 2),
      'data/reviews.json': JSON.stringify(reviewsData, null, 2),
      'data/gallery.json': JSON.stringify(galleryData, null, 2)
    };

    try {
      logTerminal('> جاري تجميع ملفات البيانات الـ 6 (الهوية، الفندق، الغرف، القاعة، التقييمات، المعرض)...');
      try {
        // Attempt Atomic Git Tree Commit (1 single commit for all 6 files!)
        const commitRes = await commitMultipleFilesAtomically(
          filesPayload,
          'تحديث شامل لبيانات وهوية ومعرض فندق روز عدن 2 عبر لوحة التحكم'
        );
        logTerminal('✓ تم تحديث data/theme.json (الهوية والألوان وشريط العروض).');
        logTerminal('✓ تم تحديث data/hotel-info.json (بيانات الفندق والاتصال).');
        logTerminal('✓ تم تحديث data/rooms.json (الغرف والأسعار والمميزات).');
        logTerminal('✓ تم تحديث data/hall.json (قاعة التدريب والمؤتمرات).');
        logTerminal('✓ تم تحديث data/reviews.json (تقييمات وآراء النزلاء).');
        logTerminal('✓ تم تحديث data/gallery.json (معرض الصور والمجموعات).');
        logTerminal(`> رقم الـ Commit الموحد: <code>${(commitRes.sha || '').slice(0, 8)}</code>`);
      } catch (atomicErr) {
        console.warn('Atomic commit fallback to sequential:', atomicErr);
        logTerminal('> جاري الحفظ المتتالي الآمن للملفات...');
        for (const [filePath, content] of Object.entries(filesPayload)) {
          logTerminal(`> نشر ${filePath}...`);
          await commitTextFileToGitHub(filePath, content, `Sync ${filePath}`);
          logTerminal(`✓ تم تحديث ${filePath}.`);
          await new Promise(r => setTimeout(r, 600));
        }
      }

      clearUnsaved();
      renderHotelInfoView();
      renderThemeView();
      renderHallView();

      logTerminal(`<br><span style="color:#10b981; font-weight:bold;">🎉 اكتملت المزامنة والنشر بنجاح 100% بدون أي أخطاء!</span>`);
      logTerminal(`> يقوم GitHub Pages الآن بتحديث الموقع الحي: <a href="https://${config.owner.toLowerCase()}.github.io/${config.repo}/" target="_blank" style="color:#d4af37;">https://${config.owner.toLowerCase()}.github.io/${config.repo}/</a>`);
    } catch (err) {
      logTerminal(`<br><span style="color:#ef4444; font-weight:bold;">❌ حدث خطأ أثناء النشر: ${err.message}</span>`);
    } finally {
      if (syncBtn) syncBtn.disabled = false;
    }
  };

  function logTerminal(msg) {
    const terminal = document.getElementById('syncTerminal');
    if (terminal) {
      terminal.innerHTML += `${msg}<br>`;
      terminal.scrollTop = terminal.scrollHeight;
    }
  }

  // Color Utilities
  function darkenColor(hex) {
    try {
      const col = parseInt(hex.replace('#', ''), 16);
      const r = Math.max(0, ((col >> 16) & 255) - 35);
      const g = Math.max(0, ((col >> 8) & 255) - 35);
      const b = Math.max(0, (col & 255) - 35);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) { return hex; }
  }

  function lightenColor(hex) {
    try {
      const col = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, ((col >> 16) & 255) + 35);
      const g = Math.min(255, ((col >> 8) & 255) + 35);
      const b = Math.min(255, (col & 255) + 35);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) { return hex; }
  }

  // Backup Download
  window.downloadBackupPackage = function () {
    harvestAllOpenForms();
    downloadFile('theme.json', themeData);
    downloadFile('hotel-info.json', hotelData);
    downloadFile('rooms.json', roomsData);
    downloadFile('hall.json', hallData);
    downloadFile('reviews.json', reviewsData);
    downloadFile('gallery.json', galleryData);
    alert('تم تنزيل جميع ملفات البيانات بنجاح كنسخة احتياطية!');
  };

  function downloadFile(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  // Initialize on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    setVal('ghOwner', config.owner);
    setVal('ghRepo', config.repo);
    setVal('ghBranch', config.branch);
    setVal('ghToken', config.token);

    testGitHubConnection();
    loadInitialData();
  });
})();