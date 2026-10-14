/**
 * Rose Aden 2 Tourist Hotel - Grouped Gallery & Lightbox Engine
 * محرك معرض الصور المقسم حسب المجموعات مع العارض المكبر (Lightbox)
 */

(function () {
  'use strict';

  const GROUPS_META = [
    { key: 'exterior', icon: '🏛️', title_ar: 'مجموعة الواجهة والمبنى الخارجي', short_ar: 'الواجهة والمبنى' },
    { key: 'lobby', icon: '🛎️', title_ar: 'مجموعة صالة الاستقبال واللوبي الفاخر', short_ar: 'الاستقبال واللوبي' },
    { key: 'vip', icon: '👑', title_ar: 'مجموعة أجنحة وطيرمانات VIP الملكية', short_ar: 'طيرمانات وأجنحة VIP' },
    { key: 'rooms', icon: '🛏️', title_ar: 'مجموعة الغرف والأجنحة الفندقية', short_ar: 'الغرف والأجنحة' },
    { key: 'halls', icon: '🎓', title_ar: 'مجموعة قاعات التدريب والفعاليات والوجبات', short_ar: 'قاعات التدريب والوجبات' }
  ];

  let allGalleryItems = [];
  let activeFilter = 'all';
  let currentLightboxIndex = 0;
  let currentVisibleList = [];

  async function initGalleryPage() {
    const container = document.getElementById('galleryGroupedContainer');
    if (!container) return;

    try {
      const res = await fetch('data/gallery.json', { cache: 'no-store' });
      if (res.ok) {
        allGalleryItems = await res.json();
      }
    } catch (e) {
      console.warn('Fallback to existing DOM gallery items:', e);
    }

    if (!allGalleryItems || allGalleryItems.length === 0) return;

    updateFilterButtonCounts();
    renderGalleryContent('all');
    initFilterButtons();
    ensureLightboxModal();
  }

  function getGroupMeta(cat) {
    return GROUPS_META.find(g => g.key === cat) || { key: cat, icon: '📸', title_ar: 'لقطات متنوعة', short_ar: 'عام' };
  }

  function updateFilterButtonCounts() {
    const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
    if (allBtn) {
      allBtn.innerHTML = `✨ جميع المجموعات (${allGalleryItems.length})`;
    }

    GROUPS_META.forEach(g => {
      const count = allGalleryItems.filter(item => item.category === g.key).length;
      const btn = document.querySelector(`.filter-btn[data-filter="${g.key}"]`);
      if (btn) {
        btn.innerHTML = `${g.icon} ${g.short_ar} (${count})`;
      }
    });
  }

  function renderGalleryContent(filterKey) {
    activeFilter = filterKey;
    const container = document.getElementById('galleryGroupedContainer');
    if (!container) return;

    if (filterKey === 'all') {
      // Render organized by groups
      currentVisibleList = [];
      let html = '';

      GROUPS_META.forEach(group => {
        const groupItems = allGalleryItems.filter(item => item.category === group.key);
        if (groupItems.length === 0) return;

        html += `
          <div class="gallery-group-section" data-group="${group.key}">
            <div class="gallery-group-header">
              <h2 class="gallery-group-title">
                <span>${group.icon}</span>
                <span>${group.title_ar}</span>
              </h2>
              <span class="gallery-group-count">${groupItems.length} صور في هذه المجموعة</span>
            </div>
            <div class="gallery-grid">
              ${groupItems.map(item => {
                const visibleIdx = currentVisibleList.length;
                currentVisibleList.push(item);
                return `
                  <div class="gallery-item" data-category="${item.category}" onclick="openGalleryLightbox(${visibleIdx})">
                    <span class="gallery-item-badge">${group.icon} ${group.short_ar}</span>
                    <img src="${item.src}" alt="${item.title || 'فندق روز عدن 2'}" loading="lazy" onerror="this.src='assets/images/logo.jpg'">
                    <div class="gallery-overlay">
                      <h4>${item.title || ''}</h4>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    } else {
      // Render single filtered group
      const group = getGroupMeta(filterKey);
      currentVisibleList = allGalleryItems.filter(item => item.category === filterKey);

      container.innerHTML = `
        <div class="gallery-group-section" data-group="${group.key}">
          <div class="gallery-group-header">
            <h2 class="gallery-group-title">
              <span>${group.icon}</span>
              <span>${group.title_ar}</span>
            </h2>
            <span class="gallery-group-count">${currentVisibleList.length} صور</span>
          </div>
          <div class="gallery-grid">
            ${currentVisibleList.map((item, idx) => `
              <div class="gallery-item" data-category="${item.category}" onclick="openGalleryLightbox(${idx})">
                <span class="gallery-item-badge">${group.icon} ${group.short_ar}</span>
                <img src="${item.src}" alt="${item.title || 'فندق روز عدن 2'}" loading="lazy" onerror="this.src='assets/images/logo.jpg'">
                <div class="gallery-overlay">
                  <h4>${item.title || ''}</h4>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  function initFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        renderGalleryContent(filter);
      };
    });
  }

  // Lightbox Modal
  function ensureLightboxModal() {
    if (document.getElementById('galleryLightbox')) return;
    const modal = document.createElement('div');
    modal.id = 'galleryLightbox';
    modal.className = 'lightbox-backdrop';
    modal.innerHTML = `
      <div class="lightbox-content">
        <button class="lightbox-close" onclick="closeGalleryLightbox()" aria-label="إغلاق">&times;</button>
        <div class="lightbox-img-wrapper">
          <button class="lightbox-nav lightbox-prev" onclick="stepGalleryLightbox(-1)" aria-label="السابق">&#10095;</button>
          <img id="lightboxMainImg" src="" alt="معاينة الصورة">
          <button class="lightbox-nav lightbox-next" onclick="stepGalleryLightbox(1)" aria-label="التالي">&#10094;</button>
        </div>
        <div class="lightbox-caption-bar">
          <h3 id="lightboxTitle"></h3>
          <span id="lightboxMeta"></span>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeGalleryLightbox();
    });
    document.body.appendChild(modal);

    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') closeGalleryLightbox();
      if (e.key === 'ArrowRight') stepGalleryLightbox(-1);
      if (e.key === 'ArrowLeft') stepGalleryLightbox(1);
    });
  }

  window.openGalleryLightbox = function (idx) {
    if (!currentVisibleList || !currentVisibleList[idx]) return;
    currentLightboxIndex = idx;
    updateLightboxView();
    const modal = document.getElementById('galleryLightbox');
    if (modal) modal.classList.add('open');
  };

  window.closeGalleryLightbox = function () {
    const modal = document.getElementById('galleryLightbox');
    if (modal) modal.classList.remove('open');
  };

  window.stepGalleryLightbox = function (dir) {
    if (!currentVisibleList || currentVisibleList.length === 0) return;
    currentLightboxIndex = (currentLightboxIndex + dir + currentVisibleList.length) % currentVisibleList.length;
    updateLightboxView();
  };

  function updateLightboxView() {
    const item = currentVisibleList[currentLightboxIndex];
    if (!item) return;
    const group = getGroupMeta(item.category);
    const img = document.getElementById('lightboxMainImg');
    const title = document.getElementById('lightboxTitle');
    const meta = document.getElementById('lightboxMeta');

    if (img) img.src = item.src;
    if (title) title.textContent = item.title || 'فندق روز عدن 2';
    if (meta) meta.textContent = `${group.icon} ${group.title_ar} — صورة ${currentLightboxIndex + 1} من ${currentVisibleList.length}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initGalleryPage();
  });
})();