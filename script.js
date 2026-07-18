
// ===== XSS 방지: 사용자/외부 데이터를 HTML에 꽂아넣기 전에 이스케이프 =====
// 지금은 place 데이터가 전부 고정값(하드코딩)이라 위험하지 않지만,
// 나중에 사용자가 직접 장소를 등록/수정하는 기능이 생기면 이 처리가 없으면
// 악성 스크립트를 이름/설명에 넣어서 다른 사용자 브라우저에서 실행시키는
// XSS 공격이 가능해짐. 그런 상황을 미리 대비해 모든 동적 텍스트에 적용.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed: " + src));
    document.head.appendChild(s);
  });
}

function loadCss(href) {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

const LEAFLET_JS_URLS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"
];
const LEAFLET_CSS_URLS = [
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
];
const CLUSTER_JS_URLS = [
  "https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js",
  "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"
];
const CLUSTER_CSS_URLS = [
  ["https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css", "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.4.1/dist/MarkerCluster.css"],
  ["https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css", "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css"]
];
const ROUTING_JS_URLS = [
  "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js",
  "https://cdn.jsdelivr.net/npm/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"
];
const ROUTING_CSS_URLS = [
  "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css",
  "https://cdn.jsdelivr.net/npm/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css"
];

// 여러 CDN 주소를 순서대로 시도하는 범용 함수. checkFn으로 실제 로드 성공 여부를 확인.
async function loadFromCdns(urls, checkFn) {
  for (const url of urls) {
    try {
      await loadScript(url);
      if (!checkFn || checkFn()) return true;
    } catch (e) {
      console.warn("CDN 실패, 다음 시도:", url);
    }
  }
  return false;
}

// CSS는 실패해도 앱이 죽지 않으므로, 여러 후보 중 첫 번째만 시도(실패해도 무시하고 진행)
function loadCssWithFallback(urlList) {
  loadCss(urlList[0]);
}

// useCluster, useRouting은 파일 하단 "애플리케이션 상태" 섹션에서 선언됨
// (라이브러리 로딩 성공 여부에 따라 loadAllLibraries()가 값을 설정함)

async function loadAllLibraries() {
  // 1. Leaflet 핵심 라이브러리 (필수 - 실패하면 지도 자체가 안 뜸)
  loadCssWithFallback(LEAFLET_CSS_URLS);
  const leafletOk = await loadFromCdns(LEAFLET_JS_URLS, () => typeof L !== "undefined");
  if (!leafletOk) return false;

  // 2. 마커 클러스터링 (선택 - 실패해도 기본 마커로 동작)
  CLUSTER_CSS_URLS.forEach((pair) => loadCssWithFallback(pair));
  useCluster = await loadFromCdns(CLUSTER_JS_URLS, () => typeof L.markerClusterGroup === "function");

  // 3. 경로 안내 (선택 - 실패해도 나머지 기능은 정상 동작)
  loadCssWithFallback(ROUTING_CSS_URLS);
  useRouting = await loadFromCdns(ROUTING_JS_URLS, () => typeof L.Routing !== "undefined");

  return true;
}

// ===== 장소 데이터: Supabase(진짜 PostgreSQL 데이터베이스)에서 가져옴 =====
// 예전에는 이 자리에 122곳 데이터가 코드 안에 통째로 박혀있었는데,
// 이제는 별도 데이터베이스에 저장해두고 REST API로 fetch해서 가져오는 구조로 바꿈.
// (이 anon key는 "읽기 전용" 공개키라 코드에 노출돼도 안전함 - Supabase의 Row Level
//  Security 정책으로 "누구나 조회만 가능, 쓰기/수정/삭제는 불가능"하게 막아뒀음)
const SUPABASE_URL = "https://txqazmmndbpcbokpipbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0xcR1WbZcpIg271GEsnBYw_WWPK1uu7";

let places = []; // 처음엔 비어있다가, fetchPlaces()가 끝나면 채워짐
let basePlaces = []; // 한국어 원본 데이터 (언어 전환 시 이걸 기준으로 다시 만듦)

// 데이터베이스 컬럼명(snake_case: has_vegan)을 코드 전체에서 쓰는
// 필드명(camelCase: hasVegan)으로 변환. place_translations도 lang을 키로 하는
// 객체({ en: {note, menu}, de: {note, menu} })로 정리해서 붙여줌.
function normalizePlace(row) {
  const translations = {};
  (row.place_translations || []).forEach((tr) => {
    translations[tr.lang] = { note: tr.note, menu: tr.menu || [] };
  });

  return {
    id: row.id,
    name: row.name,
    category: row.category,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    hasVegan: row.has_vegan,
    hasSpicy: row.has_spicy,
    hasPhotoSpot: row.has_photo_spot,
    note: row.note,
    priceLevel: row.price_level,
    menu: row.menu || [],
    _translations: translations, // { en: {note, menu}, de: {note, menu} } - DB에서 함께 가져온 번역
  };
}

async function fetchPlaces() {
  // place_translations(lang,note,menu) 부분이 핵심 - Supabase가 외래키(FK) 관계를
  // 감지해서, places 한 번 요청으로 각 장소의 번역 데이터까지 함께 묶어서 내려줌
  // (JOIN을 직접 안 짜도 PostgREST가 알아서 중첩된 배열로 만들어줌)
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/places?select=*,place_translations(lang,note,menu)&order=id`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase 응답 오류: ${response.status}`);
  }

  const rows = await response.json();
  places = rows.map(normalizePlace);
  basePlaces = places.map((p) => ({ ...p, _translations: p._translations })); // 한국어 원본 + 번역 데이터를 함께 보관
}


// ===== localStorage 안전 래퍼 =====
// 사파리 시크릿 모드, 브라우저 저장공간 차단 설정 등에서는 localStorage 접근 자체가
// 예외(에러)를 던질 수 있음. try/catch로 감싸서, 그런 환경에서도 앱이 죽지 않고
// "저장은 안 되지만 이번 세션에서는 정상 동작"하도록 만듦.
function safeStorageGet(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn(`localStorage 읽기 실패(${key}), 기본값 사용:`, e.message);
    return defaultValue;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`localStorage 저장 실패(${key}) - 이번 세션에서만 유지돼요:`, e.message);
  }
}

