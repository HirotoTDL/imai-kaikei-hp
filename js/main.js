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

// ========== Contact Form (Formspree via fetch) ==========
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.innerHTML = '送信中...';
    btn.disabled = true;

    try {
      const res = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        contactForm.innerHTML = `
          <div class="text-center py-12">
            <div class="w-16 h-16 bg-forest-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-forest-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h3 class="font-serif text-2xl font-bold text-gray-900 mb-3">送信が完了しました</h3>
            <p class="text-gray-600">お問い合わせありがとうございます。<br>3営業日以内にご連絡いたします。</p>
          </div>
        `;
      } else {
        throw new Error('送信に失敗しました');
      }
    } catch (err) {
      btn.innerHTML = origText;
      btn.disabled = false;
      alert('送信に失敗しました。お手数ですがお電話（0573-65-5054）でお問い合わせください。');
    }
  });
}
