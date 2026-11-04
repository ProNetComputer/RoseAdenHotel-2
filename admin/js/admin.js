/**
 * Rose Aden 2 Hotel - Enterprise Admin CMS v10.0
 * محرك لوحة التحكم الشاملة: إدارة المستخدمين وكلمات المرور، محتويات الصفحات الـ 8، المنشورات، الغرف، والمعرض مع مزامنة ذرية عبر GitHub API
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

  // Default Users & Roles Fallback
  const DEFAULT_USERS = {
    developer: {
      role: "developer",
      title: "المطور (Developer)",
      name_ar: "م. عمار الأسدي - برونت كمبيوتر",
      password: "Dev@2026",
      allowedSections: ["all"],
      canEditPrices: true,
      canDelete: true,
      canEditTheme: true,
      canManageUsers: true,
      availabilityOnly: false,
      description: "صلاحية كاملة 100%: إدارة جميع الأقسام، الصفحات، المنشورات، المعرض، الهوية، المستخدمين، والربط البرمجي مع GitHub."
    },
    manager: {
      role: "manager",
      title: "المدير العام (Manager)",
      name_ar: "إدارة فندق روز عدن 2",
      password: "Manager@2026",
      allowedSections: ["tab-hotel", "tab-pages", "tab-rooms", "tab-gallery", "tab-hall", "tab-reviews", "tab-users", "tab-publish"],
      canEditPrices: true,
      canDelete: true,
      canEditTheme: false,
      canManageUsers: true,
      availabilityOnly: false,
      description: "إدارة شاملة لبيانات الفندق، محتويات الصفحات والمنشورات، الغرف والأسعار، المعرض، التقييمات، وتغيير كلمات المرور."
    },
    supervisor: {
      role: "supervisor",
      title: "المشرف الفندقي (Supervisor)",
      name_ar: "مشرف الفترة",
      password: "Super@2026",
      allowedSections: ["tab-pages", "tab-rooms", "tab-gallery", "tab-hall", "tab-reviews", "tab-publish"],
      canEditPrices: false,
      canDelete: false,
      canEditTheme: false,
      canManageUsers: false,
      availabilityOnly: false,
      description: "إدارة المحتوى، المنشورات، صور المعرض، القاعة، والتقييمات (بدون صلاحية حذف العناصر أو تعديل الأسعار)."
    },
    reception: {
      role: "reception",
      title: "موظف الاستقبال (Reception)",
      name_ar: "قسم الاستقبال والحجوزات",
      password: "Rec@2026",
      allowedSections: ["tab-rooms", "tab-hall", "tab-publish"],
      canEditPrices: false,
      canDelete: false,
      canEditTheme: false,
      canManageUsers: false,
      availabilityOnly: true,
      description: "تحديث حالة توفر الغرف والأجنحة والقاعة فقط دون تعديل الأسعار أو حذف البيانات."
    }
  };

  // In-Memory Datasets
  let usersData = loadCachedUsers();
  let hotelData = null;
  let roomsData = null;
  let themeData = null;
  let hallData = null;
  let reviewsData = null;
  let galleryData = null;
  let amenitiesData = null;
  let pagesContentData = null;

  let activeAdminGalleryFilter = 'all';
  let currentSelectedPageKey = 'home';
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

  // Modal editing states
  let currentEditingRoomIndex = -1;
  let roomImageUploadBase64 = null;

  let currentEditingGalleryIndex = -1;
  let galleryModalImageUploadBase64 = null;

  let currentEditingPostIndex = -1;
  let postModalImageUploadBase64 = null;

  function loadCachedUsers() {
    try {
      const raw = localStorage.getItem('rose_admin_users_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.developer) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_USERS));
  }

  function cacheUsersLocally(uData) {
    try {
      localStorage.setItem('rose_admin_users_cache', JSON.stringify(uData));
    } catch (e) {}
  }

  // =========================================================================
  // 1. CORS-Safe GitHub API Helpers
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

  async function commitMultipleFilesAtomically(filesMap, commitMessage) {
    const baseApi = `https://api.github.com/repos/${config.owner}/${config.repo}`;

    const refRes = await fetch(`${baseApi}/git/ref/heads/${encodeURIComponent(config.branch)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: getGitHubHeaders(false)
    });
    if (!refRes.ok) throw new Error('تعذر قراءة مرجع الفرع من GitHub');
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    const commitRes = await fetch(`${baseApi}/git/commits/${latestCommitSha}`, {
      method: 'GET',
      cache: 'no-store',
      headers: getGitHubHeaders(false)
    });
    if (!commitRes.ok) throw new Error('تعذر قراءة الشجرة الأساسية من GitHub');
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    const treeItems = Object.keys(filesMap).map(filePath => ({
      path: filePath,
      mode: '100644',
      type: 'blob',
      content: filesMap[filePath]
    }));

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

  // Helper to compress uploaded image via HTML5 Canvas
  function compressImageFromFile(file, maxWidth = 1600, quality = 0.85, callback) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
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
        const compressedUrl = canvas.toDataURL('image/jpeg', quality);
        callback(compressedUrl, compressedUrl.split(',')[1]);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  // =========================================================================
  // 2. Navigation, Sub-tabs & GitHub Connection
  // =========================================================================
  window.switchTab = function (tabId) {
    document.querySelectorAll('.adm-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetTab) targetTab.classList.add('active');
    if (navBtn) navBtn.classList.add('active');
  };

  window.switchPagesSubTab = function (subId) {
    document.querySelectorAll('.pages-subpane').forEach(el => {
      el.style.display = el.id === subId ? 'block' : 'none';
    });
    const mapBtns = {
      'sub-pages-texts': 'subTabBtnPages',
      'sub-posts-manager': 'subTabBtnPosts',
      'sub-vip-packages': 'subTabBtnVipPkgs',
      'sub-amenities-manager': 'subTabBtnAmenities'
    };
    Object.entries(mapBtns).forEach(([paneId, btnId]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        if (paneId === subId) {
          btn.classList.add('adm-btn-gold');
          btn.classList.remove('adm-btn-outline');
        } else {
          btn.classList.remove('adm-btn-gold');
          btn.classList.add('adm-btn-outline');
        }
      }
    });
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
      if (statusText) statusText.textContent = 'الوضع المحلي / تحقق من رمز GitHub';
      if (alertBox) {
        alertBox.className = 'alert-box alert-info';
        alertBox.textContent = 'تعذر الاتصال المباشر بـ GitHub حالياً. يرجى مراجعة اسم المستودع وصلاحية الرمز (Token).';
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
  // 3. Load All 9 Datasets (GitHub API first -> Local JSON fallback)
  // =========================================================================
  async function fetchJsonFileSmart(relPath) {
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
      } catch (e) {}
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
      const [hData, rData, thData, hlData, rvData, gData, amData, pcData, uData] = await Promise.all([
        fetchJsonFileSmart('data/hotel-info.json').catch(() => null),
        fetchJsonFileSmart('data/rooms.json').catch(() => null),
        fetchJsonFileSmart('data/theme.json').catch(() => null),
        fetchJsonFileSmart('data/hall.json').catch(() => null),
        fetchJsonFileSmart('data/reviews.json').catch(() => null),
        fetchJsonFileSmart('data/gallery.json').catch(() => null),
        fetchJsonFileSmart('data/amenities.json').catch(() => null),
        fetchJsonFileSmart('data/pages-content.json').catch(() => null),
        fetchJsonFileSmart('data/users.json').catch(() => null)
      ]);

      hotelData = hData || {
        name_ar: 'فندق روز عدن 2 السياحي',
        name_en: 'Rose Aden 2 Tourist Hotel',
        slogan_ar: 'حيث يلتقي البحر بالفخامة... تبدأ أجمل لحظاتك',
        address_ar: 'العريش - ساحل أبين - جوار جولة الرحاب - عدن',
        whatsapp: '780000656',
        phones: ['02-278880', '02-278881', '02-278882', '02-278885', '02-278888'],
        check_in: '14:00',
        check_out: '12:00'
      };
      roomsData = rData || [];
      themeData = thData || {
        rose_primary: "#e22d46",
        rose_dark: "#be123c",
        luxury_gold: "#d4af37",
        luxury_gold_light: "#f5cd5f",
        font_arabic: "'Cairo', system-ui, sans-serif",
        border_radius: "18px",
        announcement: { enabled: true, text_ar: "", link: "", btn_text: "احجز الآن" }
      };
      hallData = hlData || { title_ar: 'قاعة التدريب والمؤتمرات', capacity: '50 - 70 مشاركاً', specs_ar: [] };
      reviewsData = rvData || [];
      galleryData = gData || [];
      amenitiesData = amData || [];
      pagesContentData = pcData || { stats: [], pages: {}, vip_packages: [], posts: [] };

      if (uData && uData.developer) {
        usersData = uData;
        cacheUsersLocally(usersData);
      }

      renderHotelInfoView();
      renderThemeView();
      renderRoomsGrid();
      renderHallView();
      renderReviewsView();
      renderGalleryGrid();
      loadPageIntoEditor(currentSelectedPageKey);
      renderPostsAdminGrid();
      renderVipPackagesAdmin();
      renderAmenitiesAdmin();
      renderUsersCards();
      clearUnsaved();

      const savedRole = sessionStorage.getItem("pronet_admin_role");
      if (savedRole && usersData[savedRole]) {
        applyRolePermissions(usersData[savedRole]);
      }
    } catch (err) {
      console.warn('Error loading initial data:', err);
    }
  }

  // =========================================================================
  // 4. Authentication, Users & Password Change Window + GitHub Sync
  // =========================================================================
  function getUserPassword(roleKey) {
    const u = usersData[roleKey];
    if (!u) return '';
    return u.password || u.defaultPassPlain || '';
  }

  function initAdminAuth() {
    const loginOverlay = document.getElementById("admin-login-overlay");
    const loginForm = document.getElementById("admin-login-form");
    const loginError = document.getElementById("login-error");
    const logoutBtn = document.getElementById("btn-logout");

    if (!loginOverlay) return;

    const savedRole = sessionStorage.getItem("pronet_admin_role");
    if (savedRole && usersData[savedRole]) {
      unlockDashboard(savedRole);
    }

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const role = document.getElementById("login-role").value;
        const password = document.getElementById("login-password").value;
        const targetPassword = getUserPassword(role);

        if (usersData[role] && password === targetPassword) {
          sessionStorage.setItem("pronet_admin_role", role);
          loginError.style.display = "none";
          loginForm.reset();
          unlockDashboard(role);
        } else {
          loginError.style.display = "block";
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("pronet_admin_role");
        location.reload();
      });
    }
  }

  function unlockDashboard(roleKey) {
    const user = usersData[roleKey] || DEFAULT_USERS[roleKey];
    if (!user) return;
    const loginOverlay = document.getElementById("admin-login-overlay");
    const sessionBar = document.getElementById("user-session-bar");
    const roleBadge = document.getElementById("current-role-badge");
    const welcomeText = document.getElementById("welcome-text");
    const passModalBtn = document.getElementById("btn-open-pass-modal");

    if (loginOverlay) loginOverlay.style.display = "none";
    if (sessionBar) sessionBar.style.display = "flex";
    if (roleBadge) roleBadge.textContent = user.title;
    if (welcomeText) welcomeText.textContent = `مرحباً بك (${user.name_ar || user.title}) — الصلاحيات مفعلة`;
    if (passModalBtn) {
      passModalBtn.style.display = (user.canManageUsers || user.allowedSections.includes("all")) ? "inline-flex" : "none";
    }
    applyRolePermissions(user);
  }

  function applyRolePermissions(user) {
    if (!user) return;
    const allowed = user.allowedSections || ["all"];
    document.querySelectorAll("[data-section]").forEach((el) => {
      const sectionName = el.getAttribute("data-section");
      if (!allowed.includes("all") && !allowed.includes(sectionName)) {
        el.classList.add("restricted-hidden");
      } else {
        el.classList.remove("restricted-hidden");
      }
    });

    if (!user.canEditPrices) {
      document.querySelectorAll('input[name*="price"], .price-input').forEach((input) => {
        input.setAttribute("readonly", true);
        input.style.opacity = "0.65";
      });
    } else {
      document.querySelectorAll('input[name*="price"], .price-input').forEach((input) => {
        input.removeAttribute("readonly");
        input.style.opacity = "1";
      });
    }

    if (!user.canDelete) {
      document.querySelectorAll(".btn-delete, .btn-add-new, .delete-btn, .btn-remove").forEach((btn) => {
        btn.classList.add("restricted-hidden");
      });
    } else {
      document.querySelectorAll(".btn-delete, .btn-add-new, .delete-btn, .btn-remove").forEach((btn) => {
        btn.classList.remove("restricted-hidden");
      });
    }
  }

  function buildUsersCardsHtml(prefix) {
    const roleKeys = ['developer', 'manager', 'supervisor', 'reception'];
    return roleKeys.map(rKey => {
      const u = usersData[rKey] || DEFAULT_USERS[rKey];
      const passVal = u.password || u.defaultPassPlain || '';
      const inputId = `${prefix}_pass_${rKey}`;
      const nameId = `${prefix}_name_${rKey}`;
      return `
        <div class="user-role-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="color: var(--adm-gold-light); font-size: 1.02rem;">🔐 ${u.title}</strong>
            <span class="adm-pill-tag">${rKey}</span>
          </div>
          <p style="font-size: 0.78rem; color: var(--adm-muted); line-height: 1.5;">${u.description || ''}</p>
          <div>
            <label style="display: block; font-size: 0.8rem; color: var(--adm-text-sub); margin-bottom: 0.3rem;">اسم المسؤول / المسمى:</label>
            <input type="text" id="${nameId}" class="adm-input" style="padding: 0.45rem 0.7rem; font-size: 0.86rem;" value="${u.name_ar || ''}" oninput="updateUserField('${rKey}', 'name_ar', this.value)">
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: var(--adm-text-sub); margin-bottom: 0.3rem;">كلمة المرور المعتمدة:</label>
            <div class="pass-input-wrap">
              <input type="password" id="${inputId}" class="adm-input" style="padding: 0.45rem 0.7rem; font-size: 0.9rem; font-weight: 700; color: #6ee7b7;" value="${passVal}" oninput="updateUserField('${rKey}', 'password', this.value)">
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" onclick="togglePassVisibility('${inputId}')" title="إظهار / إخفاء">👁️</button>
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" onclick="copyRolePassword('${rKey}')" title="نسخ كلمة المرور">📋</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderUsersCards() {
    const tabGrid = document.getElementById('usersTabCardsGrid');
    if (tabGrid) tabGrid.innerHTML = buildUsersCardsHtml('tab');
    const modalGrid = document.getElementById('passwordModalCardsGrid');
    if (modalGrid) modalGrid.innerHTML = buildUsersCardsHtml('mdl');
  }

  window.openPasswordModal = function () {
    renderUsersCards();
    const statusBox = document.getElementById('passwordModalStatus');
    if (statusBox) statusBox.style.display = 'none';
    const modal = document.getElementById('passwordModalBackdrop');
    if (modal) modal.classList.add('open');
  };

  window.closePasswordModal = function () {
    const modal = document.getElementById('passwordModalBackdrop');
    if (modal) modal.classList.remove('open');
  };

  window.togglePassVisibility = function (inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
  };

  window.copyRolePassword = function (roleKey) {
    const pwd = getUserPassword(roleKey);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pwd);
      alert(`تم نسخ كلمة مرور (${usersData[roleKey]?.title}): ${pwd}`);
    }
  };

  window.updateUserField = function (roleKey, field, val) {
    if (!usersData[roleKey]) return;
    usersData[roleKey][field] = val;
    if (field === 'password') {
      usersData[roleKey].defaultPassPlain = val;
    }
    cacheUsersLocally(usersData);
    // Sync value across both tab and modal inputs
    ['tab', 'mdl'].forEach(prefix => {
      const targetId = field === 'password' ? `${prefix}_pass_${roleKey}` : `${prefix}_name_${roleKey}`;
      const el = document.getElementById(targetId);
      if (el && el.value !== val) el.value = val;
    });
    markUnsaved();
  };

  window.saveUsersPasswordsToGitHub = async function (statusBoxId) {
    cacheUsersLocally(usersData);
    const statusBox = document.getElementById(statusBoxId || 'passwordModalStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = '⏳ جاري حفظ كلمات المرور ومزامنة ملف <code>data/users.json</code> مع مستودع GitHub...';
    }

    try {
      await commitTextFileToGitHub('data/users.json', JSON.stringify(usersData, null, 2), 'تحديث كلمات مرور وحسابات لوحة التحكم عبر بوابة الإدارة');
      clearUnsaved();
      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ كلمات المرور الجديدة محلياً ومزامنتها مع GitHub بنجاح!';
      }
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `✓ تم حفظ كلمات المرور الجديدة في المتصفح فوراً، وتعذر النشر السحابي اللحظي (${err.message}). يمكنك النشر من مركز النشر الشامل.`;
      }
    }
  };

  // =========================================================================
  // 5. Pages Content, Posts, VIP Packages & Amenities Manager (#tab-pages)
  // =========================================================================
  window.loadPageIntoEditor = function (pageKey) {
    currentSelectedPageKey = pageKey || 'home';
    if (!pagesContentData || !pagesContentData.pages) return;
    const pCfg = pagesContentData.pages[currentSelectedPageKey] || {};

    setVal('pageSelectorDropdown', currentSelectedPageKey);
    setVal('pgHeroBadge', pCfg.hero_badge_ar || '');
    setVal('pgHeroTitle', pCfg.hero_title_ar || '');
    setVal('pgHeroSubtitle', pCfg.hero_subtitle_ar || '');
    setVal('pgIntroBadge', pCfg.intro_badge_ar || pCfg.highlights_badge_ar || '');
    setVal('pgIntroTitle', pCfg.intro_title_ar || pCfg.highlights_title_ar || '');
    setVal('pgIntroDesc', pCfg.intro_desc_ar || pCfg.highlights_desc_ar || '');
    setVal('pgIntroExtra', pCfg.intro_extra_ar || '');

    const homeExtra = document.getElementById('homePageExtraFields');
    if (homeExtra) {
      if (currentSelectedPageKey === 'home') {
        homeExtra.style.display = 'block';
        setVal('pgHomeRoomsTitle', pCfg.rooms_section_title_ar || '');
        setVal('pgHomeRoomsDesc', pCfg.rooms_section_desc_ar || '');
        setVal('pgHomePostsTitle', pCfg.posts_section_title_ar || '');
        setVal('pgHomePostsDesc', pCfg.posts_section_desc_ar || '');
        renderStatsEditor();
      } else {
        homeExtra.style.display = 'none';
      }
    }
  };

  function renderStatsEditor() {
    const container = document.getElementById('statsEditorContainer');
    if (!container || !pagesContentData) return;
    const stats = pagesContentData.stats || [];
    container.innerHTML = `
      <label style="display:block; font-size:0.85rem; color:var(--adm-gold); margin-bottom:0.5rem;">📊 أرقام شريط الإحصائيات في الصفحة الرئيسية:</label>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">
        ${stats.map((st, idx) => `
          <div style="background:rgba(0,0,0,0.4); padding:0.75rem; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
            <input type="text" class="adm-input" style="margin-bottom:0.4rem; font-weight:800; color:var(--adm-gold-light);" value="${st.value || ''}" placeholder="الرقم (مثال: +8)" oninput="updateStatField(${idx}, 'value', this.value)">
            <input type="text" class="adm-input" style="font-size:0.82rem;" value="${st.label_ar || ''}" placeholder="الوصف" oninput="updateStatField(${idx}, 'label_ar', this.value)">
          </div>
        `).join('')}
      </div>
    `;
  }

  window.updateStatField = function (idx, field, val) {
    if (!pagesContentData || !pagesContentData.stats || !pagesContentData.stats[idx]) return;
    pagesContentData.stats[idx][field] = val;
    markUnsaved();
  };

  function collectCurrentPageEditorFields() {
    if (!pagesContentData) return;
    if (!pagesContentData.pages) pagesContentData.pages = {};
    if (!pagesContentData.pages[currentSelectedPageKey]) {
      pagesContentData.pages[currentSelectedPageKey] = { page_key: currentSelectedPageKey };
    }
    const pCfg = pagesContentData.pages[currentSelectedPageKey];
    pCfg.hero_badge_ar = getVal('pgHeroBadge');
    pCfg.hero_title_ar = getVal('pgHeroTitle');
    pCfg.hero_subtitle_ar = getVal('pgHeroSubtitle');

    if (currentSelectedPageKey === 'home') {
      pCfg.highlights_badge_ar = getVal('pgIntroBadge');
      pCfg.highlights_title_ar = getVal('pgIntroTitle');
      pCfg.highlights_desc_ar = getVal('pgIntroDesc');
      pCfg.rooms_section_title_ar = getVal('pgHomeRoomsTitle');
      pCfg.rooms_section_desc_ar = getVal('pgHomeRoomsDesc');
      pCfg.posts_section_title_ar = getVal('pgHomePostsTitle');
      pCfg.posts_section_desc_ar = getVal('pgHomePostsDesc');
    } else {
      pCfg.intro_badge_ar = getVal('pgIntroBadge');
      pCfg.intro_title_ar = getVal('pgIntroTitle');
      pCfg.intro_desc_ar = getVal('pgIntroDesc');
      pCfg.intro_extra_ar = getVal('pgIntroExtra');
    }
  }

  window.saveSelectedPageContentToGitHub = async function () {
    collectCurrentPageEditorFields();
    await savePagesContentToGitHub(`تحديث محتوى ونصوص صفحة (${currentSelectedPageKey})`, 'pageContentSaveStatus');
  };

  window.savePagesContentToGitHub = async function (commitMsg, statusBoxId) {
    const statusBox = document.getElementById(statusBoxId || 'pageContentSaveStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = '⏳ جاري حفظ ونشر ملف محتويات الصفحات والمنشورات <code>data/pages-content.json</code> على GitHub...';
    }

    try {
      await commitTextFileToGitHub('data/pages-content.json', JSON.stringify(pagesContentData, null, 2), commitMsg || 'تحديث محتويات الصفحات والمنشورات عبر لوحة التحكم');
      clearUnsaved();
      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر التعديلات على GitHub بنجاح!';
        setTimeout(() => { statusBox.style.display = 'none'; }, 1800);
      } else {
        alert('✓ تم حفظ ونشر التعديلات على GitHub بنجاح!');
      }
    } catch (err) {
      markUnsaved();
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ تعذر النشر اللحظي: ${err.message}`;
      } else {
        alert(`❌ خطأ: ${err.message}`);
      }
    }
  };

  // Posts & Page Content Blocks Manager
  const PAGE_LABELS_AR = {
    'home': '🏠 الرئيسية',
    'rooms': '🛏️ الغرف والأجنحة',
    'vip-suites': '👑 طيرمانات VIP',
    'about': '🏨 عن الفندق',
    'training-hall': '🎓 قاعة التدريب',
    'gallery': '📸 المعرض',
    'location': '📍 الموقع',
    'contact': '📞 الاتصال',
    'all': '🌐 جميع الصفحات'
  };

  function renderPostsAdminGrid() {
    const container = document.getElementById('postsCardsGrid');
    if (!container || !pagesContentData) return;
    const posts = pagesContentData.posts || [];

    container.innerHTML = posts.map((post, idx) => {
      const pagesBadges = (post.target_pages || []).map(p => `<span class="adm-pill-tag">${PAGE_LABELS_AR[p] || p}</span>`).join(' ');
      const isVis = post.visible !== false;
      return `
        <div class="adm-room-card">
          <div class="adm-room-media">
            <img src="../${post.image || 'assets/images/building-day.jpg'}" alt="${post.title_ar}" onerror="this.src='../assets/images/building-day.jpg'">
            <span class="adm-room-badge">${post.badge_ar || 'منشور'}</span>
          </div>
          <div class="adm-room-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span style="font-size:0.78rem; color:var(--adm-gold); font-weight:700;">${post.category_ar || 'عرض / منشور'}</span>
              <span style="font-size:0.75rem; font-weight:800; color:${isVis ? '#10b981' : '#94a3b8'};">${isVis ? '🟢 ظاهر بالموقع' : '⚪ مخفي'}</span>
            </div>
            <div class="adm-room-title">${post.title_ar || ''}</div>
            <div style="font-size:0.82rem; color:var(--adm-text-sub); margin-bottom:0.65rem;">${post.content_ar || ''}</div>
            <div style="margin-bottom:0.75rem;">
              <div style="font-size:0.74rem; color:var(--adm-muted); margin-bottom:0.25rem;">يظهر في الصفحات:</div>
              <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">${pagesBadges}</div>
            </div>
            <div class="adm-room-actions">
              <button type="button" class="adm-btn adm-btn-gold adm-btn-sm" onclick="openPostModal(${idx})">✏️ تعديل المنشور</button>
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" onclick="togglePostVisibility(${idx})">${isVis ? 'إخفاء' : 'إظهار'}</button>
              <button type="button" class="adm-btn adm-btn-danger adm-btn-sm btn-delete" onclick="deletePostItem(${idx})">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.openPostModal = function (idx) {
    currentEditingPostIndex = idx;
    postModalImageUploadBase64 = null;
    const modal = document.getElementById('postModalBackdrop');
    const header = document.getElementById('postModalHeaderTitle');
    const preview = document.getElementById('postModalImgPreview');
    const statusBox = document.getElementById('postModalStatus');
    const fileInput = document.getElementById('postModalFileInput');

    if (statusBox) statusBox.style.display = 'none';
    if (fileInput) fileInput.value = '';

    if (idx === -1) {
      header.textContent = '➕ إضافة منشور أو عرض ترويجي جديد';
      setVal('postModalTitleAr', '');
      setVal('postModalSubtitleAr', '');
      setVal('postModalBadgeAr', '✨ عرض جديد');
      setVal('postModalCategoryAr', 'عروض الفندق');
      setVal('postModalDateAr', 'متاح الآن');
      setVal('postModalContentAr', '');
      setVal('postModalCtaText', 'تواصل واحجز عبر واتساب');
      setVal('postModalCtaLink', 'https://wa.me/967780000656');
      setVal('postModalImgPath', 'assets/images/ros2-exterior-night-neon.jpg');
      preview.src = '../assets/images/ros2-exterior-night-neon.jpg';
      document.getElementById('postModalVisible').checked = true;
      document.querySelectorAll('.post-target-page-chk').forEach(chk => {
        chk.checked = (chk.value === 'home');
      });
    } else {
      const post = pagesContentData.posts[idx];
      header.textContent = `✏️ تعديل المنشور: ${post.title_ar}`;
      setVal('postModalTitleAr', post.title_ar || '');
      setVal('postModalSubtitleAr', post.subtitle_ar || '');
      setVal('postModalBadgeAr', post.badge_ar || '');
      setVal('postModalCategoryAr', post.category_ar || '');
      setVal('postModalDateAr', post.date_ar || '');
      setVal('postModalContentAr', post.content_ar || '');
      setVal('postModalCtaText', post.cta_text_ar || '');
      setVal('postModalCtaLink', post.cta_link || '');
      setVal('postModalImgPath', post.image || 'assets/images/building-day.jpg');
      preview.src = `../${post.image || 'assets/images/building-day.jpg'}`;
      document.getElementById('postModalVisible').checked = post.visible !== false;
      const targets = post.target_pages || ['home'];
      document.querySelectorAll('.post-target-page-chk').forEach(chk => {
        chk.checked = targets.includes(chk.value);
      });
    }

    modal.classList.add('open');
  };

  window.closePostModal = function () {
    document.getElementById('postModalBackdrop').classList.remove('open');
  };

  window.handlePostModalImageFile = function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('postModalImgPreview');
    if (!file || !preview) return;
    compressImageFromFile(file, 1600, 0.85, (dataUrl, b64) => {
      preview.src = dataUrl;
      postModalImageUploadBase64 = b64;
    });
  };

  window.savePostModalData = async function () {
    const title = getVal('postModalTitleAr').trim();
    if (!title) {
      alert('يرجى إدخال عنوان المنشور أو العرض.');
      return;
    }

    const saveBtn = document.getElementById('postModalSaveBtn');
    const statusBox = document.getElementById('postModalStatus');
    if (saveBtn) saveBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = '⏳ جاري حفظ المنشور ومزامنته مع GitHub...';
    }

    try {
      let imgPath = getVal('postModalImgPath').trim() || 'assets/images/ros2-exterior-night-neon.jpg';
      if (postModalImageUploadBase64) {
        const newFile = `post-${Date.now()}.jpg`;
        imgPath = `assets/images/${newFile}`;
        await commitBinaryFileToGitHub(imgPath, postModalImageUploadBase64, `Upload post image: ${newFile}`);
      }

      const selectedPages = [];
      document.querySelectorAll('.post-target-page-chk:checked').forEach(chk => {
        selectedPages.push(chk.value);
      });
      if (selectedPages.length === 0) selectedPages.push('home');

      if (!pagesContentData.posts) pagesContentData.posts = [];

      const postObj = {
        id: currentEditingPostIndex === -1 ? `post-${Date.now()}` : (pagesContentData.posts[currentEditingPostIndex].id || `post-${Date.now()}`),
        title_ar: title,
        subtitle_ar: getVal('postModalSubtitleAr').trim(),
        badge_ar: getVal('postModalBadgeAr').trim(),
        category_ar: getVal('postModalCategoryAr').trim(),
        date_ar: getVal('postModalDateAr').trim(),
        content_ar: getVal('postModalContentAr').trim(),
        cta_text_ar: getVal('postModalCtaText').trim() || 'تواصل واحجز الآن',
        cta_link: getVal('postModalCtaLink').trim() || 'https://wa.me/967780000656',
        image: imgPath,
        target_pages: selectedPages,
        visible: document.getElementById('postModalVisible').checked,
        order: currentEditingPostIndex === -1 ? (pagesContentData.posts.length + 1) : (pagesContentData.posts[currentEditingPostIndex].order || (currentEditingPostIndex + 1))
      };

      if (currentEditingPostIndex === -1) {
        pagesContentData.posts.unshift(postObj);
      } else {
        pagesContentData.posts[currentEditingPostIndex] = postObj;
      }

      await commitTextFileToGitHub('data/pages-content.json', JSON.stringify(pagesContentData, null, 2), `Update post: ${title}`);
      renderPostsAdminGrid();
      clearUnsaved();

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر المنشور بنجاح!';
      }
      setTimeout(() => { closePostModal(); }, 1000);
    } catch (err) {
      markUnsaved();
      renderPostsAdminGrid();
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ خطأ أثناء النشر: ${err.message}`;
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  window.togglePostVisibility = async function (idx) {
    if (!pagesContentData || !pagesContentData.posts || !pagesContentData.posts[idx]) return;
    pagesContentData.posts[idx].visible = pagesContentData.posts[idx].visible === false ? true : false;
    renderPostsAdminGrid();
    markUnsaved();
  };

  window.deletePostItem = async function (idx) {
    if (!pagesContentData || !pagesContentData.posts || !pagesContentData.posts[idx]) return;
    const item = pagesContentData.posts[idx];
    if (confirm(`هل أنت متأكد من حذف المنشور "${item.title_ar}"؟`)) {
      pagesContentData.posts.splice(idx, 1);
      renderPostsAdminGrid();
      markUnsaved();
    }
  };

  // VIP Packages Manager
  function renderVipPackagesAdmin() {
    const container = document.getElementById('vipPackagesAdminContainer');
    if (!container || !pagesContentData) return;
    const pkgs = pagesContentData.vip_packages || [];

    container.innerHTML = pkgs.map((pkg, idx) => `
      <div class="view-item-box" style="margin-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <strong style="color:var(--adm-gold-light); font-size:1rem;">${pkg.icon || '👑'} ${pkg.title_ar || 'باقة VIP'}</strong>
          <button type="button" class="adm-btn adm-btn-danger adm-btn-sm btn-delete" onclick="deleteVipPackage(${idx})">🗑️ حذف الباقة</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>عنوان الباقة</label>
            <input type="text" class="adm-input" value="${pkg.title_ar || ''}" oninput="updateVipPkgField(${idx}, 'title_ar', this.value)">
          </div>
          <div class="form-group">
            <label>الشارة (Badge) والأيقونة</label>
            <div style="display:flex; gap:0.5rem;">
              <input type="text" class="adm-input" style="width:70px;" value="${pkg.icon || '👑'}" oninput="updateVipPkgField(${idx}, 'icon', this.value)">
              <input type="text" class="adm-input" value="${pkg.badge_ar || ''}" oninput="updateVipPkgField(${idx}, 'badge_ar', this.value)">
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>وصف الباقة</label>
          <textarea class="adm-textarea" rows="2" oninput="updateVipPkgField(${idx}, 'desc_ar', this.value)">${pkg.desc_ar || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>مميزات الباقة (افصل بينها بـ |)</label>
            <input type="text" class="adm-input" value="${(pkg.features_ar || []).join(' | ')}" oninput="updateVipPkgField(${idx}, 'features_ar', this.value.split('|').map(s=>s.trim()).filter(Boolean))">
          </div>
          <div class="form-group">
            <label>مسار صورة الباقة</label>
            <input type="text" class="adm-input" value="${pkg.image || 'assets/images/ros2-vip-majlis.jpg'}" oninput="updateVipPkgField(${idx}, 'image', this.value)">
          </div>
        </div>
      </div>
    `).join('');
  }

  window.updateVipPkgField = function (idx, field, val) {
    if (!pagesContentData || !pagesContentData.vip_packages || !pagesContentData.vip_packages[idx]) return;
    pagesContentData.vip_packages[idx][field] = val;
    markUnsaved();
  };

  window.addNewVipPackage = function () {
    if (!pagesContentData.vip_packages) pagesContentData.vip_packages = [];
    pagesContentData.vip_packages.push({
      id: `vpkg-${Date.now()}`,
      icon: "👑",
      badge_ar: "باقة VIP خاصة",
      title_ar: "باقة ضيافة وإقامة ملكية جديدة",
      desc_ar: "تفاصيل الباقة ومزايا الإقامة والضيافة.",
      features_ar: ["إقامة فاخرة", "ضيافة ترحيبية", "إنترنت فايبر مجاني"],
      cta_text: "احجز الباقة عبر واتساب",
      image: "assets/images/ros2-suite-king-blue.jpg"
    });
    renderVipPackagesAdmin();
    markUnsaved();
  };

  window.deleteVipPackage = function (idx) {
    if (!pagesContentData || !pagesContentData.vip_packages) return;
    if (confirm('هل أنت متأكد من حذف باقة VIP هذه؟')) {
      pagesContentData.vip_packages.splice(idx, 1);
      renderVipPackagesAdmin();
      markUnsaved();
    }
  };

  // Amenities Manager
  function renderAmenitiesAdmin() {
    const container = document.getElementById('amenitiesAdminContainer');
    if (!container || !amenitiesData) return;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1rem;">
        ${amenitiesData.map((am, idx) => `
          <div class="view-item-box">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <div style="display:flex; gap:0.5rem; align-items:center; width:100%;">
                <input type="text" class="adm-input" style="width:58px; text-align:center; font-size:1.3rem; padding:0.3rem;" value="${am.icon || '✨'}" oninput="updateAmenityField(${idx}, 'icon', this.value)">
                <input type="text" class="adm-input" style="font-weight:700;" value="${am.title_ar || ''}" oninput="updateAmenityField(${idx}, 'title_ar', this.value)">
              </div>
              <button type="button" class="adm-btn adm-btn-danger adm-btn-sm btn-delete" style="margin-right:0.5rem;" onclick="deleteAmenityItem(${idx})">🗑️</button>
            </div>
            <textarea class="adm-textarea" rows="2" style="font-size:0.85rem;" oninput="updateAmenityField(${idx}, 'desc_ar', this.value)">${am.desc_ar || ''}</textarea>
          </div>
        `).join('')}
      </div>
    `;
  }

  window.updateAmenityField = function (idx, field, val) {
    if (!amenitiesData || !amenitiesData[idx]) return;
    amenitiesData[idx][field] = val;
    markUnsaved();
  };

  window.addNewAmenityItem = function () {
    if (!amenitiesData) amenitiesData = [];
    amenitiesData.push({
      id: `am-${Date.now()}`,
      icon: "✨",
      title_ar: "خدمة فندقية جديدة",
      title_en: "New Hotel Service",
      desc_ar: "وصف الخدمة أو المرفق الفندقي."
    });
    renderAmenitiesAdmin();
    markUnsaved();
  };

  window.deleteAmenityItem = function (idx) {
    if (!amenitiesData || !amenitiesData[idx]) return;
    if (confirm('هل تريد حذف هذا المرفق؟')) {
      amenitiesData.splice(idx, 1);
      renderAmenitiesAdmin();
      markUnsaved();
    }
  };

  window.saveAmenitiesToGitHub = async function () {
    try {
      await commitTextFileToGitHub('data/amenities.json', JSON.stringify(amenitiesData, null, 2), 'تحديث المرافق والخدمات الفندقية عبر لوحة التحكم');
      clearUnsaved();
      alert('✓ تم حفظ ونشر المرافق والخدمات الفندقية على GitHub بنجاح!');
    } catch (e) {
      alert(`❌ خطأ أثناء الحفظ: ${e.message}`);
    }
  };

  // =========================================================================
  // 6. Hotel General Info & Theme (#tab-hotel & #tab-theme)
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
  // 7. Expanded Rooms, Suites & VIP Tirmanah Manager (#tab-rooms)
  // =========================================================================
  function renderRoomsGrid() {
    const container = document.getElementById('roomsCardsGrid');
    const countBadge = document.getElementById('roomsCountBadge');
    if (!container || !roomsData) return;

    if (countBadge) countBadge.textContent = `${roomsData.length} فئات`;

    container.innerHTML = roomsData.map((room, idx) => {
      const isAvail = room.available !== false;
      return `
        <div class="adm-room-card" data-idx="${idx}">
          <div class="adm-room-media">
            <img src="../${room.image}" alt="${room.title_ar}" onerror="this.src='../assets/images/suite-vip.jpg'">
            <span class="adm-room-badge">${room.badge_ar || 'مميز'}</span>
          </div>
          <div class="adm-room-body">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
              <span class="adm-pill-tag">${room.area_ar || 'مساحة واسعة'} • ${room.category || 'standard'}</span>
              <label class="checkbox-label" style="font-size:0.78rem; color:${isAvail ? '#10b981' : '#ef4444'}; font-weight:800;">
                <input type="checkbox" class="availability-toggle" ${isAvail ? 'checked' : ''} onchange="toggleRoomAvailabilityQuick(${idx}, this.checked)">
                <span>${isAvail ? '🟢 متاح للحجز' : '🔴 مشغول'}</span>
              </label>
            </div>
            <div class="adm-room-title">${room.title_ar}</div>
            ${room.subtitle_ar ? `<div style="font-size:0.8rem; color:var(--adm-gold-light); margin-bottom:0.35rem;">${room.subtitle_ar}</div>` : ''}
            <div class="adm-room-price">💰 ${room.price_per_night}</div>
            <div style="font-size: 0.8rem; color: var(--adm-muted); margin-bottom: 0.5rem;">
              <span>🛏️ ${room.beds_ar || ''}</span> • <span>👥 ${room.capacity_ar || ''}</span>
              ${room.view_ar ? `<br><span>🌅 ${room.view_ar}</span>` : ''}
            </div>
            <div class="adm-room-features">
              ${(room.features_ar || []).slice(0, 4).map(f => `<span class="adm-feature-tag">${f}</span>`).join('')}
              ${(room.features_ar || []).length > 4 ? `<span class="adm-feature-tag">+${(room.features_ar.length - 4)} أخرى</span>` : ''}
            </div>
            <div class="adm-room-actions">
              <button type="button" class="adm-btn adm-btn-gold adm-btn-sm" onclick="openRoomModal(${idx})">
                <span>✏️</span> تحرير كامل التفاصيل والصورة
              </button>
              <button type="button" class="adm-btn adm-btn-danger adm-btn-sm btn-delete" onclick="deleteRoomItem(${idx})">
                <span>🗑️</span> حذف
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.toggleRoomAvailabilityQuick = async function (idx, isAvail) {
    if (!roomsData || !roomsData[idx]) return;
    roomsData[idx].available = isAvail;
    renderRoomsGrid();
    try {
      await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), `Update availability: ${roomsData[idx].title_ar}`);
    } catch (e) {
      markUnsaved();
    }
  };

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
      title.textContent = '➕ إضافة غرفة أو جناح أو طيرمانة VIP جديدة';
      setVal('modalRoomTitleAr', '');
      setVal('modalRoomSubtitleAr', 'إقامة فندقية فاخرة ومريحة');
      setVal('modalRoomDescAr', '');
      setVal('modalRoomPrice', 'أسعار تنافسية');
      setVal('modalRoomBadge', 'جديد ✨');
      setVal('modalRoomArea', '48 م²');
      setVal('modalRoomView', 'إطلالة خارجية');
      setVal('modalRoomFloor', 'الطوابق 2 - 5');
      setVal('modalRoomBeds', 'سرير مزدوج مريح');
      setVal('modalRoomCap', '2 - 3 أشخاص');
      setVal('modalRoomCategory', 'standard');
      setVal('modalRoomFeatures', 'تكييف هادئ 24/7\nشاشة ذكية 4K\nإنترنت فايبر مجاني\nثلاجة ميني بار وغلاية');
      setVal('modalRoomServices', 'استقبال من المطار، واي فاي مجاني، كهرباء 24/7');
      setVal('modalRoomImgPath', 'assets/images/ros2-room-twin-blue.jpg');
      preview.src = '../assets/images/ros2-room-twin-blue.jpg';
      document.getElementById('modalRoomAvailable').checked = true;
      document.getElementById('modalRoomFeaturedHome').checked = true;
      document.getElementById('modalRoomShowVip').checked = false;
    } else {
      const room = roomsData[idx];
      title.textContent = `✏️ تحرير كامل بيانات: ${room.title_ar}`;
      setVal('modalRoomTitleAr', room.title_ar || '');
      setVal('modalRoomSubtitleAr', room.subtitle_ar || '');
      setVal('modalRoomDescAr', room.description_ar || '');
      setVal('modalRoomPrice', room.price_per_night || '');
      setVal('modalRoomBadge', room.badge_ar || '');
      setVal('modalRoomArea', room.area_ar || '');
      setVal('modalRoomView', room.view_ar || '');
      setVal('modalRoomFloor', room.floor_ar || '');
      setVal('modalRoomBeds', room.beds_ar || '');
      setVal('modalRoomCap', room.capacity_ar || '');
      setVal('modalRoomCategory', room.category || 'standard');
      setVal('modalRoomFeatures', (room.features_ar || []).join('\n'));
      setVal('modalRoomServices', (room.included_services_ar || []).join('، '));
      setVal('modalRoomImgPath', room.image || '');
      preview.src = `../${room.image}`;
      document.getElementById('modalRoomAvailable').checked = room.available !== false;
      document.getElementById('modalRoomFeaturedHome').checked = room.featured_home !== false;
      document.getElementById('modalRoomShowVip').checked = !!room.show_in_vip_page || room.category === 'vip' || room.category === 'tirmanah';
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
    compressImageFromFile(file, 1600, 0.85, (dataUrl, b64) => {
      preview.src = dataUrl;
      roomImageUploadBase64 = b64;
    });
  };

  window.saveRoomModalData = async function () {
    const title = getVal('modalRoomTitleAr').trim();
    if (!title) {
      alert('يرجى كتابة اسم الغرفة أو الجناح.');
      return;
    }

    const saveBtn = document.getElementById('modalRoomSaveBtn');
    const statusBox = document.getElementById('modalRoomStatus');
    if (saveBtn) saveBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = '⏳ جاري حفظ بيانات الغرفة ورفع الصورة...';
    }

    try {
      let imagePath = getVal('modalRoomImgPath').trim() || 'assets/images/suite-vip.jpg';

      if (roomImageUploadBase64) {
        const newFileName = `room-${Date.now()}.jpg`;
        imagePath = `assets/images/${newFileName}`;
        if (statusBox) statusBox.innerHTML = `جاري رفع صورة الغرفة الجديدة <code>${imagePath}</code> إلى GitHub...`;
        await commitBinaryFileToGitHub(imagePath, roomImageUploadBase64, `Upload room image: ${newFileName}`);
      }

      const existing = currentEditingRoomIndex >= 0 ? roomsData[currentEditingRoomIndex] : {};
      const servicesArr = (getVal('modalRoomServices') || '')
        .split(/[،,|]/)
        .map(s => s.trim())
        .filter(Boolean);

      const roomPayload = {
        id: currentEditingRoomIndex === -1 ? `room-${Date.now()}` : (existing.id || `room-${Date.now()}`),
        category: getVal('modalRoomCategory') || 'standard',
        title_ar: title,
        title_en: existing.title_en || 'Luxury Suite & Room',
        subtitle_ar: getVal('modalRoomSubtitleAr').trim(),
        description_ar: getVal('modalRoomDescAr').trim(),
        badge_ar: getVal('modalRoomBadge').trim() || 'مميز',
        badge_en: existing.badge_en || 'Special',
        price_per_night: getVal('modalRoomPrice').trim() || 'حسب الطلب',
        price_en: existing.price_en || 'Special Rate',
        area_ar: getVal('modalRoomArea').trim(),
        view_ar: getVal('modalRoomView').trim(),
        floor_ar: getVal('modalRoomFloor').trim(),
        beds_ar: getVal('modalRoomBeds').trim() || 'سرير مريح',
        beds_en: existing.beds_en || 'Comfortable Bed',
        capacity_ar: getVal('modalRoomCap').trim() || '2 أشخاص',
        capacity_en: existing.capacity_en || '2 Guests',
        available: document.getElementById('modalRoomAvailable').checked,
        featured_home: document.getElementById('modalRoomFeaturedHome').checked,
        show_in_vip_page: document.getElementById('modalRoomShowVip').checked,
        image: imagePath,
        extra_images: existing.extra_images || [],
        features_ar: (getVal('modalRoomFeatures') || '').split('\n').map(s => s.trim()).filter(Boolean),
        included_services_ar: servicesArr
      };

      if (currentEditingRoomIndex === -1) {
        roomsData.push(roomPayload);
      } else {
        roomsData[currentEditingRoomIndex] = roomPayload;
      }

      if (statusBox) statusBox.innerHTML = 'جاري تحديث ملف الغرف والأجنحة <code>data/rooms.json</code> على GitHub...';
      await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), `Update rooms.json: ${title}`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر بيانات الغرفة بنجاح على الموقع!';
      }

      setTimeout(() => {
        closeRoomModal();
        renderRoomsGrid();
      }, 1000);
    } catch (err) {
      markUnsaved();
      renderRoomsGrid();
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
  // 8. Comprehensive Gallery & Per-Item Metadata Editor (#tab-gallery)
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

    const title = getVal('proGalleryTitle').trim() || 'صورة من فندق روز عدن 2';
    const badge = getVal('proGalleryBadge').trim() || 'لقطة مميزة';
    const desc = getVal('proGalleryDesc').trim() || '';
    const category = getVal('proGalleryCategory') || 'rooms';
    const inCarousel = document.getElementById('proGalleryInCarousel') ? document.getElementById('proGalleryInCarousel').checked : true;

    const statusBox = document.getElementById('proGalleryUploadStatus');
    const uploadBtn = document.getElementById('proGalleryUploadBtn');

    const fileName = `gallery-${Date.now()}.jpg`;
    const targetPath = `assets/images/${fileName}`;
    const base64ToUpload = preflightState.isOptimized ? preflightState.optimizedBase64 : preflightState.originalBase64;

    if (uploadBtn) uploadBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = `⏳ جاري رفع ملف الصورة <code>${targetPath}</code> إلى مستودع GitHub...`;
    }

    try {
      await commitBinaryFileToGitHub(targetPath, base64ToUpload, `Upload gallery image: ${fileName}`);

      if (!galleryData) galleryData = [];
      galleryData.unshift({
        id: `gal-${Date.now()}`,
        order: 1,
        title: title,
        title_en: "Rose Aden 2 Hotel Photo",
        description_ar: desc,
        category: category,
        group_ar: getCategoryArabic(category).replace(/^[^\s]+\s/, ''),
        badge_ar: badge,
        src: targetPath,
        show_in_carousel: inCarousel,
        featured: true,
        visible: true
      });
      galleryData.forEach((it, i) => { it.order = i + 1; });

      if (statusBox) statusBox.innerHTML = 'جاري تحديث ونشر <code>data/gallery.json</code> على GitHub...';
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), `Add gallery photo: ${title}`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = `✓ تم رفع ونشر الصورة وكامل بياناتها بنجاح في مجموعة <strong>${getCategoryArabic(category)}</strong>!`;
      }

      document.getElementById('proGalleryFileInput').value = '';
      setVal('proGalleryTitle', '');
      setVal('proGalleryBadge', '');
      setVal('proGalleryDesc', '');
      setTimeout(() => {
        document.getElementById('imagePreflightPanel').style.display = 'none';
        renderGalleryGrid();
      }, 1300);
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

    container.innerHTML = filtered.map(({ item: g, idx }) => {
      const isVis = g.visible !== false;
      const inCar = g.show_in_carousel !== false;
      return `
        <div class="adm-gallery-card" data-gidx="${idx}" style="opacity: ${isVis ? '1' : '0.6'};">
          <div style="position: relative;">
            <img src="../${g.src}" alt="${g.title}" onerror="this.src='../assets/images/building-day.jpg'">
            <span style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.82); color: var(--adm-gold-light); padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700; border: 1px solid var(--adm-border-gold);">
              #${g.order || (idx + 1)} • ${getCategoryArabic(g.category)}
            </span>
            ${g.badge_ar ? `<span style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: rgba(226,45,70,0.88); color:#fff; padding: 0.15rem 0.55rem; border-radius: 99px; font-size: 0.7rem; font-weight:700;">${g.badge_ar}</span>` : ''}
          </div>
          <div class="adm-gallery-card-body">
            <input type="text" class="adm-input" value="${g.title || ''}" placeholder="عنوان الصورة" style="padding: 0.35rem 0.6rem; font-size: 0.85rem; font-weight:700;" onchange="updateGalleryItemField(${idx}, 'title', this.value)">
            <input type="text" class="adm-input" value="${g.description_ar || ''}" placeholder="وصف الصورة (يظهر في المعرض والكاروسيل)" style="padding: 0.3rem 0.6rem; font-size: 0.78rem; color: var(--adm-text-sub);" onchange="updateGalleryItemField(${idx}, 'description_ar', this.value)">
            
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.4rem; margin-top:0.25rem;">
              <select class="adm-select" style="padding: 0.25rem 0.5rem; font-size: 0.78rem; flex-grow:1;" onchange="updateGalleryItemField(${idx}, 'category', this.value)">
                <option value="exterior" ${g.category === 'exterior' ? 'selected' : ''}>🏛️ الواجهة والمبنى</option>
                <option value="lobby" ${g.category === 'lobby' ? 'selected' : ''}>🛎️ الاستقبال واللوبي</option>
                <option value="vip" ${g.category === 'vip' ? 'selected' : ''}>👑 طيرمانات VIP</option>
                <option value="rooms" ${g.category === 'rooms' ? 'selected' : ''}>🛏️ الغرف والأجنحة</option>
                <option value="halls" ${g.category === 'halls' ? 'selected' : ''}>🎓 القاعات والوجبات</option>
              </select>
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" style="padding:0.25rem 0.45rem;" onclick="moveGalleryItemOrder(${idx}, -1)" title="تحريك لأعلى">⬆️</button>
              <button type="button" class="adm-btn adm-btn-outline adm-btn-sm" style="padding:0.25rem 0.45rem;" onclick="moveGalleryItemOrder(${idx}, 1)" title="تحريك لأسفل">⬇️</button>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; padding:0.35rem 0; border-top:1px solid rgba(255,255,255,0.06);">
              <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer; color:#cbd5e1;">
                <input type="checkbox" ${isVis ? 'checked' : ''} onchange="updateGalleryItemField(${idx}, 'visible', this.checked)"> 👁️ ظاهر
              </label>
              <label style="display:flex; align-items:center; gap:0.3rem; cursor:pointer; color:var(--adm-gold-light);">
                <input type="checkbox" ${inCar ? 'checked' : ''} onchange="updateGalleryItemField(${idx}, 'show_in_carousel', this.checked)"> 🎠 بالكاروسيل
              </label>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.4rem; margin-top: auto;">
              <button type="button" class="adm-btn adm-btn-gold adm-btn-sm" style="flex-grow:1; justify-content:center;" onclick="openGalleryItemModal(${idx})">
                ✏️ تعديل كامل والصورة
              </button>
              <button type="button" class="adm-btn adm-btn-danger adm-btn-sm btn-delete" onclick="deleteGalleryItem(${idx})">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.updateGalleryItemField = function (idx, field, val) {
    if (!galleryData || !galleryData[idx]) return;
    galleryData[idx][field] = val;
    if (field === 'category') {
      galleryData[idx].group_ar = getCategoryArabic(val).replace(/^[^\s]+\s/, '');
    }
    renderGalleryGrid();
    markUnsaved();
  };

  window.moveGalleryItemOrder = function (idx, dir) {
    if (!galleryData) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= galleryData.length) return;
    const temp = galleryData[idx];
    galleryData[idx] = galleryData[targetIdx];
    galleryData[targetIdx] = temp;
    galleryData.forEach((it, i) => { it.order = i + 1; });
    renderGalleryGrid();
    markUnsaved();
  };

  // Full Gallery Item Modal Editor
  window.openGalleryItemModal = function (idx) {
    if (!galleryData || !galleryData[idx]) return;
    currentEditingGalleryIndex = idx;
    galleryModalImageUploadBase64 = null;
    const g = galleryData[idx];

    const statusBox = document.getElementById('galModalStatus');
    const fileInput = document.getElementById('galModalFileInput');
    if (statusBox) statusBox.style.display = 'none';
    if (fileInput) fileInput.value = '';

    document.getElementById('galModalHeaderTitle').textContent = `🖼️ تحرير كامل بيانات العنصر #${idx + 1}: ${g.title || ''}`;
    document.getElementById('galModalImgPreview').src = `../${g.src}`;
    setVal('galModalImgPath', g.src || '');
    setVal('galModalTitleAr', g.title || '');
    setVal('galModalTitleEn', g.title_en || '');
    setVal('galModalDescAr', g.description_ar || '');
    setVal('galModalCategory', g.category || 'rooms');
    setVal('galModalBadgeAr', g.badge_ar || '');
    setVal('galModalOrder', g.order || (idx + 1));
    document.getElementById('galModalVisible').checked = g.visible !== false;
    document.getElementById('galModalCarousel').checked = g.show_in_carousel !== false;

    document.getElementById('galleryItemModalBackdrop').classList.add('open');
  };

  window.closeGalleryItemModal = function () {
    document.getElementById('galleryItemModalBackdrop').classList.remove('open');
  };

  window.handleGalleryModalImageFile = function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('galModalImgPreview');
    if (!file || !preview) return;
    compressImageFromFile(file, 1600, 0.85, (dataUrl, b64) => {
      preview.src = dataUrl;
      galleryModalImageUploadBase64 = b64;
    });
  };

  window.saveGalleryItemModalData = async function () {
    if (currentEditingGalleryIndex < 0 || !galleryData[currentEditingGalleryIndex]) return;
    const title = getVal('galModalTitleAr').trim();
    if (!title) {
      alert('يرجى إدخال عنوان الصورة.');
      return;
    }

    const saveBtn = document.getElementById('galModalSaveBtn');
    const statusBox = document.getElementById('galModalStatus');
    if (saveBtn) saveBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = '⏳ جاري حفظ بيانات العنصر ومزامنته مع GitHub...';
    }

    try {
      const item = galleryData[currentEditingGalleryIndex];
      let imgPath = getVal('galModalImgPath').trim() || item.src;

      if (galleryModalImageUploadBase64) {
        const newFile = `gallery-${Date.now()}.jpg`;
        imgPath = `assets/images/${newFile}`;
        if (statusBox) statusBox.innerHTML = `جاري رفع الصورة البديلة <code>${imgPath}</code> إلى GitHub...`;
        await commitBinaryFileToGitHub(imgPath, galleryModalImageUploadBase64, `Replace gallery image: ${newFile}`);
      }

      const cat = getVal('galModalCategory') || 'rooms';
      item.title = title;
      item.title_en = getVal('galModalTitleEn').trim() || item.title_en || 'Rose Aden 2 Hotel';
      item.description_ar = getVal('galModalDescAr').trim();
      item.category = cat;
      item.group_ar = getCategoryArabic(cat).replace(/^[^\s]+\s/, '');
      item.badge_ar = getVal('galModalBadgeAr').trim();
      item.order = parseInt(getVal('galModalOrder'), 10) || (currentEditingGalleryIndex + 1);
      item.visible = document.getElementById('galModalVisible').checked;
      item.show_in_carousel = document.getElementById('galModalCarousel').checked;
      item.src = imgPath;

      galleryData.sort((a, b) => (a.order || 999) - (b.order || 999));

      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), `Update gallery item: ${title}`);
      renderGalleryGrid();
      clearUnsaved();

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر بيانات وصورة العنصر على GitHub بنجاح!';
      }
      setTimeout(() => { closeGalleryItemModal(); }, 1000);
    } catch (err) {
      markUnsaved();
      renderGalleryGrid();
      if (statusBox) {
        statusBox.className = 'alert-box alert-warning';
        statusBox.innerHTML = `❌ خطأ أثناء النشر: ${err.message}`;
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  window.saveGalleryChangesToGitHub = async function () {
    try {
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), 'تحديث بيانات وترتيب ومجموعات معرض الصور عبر لوحة التحكم');
      clearUnsaved();
      alert('✓ تم حفظ ونشر كافة تعديلات المعرض على GitHub بنجاح!');
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
  // 9. Training Hall & Reviews (#tab-hall & #tab-reviews)
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
        <button type="button" class="adm-btn adm-btn-danger adm-btn-sm btn-delete" onclick="deleteReviewItem(${idx})">حذف التقييم</button>
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
  // 10. Atomic Global Sync & Publish Engine (All 9 JSON Datasets!)
  // =========================================================================
  function harvestAllOpenForms() {
    collectHotelInfoFromEditForm();
    collectThemeFromEditForm();
    collectHallFromEditForm();
    collectCurrentPageEditorFields();
    cacheUsersLocally(usersData);
  }

  window.syncAllToGitHub = async function () {
    if (!config.owner || !config.repo || !config.token) {
      alert('يرجى التأكد من إدخال اسم المستودع ورمز الوصول (Personal Access Token) في تبويب مستودع GitHub.');
      switchTab('tab-github');
      return;
    }

    harvestAllOpenForms();

    const terminal = document.getElementById('syncTerminal');
    const syncBtn = document.getElementById('syncAllBtn');
    if (syncBtn) syncBtn.disabled = true;
    if (terminal) {
      terminal.style.display = 'block';
      terminal.innerHTML = `> [${new Date().toLocaleTimeString()}] بدء المزامنة الذرية الموحدة لكافة ملفات الموقع الـ 9 مع GitHub...<br>`;
    }

    const filesPayload = {
      'data/theme.json': JSON.stringify(themeData, null, 2),
      'data/hotel-info.json': JSON.stringify(hotelData, null, 2),
      'data/pages-content.json': JSON.stringify(pagesContentData, null, 2),
      'data/rooms.json': JSON.stringify(roomsData, null, 2),
      'data/amenities.json': JSON.stringify(amenitiesData, null, 2),
      'data/hall.json': JSON.stringify(hallData, null, 2),
      'data/reviews.json': JSON.stringify(reviewsData, null, 2),
      'data/gallery.json': JSON.stringify(galleryData, null, 2),
      'data/users.json': JSON.stringify(usersData, null, 2)
    };

    try {
      logTerminal('> جاري تجميع ملفات البيانات الـ 9 (الهوية، الفندق، الصفحات والمنشورات، الغرف، المرافق، القاعة، التقييمات، المعرض، وكلمات المرور)...');
      try {
        const commitRes = await commitMultipleFilesAtomically(
          filesPayload,
          'تحديث شامل لبيانات وصفحات ومنشورات ومعرض وحسابات فندق روز عدن 2 (v10)'
        );
        Object.keys(filesPayload).forEach(fp => {
          logTerminal(`✓ تم تحديث ${fp} بنجاح.`);
        });
        logTerminal(`> رقم الـ Commit الموحد: <code>${(commitRes.sha || '').slice(0, 8)}</code>`);
      } catch (atomicErr) {
        console.warn('Atomic commit fallback to sequential:', atomicErr);
        logTerminal('> جاري الحفظ المتتالي الآمن للملفات...');
        for (const [filePath, content] of Object.entries(filesPayload)) {
          logTerminal(`> نشر ${filePath}...`);
          await commitTextFileToGitHub(filePath, content, `Sync ${filePath}`);
          logTerminal(`✓ تم تحديث ${filePath}.`);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      clearUnsaved();
      renderHotelInfoView();
      renderThemeView();
      renderHallView();

      logTerminal(`<br><span style="color:#10b981; font-weight:bold;">🎉 اكتملت المزامنة والنشر الشامل بنجاح 100% بدون أي أخطاء!</span>`);
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

  window.downloadBackupPackage = function () {
    harvestAllOpenForms();
    downloadFile('theme.json', themeData);
    downloadFile('hotel-info.json', hotelData);
    downloadFile('pages-content.json', pagesContentData);
    downloadFile('rooms.json', roomsData);
    downloadFile('amenities.json', amenitiesData);
    downloadFile('hall.json', hallData);
    downloadFile('reviews.json', reviewsData);
    downloadFile('gallery.json', galleryData);
    downloadFile('users.json', usersData);
    alert('تم تنزيل جميع ملفات البيانات الـ 9 بنجاح كنسخة احتياطية!');
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

  document.addEventListener('DOMContentLoaded', () => {
    setVal('ghOwner', config.owner);
    setVal('ghRepo', config.repo);
    setVal('ghBranch', config.branch);
    setVal('ghToken', config.token);

    initAdminAuth();
    renderUsersCards();
    testGitHubConnection();
    loadInitialData();
  });
})();