// =====================================================================
// 애플리케이션 상태 (Application State)
// =====================================================================
// 파일 전체에서 쓰는 상태 변수들을 한 군데에 모아뒀어요.
// 참고: `{ favorites: [...] }`처럼 하나의 객체로 완전히 묶는 것도 고려했지만,
// 이 파일 안에서 `map`이라는 이름이 (1) Leaflet 지도 인스턴스, (2) `places.map(...)`
// 같은 배열 메서드 이 두 가지 뜻으로 동시에 쓰이고 있어서, 기계적으로 전부
// `AppState.map`으로 바꾸면 배열 메서드 호출까지 깨질 위험이 있었어요.
// 그래서 안전한 선에서, "따로따로 흩어져 있던 걸 한 곳에 모아 문서화"하는
// 절충안을 택했어요. (실제 서비스라면 React 등으로 옮기면서 자연스럽게 해결될 부분)
let favorites = safeStorageGet("favorites", []); // 즐겨찾기한 장소 id 배열
let visitedPlaces = safeStorageGet("visitedPlaces", []); // 방문 체크한 장소 id 배열 (레벨 계산에 사용)
let currentCategory = "전체"; // 현재 선택된 카테고리 필터
let currentPrice = "전체"; // 현재 선택된 가격대 필터
let userLocation = null; // { lat, lng } 또는 null (GPS 권한 허용 시 채워짐)
let isRealGpsLocation = false; // true=실제 GPS 위치, false=GPS 실패 시 중앙역으로 대체된 상태
let markerMap = {}; // { placeId: LeafletMarker } - id로 마커를 빠르게 찾기 위한 캐시
let userMarker = null; // 내 위치를 표시하는 파란 세모 마커
let markerLayer = null; // 클러스터 그룹 또는 일반 레이어그룹 (장소 마커들을 담는 컨테이너)
let routingControl = null; // 현재 지도에 그려진 경로(Leaflet Routing Machine 컨트롤)
let course = safeStorageGet("course", []); // 나만의 코스: place id 배열, 추가한 순서 = 방문 순서
let map = null; // Leaflet 지도 인스턴스 본체
let useCluster = false; // 마커 클러스터링 라이브러리 로드 성공 여부
let useRouting = false; // 경로 안내 라이브러리 로드 성공 여부
let courseExpanded = false; // "나만의 코스" 패널이 펼쳐져 있는지 여부
let recommendCourseClickCount = 0; // 추천 코스 버튼 클릭 횟수 (첫 클릭=최단거리, 이후=랜덤 변주)

window.toggleFavorite = function(id) {
  const index = favorites.indexOf(id);
  if (index === -1) {
    favorites.push(id);
  } else {
    favorites.splice(index, 1);
  }
  safeStorageSet("favorites", favorites);

  // "즐겨찾기만 보기"가 켜져 있으면 목록 자체가 바뀌어야 하니 전체 재계산이 필요함.
  // 꺼져 있으면 그 아이템/팝업만 살짝 갱신 (지도 전체를 다시 그리면 열려있던 팝업이 닫혀버림)
  const favOnly = document.getElementById("fav-only-checkbox").checked;
  if (favOnly) {
    applyFilters();
  } else {
    refreshListItem(id);
    refreshPopupIfOpen(id);
  }
};

// ===== 방문 체크(레벨 시스템) =====
window.toggleVisited = function(id) {
  const index = visitedPlaces.indexOf(id);
  if (index === -1) {
    visitedPlaces.push(id);
  } else {
    visitedPlaces.splice(index, 1);
  }
  safeStorageSet("visitedPlaces", visitedPlaces);
  updateLevelBadge();
  // 방문 체크는 목록/필터에 영향을 주지 않으니 전체 재렌더 필요 없음
  refreshListItem(id);
  refreshPopupIfOpen(id);
};

function getLevelTitle(count) {
  const total = places.length;
  if (count === 0) return t("levelNotStarted");
  if (count < total * 0.1) return t("levelBeginner");
  if (count < total * 0.3) return t("levelRegular");
  if (count < total * 0.6) return t("levelExpert");
  return t("levelMaster");
}

