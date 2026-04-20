export function RiskBadge(riskLevel) {
  let bg = '', text = '', glow = '', label = '';
  if (riskLevel === 'HIGH_RISK') {
    bg = 'bg-red-600'; glow = 'shadow-red-500/30'; text = 'text-white';
    label = '⚠ HIGH RISK DEEPFAKE';
  } else if (riskLevel === 'MEDIUM_SUSPICION') {
    bg = 'bg-amber-500'; glow = 'shadow-amber-500/30'; text = 'text-zinc-950';
    label = '◐ MEDIUM SUSPICION';
  } else {
    bg = 'bg-emerald-500'; glow = 'shadow-emerald-500/30'; text = 'text-zinc-950';
    label = '✓ AUTHENTIC';
  }
  return `<span class="${bg} ${text} ${glow} shadow-lg px-6 py-2 rounded-full font-mono font-bold tracking-wide text-sm whitespace-nowrap inline-block">
    ${label}
  </span>`;
}

export function StatCard({ label, value, subtext, id = '' }) {
  return `
    <div class="border border-zinc-800 bg-zinc-900 rounded-lg p-6">
      <div class="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-3">${label}</div>
      <div class="text-4xl font-mono font-bold tracking-tighter text-zinc-50" ${id ? `id="${id}"` : ''}>${value}</div>
      <div class="text-xs text-zinc-400 mt-2 font-mono">${subtext}</div>
    </div>
  `;
}

export function Button({ variant = 'primary', children, onClickData = '', id = '', type = 'button', extraClasses = '' }) {
  let baseStyles = 'px-5 py-2.5 rounded-md font-mono transition-all duration-150 inline-flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-2 focus:ring-cyan-500/50';
  let varStyles = '';

  if (variant === 'primary') {
    varStyles = 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold shadow-lg shadow-cyan-500/20';
  } else if (variant === 'secondary') {
    varStyles = 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800';
  } else if (variant === 'ghost') {
    baseStyles = 'px-4 py-2 font-mono transition-all duration-150 text-sm disabled:opacity-50 disabled:cursor-not-allowed';
    varStyles = 'text-zinc-400 hover:text-zinc-50';
  } else if (variant === 'danger') {
    varStyles = 'bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-500/20';
  }

  return `<button type="${type}" ${id ? `id="${id}"` : ''} ${onClickData ? `onclick="${onClickData}"` : ''} class="${baseStyles} ${varStyles} ${extraClasses}">
    ${children}
  </button>`;
}

export function Input({ id, type = 'text', placeholder, value = '', extraClasses = '', required = false }) {
  return `<input 
    type="${type}" 
    id="${id}" 
    placeholder="${placeholder}" 
    value="${value}" 
    ${required ? 'required' : ''}
    class="w-full bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-50 placeholder-zinc-600 font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all ${extraClasses}"
  />`;
}

export function SkeletonShimmer(width = 'w-full', height = 'h-6') {
  return `<div class="shimmer-block ${width} ${height} rounded-md"></div>`;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toastId = 'toast-' + Math.random().toString(36).substr(2, 9);
  const borderLeft = type === 'success' ? 'border-l-emerald-500' : 'border-l-red-500';
  const icon = type === 'success' ? 
    '<svg class="w-4 h-4 text-emerald-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : 
    '<svg class="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    
  const el = document.createElement('div');
  el.id = toastId;
  el.className = `flex items-center min-w-[280px] bg-zinc-900 border border-zinc-800 ${borderLeft} border-l-4 backdrop-blur-xl rounded shadow-2xl p-4 shadow-black/50 transform transition-all duration-300 translate-x-full opacity-0 font-mono text-sm`;
  el.innerHTML = `${icon} <span class="text-zinc-50">${message}</span>`;
  
  container.appendChild(el);
  
  // slide in
  setTimeout(() => {
    el.classList.remove('translate-x-full', 'opacity-0');
  }, 10);
  
  // auto remove
  setTimeout(() => {
    el.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }, 4000);
}
