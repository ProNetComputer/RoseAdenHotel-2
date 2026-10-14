/**
 * Rose Aden 2 Tourist Hotel - Interactive Gallery & Lightbox
 * معرض الصور والفلترة التفاعلية
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const items = document.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
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
      });
    });
  });
})();