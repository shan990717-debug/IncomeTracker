/** Map links and distances. */

export const hasCoords = (x) => Number.isFinite(x?.lat) && Number.isFinite(x?.lng);

const q = (x) => encodeURIComponent([x.nameLocal || x.title, x.nameLocal ? '' : x.area, x.nameLocal ? '' : x.region].filter(Boolean).join(' '));

/** Google opens reviews; Naver/Kakao know Korean shops best. */
export function mapLinks(x) {
  const c = hasCoords(x);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${c ? `${q(x)}&center=${x.lat},${x.lng}` : q(x)}`,
    naver: `https://map.naver.com/p/search/${q(x)}`,
    kakao: x.placeUrl || (c ? `https://map.kakao.com/link/map/${encodeURIComponent(x.nameLocal || x.title)},${x.lat},${x.lng}` : `https://map.kakao.com/link/search/${q(x)}`),
  };
}

/** Great-circle distance in km. */
export function km(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function fmtKm(d) {
  if (d == null) return '';
  if (d < 1) return `${Math.round(d * 1000)} m`;
  return d < 100 ? `${d.toFixed(1)} km` : `${Math.round(d)} km`;
}

/** Ask the phone for where we are now. */
export function myPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('这个浏览器不能定位'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? '没有定位权限：请在手机设定里允许浏览器使用位置' : '暂时拿不到位置')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
