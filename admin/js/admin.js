/**
 * Rose Aden 2 Hotel - Admin CMS & GitHub Sync Engine
 * محرك لوحة التحكم والمزامنة المباشرة مع GitHub REST API
 */

(function () {
  'use strict';

  // State
  let config = {
    owner: localStorage.getItem('rose_gh_owner') || '',
    repo: localStorage.getItem('rose_gh_repo') || '',
    branch: localStorage.getItem('rose_gh_branch') || 'main',
    token: localStorage.getItem('rose_gh_token') || ''
  };

  let hotelData = null;
  let roomsData = null;
  let hallData = null;

  // Tab Switching
  window.switchTab = function (tabId) {
    document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (targetTab) targetTab.classList.add('active');
    if (navBtn) navBtn.classList.add('active');
  };

  // Save GitHub Config
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

    alert('تم حفظ إعدادات GitHub بنجاح في متصفحك!');
    testGitHubConnection();
  };

  // Test Connection to GitHub
  window.testGitHubConnection = async function () {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (!config.owner || !config.repo || !config.token) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.textContent = 'وضع محلي (غير متصل بـ GitHub)';
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
        if (statusDot) statusDot.className = 'status-dot connected';
        if (statusText) statusText.textContent = `متصل بالمستودع (${config.owner}/${config.repo})`;
        const alertBox = document.getElementById('ghConnAlert');
        if (alertBox) {
          alertBox.className = 'alert-box alert-success';
          alertBox.textContent = `✓ تم الاتصال بمستودع GitHub بنجاح! الفرع المستهدف: ${config.branch}`;
        }
      } else {
        throw new Error('فشل التحقق من المستودع أو الرمز (Token)');
      }
    } catch (err) {
      if (statusDot) statusDot.className = 'status-dot';
      if (statusText) statusText.textContent = 'خطأ في الاتصال بـ GitHub';
      const alertBox = document.getElementById('ghConnAlert');
      if (alertBox) {
        alertBox.className = 'alert-box alert-info';
        alertBox.textContent = 'تعذر الاتصال: يرجى التأكد من صحة اسم المستخدم واسم المستودع ورمز الوصول Personal Access Token.';
      }
    }
  };

  // Load Data
  async function loadInitialData() {
    try {
      const [hRes, rRes, hlRes] = await Promise.all([
        fetch('../data/hotel-info.json'),
        fetch('../data/rooms.json'),
        fetch('../data/hall.json')
      ]);

      hotelData = await hRes.json();
      roomsData = await rRes.json();
      hallData = await hlRes.json();

      populateHotelForm();
      populateRoomsList();
      populateHallForm();
    } catch (err) {
      console.warn('Using fallback data:', err);
    }
  }

  function populateHotelForm() {
    if (!hotelData) return;
    if (document.getElementById('hotelNameAr')) document.getElementById('hotelNameAr').value = hotelData.name_ar || '';
    if (document.getElementById('hotelSloganAr')) document.getElementById('hotelSloganAr').value = hotelData.slogan_ar || '';
    if (document.getElementById('hotelAddressAr')) document.getElementById('hotelAddressAr').value = hotelData.address_ar || '';
    if (document.getElementById('hotelWa')) document.getElementById('hotelWa').value = hotelData.whatsapp || '';
    if (document.getElementById('hotelPhones')) document.getElementById('hotelPhones').value = (hotelData.phones || []).join(' | ');
  }

  function populateRoomsList() {
    const container = document.getElementById('roomsListContainer');
    if (!container || !roomsData) return;

    container.innerHTML = roomsData.map((room, idx) => `
      <div class="room-edit-card" data-index="${idx}">
        <div class="room-edit-header">
          <strong style="color: var(--admin-gold); font-size: 1.1rem;">#${idx + 1} ${room.title_ar}</strong>
          <span style="font-size: 0.85rem; color: var(--admin-muted);">${room.id}</span>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>اسم الغرفة (عربي)</label>
            <input type="text" class="admin-input room-title-input" value="${room.title_ar}">
          </div>
          <div class="form-group">
            <label>سعر الليلة</label>
            <input type="text" class="admin-input room-price-input" value="${room.price_per_night}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>الشارة الترويجية (Badge)</label>
            <input type="text" class="admin-input room-badge-input" value="${room.badge_ar}">
          </div>
          <div class="form-group">
            <label>السعة والأسرة</label>
            <input type="text" class="admin-input room-beds-input" value="${room.beds_ar}">
          </div>
        </div>
      </div>
    `).join('');
  }

  function populateHallForm() {
    if (!hallData) return;
    if (document.getElementById('hallTitleAr')) document.getElementById('hallTitleAr').value = hallData.title_ar || '';
    if (document.getElementById('hallCapacity')) document.getElementById('hallCapacity').value = hallData.capacity || '';
  }

  // Collect updated data from forms
  function collectUpdatedData() {
    if (hotelData) {
      if (document.getElementById('hotelNameAr')) hotelData.name_ar = document.getElementById('hotelNameAr').value;
      if (document.getElementById('hotelSloganAr')) hotelData.slogan_ar = document.getElementById('hotelSloganAr').value;
      if (document.getElementById('hotelAddressAr')) hotelData.address_ar = document.getElementById('hotelAddressAr').value;
      if (document.getElementById('hotelWa')) hotelData.whatsapp = document.getElementById('hotelWa').value;
    }

    if (roomsData) {
      document.querySelectorAll('.room-edit-card').forEach((card, idx) => {
        if (roomsData[idx]) {
          const title = card.querySelector('.room-title-input').value;
          const price = card.querySelector('.room-price-input').value;
          const badge = card.querySelector('.room-badge-input').value;
          const beds = card.querySelector('.room-beds-input').value;

          roomsData[idx].title_ar = title;
          roomsData[idx].price_per_night = price;
          roomsData[idx].badge_ar = badge;
          roomsData[idx].beds_ar = beds;
        }
      });
    }

    if (hallData) {
      if (document.getElementById('hallTitleAr')) hallData.title_ar = document.getElementById('hallTitleAr').value;
      if (document.getElementById('hallCapacity')) hallData.capacity = document.getElementById('hallCapacity').value;
    }
  }

  // Publish / Commit directly to GitHub REST API
  window.publishToGitHub = async function () {
    if (!config.owner || !config.repo || !config.token) {
      alert('يرجى أولاً إدخال بيانات GitHub (المستودع ورمز الوصول Personal Access Token) في تبويب إعدادات GitHub.');
      switchTab('tab-github');
      return;
    }

    collectUpdatedData();

    const publishBtn = document.getElementById('publishBtn');
    const publishLog = document.getElementById('publishLog');
    if (publishBtn) publishBtn.disabled = true;
    if (publishLog) {
      publishLog.style.display = 'block';
      publishLog.innerHTML = 'جاري الاتصال بـ GitHub وتحديث الملفات...<br>';
    }

    try {
      // 1. Commit data/hotel-info.json
      await commitFileToGitHub('data/hotel-info.json', JSON.stringify(hotelData, null, 2), 'تحديث بيانات الفندق العامة عبر لوحة التحكم');
      if (publishLog) publishLog.innerHTML += '✓ تم تحديث data/hotel-info.json على GitHub بنجاح.<br>';

      // 2. Commit data/rooms.json
      await commitFileToGitHub('data/rooms.json', JSON.stringify(roomsData, null, 2), 'تحديث قائمة وأسعار الغرف عبر لوحة التحكم');
      if (publishLog) publishLog.innerHTML += '✓ تم تحديث data/rooms.json على GitHub بنجاح.<br>';

      // 3. Commit data/hall.json
      await commitFileToGitHub('data/hall.json', JSON.stringify(hallData, null, 2), 'تحديث بيانات قاعة التدريب عبر لوحة التحكم');
      if (publishLog) publishLog.innerHTML += '✓ تم تحديث data/hall.json على GitHub بنجاح.<br>';

      if (publishLog) {
        publishLog.innerHTML += `<br><strong style="color: #22c55e;">🎉 اكتمل النشر بنجاح!</strong><br>يقوم GitHub Pages الآن بإعادة بناء الموقع ونشره خلال دقيقة واحدة تقريباً.`;
      }
    } catch (err) {
      if (publishLog) {
        publishLog.innerHTML += `<br><strong style="color: #ef4444;">❌ حدث خطأ أثناء النشر:</strong> ${err.message}`;
      }
    } finally {
      if (publishBtn) publishBtn.disabled = false;
    }
  };

  // Helper: Commit a file using GitHub Contents API
  async function commitFileToGitHub(path, content, message) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
    
    // Get existing SHA if file exists
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

    // Base64 encode UTF-8
    const base64Content = btoa(unescape(encodeURIComponent(content)));

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
      const errorData = await putRes.json();
      throw new Error(errorData.message || 'فشل إرسال التحديث لـ GitHub');
    }

    return await putRes.json();
  }

  // Fallback: Download updated JSON package
  window.downloadJsonPackage = function () {
    collectUpdatedData();

    downloadJsonFile('hotel-info.json', hotelData);
    downloadJsonFile('rooms.json', roomsData);
    downloadJsonFile('hall.json', hallData);
    alert('تم تنزيل ملفات JSON المعدلة بنجاح. يمكنك استبدالها في مجلد data/ داخل مشروعك.');
  };

  function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('ghOwner')) document.getElementById('ghOwner').value = config.owner;
    if (document.getElementById('ghRepo')) document.getElementById('ghRepo').value = config.repo;
    if (document.getElementById('ghBranch')) document.getElementById('ghBranch').value = config.branch;
    if (document.getElementById('ghToken')) document.getElementById('ghToken').value = config.token;

    testGitHubConnection();
    loadInitialData();
  });
})();