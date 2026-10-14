/**
 * Rose Aden 2 Hotel - Pro Admin Engine & Pre-Flight Image Optimizer
 * محرك لوحة التحكم المتقدمة: التحرير المشروط، فحص الصور، والتحسين الآلي عبر المتصفح
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

  // Datasets Cache
  let hotelData = null;
  let roomsData = null;
  let themeData = null;
  let hallData = null;
  let reviewsData = null;
  let galleryData = null;

  // Pre-flight image state for gallery upload
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

  // Room modal editing state
  let currentEditingRoomIndex = -1;
  let roomImageUploadBase64 = null;

  // 1. Tab Switching
  window.switchTab = function (tabId) {
    document.querySelectorAll('.adm-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetTab) targetTab.classList.add('active');
    if (navBtn) navBtn.classList.add('active');
  };

  // 2. GitHub Connection
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
          alertBox.innerHTML = `✓ متصل بنجاح بمستودع <strong>${repoInfo.full_name}</strong> على الفرع <strong>${config.branch}</strong>. أنت جاهز للنشر والحفظ المباشر!`;
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

  // 3. Load Datasets
  async function loadInitialData() {
    try {
      const [hRes, rRes, thRes, hlRes, rvRes, gRes] = await Promise.all([
        fetch('../data/hotel-info.json'),
        fetch('../data/rooms.json'),
        fetch('../data/theme.json').catch(() => null),
        fetch('../data/hall.json'),
        fetch('../data/reviews.json'),
        fetch('../data/gallery.json')
      ]);

      hotelData = await hRes.json();
      roomsData = await rRes.json();
      themeData = thRes ? await thRes.json() : getDefaultTheme();
      hallData = await hlRes.json();
      reviewsData = await rvRes.json();
      galleryData = await gRes.json();

      renderHotelInfoView();
      renderThemeView();
      renderRoomsGrid();
      renderHallView();
      renderReviewsView();
      renderGalleryGrid();
    } catch (err) {
      console.warn('Error loading initial data:', err);
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
          <div class="view-item-label">اسم الفندق (عربي)</div>
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

  window.saveHotelInfoToGitHub = async function () {
    hotelData.name_ar = getVal('editHotelNameAr');
    hotelData.name_en = getVal('editHotelNameEn');
    hotelData.slogan_ar = getVal('editHotelSloganAr');
    hotelData.address_ar = getVal('editHotelAddressAr');
    hotelData.whatsapp = getVal('editHotelWa');
    hotelData.phones = (getVal('editHotelPhones') || '').split('|').map(s => s.trim()).filter(Boolean);
    hotelData.check_in = getVal('editHotelCheckIn');
    hotelData.check_out = getVal('editHotelCheckOut');

    const statusBox = document.getElementById('hotelSaveStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري إرسال التعديل إلى مستودع GitHub...';
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
      }, 1500);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-info';
        statusBox.innerHTML = `❌ خطأ أثناء الحفظ: ${err.message}`;
      }
    }
  };

  // =========================================================================
  // 5. Theme & Styling: View Mode vs Edit Mode
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

  window.saveThemeToGitHub = async function () {
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

    const statusBox = document.getElementById('themeSaveStatus');
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري إرسال إعدادات الألوان إلى GitHub...';
    }

    try {
      await commitTextFileToGitHub('data/theme.json', JSON.stringify(themeData, null, 2), 'تحديث هوية وألوان وشريط العروض عبر لوحة التحكم');
      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر إعدادات الهوية والألوان بنجاح!';
      }
      setTimeout(() => {
        if (statusBox) statusBox.style.display = 'none';
        renderThemeView();
      }, 1500);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-info';
        statusBox.innerHTML = `❌ خطأ أثناء الحفظ: ${err.message}`;
      }
    }
  };

  // =========================================================================
  // 6. Rooms & Suites: View Grid + Add/Edit Modal with Image Upload
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

    if (statusBox) statusBox.style.display = 'none';

    if (idx === -1) {
      // New Room
      title.textContent = '➕ إضافة غرفة أو جناح فندقي جديد';
      setVal('modalRoomTitleAr', '');
      setVal('modalRoomPrice', 'أسعار تنافسية');
      setVal('modalRoomBadge', 'جديد');
      setVal('modalRoomBeds', 'سرير مزدوج');
      setVal('modalRoomCap', '2 أشخاص');
      setVal('modalRoomCategory', 'standard');
      setVal('modalRoomFeatures', 'تكييف هادئ\nشاشة ذكية\nواي فاي فايبر مجاني');
      setVal('modalRoomImgPath', 'assets/images/room-twin.jpg');
      preview.src = '../assets/images/room-twin.jpg';
    } else {
      // Edit Existing
      const room = roomsData[idx];
      title.textContent = `✏️ تعديل: ${room.title_ar}`;
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

  // Preview local image selected for room
  window.handleRoomImageFile = function (e) {
    const file = e.target.files[0];
    const preview = document.getElementById('modalRoomImgPreview');
    if (file && preview) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        preview.src = evt.target.result;
        roomImageUploadBase64 = evt.target.result.split(',')[1];
      };
      reader.readAsDataURL(file);
    }
  };

  window.saveRoomModalData = async function () {
    const title = getVal('modalRoomTitleAr').trim();
    if (!title) {
      alert('يرجى كتابة اسم الغرفة على الأقل.');
      return;
    }

    const saveBtn = document.getElementById('modalRoomSaveBtn');
    const statusBox = document.getElementById('modalRoomStatus');
    if (saveBtn) saveBtn.disabled = true;
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.className = 'alert-box alert-info';
      statusBox.innerHTML = 'جاري معالجة بيانات الغرفة ورفع الصورة إن وجدت...';
    }

    try {
      let imagePath = getVal('modalRoomImgPath') || 'assets/images/suite-vip.jpg';

      // If user uploaded a new image file from computer
      if (roomImageUploadBase64) {
        const fileExt = 'jpg';
        const newFileName = `room-${Date.now()}.${fileExt}`;
        imagePath = `assets/images/${newFileName}`;
        if (statusBox) statusBox.innerHTML = `جاري رفع صورة الغرفة <code>${imagePath}</code> إلى مستودع GitHub...`;
        await commitBinaryFileToGitHub(imagePath, roomImageUploadBase64, `Upload room photo: ${newFileName}`);
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

      if (statusBox) statusBox.innerHTML = 'جاري تحديث ونشر قائمة الغرف على GitHub...';
      await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), `Update rooms.json: ${title}`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = '✓ تم حفظ ونشر الغرفة بنجاح على موقع الفندق!';
      }

      setTimeout(() => {
        closeRoomModal();
        renderRoomsGrid();
      }, 1200);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-info';
        statusBox.innerHTML = `❌ حدث خطأ: ${err.message}`;
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  window.deleteRoomItem = async function (idx) {
    if (!roomsData || !roomsData[idx]) return;
    const item = roomsData[idx];
    if (confirm(`هل أنت متأكد من رغبتك في حذف "${item.title_ar}" نهائياً من الموقع؟`)) {
      roomsData.splice(idx, 1);
      renderRoomsGrid();
      try {
        await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), `Delete room: ${item.title_ar}`);
        alert('تم حذف الغرفة وتحديث مستودع GitHub بنجاح.');
      } catch (e) {
        alert('تم الحذف محلياً. استخدم زر النشر الشامل لتطبيق التغيير على GitHub.');
      }
    }
  };

  // =========================================================================
  // 7. Smart Gallery & Pre-Flight Image Optimizer
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

      // Extract image natural dimensions
      const img = new Image();
      img.onload = () => {
        preflightState.width = img.naturalWidth;
        preflightState.height = img.naturalHeight;

        dimEl.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        const sizeKb = Math.round(file.size / 1024);
        sizeEl.textContent = file.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

        const ratio = (img.naturalWidth / img.naturalHeight).toFixed(2);
        ratioEl.textContent = ratio > 1.3 ? `${ratio}:1 (عريض Landscape)` : `${ratio}:1 (مربع/طولي)`;

        // Compatibility Verdict
        if (file.size > 1.2 * 1024 * 1024 || img.naturalWidth > 2400) {
          verdictEl.className = 'verdict-badge verdict-heavy';
          verdictEl.innerHTML = '⚠️ حجم وأبعاد كبيرة - يُنصح بالتحسين لتسريع الموقع';
          optBtn.style.display = 'inline-flex';
        } else {
          verdictEl.className = 'verdict-badge verdict-optimal';
          verdictEl.innerHTML = '✓ أبعاد وحجم مثاليان للعرض السريع على الويب';
          optBtn.style.display = 'none';
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Client-side auto-optimization using HTML5 Canvas
  window.autoOptimizeGalleryImage = function () {
    if (!preflightState.file) return;

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

      // Compress to JPEG with 0.84 quality
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
      preflightState.optimizedBase64 = compressedDataUrl.split(',')[1];

      // Calculate new size
      const approxBytes = Math.round((preflightState.optimizedBase64.length * 3) / 4);
      preflightState.optimizedSize = approxBytes;
      preflightState.isOptimized = true;

      // Update UI
      document.getElementById('preflightStageThumb').src = compressedDataUrl;
      document.getElementById('metricDimensions').textContent = `${targetWidth} × ${targetHeight} px (محسّن)`;

      const origKb = Math.round(preflightState.originalSize / 1024);
      const newKb = Math.round(approxBytes / 1024);
      const savings = Math.round(((preflightState.originalSize - approxBytes) / preflightState.originalSize) * 100);

      document.getElementById('metricSize').innerHTML = `
        <span style="color:#6ee7b7; font-weight:800;">${newKb} KB</span> 
        <small style="color:var(--adm-muted);">(توفير ${savings}%)</small>
      `;

      const verdictEl = document.getElementById('metricVerdict');
      verdictEl.className = 'verdict-badge verdict-optimal';
      verdictEl.innerHTML = `⚡ تم التحسين آلياً بنجاح! تم تقليص ${savings}% من الحجم`;

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
      statusBox.innerHTML = `جاري رفع الصورة <code>${targetPath}</code> إلى مستودع GitHub...`;
    }

    try {
      // 1. Commit image to GitHub repository
      await commitBinaryFileToGitHub(targetPath, base64ToUpload, `Upload gallery image: ${fileName}`);

      // 2. Insert into galleryData
      if (!galleryData) galleryData = [];
      const newPhoto = {
        title: title,
        category: category,
        src: targetPath
      };
      galleryData.unshift(newPhoto);

      // 3. Commit updated data/gallery.json
      if (statusBox) statusBox.innerHTML = 'جاري تحديث ونشر ملف المعرض <code>data/gallery.json</code>...';
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), `Add gallery photo: ${title}`);

      if (statusBox) {
        statusBox.className = 'alert-box alert-success';
        statusBox.innerHTML = `✓ تم رفع ونشر الصورة بنجاح في المعرض!<br>المسار: <code>${targetPath}</code> | القسم: <strong>${getCategoryArabic(category)}</strong>`;
      }

      // Reset file input & preflight panel
      document.getElementById('proGalleryFileInput').value = '';
      if (titleInput) titleInput.value = '';
      setTimeout(() => {
        document.getElementById('imagePreflightPanel').style.display = 'none';
        renderGalleryGrid();
      }, 1800);
    } catch (err) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-info';
        statusBox.innerHTML = `❌ خطأ أثناء الرفع: ${err.message}`;
      }
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
    }
  };

  function getCategoryArabic(cat) {
    const map = {
      'rooms': 'الغرف والأجنحة',
      'vip': 'طيرمانات VIP',
      'halls': 'قاعات التدريب والفعاليات',
      'lobby': 'الاستقبال واللوبي',
      'exterior': 'الواجهة والمبنى'
    };
    return map[cat] || cat;
  }

  function renderGalleryGrid() {
    const container = document.getElementById('proGalleryGrid');
    const badge = document.getElementById('proGalleryCountBadge');
    if (!galleryData) return;

    if (badge) badge.textContent = `${galleryData.length} صورة`;
    if (!container) return;

    container.innerHTML = galleryData.map((g, idx) => `
      <div class="adm-gallery-card" data-gidx="${idx}">
        <div style="position: relative;">
          <img src="../${g.src}" alt="${g.title}" onerror="this.src='../assets/images/building-day.jpg'">
          <span style="position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.75); color: var(--adm-gold); padding: 0.2rem 0.6rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700;">
            ${getCategoryArabic(g.category)}
          </span>
        </div>
        <div class="adm-gallery-card-body">
          <input type="text" class="adm-input" value="${g.title || ''}" style="padding: 0.35rem 0.6rem; font-size: 0.85rem;" onchange="galleryData[${idx}].title = this.value">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
            <select class="adm-select" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; width: auto;" onchange="galleryData[${idx}].category = this.value">
              <option value="rooms" ${g.category === 'rooms' ? 'selected' : ''}>غرف</option>
              <option value="vip" ${g.category === 'vip' ? 'selected' : ''}>VIP</option>
              <option value="halls" ${g.category === 'halls' ? 'selected' : ''}>قاعات</option>
              <option value="lobby" ${g.category === 'lobby' ? 'selected' : ''}>لوبي</option>
              <option value="exterior" ${g.category === 'exterior' ? 'selected' : ''}>واجهة</option>
            </select>
            <button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteGalleryItem(${idx})">حذف</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.deleteGalleryItem = async function (idx) {
    if (!galleryData || !galleryData[idx]) return;
    const item = galleryData[idx];
    if (confirm(`هل أنت متأكد من حذف صورة "${item.title}" من المعرض؟`)) {
      galleryData.splice(idx, 1);
      renderGalleryGrid();
      try {
        await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), `Delete gallery photo: ${item.title}`);
        alert('تم حذف الصورة وتحديث المعرض في GitHub بنجاح.');
      } catch (e) {
        alert('تم الحذف محلياً. استخدم زر النشر الشامل لتطبيق التحديث على GitHub.');
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

  window.saveHallToGitHub = async function () {
    hallData.title_ar = getVal('editHallTitleAr');
    hallData.capacity = getVal('editHallCapacity');
    hallData.specs_ar = (getVal('editHallSpecs') || '').split('\n').map(s => s.trim()).filter(Boolean);

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
      }, 1500);
    } catch (e) {
      if (statusBox) {
        statusBox.className = 'alert-box alert-info';
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

  window.addNewReviewPrompt = function () {
    const name = prompt('اسم النزيل أو الضيف:');
    if (!name) return;
    const role = prompt('الصفة أو العمل (مثال: نزيل جناح VIP):') || 'نزيل';
    const comment = prompt('نص التقييم:') || 'إقامة ممتازة وخدمة راقية.';

    if (!reviewsData) reviewsData = [];
    reviewsData.push({
      name: name,
      role: role,
      rating: 5,
      comment_ar: comment
    });
    renderReviewsView();
    commitTextFileToGitHub('data/reviews.json', JSON.stringify(reviewsData, null, 2), `Add review: ${name}`);
  };

  window.deleteReviewItem = async function (idx) {
    if (!reviewsData || !reviewsData[idx]) return;
    if (confirm('حذف هذا التقييم؟')) {
      reviewsData.splice(idx, 1);
      renderReviewsView();
      await commitTextFileToGitHub('data/reviews.json', JSON.stringify(reviewsData, null, 2), 'Delete review');
    }
  };

  // =========================================================================
  // 9. Full Sync & Publish to GitHub
  // =========================================================================
  window.syncAllToGitHub = async function () {
    if (!config.owner || !config.repo || !config.token) {
      alert('يرجى التأكد من إدخال اسم المستودع ورمز الوصول (Personal Access Token) في تبويب GitHub.');
      switchTab('tab-github');
      return;
    }

    const terminal = document.getElementById('syncTerminal');
    const syncBtn = document.getElementById('syncAllBtn');
    if (syncBtn) syncBtn.disabled = true;
    if (terminal) {
      terminal.style.display = 'block';
      terminal.innerHTML = `> [${new Date().toLocaleTimeString()}] بدء المزامنة والنشر الشامل لكافة ملفات الموقع...<br>`;
    }

    try {
      logTerminal('> نشر data/theme.json (الهوية والألوان)...');
      await commitTextFileToGitHub('data/theme.json', JSON.stringify(themeData, null, 2), 'Sync theme.json');
      await sleep(800);
      logTerminal('✓ تم تحديث data/theme.json.');

      logTerminal('> نشر data/hotel-info.json (بيانات الفندق)...');
      await commitTextFileToGitHub('data/hotel-info.json', JSON.stringify(hotelData, null, 2), 'Sync hotel-info.json');
      await sleep(800);
      logTerminal('✓ تم تحديث data/hotel-info.json.');

      logTerminal('> نشر data/rooms.json (الغرف والأسعار)...');
      await commitTextFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), 'Sync rooms.json');
      await sleep(800);
      logTerminal('✓ تم تحديث data/rooms.json.');

      logTerminal('> نشر data/hall.json (قاعة المؤتمرات)...');
      await commitTextFileToGitHub('data/hall.json', JSON.stringify(hallData, null, 2), 'Sync hall.json');
      await sleep(800);
      logTerminal('✓ تم تحديث data/hall.json.');

      logTerminal('> نشر data/reviews.json (التقييمات)...');
      await commitTextFileToGitHub('data/reviews.json', JSON.stringify(reviewsData, null, 2), 'Sync reviews.json');
      await sleep(800);
      logTerminal('✓ تم تحديث data/reviews.json.');

      logTerminal('> نشر data/gallery.json (صور المعرض)...');
      await commitTextFileToGitHub('data/gallery.json', JSON.stringify(galleryData, null, 2), 'Sync gallery.json');
      await sleep(800);
      logTerminal('✓ تم تحديث data/gallery.json.');

      logTerminal(`<br><span style="color:#10b981; font-weight:bold;">🎉 اكتملت المزامنة بنجاح 100%!</span>`);
      logTerminal(`> يقوم GitHub Pages الآن بنشر التحديثات على الرابط الحي: <a href="https://${config.owner.toLowerCase()}.github.io/${config.repo}/" target="_blank" style="color:#d4af37;">https://${config.owner.toLowerCase()}.github.io/${config.repo}/</a>`);
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

  // GitHub API Binary & Text Committer
  // Robust GitHub API Helper: Fetch fresh SHA with strict cache-busting
  async function getFreshFileSha(path) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}&_cb=${Date.now()}`;
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const fileJson = await res.json();
        return fileJson.sha || null;
      }
    } catch (e) {
      // file might be newly created
    }
    return null;
  }

  async function commitTextFileToGitHub(path, content, message) {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    return commitBinaryFileToGitHub(path, base64, message);
  }

  async function commitBinaryFileToGitHub(path, base64Content, message, retryCount = 0) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
    
    // Always get the absolute latest SHA directly from GitHub without any browser caching
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
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      // Auto-retry on 409 SHA conflict up to 3 times with exponential backoff
      if (putRes.status === 409 && retryCount < 3) {
        console.warn(`409 Conflict on ${path}, retrying with fresh SHA (attempt ${retryCount + 1})...`);
        await new Promise(r => setTimeout(r, 1200 * (retryCount + 1)));
        return commitBinaryFileToGitHub(path, base64Content, message, retryCount + 1);
      }
      throw new Error(err.message || 'فشل إرسال الملف إلى GitHub');
    }
    return await putRes.json();
  }

  // Delay helper
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

  // Backup Download
  window.downloadBackupPackage = function () {
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
    loadInitialData();
  });
})();