function updateLevelBadge() {
  const badge = document.getElementById("level-badge");
  const count = visitedPlaces.length;
  badge.textContent = `Lv.${count}/${places.length} · ${getLevelTitle(count)}`;
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestCafe(place) {
  const cafes = places.filter((p) => p.type === "cafe" && p.id !== place.id);
  if (cafes.length === 0) return null;
  let nearest = cafes[0];
  let minDist = getDistanceKm(place.lat, place.lng, nearest.lat, nearest.lng);
  cafes.forEach((cafe) => {
    const dist = getDistanceKm(place.lat, place.lng, cafe.lat, cafe.lng);
    if (dist < minDist) {
      minDist = dist;
      nearest = cafe;
    }
  });
  return { cafe: nearest, distanceKm: minDist };
}

function renderDistanceFromUser(place) {
  if (!userLocation) return "";
  const km = getDistanceKm(userLocation.lat, userLocation.lng, place.lat, place.lng);
  
  // '내 위치', '중앙역' 단어를 언어 상태에 맞게 가져오기
  const label = isRealGpsLocation ? t("courseStartReal").replace("📍 출발점: ", "") : t("courseStartFallback").replace("📍 출발점: ", "");
  
  // 한국어 / 영어 / 독일어 어순과 표현 방식 분기
  if (currentLang === "ko") {
    return km < 1 ? `📍 ${label}에서 약 ${Math.round(km * 1000)}m` : `📍 ${label}에서 약 ${km.toFixed(1)}km`;
  } else if (currentLang === "de") {
    return km < 1 ? `📍 Ca. ${Math.round(km * 1000)}m von ${label}` : `📍 Ca. ${km.toFixed(1)}km von ${label}`;
  } else {
    return km < 1 ? `📍 Approx. ${Math.round(km * 1000)}m from ${label}` : `📍 Approx. ${km.toFixed(1)}km from ${label}`;
  }
}

function getFlagSvg(category) {
  const svgs = {
    한식: `<svg width="18" height="12" viewBox="0 0 30 20" style="vertical-align:-2px;margin-right:3px;"><rect width="30" height="20" fill="#fff"/><path d="M15 4 A6 6 0 0 1 15 16 A3 3 0 0 1 15 10 A3 3 0 0 0 15 4 Z" fill="#c60c30"/><path d="M15 16 A6 6 0 0 1 15 4 A3 3 0 0 1 15 10 A3 3 0 0 0 15 16 Z" fill="#003478"/></svg>`,
    일식: `<svg width="18" height="12" viewBox="0 0 30 20" style="vertical-align:-2px;margin-right:3px;"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/></svg>`,
    중식: `<svg width="18" height="12" viewBox="0 0 30 20" style="vertical-align:-2px;margin-right:3px;"><rect width="30" height="20" fill="#de2910"/><polygon points="7,3 8.2,6.2 11.5,6.2 8.8,8.2 9.8,11.4 7,9.4 4.2,11.4 5.2,8.2 2.5,6.2 5.8,6.2" fill="#ffde00"/></svg>`,
    베트남: `<svg width="18" height="12" viewBox="0 0 30 20" style="vertical-align:-2px;margin-right:3px;"><rect width="30" height="20" fill="#da251d"/><polygon points="15,4 17,9.5 23,9.5 18.3,13 20,18.5 15,15 10,18.5 11.7,13 7,9.5 13,9.5" fill="#ffde00"/></svg>`,
    태국: `<svg width="18" height="12" viewBox="0 0 30 20" style="vertical-align:-2px;margin-right:3px;"><rect width="30" height="20" fill="#a51931"/><rect y="3.3" width="30" height="13.4" fill="#fff"/><rect y="6.7" width="30" height="6.6" fill="#2d2a4a"/></svg>`
  };
  return svgs[category] || "";
}

function getCategoryLabel(category) {
  const name = translateCategoryName(category);
  if (category === "마트") return `🛒 ${name}`;
  if (category === "카페") return `☕ ${name}`;
  if (category === "오락") return `🎮 ${name}`;
  if (category === "서점") return `📚 ${name}`;
  if (category === "디저트") return `🍡 ${name}`;
  if (category === "명소") return `🏯 ${name}`;
  if (category === "굿즈") return `🎁 ${name}`;
  const flag = getFlagSvg(category);
  return flag ? `${flag}${name}` : name;
}

function renderTags(place) {
  let tags = "";
  if (place.hasVegan) tags += `<span title="비건 메뉴 있음">🌱</span> `;
  if (place.hasSpicy) tags += `<span title="매운 음식 있음">🌶️</span> `;
  if (place.hasPhotoSpot) tags += `<span title="인생샷 스팟">📸</span> `;
  return tags;
}

const PRICE_RANGES = { 1: "€8~15", 2: "€15~30", 3: "€30~50+" };
function renderMenu(menu) {
  if (!menu || menu.length === 0) return "";
  return menu.map(item => `<span style="display:inline-block;background:#f0e9dc;color:#1b2a4a;padding:2px 7px;border-radius:10px;margin:2px 3px 0 0;font-size:0.72rem;">${escapeHtml(item)}</span>`).join("");
}

function buildPopupContent(place) {
  let recommendationHtml = "";
  if (place.type === "restaurant") {
    const result = findNearestCafe(place);
    if (result) {
      recommendationHtml = `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #ccc;font-size:0.8rem;">☕ 근처 카페·디저트: <strong>${escapeHtml(result.cafe.name)}</strong> (약 ${Math.round(result.distanceKm * 1000)}m)</div>`;
    }
  }

  const isFav = favorites.includes(place.id);
  const activeClass = isFav ? "active" : "";
  const starText = isFav ? "★" : "☆";
  const isVisited = visitedPlaces.includes(place.id);
  const isInCourse = course.includes(place.id);
  const distanceHtml = renderDistanceFromUser(place) ? `<div style="margin-top:4px;font-size:0.78rem;color:#3c7a5e;font-weight:600;">${renderDistanceFromUser(place)}</div>` : "";
  const routeBtnHtml = (useRouting && userLocation)
    ? `<button onclick="showRouteTo(${place.id});" style="margin-top:6px;width:100%;padding:5px;border:1px solid #1b2a4a;background:#fff;color:#1b2a4a;border-radius:6px;cursor:pointer;font-size:0.75rem;font-family:inherit;">🚗 여기까지 경로 보기</button>`
    : "";
  const courseBtnHtml = `<button onclick="toggleCourse(${place.id});" style="margin-top:4px;width:100%;padding:5px;border:1px solid ${isInCourse ? '#c65a3c' : '#d8d0bd'};background:${isInCourse ? '#c65a3c' : '#fff'};color:${isInCourse ? '#fff' : '#666'};border-radius:6px;cursor:pointer;font-size:0.75rem;font-family:inherit;font-weight:600;">${isInCourse ? '✕ 코스에서 빼기' : '🚩 코스에 담기'}</button>`;

  // 구글맵 검색 URL - 좌표+이름으로 정확한 위치를 새 탭에서 열어줌 (API 키 불필요, 무료)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}@${place.lat},${place.lng}`;
  const googleMapsBtnHtml = `<a href="${googleMapsUrl}" target="_blank" rel="noopener" style="display:block;margin-top:4px;width:100%;padding:5px;border:1px solid #4285F4;background:#fff;color:#4285F4;border-radius:6px;cursor:pointer;font-size:0.75rem;font-family:inherit;font-weight:600;text-align:center;text-decoration:none;box-sizing:border-box;">🗺️ 구글맵에서 사진·리뷰 보기</a>`;

  return `
    <div style="min-width:190px; font-family: inherit;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <strong style="font-size:0.95rem; color:#1b2a4a;">${escapeHtml(place.name)}</strong>
        <span style="white-space:nowrap;">
          <button class="visit-btn ${isVisited ? 'active' : ''}" onclick="toggleVisited(${place.id});" aria-label="${isVisited ? '방문 완료 취소하기' : '가본 곳으로 표시하기'}" aria-pressed="${isVisited}">${isVisited ? '✔️ 완료' : '📍 가봤어요'}</button>
          <button class="popup-fav-btn ${activeClass}" onclick="toggleFavorite(${place.id});" aria-label="${isFav ? '즐겨찾기 해제' : '즐겨찾기에 추가'}" aria-pressed="${isFav}">${starText}</button>
        </span>
      </div>
      <div style="margin-top:2px;">${renderTags(place)}</div>
      <span style="color:#666;font-size:0.78rem;">${getCategoryLabel(place.category)}${place.priceLevel ? " · " + PRICE_RANGES[place.priceLevel] : ""}</span>
      ${distanceHtml}
      <div style="margin-top:4px;font-size:0.78rem;color:#444;line-height:1.3;">${escapeHtml(place.note)}</div>
      <div style="margin-top:6px;">${renderMenu(place.menu)}</div>
      ${recommendationHtml}
      ${routeBtnHtml}
      ${courseBtnHtml}
      ${googleMapsBtnHtml}
    </div>
  `;
}

// ===== 경로(라우팅) 기능 =====
// 무료 공개 OSRM 데모 서버를 사용합니다. 차량 기준 경로이며, 참고용 예상 경로입니다.
window.showRouteTo = function(placeId) {
  if (!useRouting) {
    alert(t("alertRoutingLibFailed"));
    return;
  }
  if (!userLocation) {
    alert(t("alertNeedLocation"));
    return;
  }
  const place = places.find((p) => p.id === placeId);
  if (!place) return;

  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }

  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(userLocation.lat, userLocation.lng),
      L.latLng(place.lat, place.lng),
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    createMarker: () => null, // 우리 마커를 이미 쓰고 있으니 라우팅 라이브러리의 기본 마커는 끔
    lineOptions: { styles: [{ color: "#c65a3c", weight: 5, opacity: 0.8 }] },
  }).addTo(map);
};

