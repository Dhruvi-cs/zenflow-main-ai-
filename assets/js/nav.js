// assets/js/nav.js - Unified Responsive Navigation & Mobile Drawer for ZenFlow ITSM
(function initZenFlowNav() {
  document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // 1. Ensure Knowledge Base link exists in sidebar
    const navUl = sidebar.querySelector('ul');
    if (navUl && !navUl.innerHTML.includes('knowledge.html')) {
      const profileLi = navUl.querySelector('a[href="profile.html"]')?.parentElement;
      const knowledgeLi = document.createElement('li');
      knowledgeLi.innerHTML = `<a href="knowledge.html"><i class="fa-solid fa-book"></i> Knowledge Base</a>`;
      if (profileLi) {
        navUl.insertBefore(knowledgeLi, profileLi);
      } else {
        navUl.appendChild(knowledgeLi);
      }
    }

    // 2. Highlight active navigation item based on current page
    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navLinks = sidebar.querySelectorAll('ul li a');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      const li = link.parentElement;
      if (href === currentPath || (currentPath === '' && href === 'dashboard.html')) {
        li.classList.add('active');
        link.classList.add('active');
      } else {
        li.classList.remove('active');
        link.classList.remove('active');
      }
    });

    // 3. Inject Mobile Close button in Sidebar if not present
    if (!sidebar.querySelector('#sidebarCloseBtn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'sidebar-close-btn';
      closeBtn.id = 'sidebarCloseBtn';
      closeBtn.setAttribute('aria-label', 'Close Menu');
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      sidebar.insertBefore(closeBtn, sidebar.firstChild);
    }

    // 4. Inject Mobile Header and Backdrop if not present
    if (!document.querySelector('.mobile-header')) {
      const mobileHeader = document.createElement('header');
      mobileHeader.className = 'mobile-header';
      mobileHeader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="mobile-toggle-btn" id="mobileNavToggle" aria-label="Toggle navigation">
            <i class="fa-solid fa-bars"></i>
          </button>
          <span class="mobile-brand">
            <i class="fa-solid fa-headset"></i> ZenFlow
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; font-size: 1.15rem;">
          <a href="ai-chat.html" style="color: #94a3b8;" title="AI Assistant"><i class="fa-solid fa-robot"></i></a>
          <a href="knowledge.html" style="color: #94a3b8;" title="Knowledge Base"><i class="fa-solid fa-book"></i></a>
          <a href="profile.html" style="color: #94a3b8;" title="Profile"><i class="fa-solid fa-circle-user"></i></a>
        </div>
      `;
      document.body.insertBefore(mobileHeader, document.body.firstChild);
    }

    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      backdrop.id = 'sidebarBackdrop';
      document.body.appendChild(backdrop);
    }

    // 5. Drawer Toggle Logic
    const toggleBtn = document.getElementById('mobileNavToggle');
    const closeBtn = document.getElementById('sidebarCloseBtn');

    function openSidebar() {
      sidebar.classList.add('open');
      backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains('open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSidebar();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeSidebar);
    }

    // Auto-close drawer on link click when on mobile
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          closeSidebar();
        }
      });
    });
  });
})();
