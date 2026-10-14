/**
 * Rose Aden 2 Hotel - Enterprise Admin CMS & GitHub Sync Engine
 * محرك لوحة التحكم المتقدمة: تخصيص الهوية، الألوان، الوسائط، والمزامنة مع GitHub
 */

(function () {
  'use strict';

  // Config State
  let config = {
    owner: localStorage.getItem('rose_gh_owner') || 'ProNetComputer',
    repo: localStorage.getItem('rose_gh_repo') || 'RoseAdenHotel-2',
    branch: localStorage.getItem('rose_gh_branch') || 'main',
    token: localStorage.getItem('rose_gh_token') || 'ghp_brEIi45WzJNmxsEJBUi33tKqJPD2XE2exfUe'
  };

  // Datasets
  let themeData = null;
  let hotelData = null;
  let roomsData = null;
  let hallData = null;
  let reviewsData = null;
  let galleryData = null;

  // 1. Tab Switching
  window.switchTab = function (tabId) {
    document.querySelectorAll('.adm-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetTab) targetTab.classList.add('active');
    if (navBtn) navBtn.classList.add('active');
  };

  // 2. GitHub Config
  window.saveGitHubConfig = function (e) {
    if (e) e.preventDefault();
    config.owner = document.getElementById('ghOwner').value.trim();
    config.repo = document.getElementById('ghRepo').value.trim();
    config.branch = document.getElementById('ghBranch').value.trim() || 'main';
    config.token = document.getElementById('ghToken').value.trim();

    localStorage.setItem('rose_gh_owner', config.owner);
    localStorage.setItem('rose_gh_repo', config.repo);
    localStorage.setItem('rose_gh_branch', config.branch);
    localStorage.setItem('rose_gh_token', config.token);

    alert('تم حفظ إعدادات GitHub بنجاح!');
    testGitHubConnection();
  };

  // Test Connection
  window.testGitHubConnection = async function () {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const alertBox = document.getElementById('ghConnAlert');

    if (!config.owner || !config.repo || !config.token) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.textContent = 'غير متصل (أدخل بيانات GitHub)';
      return;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (res.ok) {
        const repoInfo = await res.json();
        if (statusDot) statusDot.className = 'status-dot connected';
        if (statusText) statusText.textContent = `متصل: ${repoInfo.full_name} (${config.branch})`;
        if (alertBox) {
          alertBox.className = 'alert-box alert-success';
          alertBox.innerHTML = `✓ متصل بنجاح بمستودع <strong>${repoInfo.full_name}</strong> على الفرع <strong>${config.branch}</strong>. أنت جاهز للنشر المباشر!`;
        }
      } else {
        throw new Error('فشل التحقق من المستودع أو الرمز (Token)');
      }
    } catch (err) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.textContent = 'خطأ في الاتصال بـ GitHub';
      if (alertBox) {
        alertBox.className = 'alert-box alert-info';
        alertBox.textContent = 'تعذر الاتصال بـ GitHub. يرجى مراجعة صحة اسم المستودع والرمز (Token).';
      }
    }
  };

  // 3. Load Datasets
  async function loadAllData() {
    try {
      const [thRes, hRes, rRes, hlRes, rvRes, gRes] = await Promise.all([
        fetch('../data/theme.json').catch(() => null),
        fetch('../data/hotel-info.json'),
        fetch('../data/rooms.json'),
        fetch('../data/hall.json'),
        fetch('../data/reviews.json'),
        fetch('../data/gallery.json')
      ]);

      themeData = thRes ? await thRes.json() : getDefaultTheme();
      hotelData = await hRes.json();
      roomsData = await rRes.json();
      hallData = await hlRes.json();
      reviewsData = await rvRes.json();
      galleryData = await gRes.json();

      populateThemeForm();
      populateHotelForm();
      populateRoomsList();
      populateHallForm();
      populateReviewsList();
      populateGalleryList();
    } catch (err) {
      console.warn('Error loading local data:', err);
    }
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
        text_ar: "✨ عرض خاص: خصم مميز على أجنحة وطيرمانات VIP بإطلالة ساحل أبين!",
        link: "https://wa.me/967780000656",
        btn_text: "احجز بالعرض"
      }
    };
  }

  // 4. Populate Forms
  function populateThemeForm() {
    if (!themeData) return;
    setVal('thmPrimary', themeData.rose_primary || '#e22d46');
    setVal('thmPrimaryText', themeData.rose_primary || '#e22d46');
    setVal('thmGold', themeData.luxury_gold || '#d4af37');
    setVal('thmGoldText', themeData.luxury_gold || '#d4af37');
    setVal('thmFont', themeData.font_arabic || "'Cairo', system-ui, sans-serif");
    setVal('thmRadius', themeData.border_radius || '18px');

    if (themeData.announcement) {
      const ann = themeData.announcement;
      const chk = document.getElementById('annEnabled');
      if (chk) chk.checked = !!ann.enabled;
      setVal('annTextAr', ann.text_ar || '');
      setVal('annLink', ann.link || '');
      setVal('annBtn', ann.btn_text || '');
    }

    updateThemePreview();
  }

  window.syncColorInput = function (pickerId, textId) {
    const picker = document.getElementById(pickerId);
    const text = document.getElementById(textId);
    if (picker && text) {
      text.value = picker.value;
      updateThemePreview();
    }
  };

  window.syncTextInput = function (textId, pickerId) {
    const text = document.getElementById(textId);
    const picker = document.getElementById(pickerId);
    if (text && picker && /^#[0-9A-Fa-f]{6}$/.test(text.value)) {
      picker.value = text.value;
      updateThemePreview();
    }
  };

  window.setPresetColor = function (primary, gold) {
    setVal('thmPrimary', primary);
    setVal('thmPrimaryText', primary);
    setVal('thmGold', gold);
    setVal('thmGoldText', gold);
    updateThemePreview();
  };

  function updateThemePreview() {
    const p = document.getElementById('thmPrimary') ? document.getElementById('thmPrimary').value : '#e22d46';
    const g = document.getElementById('thmGold') ? document.getElementById('thmGold').value : '#d4af37';
    const previewBox = document.getElementById('themePreviewBox');
    if (previewBox) {
      previewBox.style.setProperty('--prev-primary', p);
      previewBox.style.setProperty('--prev-gold', g);
    }
  }

  function populateHotelForm() {
    if (!hotelData) return;
    setVal('hotelNameAr', hotelData.name_ar || '');
    setVal('hotelNameEn', hotelData.name_en || '');
    setVal('hotelSloganAr', hotelData.slogan_ar || '');
    setVal('hotelAddressAr', hotelData.address_ar || '');
    setVal('hotelWa', hotelData.whatsapp || '');
    setVal('hotelPhones', (hotelData.phones || []).join(' | '));
    setVal('hotelCheckIn', hotelData.check_in || '14:00');
    setVal('hotelCheckOut', hotelData.check_out || '12:00');
  }

  function populateRoomsList() {
    const container = document.getElementById('roomsContainer');
    if (!container || !roomsData) return;

    container.innerHTML = roomsData.map((room, idx) => `
      <div class="room-edit-card" data-idx="${idx}">
        <div class="room-edit-header">
          <strong style="color: var(--adm-gold); font-size: 1.15rem;">#${idx + 1} ${room.title_ar}</strong>
          <div>
            <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteRoom(${idx})">حذف الغرفة</button>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>اسم الغرفة (بالعربية)</label>
            <input type="text" class="adm-input r-title-ar" value="${room.title_ar || ''}">
          </div>
          <div class="form-group">
            <label>سعر الليلة</label>
            <input type="text" class="adm-input r-price" value="${room.price_per_night || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>الشارة الترويجية (Badge)</label>
            <input type="text" class="adm-input r-badge" value="${room.badge_ar || ''}">
          </div>
          <div class="form-group">
            <label>نوع السرير والسعة</label>
            <input type="text" class="adm-input r-beds" value="${room.beds_ar || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>مسار الصورة</label>
            <input type="text" class="adm-input r-img" value="${room.image || ''}">
          </div>
          <div class="form-group">
            <label>السعة (عدد النزلاء)</label>
            <input type="text" class="adm-input r-cap" value="${room.capacity_ar || ''}">
          </div>
        </div>

        <div class="form-group">
          <label>المميزات (مفصولة بفاصلة أو سطر جديد)</label>
          <textarea class="adm-textarea r-features" rows="3">${(room.features_ar || []).join('\n')}</textarea>
        </div>
      </div>
    `).join('');
  }

  window.addNewRoom = function () {
    if (!roomsData) roomsData = [];
    roomsData.push({
      id: `room-custom-${Date.now()}`,
      category: 'standard',
      title_ar: 'غرفة فاخرة جديدة',
      title_en: 'New Deluxe Room',
      badge_ar: 'جديد',
      badge_en: 'New',
      price_per_night: 'حسب الطلب',
      price_en: 'Special Rate',
      beds_ar: 'سرير مزدوج مريح',
      beds_en: 'Double Bed',
      capacity_ar: '2 أشخاص',
      capacity_en: '2 Guests',
      image: 'assets/images/room-twin.jpg',
      features_ar: ['تكييف صامت', 'شاشة ذكية', 'واي فاي فايبر مجاني']
    });
    populateRoomsList();
  };

  window.deleteRoom = function (idx) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذه الغرفة من القائمة؟')) {
      roomsData.splice(idx, 1);
      populateRoomsList();
    }
  };

  function populateHallForm() {
    if (!hallData) return;
    setVal('hallTitleAr', hallData.title_ar || '');
    setVal('hallCapacity', hallData.capacity || '');
    setVal('hallSpecs', (hallData.specs_ar || []).join('\n'));
  }

  function populateReviewsList() {
    const container = document.getElementById('reviewsContainer');
    if (!container || !reviewsData) return;

    container.innerHTML = reviewsData.map((rev, idx) => `
      <div class="room-edit-card" data-rev-idx="${idx}">
        <div class="room-edit-header">
          <strong>${rev.name} (${'★'.repeat(rev.rating || 5)})</strong>
          <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteReview(${idx})">حذف</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>اسم النزيل</label>
            <input type="text" class="adm-input rev-name" value="${rev.name || ''}">
          </div>
          <div class="form-group">
            <label>الصفة / الوظيفة</label>
            <input type="text" class="adm-input rev-role" value="${rev.role || ''}">
          </div>
          <div class="form-group" style="max-width: 120px;">
            <label>التقييم (1-5)</label>
            <input type="number" min="1" max="5" class="adm-input rev-rating" value="${rev.rating || 5}">
          </div>
        </div>
        <div class="form-group">
          <label>التعليق</label>
          <textarea class="adm-textarea rev-comment" rows="2">${rev.comment_ar || ''}</textarea>
        </div>
      </div>
    `).join('');
  }

  window.addNewReview = function () {
    if (!reviewsData) reviewsData = [];
    reviewsData.push({
      name: 'ضيف كريم',
      role: 'نزيل في الفندق',
      rating: 5,
      comment_ar: 'إقامة ممتازة وخدمة استثنائية ونظافة عالية.'
    });
    populateReviewsList();
  };

  window.deleteReview = function (idx) {
    reviewsData.splice(idx, 1);
    populateReviewsList();
  };

  function populateGalleryList() {
    const container = document.getElementById('galleryContainer');
    if (!container || !galleryData) return;

    container.innerHTML = galleryData.map((g, idx) => `
      <div style="display: flex; gap: 1rem; align-items: center; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid var(--adm-border);">
        <img src="../${g.src}" style="width: 60px; height: 45px; object-fit: cover; border-radius: 6px;" onerror="this.src='../assets/images/logo.jpg'">
        <div style="flex-grow: 1;">
          <input type="text" class="adm-input g-title" value="${g.title || ''}" style="padding: 0.35rem 0.6rem; font-size: 0.85rem; margin-bottom: 0.25rem;">
          <input type="text" class="adm-input g-src" value="${g.src || ''}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; color: var(--adm-muted);">
        </div>
        <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteGalleryItem(${idx})">&times;</button>
      </div>
    `).join('');
  }

  window.addGalleryItem = function () {
    if (!galleryData) galleryData = [];
    galleryData.push({
      title: 'صورة جديدة',
      category: 'rooms',
      src: 'assets/images/suite-vip.jpg'
    });
    populateGalleryList();
  };

  window.deleteGalleryItem = function (idx) {
    galleryData.splice(idx, 1);
    populateGalleryList();
  };

  // 5. Direct Image Upload to GitHub Repository via REST API
  window.uploadDirectAsset = async function (fileInputId, targetRepoPath, statusBoxId) {
    const fileInput = document.getElementById(fileInputId);
    const statusBox = document.getElementById(statusBoxId);

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      alert('يرجى اختيار ملف صورة أولاً من جهازك.');
      return;
    }

    if (!config.owner || !config.repo || !config.token) {
      alert('يرجى التأكد من حفظ إعدادات GitHub والرمز (Token) أولاً في التبويب الأول.');
      return;
    }

    const file = fileInput.files[0];
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = `جاري قراءة ورفع <strong>${file.name}</strong> إلى <code>${targetRepoPath}</code>...`;
    }

    try {
      const base64Data = await readFileAsBase64(file);
      await commitBinaryFileToGitHub(targetRepoPath, base64Data, `Upload media asset: ${targetRepoPath} via Admin Panel`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = `✓ تم رفع <strong>${targetRepoPath}</strong> بنجاح إلى مستودع GitHub! سيتم تحديث العرض فوراً.`;
      }
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-info';
        statusBox.innerHTML = `❌ خطأ أثناء رفع الصورة: ${err.message}`;
      }
    }
  };

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const b64 = result.split(',')[1];
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 6. Collect All Data from Forms
  function collectAllData() {
    // Theme
    themeData = {
      rose_primary: getVal('thmPrimary') || '#e22d46',
      rose_dark: darkenColor(getVal('thmPrimary') || '#e22d46'),
      luxury_gold: getVal('thmGold') || '#d4af37',
      luxury_gold_light: lightenColor(getVal('thmGold') || '#d4af37'),
      font_arabic: getVal('thmFont') || "'Cairo', system-ui, sans-serif",
      border_radius: getVal('thmRadius') || '18px',
      announcement: {
        enabled: document.getElementById('annEnabled') ? document.getElementById('annEnabled').checked : false,
        text_ar: getVal('annTextAr') || '',
        link: getVal('annLink') || '',
        btn_text: getVal('annBtn') || 'احجز بالعرض'
      }
    };

    // Hotel Info
    if (hotelData) {
      hotelData.name_ar = getVal('hotelNameAr');
      hotelData.name_en = getVal('hotelNameEn');
      hotelData.slogan_ar = getVal('hotelSloganAr');
      hotelData.address_ar = getVal('hotelAddressAr');
      hotelData.whatsapp = getVal('hotelWa');
      hotelData.phones = (getVal('hotelPhones') || '').split('|').map(s => s.trim()).filter(Boolean);
      hotelData.check_in = getVal('hotelCheckIn');
      hotelData.check_out = getVal('hotelCheckOut');
    }

    // Rooms
    if (roomsData) {
      document.querySelectorAll('.room-edit-card[data-idx]').forEach((card, idx) => {
        if (roomsData[idx]) {
          roomsData[idx].title_ar = card.querySelector('.r-title-ar').value;
          roomsData[idx].price_per_night = card.querySelector('.r-price').value;
          roomsData[idx].badge_ar = card.querySelector('.r-badge').value;
          roomsData[idx].beds_ar = card.querySelector('.r-beds').value;
          roomsData[idx].image = card.querySelector('.r-img').value;
          roomsData[idx].capacity_ar = card.querySelector('.r-cap').value;
          roomsData[idx].features_ar = card.querySelector('.r-features').value.split('\n').map(s => s.trim()).filter(Boolean);
        }
      });
    }

    // Hall
    if (hallData) {
      hallData.title_ar = getVal('hallTitleAr');
      hallData.capacity = getVal('hallCapacity');
      hallData.specs_ar = (getVal('hallSpecs') || '').split('\n').map(s => s.trim()).filter(Boolean);
    }

    // Reviews
    if (reviewsData) {
      document.querySelectorAll('.room-edit-card[data-rev-idx]').forEach((card, idx) => {
        if (reviewsData[idx]) {
          reviewsData[idx].name = card.querySelector('.rev-name').value;
          reviewsData[idx].role = card.querySelector('.rev-role').value;
          reviewsData[idx].rating = parseInt(card.querySelector('.rev-rating').value, 10) || 5;
          reviewsData[idx].comment_ar = card.querySelector('.rev-comment').value;
        }
      });
    }

    // Gallery
    if (galleryData) {
      const titles = document.querySelectorAll('.g-title');
      const srcs = document.querySelectorAll('.g-src');
      galleryData.forEach((g, idx) => {
        if (titles[idx]) g.title = titles[idx].value;
        if (srcs[idx]) g.src = srcs[idx].value;
      });
    }
  }

  // 7. Full Sync & Push to GitHub REST API
  window.syncAllToGitHub = async function () {
    if (!config.owner || !config.repo || !config.token) {
      alert('يرجى التأكد من إدخال اسم المستودع ورمز الوصول (Personal Access Token) في تبويب GitHub.');
      switchTab('tab-github');
      return;
    }

    collectAllData();

    const terminal = document.getElementById('syncTerminal');
    const syncBtn = document.getElementById('syncAllBtn');
    if (syncBtn) syncBtn.disabled = true;
    if (terminal) {
      terminal.style.display = 'block';
      terminal.innerHTML = `> [${new Date().toLocaleTimeString()}] بدء مزامنة التعديلات الشاملة مع GitHub...<br>`;
    }

    try {
      // 1. theme.json
      logTerminal('> تحديث data/theme.json (الألوان، الخطوط، وشريط العروض)...');
      await commitTextFileToGitHub('data/theme.json', JSON.stringify(themeData, null, 2), 'تحديث هوية وألوان وشريط العروض عبر لوحة التحكم');
      logTerminal('✓ تم تحديث data/theme.json بنجاح.');

      // 2. hotel-info.json
      logTerminal('> تحديث data/hotel-info.json (بيانات الفندق والاتصال)...');
      await commitTextFileToGitHub('data/hotel-info.json', JSON.stringify(hotelData, null, 2), 'تحديث معلومات الفندق والاتصال عبر لوحة التحكم');
      logTerminal('✓ تم تحديث data/hotel-info.json بنجاح.');

      // 3. rooms.json
      logTerminal('> تحديث data/rooms.json (الغرف والأسعار والمميزات)...');
      await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), 'تحديث قائمة وأسعار ومميزات الغرف عبر لوحة التحكم');
      logTerminal('✓ تم تحديث data/rooms.json بنجاح.');

      // 4. hall.json
      logTerminal('> تحديث data/hall.json (قاعة التدريب)...');
      await commitTextFileToGitHub('data/hall.json', JSON.stringify(hallData, null, 2), 'تحديث قاعة التدريب والمؤتمرات عبر لوحة التحكم');
      logTerminal('✓ تم تحديث data/hall.json بنجاح.');

      // 5. reviews.json
      logTerminal('> تحديث data/reviews.json (تقييمات النزلاء)...');
      await commitTextFileToGitHub('data/reviews.json', JSON.stringify(reviewsData, null, 2), 'تحديث آراء النزلاء والتقييمات عبر لوحة التحكم');
      logTerminal('✓ تم تحديث data/reviews.json بنجاح.');

      // 6. gallery.json
      logTerminal('> تحديث data/gallery.json (معرض الصور)...');
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), 'تحديث قائمة صور المعرض عبر لوحة التحكم');
      logTerminal('✓ تم تحديث data/gallery.json بنجاح.');

      logTerminal(`<br><span style="color:#10b981; font-weight:bold;">🎉 اكتملت المزامنة بنجاح بنسبة 100%!</span>`);
      logTerminal(`> يقوم GitHub Pages الآن بإعادة بناء ونشر الموقع الحي في أقل من 40 ثانية.`);
      logTerminal(`> رابط الموقع الحي: <a href="https://${config.owner.toLowerCase()}.github.io/${config.repo}/" target="_blank" style="color:#d4af37;">https://${config.owner.toLowerCase()}.github.io/${config.repo}/</a>`);
    } catch (err) {
      logTerminal(`<br><span style="color:#ef4444; font-weight:bold;">❌ حدث خطأ: ${err.message}</span>`);
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

  // GitHub API Helpers
  async function commitTextFileToGitHub(path, content, message) {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    return commitBinaryFileToGitHub(path, base64, message);
  }

  async function commitBinaryFileToGitHub(path, base64Content, message) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
    
    let sha = null;
    try {
      const getRes = await fetch(`${url}?ref=${config.branch}`, {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileJson = await getRes.json();
        sha = fileJson.sha;
      }
    } catch (e) {
      // file might be new
    }

    const body = {
      message: message,
      content: base64Content,
      branch: config.branch
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || 'فشل رفع الملف إلى GitHub');
    }
    return await putRes.json();
  }

  // Color math
  function darkenColor(hex) {
    try {
      const col = parseInt(hex.replace('#',''), 16);
      const r = Math.max(0, ((col >> 16) & 255) - 35);
      const g = Math.max(0, ((col >> 8) & 255) - 35);
      const b = Math.max(0, (col & 255) - 35);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) { return hex; }
  }

  function lightenColor(hex) {
    try {
      const col = parseInt(hex.replace('#',''), 16);
      const r = Math.min(255, ((col >> 16) & 255) + 35);
      const g = Math.min(255, ((col >> 8) & 255) + 35);
      const b = Math.min(255, (col & 255) + 35);
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    } catch (e) { return hex; }
  }

  // Backup Export
  window.downloadBackupPackage = function () {
    collectAllData();
    downloadFile('theme.json', themeData);
    downloadFile('hotel-info.json', hotelData);
    downloadFile('rooms.json', roomsData);
    downloadFile('hall.json', hallData);
    downloadFile('reviews.json', reviewsData);
    downloadFile('gallery.json', galleryData);
    alert('تم تحميل جميع ملفات التكوين والبيانات بنجاح كنسخة احتياطية!');
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

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    setVal('ghOwner', config.owner);
    setVal('ghRepo', config.repo);
    setVal('ghBranch', config.branch);
    setVal('ghToken', config.token);

    testGitHubConnection();
    loadAllData();
  });
})();