function clearRoute() {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
}

// ===== 나만의 코스 빌더 =====
function saveCourse() {
  safeStorageSet("course", course);
}

// 뒤셀도르프 중앙역 좌표 - 내 위치를 아직 안 켰을 때 코스 출발점 기본값으로 사용
const DUSSELDORF_HBF = { lat: 51.219853, lng: 6.794314 };

window.toggleCourse = function (id) {
  const idx = course.indexOf(id);
  const wasEmpty = course.length === 0;
  if (idx === -1) {
    course.push(id);
    if (wasEmpty) setCourseExpanded(true); // 첫 장소를 담으면 패널이 자동으로 펼쳐짐
  } else {
    course.splice(idx, 1);
  }
  saveCourse();
  renderCoursePanel();
  updateCourseRouteIfNeeded();
  // 코스는 목록/필터에 영향을 주지 않으니 전체 재렌더 필요 없음.
  // (예전엔 여기서 applyFilters()를 불러서 지도를 통째로 다시 그렸는데,
  //  그러면 방금 열려있던 팝업이 그대로 사라져버려서 "추가했는데 아무 반응 없음"처럼 보였음)
  refreshPopupIfOpen(id);
  refreshListItem(id); // 코스 뱃지 갱신
};

window.moveCourseItem = function (id, direction) {
  const idx = course.indexOf(id);
  const newIdx = idx + direction;
  if (idx === -1 || newIdx < 0 || newIdx >= course.length) return;
  [course[idx], course[newIdx]] = [course[newIdx], course[idx]];
  saveCourse();
  renderCoursePanel();
  updateCourseRouteIfNeeded();
};

function clearCourse() {
  const affectedIds = course.slice();
  course = [];
  saveCourse();
  renderCoursePanel();
  clearRoute();
  setCourseExpanded(false); // 비우면 다시 접어둠
  affectedIds.forEach((id) => refreshListItem(id));
}

function setCourseExpanded(expanded) {
  courseExpanded = expanded;
  document.getElementById("course-body").style.display = expanded ? "block" : "none";
  document.getElementById("course-toggle-arrow").textContent = expanded ? "▾" : "▸";
  document.getElementById("course-header").setAttribute("aria-expanded", String(expanded));
}

window.toggleCoursePanelBody = function () {
  setCourseExpanded(!courseExpanded);
};

function renderCoursePanel() {
  const countText = document.getElementById("course-count-text");
  const listEl = document.getElementById("course-list");
  const emptyEl = document.getElementById("course-empty");
  const actionsEl = document.getElementById("course-actions");
  const startInfoEl = document.getElementById("course-start-info");

  countText.textContent = `🧭 나만의 코스 (${course.length}곳)`;
  listEl.innerHTML = "";

  if (course.length === 0) {
    emptyEl.style.display = "block";
  } else {
    emptyEl.style.display = "none";
  }

  course.forEach((id, index) => {
    const place = places.find((p) => p.id === id);
    if (!place) return;

    const li = document.createElement("li");
    li.className = "course-item";
    li.innerHTML = `
      <span class="course-num" aria-hidden="true">${index + 1}</span>
      <span class="course-name">${escapeHtml(place.name)}</span>
      <button onclick="moveCourseItem(${id}, -1)" aria-label="${escapeHtml(place.name)} 순서를 위로 이동" ${index === 0 ? "disabled" : ""}>▲</button>
      <button onclick="moveCourseItem(${id}, 1)" aria-label="${escapeHtml(place.name)} 순서를 아래로 이동" ${index === course.length - 1 ? "disabled" : ""}>▼</button>
      <button onclick="toggleCourse(${id})" aria-label="${escapeHtml(place.name)} 코스에서 빼기">✕</button>
    `;
    listEl.appendChild(li);
  });

  actionsEl.style.display = course.length > 0 ? "flex" : "none";
  startInfoEl.textContent = isRealGpsLocation
    ? t("courseStartReal")
    : t("courseStartFallback");
  startInfoEl.style.display = course.length > 0 ? "block" : "none";
}

// 코스에 담긴 장소들을 순서대로 이어서 경로로 그림.
// 출발점은 내 위치가 있으면 내 위치, 없으면 뒤셀도르프 중앙역을 기본값으로 사용 (항상 출발점이 있음)
function drawCourseRoute() {
  if (!useRouting || course.length < 1) return;

  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }

  const startPoint = userLocation || DUSSELDORF_HBF;
  const waypoints = [L.latLng(startPoint.lat, startPoint.lng)];

  course.forEach((id) => {
    const place = places.find((p) => p.id === id);
    if (place) waypoints.push(L.latLng(place.lat, place.lng));
  });

  routingControl = L.Routing.control({
    waypoints: waypoints,
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    createMarker: () => null,
    lineOptions: { styles: [{ color: "#1b2a4a", weight: 5, opacity: 0.85 }] },
  }).addTo(map);
}

// 코스가 바뀔 때마다(추가/삭제/순서변경) 자동으로 호출 - 비어있으면 경로를 지우고, 있으면 다시 그림
function updateCourseRouteIfNeeded() {
  if (course.length === 0) {
    clearRoute();
  } else {
    drawCourseRoute();
  }
}

