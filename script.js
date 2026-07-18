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
  ["https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css", "https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css"],
  ["https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css", "https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css"]
];
const ROUTING_JS_URLS = [
  "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js",
  "https://cdn.jsdelivr.net/npm/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js"
];
const ROUTING_CSS_URLS = [
  "https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css",
  "https://cdn.jsdelivr.net/npm/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css"
];

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

function loadCssWithFallback(urlList) {
  loadCss(urlList[0]);
}

async function loadAllLibraries() {
  loadCssWithFallback(LEAFLET_CSS_URLS);
  const leafletOk = await loadFromCdns(LEAFLET_JS_URLS, () => typeof L !== "undefined");
  if (!leafletOk) return false;

  CLUSTER_CSS_URLS.forEach((pair) => loadCssWithFallback(pair));
  useCluster = await loadFromCdns(CLUSTER_JS_URLS, () => typeof L.markerClusterGroup === "function");

  loadCssWithFallback(ROUTING_CSS_URLS);
  useRouting = await loadFromCdns(ROUTING_JS_URLS, () => typeof L.Routing !== "undefined");

  return true;
}

const SUPABASE_URL = "https://txqazmmndbpcbokpipbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0xcR1WbZcpIg271GEsnBYw_WWPK1uu7";

let places = []; 
let basePlaces = []; 

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
    _translations: translations, 
  };
}

async function fetchPlaces() {
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
  basePlaces = places.map((p) => ({ ...p, _translations: p._translations })); 
}

function safeStorageGet(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

let favorites = safeStorageGet("favorites", []); 
let visitedPlaces = safeStorageGet("visitedPlaces", []); 
let currentCategory = "전체"; 
let currentPrice = "전체"; 
let userLocation = null; 
let isRealGpsLocation = false; 
let markerMap = {}; 
let userMarker = null; 
let markerLayer = null; 
let routingControl = null; 
let course = safeStorageGet("course", []); 
let map = null; 
let useCluster = false; 
let useRouting = false; 
let courseExpanded = false; 
let recommendCourseClickCount = 0; 

function saveCourse() {
  safeStorageSet("course", course);
}

window.toggleFavorite = function(id) {
  const index = favorites.indexOf(id);
  if (index === -1) {
    favorites.push(id);
  } else {
    favorites.splice(index, 1);
  }
  safeStorageSet("favorites", favorites);

  const favOnly = document.getElementById("fav-only-checkbox").checked;
  if (favOnly) {
    applyFilters();
  } else {
    refreshListItem(id);
    refreshPopupIfOpen(id);
  }
};

window.toggleVisited = function(id) {
  const index = visitedPlaces.indexOf(id);
  if (index === -1) {
    visitedPlaces.push(id);
  } else {
    visitedPlaces.splice(index, 1);
  }
  safeStorageSet("visitedPlaces", visitedPlaces);
  updateLevelBadge();
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
  const label = isRealGpsLocation ? t("courseStartReal").replace("🎯 출발점: ", "") : t("courseStartFallback").replace("🎯 출발점: ", "");
  
  if (currentLang === "ko") {
    return km < 1 ? `🎯 ${label}에서 약 ${Math.round(km * 1000)}m` : `🎯 ${label}에서 약 ${km.toFixed(1)}km`;
  } else if (currentLang === "de") {
    return km < 1 ? `🎯 Ca. ${Math.round(km * 1000)}m von ${label}` : `🎯 Ca. ${km.toFixed(1)}km von ${label}`;
  } else {
    return km < 1 ? `🎯 Approx. ${Math.round(km * 1000)}m from ${label}` : `🎯 Approx. ${km.toFixed(1)}km from ${label}`;
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
      let recTitle = "☕ 근처 카페·디저트:";
      let approxText = `약 ${Math.round(result.distanceKm * 1000)}m`;
      if (currentLang === "en") { recTitle = "☕ Nearby Cafe/Dessert:"; approxText = `approx. ${Math.round(result.distanceKm * 1000)}m`; }
      if (currentLang === "de") { recTitle = "☕ Café/Dessert in der Nähe:"; approxText = `ca. ${Math.round(result.distanceKm * 1000)}m`; }
      
      recommendationHtml = `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #ccc;font-size:0.8rem;">${recTitle} <strong>${escapeHtml(result.cafe.name)}</strong> (${approxText})</div>`;
    }
  }

  const isFav = favorites.includes(place.id);
  const activeClass = isFav ? "active" : "";
  const starText = isFav ? "★" : "☆";
  const isVisited = visitedPlaces.includes(place.id);
  const isInCourse = course.includes(place.id);
  const distanceHtml = renderDistanceFromUser(place) ? `<div style="margin-top:4px;font-size:0.78rem;color:#3c7a5e;font-weight:600;">${renderDistanceFromUser(place)}</div>` : "";
  
  let routeBtnText = "🚗 여기까지 경로 보기";
  if (currentLang === "en") routeBtnText = "🚗 Route to here";
  if (currentLang === "de") routeBtnText = "🚗 Route hierher";
  const routeBtnHtml = (useRouting && userLocation)
    ? `<button onclick="showRouteTo(${place.id});" style="margin-top:6px;width:100%;padding:5px;border:1px solid #1b2a4a;background:#fff;color:#1b2a4a;border-radius:6px;cursor:pointer;font-size:0.75rem;font-family:inherit;">${routeBtnText}</button>`
    : "";

  let courseBtnText = isInCourse ? '✕ 코스에서 빼기' : '🚩 코스에 담기';
  if (currentLang === "en") courseBtnText = isInCourse ? '✕ Remove from Course' : '🚩 Add to Course';
  if (currentLang === "de") courseBtnText = isInCourse ? '✕ Aus Route entfernen' : '🚩 In Route hinzufügen';
  const courseBtnHtml = `<button onclick="toggleCourse(${place.id});" style="margin-top:4px;width:100%;padding:5px;border:1px solid ${isInCourse ? '#c65a3c' : '#d8d0bd'};background:${isInCourse ? '#c65a3c' : '#fff'};color:${isInCourse ? '#fff' : '#666'};border-radius:6px;cursor:pointer;font-size:0.75rem;font-family:inherit;font-weight:600;">${courseBtnText}</button>`;

  let visitBtnText = isVisited ? '✔️ 완료' : '📍 가봤어요';
  if (currentLang === "en") visitBtnText = isVisited ? '✔️ Visited' : '📍 Been here';
  if (currentLang === "de") visitBtnText = isVisited ? '✔️ Besucht' : '📍 Hier gewesen';

  let gmapsBtnText = "🗺️ 구글맵에서 사진·리뷰 보기";
  if (currentLang === "en") gmapsBtnText = "🗺️ View Photos & Reviews on Google Maps";
  if (currentLang === "de") gmapsBtnText = "🗺️ Fotos & Bewertungen auf Google Maps";

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}@${place.lat},${place.lng}`;
  const googleMapsBtnHtml = `<a href="${googleMapsUrl}" target="_blank" rel="noopener" style="display:block;margin-top:4px;width:100%;padding:5px;border:1px solid #4285F4;background:#fff;color:#4285F4;border-radius:6px;cursor:pointer;font-size:0.75rem;font-family:inherit;font-weight:600;text-align:center;text-decoration:none;box-sizing:border-box;">${gmapsBtnText}</a>`;

  return `
    <div style="min-width:190px; font-family: inherit;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <strong style="font-size:0.95rem; color:#1b2a4a;">${escapeHtml(place.name)}</strong>
        <span style="white-space:nowrap;">
          <button class="visit-btn ${isVisited ? 'active' : ''}" onclick="toggleVisited(${place.id});" aria-label="Visit toggle" aria-pressed="${isVisited}">${visitBtnText}</button>
          <button class="popup-fav-btn ${activeClass}" onclick="toggleFavorite(${place.id});" aria-label="Favorite toggle" aria-pressed="${isFav}">${starText}</button>
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
    createMarker: () => null, 
    lineOptions: { styles: [{ color: "#c65a3c", weight: 5, opacity: 0.8 }] },
  }).addTo(map);
};

