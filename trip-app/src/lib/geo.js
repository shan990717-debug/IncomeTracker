/** Open a place in Naver / Kakao / Google Maps. Korean names search best on Naver/Kakao. */
export function mapLinks(x) {
  const q = encodeURIComponent([x.nameLocal || x.title, x.nameLocal ? '' : x.area, x.nameLocal ? '' : x.region].filter(Boolean).join(' '));
  return {
    naver: `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/link/search/${q}`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}
