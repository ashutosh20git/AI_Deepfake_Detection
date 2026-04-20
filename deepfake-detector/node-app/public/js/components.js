const BUTTON_VARIANTS = {
  primary:
    "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-mono font-semibold px-5 py-2.5 rounded-md shadow-lg shadow-cyan-500/20",
  secondary:
    "bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 px-5 py-2.5 rounded-md font-mono",
  ghost: "text-zinc-400 hover:text-zinc-50 px-4 py-2 font-mono",
  danger:
    "bg-red-600 hover:bg-red-500 text-white font-mono font-semibold px-5 py-2.5 rounded-md shadow-lg shadow-red-500/20",
};

function badgeStyles(riskLevel) {
  if (riskLevel === "HIGH_RISK") {
    return {
      bg: "bg-red-600",
      glow: "shadow-red-500/30",
      text: "text-white",
      label: "⚠ HIGH RISK DEEPFAKE",
    };
  }
  if (riskLevel === "MEDIUM_SUSPICION") {
    return {
      bg: "bg-amber-500",
      glow: "shadow-amber-500/30",
      text: "text-zinc-950",
      label: "◐ MEDIUM SUSPICION",
    };
  }
  return {
    bg: "bg-emerald-500",
    glow: "shadow-emerald-500/30",
    text: "text-zinc-950",
    label: "✓ AUTHENTIC",
  };
}

export function RiskBadge(riskLevel, large = false) {
  const badge = badgeStyles(riskLevel);
  const size = large ? "px-8 py-3 text-base" : "px-6 py-2 text-sm";
  return `<span class="${badge.bg} ${badge.glow} ${badge.text} ${size} rounded-full shadow-lg font-mono font-bold tracking-wide inline-flex items-center gap-2">${badge.label}</span>`;
}

export function StatCard({ label, value, subtext }) {
  return `<div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6"><div class="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">${label}</div><div class="text-4xl font-mono font-bold tracking-tighter text-zinc-50">${value}</div><div class="text-xs text-zinc-400 mt-2 font-mono">${subtext}</div></div>`;
}

export function Button({ variant = "primary", children, id = "", type = "button", classes = "" }) {
  return `<button type="${type}" ${id ? `id="${id}"` : ""} class="${BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary} text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${classes}">${children}</button>`;
}

export function Input({ id, type = "text", placeholder = "", value = "", required = false, classes = "" }) {
  return `<input id="${id}" type="${type}" value="${value}" placeholder="${placeholder}" ${required ? "required" : ""} class="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-50 placeholder-zinc-600 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${classes}">`;
}

export function SkeletonShimmer(width = "100%", height = "24px") {
  return `<div class="shimmer-block rounded-md" style="width:${width};height:${height};"></div>`;
}

export function ensureToastContainer() {
  if (document.getElementById("toast-container")) return;
  const div = document.createElement("div");
  div.id = "toast-container";
  div.className = "fixed bottom-6 right-6 z-[90] flex flex-col gap-3";
  document.body.appendChild(div);
}

export function showToast(message, type = "success") {
  ensureToastContainer();
  const container = document.getElementById("toast-container");
  const accent = type === "success" ? "border-emerald-500" : "border-red-500";
  const icon = type === "success" ? "check-circle-2" : "alert-triangle";
  const toast = document.createElement("div");
  toast.className =
    `translate-y-3 opacity-0 transition-all duration-200 min-w-[280px] max-w-[420px] ` +
    `bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 border-l-4 ${accent} rounded-md p-4 shadow-2xl shadow-black/50`;
  toast.innerHTML = `<div class="flex items-center gap-3"><i data-lucide="${icon}" class="h-4 w-4 ${type === "success" ? "text-emerald-500" : "text-red-500"}"></i><p class="text-sm font-mono text-zinc-50">${message}</p></div>`;
  container.appendChild(toast);
  if (window.lucide?.createIcons) window.lucide.createIcons({ icons: toast.querySelectorAll("[data-lucide]") });
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-3", "opacity-0");
  });
  setTimeout(() => {
    toast.classList.add("translate-y-3", "opacity-0");
    setTimeout(() => toast.remove(), 220);
  }, 4000);
}