function clearRoute() {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
}

const DUSSELDORF_HBF = { lat: 51.219853, lng: 6.794314 };

window.toggleCourse = function (id) {
  const idx = course.indexOf(id);
  const wasEmpty = course.length === 0;
  if (idx === -1) {
    course.push(id);
    if (wasEmpty) setCourseExpanded(true); 
  } else {
    course.splice(idx, 1);
  }
  saveCourse();
  renderCoursePanel();
  updateCourseRouteIfNeeded();
  refreshPopupIfOpen(id);
  refreshListItem(id); 
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
  setCourseExpanded(false); 
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
  startInfoEl.textContent = isRealGpsLocation ? t("courseStartReal") : t("courseStartFallback");
  startInfoEl.style.display = course.length > 0 ? "block" : "none";
}

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

function updateCourseRouteIfNeeded() {
  if (course.length === 0) {
    clearRoute();
  } else {
    drawCourseRoute();
  }
}

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

  const changedIds = Array.from(new Set([...previousIds, ...course]));
  changedIds.forEach((id) => refreshListItem(id));
}

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

function generateTasteRecommendation() {
  const likedIds = Array.from(new Set([...favorites, ...visitedPlaces]));
  const liked = places.filter((p) => likedIds.includes(p.id));

  if (liked.length < 3) {
    alert(t("alertTasteNotEnough").replace("{count}", liked.length));
    return;
  }

  const spicyRatio = liked.filter((p) => p.hasSpicy).length / liked.length;
  const veganRatio = liked.filter((p) => p.hasVegan).length / liked.length;
  const prefersSpicy = spicyRatio >= 0.5;
  const prefersVegan = veganRatio >= 0.5;

  const categoryCounts = {};
  liked.forEach((p) => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => cat);

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
        <button class="visit-btn ${isVisited ? 'active' : ''}" onclick="toggleVisited(${place.id}); event.stopPropagation();" aria-label="Visit toggle" aria-pressed="${isVisited}">
          ${isVisited ? '✔️' : '📍'}
        </button>
        <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${place.id}); event.stopPropagation();" aria-label="Favorite toggle" aria-pressed="${isFav}">
          ${isFav ? '★' : '☆'}
        </button>
        <button class="course-badge-btn ${isInCourse ? 'active' : ''}" onclick="toggleCourse(${place.id}); event.stopPropagation();" aria-label="Course toggle" aria-pressed="${isInCourse}">
          🚩
        </button>
      </span>
    </div>
    <div class="place-category">${getCategoryLabel(place.category)}${priceHtml ? " · " + priceHtml : ""}</div>
    ${distanceText ? `<div style="font-size:0.72rem;color:#3c7a5e;font-weight:600;margin-top:2px;">${distanceText}</div>` : ""}
  `;
}

function refreshListItem(id) {
  const place = places.find((p) => p.id === id);
  const li = document.getElementById(`place-item-${id}`);
  if (!place || !li) return;
  li.innerHTML = buildListItemInnerHtml(place);
}

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
  if (!el) return; 
  const dot = el.querySelector(".place-marker-dot");
  if (!dot) return;
  dot.classList.add("marker-pulse");
  setTimeout(() => dot.classList.remove("marker-pulse"), 1500);
}

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
    setTimeout(finish, 1200); 
  } else {
    map.setView([place.lat, place.lng], targetZoom);
    finish();
  }
}

function applyFilters() {
  if (!map) return;

  const filtered = getFilteredPlaces();

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

    const priceForTooltip = place.priceLevel ? PRICE_RANGES[place.priceLevel] : "";
    marker.bindTooltip(
      `<strong>${escapeHtml(place.name)}</strong><br><span style="font-size:11px;color:#666;">${translateCategoryName(place.category)}${priceForTooltip ? " · " + priceForTooltip : ""}</span>`,
      { direction: "top", offset: [0, -10], className: "place-tooltip" }
    );

    // 💡 [성능 최적화 패치 1] 브라우저 지연 원인이던 setTimeout 제거 및 연산이 가벼운 'nearest' 스크롤 방식 장착
    marker.on("click", () => {
      const li = document.getElementById(`place-item-${place.id}`);
      if (li) {
        li.scrollIntoView({ behavior: "smooth", block: "nearest" });
        li.classList.add("highlight-flash");
        li.onanimationend = () => li.classList.remove("highlight-flash");
      }
    });

    markerLayer.addLayer(marker);
    markerMap[place.id] = marker;

    const li = document.createElement("li");
    li.className = "place-item";
    li.id = `place-item-${place.id}`;
    li.innerHTML = buildListItemInnerHtml(place);

    li.addEventListener("click", () => {
      focusOnMarker(place, marker, 15);
    });

    listEl.appendChild(li);
  });
}

function drawUserMarker(loc, popupText) {
  const btn = document.getElementById("locate-btn");
  btn.textContent = isRealGpsLocation ? t("locateActiveReal") : t("locateActiveFallback");
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
  renderCoursePanel(); 
  updateCourseRouteIfNeeded(); 
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
      drawUserMarker(userLocation, "🎯 나의 실시간 현재 위치");
    },
    (error) => {
      console.warn("GPS 호출 실패, 중앙역으로 대체 작동합니다.", error.message);
      userLocation = { lat: 51.219853, lng: 6.794314 };
      isRealGpsLocation = false;
      drawUserMarker(userLocation, "🗺️ 임시 위치 (Düsseldorf Hbf)로 작동 중");
    }
  );
}

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

  const locateBtn = document.getElementById("locate-btn");
  if (!locateBtn.classList.contains("active")) {
    locateBtn.textContent = t("locateDefault");
  } else {
    locateBtn.textContent = isRealGpsLocation ? t("locateActiveReal") : t("locateActiveFallback");
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

// 💡 [성능 최적화 패치 2] 언어 변경 시 무겁게 수백 개 루프를 돌던 로직을 지우고, 활성화된 '현재 열려있는 팝업'만 갱신
function setLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));

  applyPlaceTranslations(lang); 
  applyUIText(); 
  refreshCategoryAndPriceButtonLabels();
  updateLevelBadge();
  renderCoursePanel();
  applyFilters(); 
  
  const openPopup = map.getPopup();
  if (openPopup && openPopup.isOpen()) {
    for (const id in markerMap) {
      if (markerMap[id].getPopup() === openPopup) {
        refreshPopupIfOpen(Number(id));
        break;
      }
    }
  }
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

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });
  document.getElementById("clear-route-btn").addEventListener("click", clearRoute);
  document.getElementById("course-clear-btn").addEventListener("click", clearCourse);
  document.getElementById("course-recommend-btn").addEventListener("click", generateRecommendedCourse);

  const sidebarHandle = document.getElementById("sidebar-handle");
  const appContainer = document.getElementById("app-container");
  sidebarHandle.addEventListener("click", () => {
    const collapsed = appContainer.classList.toggle("sidebar-collapsed");
    sidebarHandle.setAttribute("aria-expanded", String(!collapsed));
    setTimeout(() => map.invalidateSize(), 50);
    setTimeout(() => map.invalidateSize(), 350);
  });

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
  if (loadingEl) loadingEl.remove(); 
}

startApp();
