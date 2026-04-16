// ========== Mobile Menu ==========
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const hamburgerIcon = mobileMenuBtn.querySelector('.hamburger-icon');
const closeIcon = mobileMenuBtn.querySelector('.close-icon');

let menuOpen = false;

mobileMenuBtn.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('hidden', !menuOpen);
  hamburgerIcon.classList.toggle('hidden', menuOpen);
  closeIcon.classList.toggle('hidden', !menuOpen);
});

// Close mobile menu on link click
document.querySelectorAll('.mobile-nav-link, #mobile-menu a[href^="#"]').forEach(link => {
  link.addEventListener('click', () => {
    menuOpen = false;
    mobileMenu.classList.add('hidden');
    hamburgerIcon.classList.remove('hidden');
    closeIcon.classList.add('hidden');
  });
});

// ========== Header Shadow on Scroll ==========
const header = document.getElementById('header');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// ========== FAQ Accordion ==========
document.querySelectorAll('.faq-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const content = item.querySelector('.faq-content');
    const isActive = item.classList.contains('active');

    // Close all
    document.querySelectorAll('.faq-item.active').forEach(openItem => {
      openItem.classList.remove('active');
      const openContent = openItem.querySelector('.faq-content');
      openContent.style.maxHeight = null;
      openContent.classList.add('hidden');
    });

    // Open clicked (if wasn't active)
    if (!isActive) {
      item.classList.add('active');
      content.classList.remove('hidden');
      content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
});

// ========== Scroll Reveal ==========
const revealElements = document.querySelectorAll('.scroll-reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = entry.target.style.animationDelay || '0s';
      const ms = parseFloat(delay) * 1000;
      setTimeout(() => {
        entry.target.classList.add('revealed');
      }, ms);
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// ========== Smooth scroll for anchor links ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