// ===== 추천 코스 짜기 =====
// 현재 필터 조건을 존중하면서, "식당 → 가장 가까운 카페/디저트 → 가장 가까운 놀거리(오락/서점/명소/굿즈)"
// 순서로 3곳을 자동으로 골라 코스를 만들어줌. 기존 코스는 덮어씀.
function generateRecommendedCourse() {
  const pool = getFilteredPlaces();
  const restaurants = pool.filter((p) => p.type === "restaurant");
  const cafes = pool.filter((p) => p.type === "cafe");
  const cultureSpots = pool.filter((p) => p.type === "culture");

  if (restaurants.length === 0) {
    alert(t("alertNoRestaurantForCourse"));
    return;
  }

  const anchor = userLocation || DUSSELDORF_HBF;
  const isFirstClick = recommendCourseClickCount === 0;
  recommendCourseClickCount++;

  // 첫 클릭: 진짜 제일 가까운 곳 하나로 결정.
  // 두 번째 클릭부터: 가까운 후보 5곳 중에서 무작위로 골라서 누를 때마다 다른 조합이 나오게 함.
  const pickNear = (list, from) => {
    const sorted = list.slice().sort(
      (a, b) => getDistanceKm(from.lat, from.lng, a.lat, a.lng) - getDistanceKm(from.lat, from.lng, b.lat, b.lng)
    );
    if (isFirstClick || sorted.length <= 1) return sorted[0];
    const topCandidates = sorted.slice(0, Math.min(5, sorted.length));
    return topCandidates[Math.floor(Math.random() * topCandidates.length)];
  };

  const picks = [];
  const startRestaurant = pickNear(restaurants, anchor);
  picks.push(startRestaurant);

  const remainingCafes = cafes.filter((c) => c.id !== startRestaurant.id);
  const nearestCafe = remainingCafes.length ? pickNear(remainingCafes, startRestaurant) : null;
  if (nearestCafe) picks.push(nearestCafe);

  const lastPoint = picks[picks.length - 1];
  const remainingCulture = cultureSpots.filter((c) => !picks.some((p) => p.id === c.id));
  const nearestCulture = remainingCulture.length ? pickNear(remainingCulture, lastPoint) : null;
  if (nearestCulture) picks.push(nearestCulture);

  const previousIds = course.slice();
  course = picks.map((p) => p.id);
  saveCourse();
  renderCoursePanel();
  setCourseExpanded(true);
  updateCourseRouteIfNeeded();

  // 바뀐 아이템들(예전 코스 + 새 코스)의 리스트 뱃지 갱신
  const changedIds = Array.from(new Set([...previousIds, ...course]));
  changedIds.forEach((id) => refreshListItem(id));
}

// ===== 룰렛 기능 =====
// 이제 "오늘 뭐 먹지"뿐 아니라 만화카페·서점·굿즈샵 등 문화 스팟도 후보에 포함
function spinRoulette() {
  const candidates = getFilteredPlaces().filter((p) => p.category !== "마트");
  const pool = candidates.length > 0 ? candidates : places.filter((p) => p.category !== "마트");
  const pick = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById("roulette-result-name").innerHTML =
    `${getCategoryLabel(pick.category)}<br>${escapeHtml(pick.name)}`;
  document.getElementById("roulette-modal").style.display = "flex";

  const marker = markerMap[pick.id];
  if (!marker) return;
  focusOnMarker(pick, marker, 16);
}

window.closeRouletteModal = function () {
  document.getElementById("roulette-modal").style.display = "none";
};

// ===== 취향 맞춤 추천 =====
// 즐겨찾기·방문체크한 곳들의 공통점(매운맛/비건 비율, 자주 가는 카테고리)을 계산해서
// 아직 안 가본 곳 중 취향에 가장 잘 맞는 곳을 골라주는 규칙 기반 추천 로직.
// (머신러닝 모델이 아니라 "패턴 세기 + 조건 매칭"이지만, 추천 시스템의 기본 원리는 동일함)
function generateTasteRecommendation() {
  const likedIds = Array.from(new Set([...favorites, ...visitedPlaces]));
  const liked = places.filter((p) => likedIds.includes(p.id));

  if (liked.length < 3) {
    alert(t("alertTasteNotEnough").replace("{count}", liked.length));
    return;
  }

  // 1. 매운맛/비건 선호도 계산 (찜한 곳의 절반 이상이면 "선호"로 판단)
  const spicyRatio = liked.filter((p) => p.hasSpicy).length / liked.length;
  const veganRatio = liked.filter((p) => p.hasVegan).length / liked.length;
  const prefersSpicy = spicyRatio >= 0.5;
  const prefersVegan = veganRatio >= 0.5;

  // 2. 가장 자주 찜한 카테고리 상위 2개
  const categoryCounts = {};
  liked.forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => cat);

  // 3. 아직 안 찜한 곳들 중, 위 조건에 맞을 때마다 점수를 매겨서 후보 선정
  const scored = places
    .filter((p) => !likedIds.includes(p.id))
    .map((p) => {
      let score = 0;
      if (prefersSpicy && p.hasSpicy) score++;
      if (prefersVegan && p.hasVegan) score++;
      if (topCategories.includes(p.category)) score++;
      return { place: p, score };
    })
    .filter((c) => c.score > 0);

  if (scored.length === 0) {
    alert(t("alertTasteNoMatch"));
    return;
  }

  const topScore = Math.max(...scored.map((c) => c.score));
  const bestMatches = scored.filter((c) => c.score === topScore);
  const pick = bestMatches[Math.floor(Math.random() * bestMatches.length)].place;

  // 4. "왜 추천했는지" 이유 문장 만들기
  const reasons = [];
  if (prefersSpicy && pick.hasSpicy) reasons.push(t("reasonSpicy"));
  if (prefersVegan && pick.hasVegan) reasons.push(t("reasonVegan"));
  if (topCategories.includes(pick.category)) reasons.push(translateCategoryName(pick.category));
  const reasonText = reasons.length > 0 ? t("reasonPrefix").replace("{reasons}", reasons.join("·")) : t("reasonDefault");

  document.getElementById("taste-reason").textContent = reasonText;
  document.getElementById("taste-result-name").innerHTML = `${getCategoryLabel(pick.category)}<br>${escapeHtml(pick.name)}`;
  document.getElementById("taste-modal").style.display = "flex";

  const marker = markerMap[pick.id];
  if (marker) focusOnMarker(pick, marker, 16);
}

window.closeTasteModal = function () {
  document.getElementById("taste-modal").style.display = "none";
};

