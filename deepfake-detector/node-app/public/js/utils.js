export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function NumberCounter(targetElement, end, suffix = "%", duration = 500) {
  const start = 0;
  let startTimestamp = null;
  const tick = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
    const value = start + (end - start) * eased;
    targetElement.textContent = `${value.toFixed(1)}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function mountPage(callback) {
  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector("main");
    if (main) {
      main.classList.add("opacity-0", "translate-y-1", "transition-all", "duration-200");
      requestAnimationFrame(() => {
        main.classList.remove("opacity-0", "translate-y-1");
      });
    }
    if (callback) callback();
  });
}

export function formatPercent(value, digits = 1) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

export function bytesToSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / 1024 ** index;
  return `${size.toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
