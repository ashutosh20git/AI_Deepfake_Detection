export function renderNav(userRole, userEmail) {
  const isAdmin = userRole === 'ADMIN';
  
  return `
    <nav class="fixed top-0 w-full h-14 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/60 z-50 flex items-center justify-between px-6 md:px-12 transition-all">
      <div class="flex items-center space-x-3">
        <!-- Logo svg -->
        <svg class="h-6 w-6 text-zinc-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path class="text-cyan-500" stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span class="font-mono font-bold tracking-wider text-sm text-zinc-50">DEEPFAKE.DETECT</span>
      </div>

      <div class="hidden md:flex items-center space-x-8 h-full">
        <a href="/dashboard.html" class="nav-link font-mono text-sm text-zinc-400 hover:text-zinc-50 transition-colors h-full flex items-center relative" data-target="/dashboard.html">
          Dashboard
        </a>
        ${isAdmin ? `
        <a href="/admin.html" class="nav-link font-mono text-sm text-zinc-400 hover:text-zinc-50 transition-colors h-full flex items-center relative" data-target="/admin.html">
          Admin Area
        </a>
        ` : ''}
      </div>

      <div class="flex items-center space-x-6">
        <button id="open-chat-btn" class="font-mono text-xs text-zinc-400 hover:text-cyan-500 transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          HELP
        </button>
        <span class="text-xs text-zinc-500 font-mono hidden sm:inline-block">${userEmail}</span>
        <button id="logout-btn" class="text-zinc-400 hover:text-red-500 transition-colors" title="Logout">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
        </button>
      </div>
    </nav>
  `;
}

export function activateNav() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-target') === currentPath) {
      link.classList.remove('text-zinc-400');
      link.classList.add('text-zinc-50');
      
      const underline = document.createElement('div');
      underline.className = 'absolute bottom-0 left-0 w-full h-[2px] bg-cyan-500';
      link.appendChild(underline);
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('deepfake_token');
    window.location.href = '/login.html';
  });
}