function getColorForCategory(category) {
  switch (category) {
    case "한식": return "#c65a3c";
    case "일식": return "#4a7fc6";
    case "중식": return "#d94141";
    case "베트남": return "#e0b400";
    case "태국": return "#7b3fbf";
    case "마트": return "#3c7a5e";
    case "카페": return "#a67c52";
    case "오락": return "#2d9c9c";
    case "서점": return "#8a6d3b";
    case "디저트": return "#e0729e";
    case "명소": return "#ff8c42";
    case "굿즈": return "#5b5bd6";
    default: return "#1b2a4a";
  }
}


// 검색어/카테고리/가격/비건/매운맛/즐겨찾기/포토스팟 조건을 모두 반영해 걸러진 배열을 반환.
// applyFilters(렌더링)와 spinRoulette(룰렛 대상 선정) 둘 다 이 함수를 재사용.
function getFilteredPlaces() {
  const searchText = document.getElementById("search-input").value.trim().toLowerCase();
  const veganOnly = document.getElementById("vegan-checkbox").checked;
  const spicyOnly = document.getElementById("spicy-checkbox").checked;
  const favOnly = document.getElementById("fav-only-checkbox").checked;
  const photoOnly = document.getElementById("photospot-checkbox").checked;

  let filtered = places.filter((place) => {
    const matchesSearch = place.name.toLowerCase().includes(searchText);
    const matchesCategory = currentCategory === "전체" || place.category === currentCategory;
    const matchesPrice = currentPrice === "전체" || place.priceLevel === currentPrice;
    const matchesVegan = !veganOnly || place.hasVegan === true;
    const matchesSpicy = !spicyOnly || place.hasSpicy === true;
    const matchesFav = !favOnly || favorites.includes(place.id);
    const matchesPhoto = !photoOnly || place.hasPhotoSpot === true;

    return matchesSearch && matchesCategory && matchesPrice && matchesVegan && matchesSpicy && matchesFav && matchesPhoto;
  });

  filtered.sort((a, b) => {
    const aFav = favorites.includes(a.id) ? 1 : 0;
    const bFav = favorites.includes(b.id) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    if (userLocation) {
      const distA = getDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
      const distB = getDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
      return distA - distB;
    }
    return 0;
  });

  return filtered;
}

// 리스트에서 장소를 클릭했을 때, 어떤 마커인지 확실히 보이도록 잠깐 크게 만들었다가 되돌림.
// L.marker(divIcon 아이콘)는 setStyle이 없는 타입이라, 아이콘의 실제 DOM 요소에
// CSS 클래스를 붙였다 떼는 방식으로 처리함.
// 사이드바 리스트 아이템 하나의 내용물 HTML을 만드는 함수.
// applyFilters(전체 그리기)와 refreshListItem(부분 갱신) 둘 다 이 함수를 재사용함.
function buildListItemInnerHtml(place) {
  const isFav = favorites.includes(place.id);
  const isVisited = visitedPlaces.includes(place.id);
  const isInCourse = course.includes(place.id);
  const priceHtml = place.priceLevel ? PRICE_RANGES[place.priceLevel] : "";
  const distanceText = renderDistanceFromUser(place);

  return `
    <div class="place-item-header">
      <div class="place-name">${escapeHtml(place.name)} ${renderTags(place)}</div>
      <span style="white-space:nowrap;">
        <button class="visit-btn ${isVisited ? 'active' : ''}" onclick="toggleVisited(${place.id}); event.stopPropagation();" aria-label="${isVisited ? '방문 완료 취소하기' : '가본 곳으로 표시하기'}" aria-pressed="${isVisited}">
          ${isVisited ? '✔️' : '📍'}
        </button>
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${place.id}); event.stopPropagation();" aria-label="${isFav ? '즐겨찾기 해제' : '즐겨찾기에 추가'}" aria-pressed="${isFav}">
          ${isFav ? '★' : '☆'}
        </button>
        <button class="course-badge-btn ${isInCourse ? 'active' : ''}" onclick="toggleCourse(${place.id}); event.stopPropagation();" aria-label="${isInCourse ? '코스에서 빼기' : '코스에 담기'}" aria-pressed="${isInCourse}">
          🚩
        </button>
      </span>
    </div>
    <div class="place-category">${getCategoryLabel(place.category)}${priceHtml ? " · " + priceHtml : ""}</div>
    ${distanceText ? `<div style="font-size:0.72rem;color:#3c7a5e;font-weight:600;margin-top:2px;">${distanceText}</div>` : ""}
  `;
}

// 즐겨찾기/방문체크/코스추가 버튼을 눌렀을 때 지도 전체를 다시 그리지 않고,
// 딱 그 리스트 아이템 하나만 새로고침 (전체 재렌더는 느리고, 열려있던 팝업도 닫혀버림)
function refreshListItem(id) {
  const place = places.find((p) => p.id === id);
  const li = document.getElementById(`place-item-${id}`);
  if (!place || !li) return;
  li.innerHTML = buildListItemInnerHtml(place);
}

// 지금 열려있는 팝업이 있으면, 팝업을 닫지 않고 내용만 새로고침
// (즐겨찾기 별 표시나 코스 버튼 상태가 바로 바뀐 걸 보여주기 위함)
function refreshPopupIfOpen(id) {
  const marker = markerMap[id];
  const place = places.find((p) => p.id === id);
  if (!marker || !place) return;
  const popup = marker.getPopup();
  if (popup && marker.isPopupOpen && marker.isPopupOpen()) {
    popup.setContent(buildPopupContent(place));
  }
}

function pulseMarker(marker) {
  const el = marker.getElement && marker.getElement();
  if (!el) return; // 클러스터에 가려져서 아직 실제로 화면에 없는 경우
  const dot = el.querySelector(".place-marker-dot");
  if (!dot) return;
  dot.classList.add("marker-pulse");
  setTimeout(() => dot.classList.remove("marker-pulse"), 1500);
}

// 마커로 지도를 이동시키고 팝업을 열고 강조하는 공용 함수.
// 클러스터 모드에서는 zoomToShowLayer가 지도 이동을 전담해야 콜백이 확실히 실행되므로
// 미리 map.setView를 부르지 않음. 혹시 라이브러리 콜백이 어떤 이유로든 안 불리는 경우를
// 대비해 1.2초 안전장치(fallback)도 같이 걸어둠.
function focusOnMarker(place, marker, targetZoom) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    marker.openPopup();
    pulseMarker(marker);
  };

  if (useCluster && markerLayer.zoomToShowLayer) {
    markerLayer.zoomToShowLayer(marker, finish);
    setTimeout(finish, 1200); // 안전장치
  } else {
    map.setView([place.lat, place.lng], targetZoom);
    finish();
  }
}

