function navLink(path, label, activePath) {
  const active = activePath === path;
  return `<a href="${path}" class="relative h-14 inline-flex items-center font-mono text-sm transition-colors ${active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-200"}">${label}${active ? '<span class="absolute bottom-0 left-0 h-[2px] w-full bg-cyan-500"></span>' : ""}</a>`;
}

export function renderLayout({ role = "ANALYST", email = "", activePath = "/dashboard.html", content = "" }) {
  const isAdmin = role === "ADMIN";
  return `
  <div class="fixed inset-0 -z-20 noise-overlay"></div>
  <div class="absolute top-[-120px] right-[-100px] h-[600px] w-[600px] rounded-full bg-cyan-500/5 blur-3xl -z-10"></div>
  <header class="fixed top-0 inset-x-0 h-14 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/60 z-50">
    <div class="h-full px-6 md:px-12 max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <svg class="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 20 7v6c0 5-3.5 7.8-8 9-4.5-1.2-8-4-8-9V7l8-4Z"/></svg>
        <span class="font-mono font-bold tracking-wider text-sm text-zinc-50">DEEPFAKE.DETECT</span>
      </div>
      <nav class="hidden md:flex items-center gap-8">
        ${navLink("/dashboard.html", "Dashboard", activePath)}
        ${isAdmin ? navLink("/admin.html", "Admin", activePath) : ""}
        ${isAdmin ? navLink("/admin.html#audit", "Audit", activePath) : ""}
      </nav>
      <div class="flex items-center gap-3 md:gap-5">
        <button id="open-chat-btn" class="text-xs font-mono text-zinc-500 hover:text-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 rounded-md px-2 py-1 transition-all">HELP</button>
        <span class="hidden md:inline text-xs font-mono text-zinc-400">${email || "analyst@local"}</span>
        <button id="mobile-nav-toggle" class="md:hidden h-8 w-8 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-50 hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"><i data-lucide="menu" class="h-4 w-4 mx-auto"></i></button>
        <button id="logout-btn" class="h-8 w-8 rounded-md border border-zinc-800 text-zinc-400 hover:text-red-500 hover:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"><i data-lucide="log-out" class="h-4 w-4 mx-auto"></i></button>
      </div>
    </div>
    <nav id="mobile-nav" class="md:hidden hidden border-t border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl px-6 py-3 flex flex-col gap-2">
      <a href="/dashboard.html" class="font-mono text-sm text-zinc-300 hover:text-zinc-50">Dashboard</a>
      ${isAdmin ? '<a href="/admin.html" class="font-mono text-sm text-zinc-300 hover:text-zinc-50">Admin</a>' : ""}
      ${isAdmin ? '<a href="/admin.html#audit" class="font-mono text-sm text-zinc-300 hover:text-zinc-50">Audit</a>' : ""}
    </nav>
  </header>
  <main class="pt-20 pb-12 px-6 md:px-12 max-w-7xl mx-auto space-y-6">${content}</main>`;
}

export function bindLayoutEvents() {
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("deepfake_token");
    window.location.href = "/login.html";
  });
  document.getElementById("mobile-nav-toggle")?.addEventListener("click", () => {
    document.getElementById("mobile-nav")?.classList.toggle("hidden");
  });
  if (window.lucide?.createIcons) window.lucide.createIcons();
}
