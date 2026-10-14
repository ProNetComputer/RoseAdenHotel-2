/**
 * Rose Aden 2 Tourist Hotel - Dynamic Gallery & Lightbox Engine
 * محرك معرض الصور التفاعلي الديناميكي والفلترة الحية
 */

(function () {
  'use strict';

  // Fetch live photos from data/gallery.json
  async function loadDynamicGallery() {
    try {
      const res = await fetch('data/gallery.json');
      if (res.ok) {
        const items = await res.json();
        const grid = document.querySelector('.gallery-grid');
        const filterBtns = document.querySelectorAll('.filter-btn');

        if (grid && items && items.length > 0) {
          // Render items
          grid.innerHTML = items.map(g => `
            <div class="gallery-item" data-category="${g.category || 'rooms'}">
              <img src="${g.src}" alt="${g.title || 'صورة من فندق روز عدن 2'}" loading="lazy" onerror="this.src='assets/images/logo.jpg'">
              <div class="gallery-overlay">
                <h4>${g.title || ''}</h4>
              </div>
            </div>
          `).join('');

          // Update total badge if present
          const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
          if (allBtn) {
            allBtn.textContent = `جميع الصور (${items.length})`;
          }

          // Re-bind filter events
          initFilterEvents();
        }
      }
    } catch (e) {
      // Keep static HTML items if fetch fails
      initFilterEvents();
    }
  }

  function initFilterEvents() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const items = document.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
      btn.onclick = () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');

        items.forEach(item => {
          const category = item.getAttribute('data-category');
          if (filter === 'all' || category === filter) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      };
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadDynamicGallery();
  });
})();