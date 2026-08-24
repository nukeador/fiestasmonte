export function setupMapDirections(root = document) {
  if (!root?.querySelectorAll) return;

  root.querySelectorAll('[data-fiestas-directions]').forEach((link) => {
    const lat = Number(link.dataset.lat);
    const lng = Number(link.dataset.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const title = link.dataset.title || 'Destino';
    const platform = getMapPlatform();
    if (platform === 'android') {
      const label = encodeURIComponent(title);
      link.href = `geo:0,0?q=${lat},${lng}(${label})`;
      link.removeAttribute('target');
      link.removeAttribute('rel');
      return;
    }

    if (platform === 'ios') {
      link.href = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });
}

function getMapPlatform() {
  const userAgent = navigator.userAgent || '';
  if (/Android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/i.test(userAgent)) return 'ios';
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}
