/**
 * Rose Aden 2 Tourist Hotel - Reactive Core Application & Data-Binding Engine (v10 Enterprise)
 * فندق روز عدن 2 السياحي - محرك الربط الديناميكي الشامل للبيانات والصفحات والمنشورات والغرف والهوية
 */

(function () {
  'use strict';

  let currentTheme = localStorage.getItem('rose_theme') || 'dark';
  let currentLang = localStorage.getItem('rose_lang') || 'ar';
  let allLoadedRooms = [];
  let activeRoomCategoryFilter = 'all';

  function detectCurrentPageKey() {
    const bodyAttr = document.body.getAttribute('data-page');
    if (bodyAttr) return bodyAttr;
    const path = window.location.pathname.toLowerCase();
    if (path.includes('about')) return 'about';
    if (path.includes('rooms')) return 'rooms';
    if (path.includes('vip-suites')) return 'vip-suites';
    if (path.includes('training-hall')) return 'training-hall';
    if (path.includes('gallery')) return 'gallery';
    if (path.includes('location')) return 'location';
    if (path.includes('contact')) return 'contact';
    return 'home';
  }

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

  // 1. Dynamic Theme Loader (data/theme.json)
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

  // 2. Dynamic Hotel Info Binding (data/hotel-info.json)
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

  // 3. Dynamic Pages Content, Posts, Stats & VIP Packages (data/pages-content.json)
  async function loadDynamicPagesAndPosts() {
    const pageKey = detectCurrentPageKey();
    try {
      const res = await fetch('data/pages-content.json', { cache: 'no-store' });
      if (!res.ok) return;
      const pc = await res.json();

      // Bind Stats Bar if present
      const statsGrid = document.getElementById('hotelStatsGrid');
      if (statsGrid && pc.stats && pc.stats.length > 0) {
        statsGrid.innerHTML = pc.stats.map(st => `
          <div class="stat-card">
            <div class="stat-value">${st.value || ''}</div>
            <div class="stat-label">${st.label_ar || ''}</div>
          </div>
        `).join('');
      }

      // Bind Page-Specific Hero & Section Texts
      const pageCfg = pc.pages && pc.pages[pageKey];
      if (pageCfg) {
        Object.keys(pageCfg).forEach(fieldKey => {
          const val = pageCfg[fieldKey];
          if (!val || typeof val !== 'string') return;
          document.querySelectorAll(`[data-page-bind="${fieldKey}"]`).forEach(el => {
            el.textContent = val;
          });
        });

        if (pageKey === 'home' && pageCfg.hero_image) {
          const heroHome = document.querySelector('.hero-home');
          if (heroHome) {
            heroHome.style.backgroundImage = `var(--hero-overlay), url('${pageCfg.hero_image}')`;
          }
        }
      }

      // Bind VIP Packages on vip-suites.html
      const vipPkgGrid = document.getElementById('vipPackagesGrid');
      if (vipPkgGrid && pc.vip_packages && pc.vip_packages.length > 0) {
        vipPkgGrid.innerHTML = pc.vip_packages.map(pkg => {
          const safeTitle = (pkg.title_ar || '').replace(/'/g, "\'");
          return `
            <div class="vip-pkg-card">
              <div class="vip-pkg-media">
                <img src="${pkg.image || 'assets/images/ros2-vip-majlis.jpg'}" alt="${pkg.title_ar || ''}" loading="lazy" onerror="this.src='assets/images/ros2-vip-majlis.jpg'">
                <span class="post-badge">${pkg.icon || '👑'} ${pkg.badge_ar || 'باقة VIP'}</span>
              </div>
              <div class="vip-pkg-body">
                <h3 class="post-title">${pkg.title_ar || ''}</h3>
                <p class="post-content">${pkg.desc_ar || ''}</p>
                <ul class="room-features-list" style="margin-bottom: 1.25rem;">
                  ${(pkg.features_ar || []).map(f => `<li>${f}</li>`).join('')}
                </ul>
                <button onclick="bookSpecificRoom('${safeTitle}')" class="btn btn-gold" style="width: 100%;">
                  <span>👑</span> ${pkg.cta_text || 'احجز الباقة عبر واتساب'}
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      // Bind Dynamic Posts / Offers targeted to this page
      const postsSection = document.getElementById('pagePostsSection');
      const postsGrid = document.getElementById('pagePostsGrid');
      if (postsGrid && pc.posts) {
        const matchingPosts = pc.posts
          .filter(p => p.visible !== false && Array.isArray(p.target_pages) && (p.target_pages.includes(pageKey) || p.target_pages.includes('all')))
          .sort((a, b) => (a.order || 99) - (b.order || 99));

        if (matchingPosts.length > 0) {
          if (postsSection) postsSection.style.display = 'block';
          postsGrid.innerHTML = matchingPosts.map(post => `
            <article class="post-card">
              <div class="post-card-media">
                <img src="${post.image || 'assets/images/building-day.jpg'}" alt="${post.title_ar || ''}" loading="lazy" onerror="this.src='assets/images/building-day.jpg'">
                ${post.badge_ar ? `<span class="post-badge">${post.badge_ar}</span>` : ''}
                ${post.date_ar ? `<span class="post-date-pill">📅 ${post.date_ar}</span>` : ''}
              </div>
              <div class="post-card-body">
                ${post.category_ar ? `<div class="post-category">${post.category_ar}</div>` : ''}
                <h3 class="post-title">${post.title_ar || ''}</h3>
                ${post.subtitle_ar ? `<div class="post-subtitle">${post.subtitle_ar}</div>` : ''}
                <p class="post-content">${post.content_ar || ''}</p>
                <a href="${post.cta_link || 'contact.html'}" target="${(post.cta_link || '').startsWith('http') ? '_blank' : '_self'}" class="btn btn-whatsapp btn-sm" style="width: 100%;">
                  <span>💬</span> ${post.cta_text_ar || 'تواصل واحجز الآن'}
                </a>
              </div>
            </article>
          `).join('');
        } else if (postsSection) {
          postsSection.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Could not load pages-content.json:', e);
    }
  }

  // 4. Dynamic Amenities Binding (data/amenities.json)
  async function loadDynamicAmenities() {
    const homeGrid = document.getElementById('homeAmenitiesGrid');
    const aboutGrid = document.getElementById('aboutAmenitiesGrid');
    if (!homeGrid && !aboutGrid) return;

    try {
      const res = await fetch('data/amenities.json', { cache: 'no-store' });
      if (!res.ok) return;
      const amenities = await res.json();
      if (!amenities || amenities.length === 0) return;

      const html = amenities.map(a => `
        <div class="amenity-card">
          <div class="amenity-icon">${a.icon || '✨'}</div>
          <h3 class="amenity-title">${a.title_ar || ''}</h3>
          <p class="amenity-desc">${a.desc_ar || ''}</p>
        </div>
      `).join('');

      if (homeGrid) homeGrid.innerHTML = html;
      if (aboutGrid) aboutGrid.innerHTML = html;
    } catch (e) {}
  }

  // 5. Dynamic Rooms & VIP Suites Binding (data/rooms.json)
  async function loadDynamicRooms() {
    const featuredGrid = document.getElementById('featuredRoomsGrid');
    const allRoomsGrid = document.getElementById('allRoomsGrid');
    const vipSuitesGrid = document.getElementById('vipSuitesRoomsGrid');
    const bkSelect = document.getElementById('bkRoomType');

    if (!featuredGrid && !allRoomsGrid && !vipSuitesGrid && !bkSelect) return;

    try {
      const res = await fetch('data/rooms.json', { cache: 'no-store' });
      if (!res.ok) return;
      const rooms = await res.json();
      if (!rooms || rooms.length === 0) return;

      allLoadedRooms = rooms;

      if (featuredGrid) {
        const homeRooms = rooms.filter(r => r.featured_home !== false).slice(0, 6);
        featuredGrid.innerHTML = (homeRooms.length > 0 ? homeRooms : rooms.slice(0, 6))
          .map(r => renderRoomCardHtml(r, 5, false)).join('');
      }

      if (allRoomsGrid) {
        renderFilteredRoomsPage('all');
        initRoomFilterButtons();
      }

      if (vipSuitesGrid) {
        const vipRooms = rooms.filter(r => r.category === 'vip' || r.category === 'tirmanah' || r.show_in_vip_page);
        vipSuitesGrid.innerHTML = vipRooms.map(r => renderRoomCardHtml(r, 10, true)).join('');
      }

      if (bkSelect) {
        bkSelect.innerHTML = rooms.map(r => `<option value="${r.title_ar}">${r.title_ar}</option>`).join('') +
          `<option value="حجز قاعة التدريب والمؤتمرات">قاعة التدريب والمؤتمرات الكبرى</option>`;
      }
    } catch (e) {}
  }

  window.filterRoomsByCategory = function (cat) {
    activeRoomCategoryFilter = cat;
    document.querySelectorAll('.room-cat-btn').forEach(btn => {
      if (btn.getAttribute('data-rcat') === cat) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    renderFilteredRoomsPage(cat);
  };

  function initRoomFilterButtons() {
    document.querySelectorAll('.room-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-rcat') || 'all';
        window.filterRoomsByCategory(cat);
      });
    });
  }

  function renderFilteredRoomsPage(cat) {
    const allRoomsGrid = document.getElementById('allRoomsGrid');
    if (!allRoomsGrid || !allLoadedRooms.length) return;

    const filtered = cat === 'all'
      ? allLoadedRooms
      : allLoadedRooms.filter(r => r.category === cat);

    allRoomsGrid.innerHTML = filtered.map(r => renderRoomCardHtml(r, 12, true)).join('');
  }

  function renderRoomCardHtml(r, maxFeatures, isDetailed) {
    const feats = (r.features_ar || []).slice(0, maxFeatures).map(f => `<li>${f}</li>`).join('');
    const safeTitle = (r.title_ar || '').replace(/'/g, "\'");
    const isAvail = r.available !== false;

    const specsPills = [];
    if (r.area_ar) specsPills.push(`<span class="room-spec-pill">📐 المساحة: ${r.area_ar}</span>`);
    if (r.view_ar) specsPills.push(`<span class="room-spec-pill">🌅 ${r.view_ar}</span>`);
    if (r.floor_ar && isDetailed) specsPills.push(`<span class="room-spec-pill">🏢 ${r.floor_ar}</span>`);

    const servicesHtml = (isDetailed && r.included_services_ar && r.included_services_ar.length > 0)
      ? `<div class="room-services-row">
          ${r.included_services_ar.map(s => `<span class="room-service-tag">✨ ${s}</span>`).join('')}
         </div>`
      : '';

    return `
      <div class="room-card" id="${r.id || ''}" data-category="${r.category || 'standard'}">
        <div class="room-card-media">
          <img src="${r.image || 'assets/images/suite-vip.jpg'}" alt="${r.title_ar || ''}" loading="lazy" onerror="this.src='assets/images/suite-vip.jpg'">
          <span class="room-badge">${r.badge_ar || 'مميز'}</span>
          <span class="room-availability-pill ${isAvail ? 'available' : 'unavailable'}">
            ${isAvail ? '🟢 متاح للحجز' : '🔴 مشغول حالياً'}
          </span>
        </div>
        <div class="room-card-body">
          <h3 class="room-title">${r.title_ar || ''}</h3>
          ${r.subtitle_ar ? `<div class="room-subtitle">${r.subtitle_ar}</div>` : ''}
          ${(isDetailed && r.description_ar) ? `<p class="room-desc-text">${r.description_ar}</p>` : ''}
          ${specsPills.length > 0 ? `<div class="room-specs-pills">${specsPills.join('')}</div>` : ''}
          <div class="room-meta">
            <span>🛏️ ${r.beds_ar || ''}</span>
            <span>👥 ${r.capacity_ar || ''}</span>
          </div>
          <ul class="room-features-list">${feats}</ul>
          ${servicesHtml}
          <div class="room-card-footer">
            <div class="room-price-box">
              <span class="room-price-label">سعر الليلة:</span>
              <span class="room-price-val">${r.price_per_night || ''}</span>
            </div>
            <button onclick="bookSpecificRoom('${safeTitle}')" class="btn btn-whatsapp btn-sm">
              <span>💬</span> ${isAvail ? 'احجز الآن' : 'استفسر عن أقرب موعد'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 6. Dynamic Hall & Reviews Binding
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

  // 7. Smart Randomized Hero Gallery Carousel Controller
  async function initHeroRandomCarousel() {
    const track = document.getElementById('heroCarouselTrack');
    const dotsContainer = document.getElementById('heroCarouselDots');
    const prevBtn = document.getElementById('carPrevBtn');
    const nextBtn = document.getElementById('carNextBtn');
    const box = document.getElementById('heroCarouselBox');
    const titleEl = document.getElementById('carouselActiveTitle');
    const descEl = document.getElementById('carouselActiveDesc');
    const counterEl = document.getElementById('carouselActiveCounter');
    const categoryPill = document.getElementById('carouselCategoryPill');
    const progressFill = document.getElementById('carouselProgressFill');

    if (!track) return;

    let items = [];
    let currentIndex = 0;
    let autoPlayTimer = null;
    let progressTimer = null;
    const slideDuration = 4200;
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
        const rawItems = await res.json();
        items = (rawItems || []).filter(item => item.visible !== false && item.show_in_carousel !== false);
      }
    } catch (e) {
      console.warn('Could not load gallery.json:', e);
    }

    if (!items || items.length === 0) return;

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
        if (descEl) descEl.textContent = curItem.description_ar || '';
        if (categoryPill) categoryPill.textContent = curItem.badge_ar ? `✨ ${curItem.badge_ar}` : (categoryArabicNames[curItem.category] || 'لقطة مميزة');
        if (counterEl) counterEl.textContent = `لقطة رقم ${currentIndex + 1} من إجمالي ${items.length} صور في العرض`;
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
    loadDynamicPagesAndPosts();
    loadDynamicAmenities();
    loadDynamicRooms();
    loadDynamicHallAndReviews();
    initHeroRandomCarousel();
  });
})();