function applyFilters() {
  if (!map) return;

  const filtered = getFilteredPlaces();

  // 클러스터 그룹(또는 일반 레이어그룹)을 통째로 비우고 다시 채움
  markerLayer.clearLayers();
  markerMap = {};

  const listEl = document.getElementById("place-list");
  listEl.innerHTML = "";

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <li style="padding:2rem 1.2rem;text-align:center;color:#999;font-size:0.85rem;line-height:1.5;">
        ${t("noResults")}
      </li>
    `;
  }

  filtered.forEach((place) => {
    const dotColor = getColorForCategory(place.category);
    const markerIcon = L.divIcon({
      className: "place-marker-icon",
      html: `<div class="place-marker-dot" style="background:${dotColor};"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const marker = L.marker([place.lat, place.lng], { icon: markerIcon });

    marker.bindPopup(() => buildPopupContent(place), { maxWidth: 260, minWidth: 200 });

    // 마우스를 올리면(클릭 안 해도) 이름/카테고리/가격이 바로 보이는 호버 툴팁
    const priceForTooltip = place.priceLevel ? PRICE_RANGES[place.priceLevel] : "";
    marker.bindTooltip(
      `<strong>${escapeHtml(place.name)}</strong><br><span style="font-size:11px;color:#666;">${place.category}${priceForTooltip ? " · " + priceForTooltip : ""}</span>`,
      { direction: "top", offset: [0, -10], className: "place-tooltip" }
    );

    marker.on("click", () => {
      setTimeout(() => {
        const li = document.getElementById(`place-item-${place.id}`);
        if (li) {
          li.scrollIntoView({ behavior: "smooth", block: "center" });
          li.classList.add("highlight-flash");
          setTimeout(() => li.classList.remove("highlight-flash"), 3000);
        }
      }, 100);
    });

    markerLayer.addLayer(marker);
    markerMap[place.id] = marker;

    const li = document.createElement("li");
    li.className = "place-item";
    li.id = `place-item-${place.id}`;
    li.innerHTML = buildListItemInnerHtml(place);

    // 리스트 클릭 시 지도 이동 + 팝업 열기 + 마커 강조(펄스) - 공용 함수 사용
    li.addEventListener("click", () => {
      focusOnMarker(place, marker, 15);
    });

    listEl.appendChild(li);
  });
}

function drawUserMarker(loc, popupText) {
  const btn = document.getElementById("locate-btn");
  btn.textContent = isRealGpsLocation
    ? t("locateActiveReal")
    : t("locateActiveFallback");
  btn.classList.add("active");

  if (userMarker) map.removeLayer(userMarker);

  const triangleIcon = L.divIcon({
    className: 'user-location-tri-container',
    html: '<div class="user-location-tri"></div>',
    iconSize: [20, 18],
    iconAnchor: [10, 18]
  });

  userMarker = L.marker([loc.lat, loc.lng], { icon: triangleIcon }).addTo(map);
  userMarker.bindPopup(`<strong>${popupText}</strong>`).openPopup();
  map.setView([loc.lat, loc.lng], 14);

  applyFilters();
  renderCoursePanel(); // 출발점 안내 문구("내 위치" ↔ "중앙역 기본값") 갱신
  updateCourseRouteIfNeeded(); // 코스가 이미 있었다면 실제 위치 기준으로 다시 그림
}

function requestUserLocation() {
  const btn = document.getElementById("locate-btn");
  if (!navigator.geolocation) {
    btn.textContent = t("locateUnsupported");
    return;
  }
  btn.textContent = t("locateSearching");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
      isRealGpsLocation = true;
      drawUserMarker(userLocation, "📍 나의 실시간 현재 위치");
    },
    (error) => {
      console.warn("GPS 호출 실패, 중앙역으로 대체 작동합니다.", error.message);
      userLocation = { lat: 51.219853, lng: 6.794314 };
      isRealGpsLocation = false;
      drawUserMarker(userLocation, "🗺️ 임시 위치 (Düsseldorf Hbf)로 작동 중");
    }
  );
}

// ===== 언어 전환 =====
// 정적으로 박혀있는 UI 텍스트들을 현재 언어(currentLang)에 맞게 다시 채워 넣음.
// 동적으로 상태에 따라 바뀌는 텍스트(내위치 버튼, 코스 출발점 등)는 각자의 함수에서 t()를 직접 부름.
function applyUIText() {
  document.getElementById("app-header").querySelector("h1").textContent = t("headerTitle");
  document.getElementById("app-header").querySelector(".subtitle").textContent = t("headerSubtitle");
  document.getElementById("search-input").placeholder = t("searchPlaceholder");

  const filterMore = document.getElementById("filter-more");
  const filterToggleBtn = document.getElementById("filter-toggle-btn");
  filterToggleBtn.textContent = filterMore.classList.contains("expanded")
    ? t("filterMoreExpanded")
    : t("filterMoreCollapsed");

  const veganLabel = document.getElementById("vegan-checkbox")?.closest("label");
  if (veganLabel) veganLabel.lastChild.textContent = " " + t("veganLabel");
  const spicyLabel = document.getElementById("spicy-checkbox")?.closest("label");
  if (spicyLabel) spicyLabel.lastChild.textContent = " " + t("spicyLabel");
  const photospotLabel = document.getElementById("photospot-checkbox")?.closest("label");
  if (photospotLabel) photospotLabel.lastChild.textContent = " " + t("photospotLabel");
  const favonlyLabel = document.getElementById("fav-only-checkbox")?.closest("label");
  if (favonlyLabel) favonlyLabel.lastChild.textContent = " " + t("favonlyLabel");

  if (!document.getElementById("locate-btn").classList.contains("active")) {
    document.getElementById("locate-btn").textContent = t("locateDefault");
  }
  document.getElementById("clear-route-btn").textContent = t("clearRouteBtn");
  document.getElementById("course-empty").textContent = t("courseEmpty");
  document.getElementById("course-clear-btn").textContent = t("courseClearBtn");
  document.getElementById("course-recommend-btn").textContent = t("courseRecommendBtn");
  document.getElementById("roulette-btn").textContent = t("rouletteBtn");
  document.querySelector("#roulette-modal .modal-subtitle").textContent = t("rouletteModalSubtitle");
  document.querySelectorAll(".modal-close-btn").forEach((b) => (b.textContent = t("modalConfirm")));
  document.getElementById("taste-recommend-btn").textContent = t("tasteRecommendBtn");
}

