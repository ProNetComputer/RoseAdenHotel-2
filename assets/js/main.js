/**
 * Rose Aden 2 Tourist Hotel - Reactive Core Application & Data-Binding Engine
 * فندق روز عدن 2 السياحي - محرك الربط الديناميكي الشامل للبيانات والهوية والكاروسيل
 */

(function () {
  'use strict';

  let currentTheme = localStorage.getItem('rose_theme') || 'dark';
  let currentLang = localStorage.getItem('rose_lang') || 'ar';

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rose_theme', theme);

    const icon = document.getElementById('themeBtnIcon');
    const text = document.getElementById('themeBtnText');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) {
      text.textContent = currentLang === 'ar'
        ? (theme === 'dark' ? 'النهاري' : 'الليلي')
        : (theme === 'dark' ? 'Light' : 'Dark');
    }
  }

  window.toggleTheme = function () {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  // Mobile Navigation Drawer
  function initMobileNav() {
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');
    if (mobileToggle && navLinks) {
      mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        const isOpen = navLinks.classList.contains('open');
        mobileToggle.innerHTML = isOpen ? '&times;' : '&#9776;';
      });
    }

    const header = document.querySelector('.main-header');
    window.addEventListener('scroll', () => {
      if (header) {
        if (window.scrollY > 40) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
      }
    });
  }

  // Dynamic Theme Loader (data/theme.json)
  async function loadDynamicThemeConfig() {
    try {
      const res = await fetch('data/theme.json', { cache: 'no-store' });
      if (!res.ok) return;
      const cfg = await res.json();
      const root = document.documentElement;

      if (cfg.rose_primary) root.style.setProperty('--rose-primary', cfg.rose_primary);
      if (cfg.rose_dark) root.style.setProperty('--rose-dark', cfg.rose_dark);
      if (cfg.luxury_gold) root.style.setProperty('--luxury-gold', cfg.luxury_gold);
      if (cfg.luxury_gold_light) root.style.setProperty('--luxury-gold-light', cfg.luxury_gold_light);
      if (cfg.font_arabic) root.style.setProperty('--font-arabic', cfg.font_arabic);
      if (cfg.border_radius) root.style.setProperty('--radius-lg', cfg.border_radius);

      if (cfg.hotel_logo) {
        document.querySelectorAll('.brand-logo img').forEach(img => {
          img.src = cfg.hotel_logo;
        });
      }

      if (cfg.announcement && cfg.announcement.enabled && !document.getElementById('promoBanner')) {
        renderAnnouncementBanner(cfg.announcement);
      }
    } catch (e) {}
  }

  function renderAnnouncementBanner(ann) {
    const banner = document.createElement('div');
    banner.id = 'promoBanner';
    banner.style.cssText = 'background: linear-gradient(90deg, var(--rose-dark) 0%, var(--rose-primary) 50%, var(--luxury-gold) 100%); color: #ffffff; padding: 0.55rem 1rem; text-align: center; font-size: 0.88rem; font-weight: 700; display: flex; justify-content: center; align-items: center; gap: 1rem; flex-wrap: wrap; box-shadow: 0 2px 8px rgba(0,0,0,0.25); position: relative; z-index: 1001;';

    banner.innerHTML = '<span>' + (ann.text_ar || '') + '</span>' +
      (ann.link ? '<a href="' + ann.link + '" target="_blank" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.4); color: #fff; padding: 0.2rem 0.75rem; border-radius: 99px; text-decoration: none; font-size: 0.8rem;">' + (ann.btn_text || 'التفاصيل') + '</a>' : '') +
      '<button onclick="this.parentElement.remove()" style="background:none; border:none; color:#fff; font-size:1.1rem; cursor:pointer; line-height:1; margin-right: 0.5rem;" title="إغلاق">&times;</button>';

    document.body.prepend(banner);
  }

  // Dynamic Hotel Info Binding (data/hotel-info.json)
  async function loadDynamicHotelInfo() {
    try {
      const res = await fetch('data/hotel-info.json', { cache: 'no-store' });
      if (!res.ok) return;
      const info = await res.json();

      document.querySelectorAll('[data-bind="hotel-name"]').forEach(el => {
        el.textContent = info.name_ar || 'فندق روز عدن 2 السياحي';
      });
      document.querySelectorAll('[data-bind="hotel-address"]').forEach(el => {
        el.textContent = info.address_ar || '';
      });
      document.querySelectorAll('[data-bind="hotel-whatsapp"]').forEach(el => {
        el.textContent = info.whatsapp || '780000656';
      });
      if (info.phones && info.phones.length > 0) {
        document.querySelectorAll('[data-bind="hotel-phones"]').forEach(el => {
          el.textContent = info.phones.join(' | ');
        });
      }
    } catch (e) {}
  }

  // Dynamic Rooms Binding (data/rooms.json)
  async function loadDynamicRooms() {
    const featuredGrid = document.getElementById('featuredRoomsGrid');
    const allRoomsGrid = document.getElementById('allRoomsGrid');
    const bkSelect = document.getElementById('bkRoomType');

    if (!featuredGrid && !allRoomsGrid && !bkSelect) return;

    try {
      const res = await fetch('data/rooms.json', { cache: 'no-store' });
      if (!res.ok) return;
      const rooms = await res.json();
      if (!rooms || rooms.length === 0) return;

      if (featuredGrid) {
        featuredGrid.innerHTML = rooms.slice(0, 3).map(r => renderRoomCardHtml(r, 4)).join('');
      }
      if (allRoomsGrid) {
        allRoomsGrid.innerHTML = rooms.map(r => renderRoomCardHtml(r, 10)).join('');
      }
      if (bkSelect) {
        bkSelect.innerHTML = rooms.map(r => `<option value="${r.title_ar}">${r.title_ar}</option>`).join('') +
          `<option value="حجز قاعة التدريب والمؤتمرات">قاعة التدريب والمؤتمرات</option>`;
      }
    } catch (e) {}
  }

  function renderRoomCardHtml(r, maxFeatures) {
    const feats = (r.features_ar || []).slice(0, maxFeatures).map(f => `<li>${f}</li>`).join('');
    const safeTitle = (r.title_ar || '').replace(/'/g, "\'");
    return `
      <div class="room-card" id="${r.id || ''}">
        <div class="room-card-media">
          <img src="${r.image || 'assets/images/suite-vip.jpg'}" alt="${r.title_ar || ''}" loading="lazy" onerror="this.src='assets/images/suite-vip.jpg'">
          <span class="room-badge">${r.badge_ar || 'مميز'}</span>
        </div>
        <div class="room-card-body">
          <h3 class="room-title">${r.title_ar || ''}</h3>
          <div class="room-meta">
            <span>🛏️ ${r.beds_ar || ''}</span>
            <span>👥 ${r.capacity_ar || ''}</span>
          </div>
          <ul class="room-features-list">${feats}</ul>
          <div class="room-card-footer">
            <div class="room-price-box">
              <span class="room-price-label">سعر الليلة:</span>
              <span class="room-price-val">${r.price_per_night || ''}</span>
            </div>
            <button onclick="bookSpecificRoom('${safeTitle}')" class="btn btn-whatsapp btn-sm">
              <span>💬</span> احجز الآن
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Dynamic Hall & Reviews Binding
  async function loadDynamicHallAndReviews() {
    const hallTitle = document.getElementById('dynamicHallTitle');
    const hallCap = document.getElementById('dynamicHallCapacity');
    const hallSpecs = document.getElementById('dynamicHallSpecs');
    const reviewsGrid = document.getElementById('guestReviewsGrid');

    if (hallTitle || hallCap || hallSpecs) {
      try {
        const res = await fetch('data/hall.json', { cache: 'no-store' });
        if (res.ok) {
          const hall = await res.json();
          if (hallTitle && hall.title_ar) hallTitle.textContent = hall.title_ar;
          if (hallCap && hall.capacity) hallCap.textContent = '👥 ' + hall.capacity;
          if (hallSpecs && hall.specs_ar) {
            const limit = hallSpecs.getAttribute('data-limit') ? parseInt(hallSpecs.getAttribute('data-limit'), 10) : hall.specs_ar.length;
            hallSpecs.innerHTML = hall.specs_ar.slice(0, limit).map(s => `
              <div class="hall-spec-item">
                <span class="hall-spec-icon">★</span>
                <span>${s}</span>
              </div>
            `).join('');
          }
        }
      } catch (e) {}
    }

    if (reviewsGrid) {
      try {
        const res = await fetch('data/reviews.json', { cache: 'no-store' });
        if (res.ok) {
          const reviews = await res.json();
          if (reviews && reviews.length > 0) {
            reviewsGrid.innerHTML = reviews.map(r => `
              <div class="review-card">
                <div class="review-stars">${'★'.repeat(r.rating || 5)}</div>
                <p class="review-text">"${r.comment_ar || ''}"</p>
                <div class="reviewer-name">${r.name || ''}</div>
                <div class="reviewer-role">${r.role || ''}</div>
              </div>
            `).join('');
          }
        }
      } catch (e) {}
    }
  }

  // Smart Randomized Hero Gallery Carousel Controller
  async function initHeroRandomCarousel() {
    const track = document.getElementById('heroCarouselTrack');
    const dotsContainer = document.getElementById('heroCarouselDots');
    const prevBtn = document.getElementById('carPrevBtn');
    const nextBtn = document.getElementById('carNextBtn');
    const box = document.getElementById('heroCarouselBox');
    const titleEl = document.getElementById('carouselActiveTitle');
    const counterEl = document.getElementById('carouselActiveCounter');
    const categoryPill = document.getElementById('carouselCategoryPill');
    const progressFill = document.getElementById('carouselProgressFill');

    if (!track) return;

    let items = [];
    let currentIndex = 0;
    let autoPlayTimer = null;
    let progressTimer = null;
    const slideDuration = 4000;
    const progressInterval = 50;

    const categoryArabicNames = {
      'exterior': '🏛️ الواجهة والمبنى الخارجي',
      'rooms': '🛏️ الغرف والأجنحة الفندقية',
      'vip': '👑 طيرمانات وأجنحة VIP الملكية',
      'halls': '🎓 قاعات التدريب والفعاليات والوجبات',
      'lobby': '🛎️ صالة الاستقبال واللوبي الفاخر'
    };

    try {
      const res = await fetch('data/gallery.json', { cache: 'no-store' });
      if (res.ok) {
        items = await res.json();
      }
    } catch (e) {
      console.warn('Could not load gallery.json:', e);
    }

    if (!items || items.length === 0) return;

    // Shuffle for fresh random experience on each visit
    items = shuffleArray([...items]);

    track.innerHTML = items.map((slide, idx) => `
      <div class="hero-car-slide ${idx === 0 ? 'active' : ''}">
        <img src="${slide.src}" alt="${slide.title || 'فندق روز عدن 2'}" loading="${idx < 2 ? 'eager' : 'lazy'}" onerror="this.src='assets/images/building-day.jpg'">
        <div class="hero-slide-overlay">
          <div class="hero-slide-caption"></div>
        </div>
      </div>
    `).join('');

    if (dotsContainer) {
      dotsContainer.innerHTML = items.map((_, idx) => `
        <button class="hero-car-dot ${idx === 0 ? 'active' : ''}" data-idx="${idx}" aria-label="صورة ${idx + 1}"></button>
      `).join('');

      dotsContainer.querySelectorAll('.hero-car-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          goToSlide(idx);
          resetAutoPlay();
        });
      });
    }

    const slideEls = track.querySelectorAll('.hero-car-slide');

    function updateCarousel() {
      const isRtl = document.documentElement.dir === 'rtl';
      const offset = currentIndex * 100;
      track.style.transform = isRtl ? `translateX(${offset}%)` : `translateX(-${offset}%)`;

      slideEls.forEach((s, idx) => {
        if (idx === currentIndex) s.classList.add('active');
        else s.classList.remove('active');
      });

      const curItem = items[currentIndex];
      if (curItem) {
        if (titleEl) titleEl.textContent = curItem.title || 'فندق روز عدن 2';
        if (categoryPill) categoryPill.textContent = categoryArabicNames[curItem.category] || 'لقطة مميزة';
        if (counterEl) counterEl.textContent = `لقطة رقم ${currentIndex + 1} من إجمالي ${items.length} صور في المعرض`;
      }

      if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('.hero-car-dot');
        dots.forEach((d, idx) => {
          if (idx === currentIndex) d.classList.add('active');
          else d.classList.remove('active');
        });
      }
    }

    function goToSlide(index) {
      if (index >= items.length) currentIndex = 0;
      else if (index < 0) currentIndex = items.length - 1;
      else currentIndex = index;
      updateCarousel();
    }

    function nextSlide() { goToSlide(currentIndex + 1); }
    function prevSlide() { goToSlide(currentIndex - 1); }

    if (prevBtn) prevBtn.onclick = () => { prevSlide(); resetAutoPlay(); };
    if (nextBtn) nextBtn.onclick = () => { nextSlide(); resetAutoPlay(); };

    let progressElapsed = 0;
    function startProgress() {
      progressElapsed = 0;
      if (progressFill) progressFill.style.width = '0%';
      clearInterval(progressTimer);
      progressTimer = setInterval(() => {
        progressElapsed += progressInterval;
        const pct = Math.min(100, (progressElapsed / slideDuration) * 100);
        if (progressFill) progressFill.style.width = `${pct}%`;
      }, progressInterval);
    }

    function startAutoPlay() {
      startProgress();
      clearInterval(autoPlayTimer);
      autoPlayTimer = setInterval(() => {
        nextSlide();
        startProgress();
      }, slideDuration);
    }

    function stopAutoPlay() {
      clearInterval(autoPlayTimer);
      clearInterval(progressTimer);
    }

    function resetAutoPlay() {
      stopAutoPlay();
      startAutoPlay();
    }

    if (box) {
      box.addEventListener('mouseenter', stopAutoPlay);
      box.addEventListener('mouseleave', startAutoPlay);

      let touchStartX = 0;
      box.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoPlay();
      }, { passive: true });

      box.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (Math.abs(diff) > 40) {
          const isRtl = document.documentElement.dir === 'rtl';
          if (diff > 0) { if (isRtl) nextSlide(); else prevSlide(); }
          else { if (isRtl) prevSlide(); else nextSlide(); }
        }
        startAutoPlay();
      }, { passive: true });
    }

    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    updateCarousel();
    startAutoPlay();
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
    initMobileNav();
    loadDynamicThemeConfig();
    loadDynamicHotelInfo();
    loadDynamicRooms();
    loadDynamicHallAndReviews();
    initHeroRandomCarousel();
  });
})();