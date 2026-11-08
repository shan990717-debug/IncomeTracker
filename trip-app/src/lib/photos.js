/*
 * Photos for the 旅行报告, kept only on this phone (IndexedDB), never uploaded.
 * Shrunk to 1600px JPEG data URLs so making the images stays quick.
 * Shape per trip: { cover: dataUrl, days: { 'YYYY-MM-DD': [dataUrl…] } }
 */
const DB = 'tripaa_photos';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('trips');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('trips', mode);
    const req = fn(t.objectStore('trips'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
};

export async function loadPhotos(tripId) {
  try { return (await tx('readonly', (s) => s.get(tripId))) || { cover: '', days: {} }; } catch { return { cover: '', days: {} }; }
}
export async function savePhotos(tripId, photos) {
  try { await tx('readwrite', (s) => s.put(photos, tripId)); } catch { /* private mode: keep in memory only */ }
}

export async function shrink(file, max = 1600) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
