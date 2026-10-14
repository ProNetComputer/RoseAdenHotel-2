/**
 * Rose Aden 2 Tourist Hotel - Core Application Script
 * فندق روز عدن 2 السياحي - سكريبت النظام والتحكم الأساسي
 */

(function () {
  'use strict';

  // State
  let currentTheme = localStorage.getItem('rose_theme') || 'dark';
  let currentLang = localStorage.getItem('rose_lang') || 'ar';

  // Apply Theme Mode (Dark / Light)
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rose_theme', theme);

    const icon = document.getElementById('themeBtnIcon');
    const text = document.getElementById('themeBtnText');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (text) {
      if (currentLang === 'ar') {
        text.textContent = theme === 'dark' ? 'النهاري' : 'الليلي';
      } else {
        text.textContent = theme === 'dark' ? 'Light' : 'Dark';
      }
    }
  }

  // Toggle Theme
  window.toggleTheme = function () {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  };

  // Mobile Navigation Drawer
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const isOpen = navLinks.classList.contains('open');
      mobileToggle.innerHTML = isOpen ? '&times;' : '&#9776;';
    });
  }

  // Header Scroll Effect
  const header = document.querySelector('.main-header');
  window.addEventListener('scroll', () => {
    if (header) {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // Dynamic Theme & Customizer Loader from data/theme.json
  async function loadDynamicThemeConfig() {
    try {
      const isSub = window.location.pathname.includes('/admin/');
      const jsonPath = isSub ? '../data/theme.json' : 'data/theme.json';

      const res = await fetch(jsonPath);
      if (res.ok) {
        const cfg = await res.json();
        const root = document.documentElement;

        if (cfg.rose_primary) {
          root.style.setProperty('--rose-primary', cfg.rose_primary);
        }
        if (cfg.rose_dark) {
          root.style.setProperty('--rose-dark', cfg.rose_dark);
        }
        if (cfg.luxury_gold) {
          root.style.setProperty('--luxury-gold', cfg.luxury_gold);
        }
        if (cfg.luxury_gold_light) {
          root.style.setProperty('--luxury-gold-light', cfg.luxury_gold_light);
        }
        if (cfg.font_arabic) {
          root.style.setProperty('--font-arabic', cfg.font_arabic);
        }
        if (cfg.border_radius) {
          root.style.setProperty('--radius-lg', cfg.border_radius);
        }

        // Announcement Bar
        if (cfg.announcement && cfg.announcement.enabled && !document.getElementById('promoBanner')) {
          renderAnnouncementBanner(cfg.announcement);
        }
      }
    } catch (e) {
      // fallback to default stylesheet values
    }
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

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentTheme);
    loadDynamicThemeConfig();
  });
})();