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
  header.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ========== FAQ Accordion ==========
document.querySelectorAll('.faq-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const content = item.querySelector('.faq-content');
    const isActive = item.classList.contains('active');

    document.querySelectorAll('.faq-item.active').forEach(openItem => {
      openItem.classList.remove('active');
      const openContent = openItem.querySelector('.faq-content');
      openContent.style.maxHeight = null;
      openContent.classList.add('hidden');
    });

    if (!isActive) {
      item.classList.add('active');
      content.classList.remove('hidden');
      content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
});

// ========== Scroll Reveal (all variants) ==========
const revealSelectors = '.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .counter-item';
const revealElements = document.querySelectorAll(revealSelectors);

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
  threshold: 0.08,
  rootMargin: '0px 0px -60px 0px'
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

// ========== Hero floating particles ==========
function createParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;

  const count = window.innerWidth < 768 ? 8 : 15;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = Math.random() * 4 + 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
    particle.style.animationDelay = (Math.random() * 10) + 's';
    container.appendChild(particle);
  }
}
createParticles();

// ========== Parallax on mouse move (desktop only) ==========
if (window.innerWidth >= 1024) {
  const hero = document.getElementById('hero');
  if (hero) {
    hero.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 10;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      const content = hero.querySelector('.relative.z-10');
      if (content) {
        content.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      }
    });
  }
}
