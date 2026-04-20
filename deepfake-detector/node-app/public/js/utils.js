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

export function animateValue(targetElement, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // EaseOutQuart
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    
    // We compute the current value
    const currentVal = (easeProgress * (end - start) + start).toFixed(1);
    targetElement.innerHTML = `${currentVal}%`;
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      targetElement.innerHTML = `${end.toFixed(1)}%`;
    }
  };
  window.requestAnimationFrame(step);
}

// Utility to mount pages with fade effect
export function mountPage(callback) {
  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main');
    if (main) main.classList.add('page-mount');
    if (callback) callback();
  });
}