function refreshCategoryAndPriceButtonLabels() {
  document.querySelectorAll("#category-buttons .cat-btn").forEach((btn) => {
    const cat = btn.dataset.category;
    btn.innerHTML = cat === "전체" ? translateCategoryName("전체") : getCategoryLabel(cat);
  });
  document.querySelectorAll("#price-buttons .cat-btn").forEach((btn) => {
    if (btn.dataset.priceOpt === "전체") {
      btn.textContent = t("priceAll");
    }
  });
}

function setLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));

  applyPlaceTranslations(lang); // 장소 설명/메뉴를 해당 언어로 교체
  applyUIText(); // 버튼/라벨 등 고정 텍스트 갱신
  refreshCategoryAndPriceButtonLabels();
  updateLevelBadge();
  renderCoursePanel();
  applyFilters(); // 리스트/팝업/툴팁이 새 언어로 다시 그려짐
}

async function startApp() {
  const ok = await loadAllLibraries();
  if (!ok) {
    document.getElementById("map").innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;color:#888;">${t("mapLoadFailed")}</div>`;
    return;
  }

  try {
    await fetchPlaces();
  } catch (e) {
    console.error("장소 데이터를 가져오지 못했습니다:", e.message);
    document.getElementById("map").innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;color:#888;">${t("dataLoadFailed")}</div>`;
    return;
  }

  map = L.map("map").setView([51.2277, 6.7735], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // 마커 99개를 한 화면에 다 찍으면 지저분하니, 클러스터링 라이브러리가 로드됐으면 그걸 쓰고
  // 실패했으면 그냥 일반 레이어그룹으로 자연스럽게 대체(기능은 그대로 동작)
  markerLayer = useCluster
    ? L.markerClusterGroup({ disableClusteringAtZoom: 16 })
    : L.layerGroup();
  map.addLayer(markerLayer);

  const categories = ["전체", "한식", "일식", "중식", "베트남", "태국", "마트", "카페", "오락", "서점", "디저트", "명소", "굿즈"];
  const catContainer = document.getElementById("category-buttons");
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (cat === "전체" ? " active" : "");
    btn.dataset.category = cat;
    btn.innerHTML = cat === "전체" ? translateCategoryName("전체") : getCategoryLabel(cat);
    btn.addEventListener("click", () => {
      currentCategory = cat;
      document.querySelectorAll("#category-buttons .cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
    catContainer.appendChild(btn);
  });

  const priceOptions = [
    { value: "전체", label: "전체 가격" },
    { value: 1, label: "€8~15" },
    { value: 2, label: "€15~30" },
    { value: 3, label: "€30~50+" }
  ];
  const priceContainer = document.getElementById("price-buttons");
  priceOptions.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "cat-btn" + (opt.value === "전체" ? " active" : "");
    btn.dataset.priceOpt = String(opt.value);
    btn.textContent = opt.value === "전체" ? t("priceAll") : opt.label;
    btn.addEventListener("click", () => {
      currentPrice = opt.value;
      document.querySelectorAll("#price-buttons .cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilters();
    });
    priceContainer.appendChild(btn);
  });

  // 검색창은 타이핑할 때마다 바로 다시 그리면 버벅이니, 0.25초 정도 멈췄을 때만 반영(디바운스)
  let searchDebounceTimer = null;
  document.getElementById("search-input").addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilters, 250);
  });
  document.getElementById("vegan-checkbox").addEventListener("change", applyFilters);
  document.getElementById("spicy-checkbox").addEventListener("change", applyFilters);
  document.getElementById("fav-only-checkbox").addEventListener("change", applyFilters);
  document.getElementById("photospot-checkbox").addEventListener("change", applyFilters);
  document.getElementById("locate-btn").addEventListener("click", requestUserLocation);
  document.getElementById("roulette-btn").addEventListener("click", spinRoulette);
  document.getElementById("taste-recommend-btn").addEventListener("click", generateTasteRecommendation);

  // 언어 선택 버튼
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });
  document.getElementById("clear-route-btn").addEventListener("click", clearRoute);
  document.getElementById("course-clear-btn").addEventListener("click", clearCourse);
  document.getElementById("course-recommend-btn").addEventListener("click", generateRecommendedCourse);

  // 모바일 바텀시트 핸들 - 누르면 검색창/리스트를 접고 지도를 크게 봄
  const sidebarHandle = document.getElementById("sidebar-handle");
  const appContainer = document.getElementById("app-container");
  sidebarHandle.addEventListener("click", () => {
    const collapsed = appContainer.classList.toggle("sidebar-collapsed");
    sidebarHandle.setAttribute("aria-expanded", String(!collapsed));
    // 지도 컨테이너 크기가 CSS로 바뀌었으니, Leaflet한테 다시 계산하라고 알려줘야
    // 타일이 회색으로 깨지지 않음. 애니메이션(트랜지션) 끝난 뒤 한 번 더 불러줌.
    setTimeout(() => map.invalidateSize(), 50);
    setTimeout(() => map.invalidateSize(), 350);
  });

  // "⚙️ 필터 더보기" 토글 - 가격/비건/매운맛/포토스팟/즐겨찾기 필터를 평소엔 접어둠
  const filterToggleBtn = document.getElementById("filter-toggle-btn");
  const filterMore = document.getElementById("filter-more");
  filterToggleBtn.addEventListener("click", () => {
    const expanded = filterMore.classList.toggle("expanded");
    filterToggleBtn.textContent = expanded ? "⚙️ 필터 접기 ▴" : "⚙️ 필터 더보기 ▾";
    filterToggleBtn.setAttribute("aria-expanded", String(expanded));
  });

  if (!useRouting) {
    const clearBtn = document.getElementById("clear-route-btn");
    clearBtn.disabled = true;
    clearBtn.title = "경로 안내 라이브러리를 불러오지 못해 이 기능은 비활성화됐어요.";
    clearBtn.style.opacity = "0.5";
  }

  updateLevelBadge();
  renderCoursePanel();
  applyFilters();

  const loadingEl = document.getElementById("map-loading");
  if (loadingEl) loadingEl.remove(); // 지도 준비 끝났으니 로딩 문구 제거
}

startApp();
  
