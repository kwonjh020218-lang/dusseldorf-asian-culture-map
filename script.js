
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

const places = [
  {
    "id": 1,
    "name": "Hanaro Markt",
    "category": "마트",
    "type": "market",
    "lat": 51.2220999,
    "lng": 6.7889315,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "임머만 거리의 한인 마트. 정육·수산 코너와 즉석 김밥/스시도 있음.",
    "priceLevel": null,
    "menu": [
      "즉석 김밥",
      "정육/수산",
      "라면 코너"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 2,
    "name": "Soboro Korean Bakery",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2202,
    "lng": 6.7928,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "한국식 베이커리 겸 카페. 말차 케이크 라인업이 다양함.",
    "priceLevel": 2,
    "menu": [
      "말차 케이크",
      "빵/디저트"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 3,
    "name": "Bibimcup",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.22238,
    "lng": 6.78693,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "돌솥 비빔밥이 유명. 반찬을 서비스로 줌. 비건 김치 있음.",
    "priceLevel": 2,
    "menu": [
      "돌솥 비빔밥",
      "파전",
      "김밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 4,
    "name": "Korea Haus Han Kook Kwan",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.221875,
    "lng": 6.7870389,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "뒤셀도르프에서 가장 오래된 한식당 중 하나. 삼겹살 등 코리안 BBQ.",
    "priceLevel": 2,
    "menu": [
      "삼겹살 BBQ",
      "돌솥비빔밥",
      "김치찌개"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 5,
    "name": "YoGi",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2211,
    "lng": 6.7854,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "그루펠로 거리에 있는 작은 한식당. 현지 한인 커뮤니티에서 평이 좋음.",
    "priceLevel": 2,
    "menu": [
      "백반 정식",
      "제육볶음"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 6,
    "name": "Koreanisches Restaurant Gusan",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.214,
    "lng": 6.787,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "가족이 운영하는 작은 식당. 뜨거운 돌솥 비빔밥 추천.",
    "priceLevel": 2,
    "menu": [
      "돌솥 비빔밥",
      "비건 김치"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 7,
    "name": "Mandu",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.208,
    "lng": 6.805,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "오버빌크에 위치. 튀긴 만두가 시그니처. 소박하지만 맛은 확실함.",
    "priceLevel": 1,
    "menu": [
      "튀김만두",
      "김밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 8,
    "name": "Restaurant Seoul",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2249869,
    "lng": 6.7871114,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "정통 한식을 표방하는 가정식 느낌의 식당.",
    "priceLevel": 2,
    "menu": [
      "돌솥비빔밥",
      "된장찌개",
      "잡채"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 9,
    "name": "Tokyo Ramen Takeichi",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.22434,
    "lng": 6.7872424,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "도쿄식 쇼유 라멘 전문. 진하고 크리미한 육수가 특징.",
    "priceLevel": 2,
    "menu": [
      "쇼유 라멘",
      "탄탄멘",
      "치킨 교자"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 10,
    "name": "Tonkatsu GONTA",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2201,
    "lng": 6.7926,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "돈카츠 전문점.",
    "priceLevel": 2,
    "menu": [
      "돈카츠",
      "카츠동"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 11,
    "name": "Okinii Düsseldorf City",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.22,
    "lng": 6.7925,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "아이패드로 주문하는 무제한 뷔페 컨셉. 캐주얼한 분위기.",
    "priceLevel": 2,
    "menu": [
      "무제한 뷔페",
      "초밥",
      "야키토리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 12,
    "name": "张亮麻辣烫 Zhang Liang Malatang",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2197,
    "lng": 6.7915,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "직접 재료를 골라 끓이는 마라탕 전문점. 재료 대부분 비건 옵션 선택 가능.",
    "priceLevel": 1,
    "menu": [
      "마라탕(직접 구성)",
      "꿔바로우"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 13,
    "name": "Fuyu 台灣美食坊",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2196,
    "lng": 6.7913,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "대만식 국수 전문. 탕면과 돼지고기덮밥이 인기.",
    "priceLevel": 1,
    "menu": [
      "탕면",
      "돼지고기덮밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 14,
    "name": "DongWu Chinese Kitchen",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2333108,
    "lng": 6.7788968,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "쓰촨식 매운 요리 전문. 오리 요리도 유명. Kaiserstr. 29.",
    "priceLevel": 2,
    "menu": [
      "방방지(닭냉채)",
      "오리 요리",
      "매운 국수"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 15,
    "name": "Namu Café",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2203,
    "lng": 6.7933,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "전통 방식 빙수(Bing Su)로 유명한 작은 카페.",
    "priceLevel": 2,
    "menu": [
      "빙수",
      "말차 디저트"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 16,
    "name": "Bing Go",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2199,
    "lng": 6.7918,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "일본식 카키고리(빙수)와 달고나 커피 전문.",
    "priceLevel": 2,
    "menu": [
      "카키고리(빙수)",
      "달고나 커피"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 17,
    "name": "Takumi",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2236177,
    "lng": 6.788777,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "삿포로식 쇼유 라멘의 원조 격. 항상 줄이 김. Immermannstr. 28.",
    "priceLevel": 2,
    "menu": [
      "삿포로 쇼유 라멘",
      "교자",
      "타코야키"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 18,
    "name": "Naniwa Noodles & Soups",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2249515,
    "lng": 6.7881079,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "20가지 라멘 조합. 채식/비건 옵션이 다른 라멘집보다 많음. Oststraße 55.",
    "priceLevel": 2,
    "menu": [
      "미소 라멘",
      "탄탄 라멘",
      "채식 라멘"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 19,
    "name": "Takezo",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2226986,
    "lng": 6.7907142,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "탄탄멘(매운 라멘) 전문. 검은 참깨 국물이 시그니처. Immermannstr. 48.",
    "priceLevel": 2,
    "menu": [
      "탄탄멘",
      "가라아게",
      "교자"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 20,
    "name": "My Noodlehouse",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2223746,
    "lng": 6.7860496,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "한국/일본 스타일에 태국·중국 메뉴까지 섞인 아늑한 국수집. Bismarckstr. 54A.",
    "priceLevel": 2,
    "menu": [
      "국수 수프",
      "차슈"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 21,
    "name": "Three Kingdoms",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2199,
    "lng": 6.7919,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "임머만 거리의 정통 중식당. Immermannstr. 32.",
    "priceLevel": 2,
    "menu": [
      "마파두부",
      "탕수육"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 22,
    "name": "Hallo Vietnam",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.245,
    "lng": 6.787,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "포(Pho)와 태국 커리를 함께 파는 베트남·태국 퓨전. Münsterstr. 81.",
    "priceLevel": 2,
    "menu": [
      "쌀국수(포)",
      "태국 커리",
      "생춘권"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 23,
    "name": "Sila Thai",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.223,
    "lng": 6.781,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "뒤셀도르프에서 손꼽히는 태국 레스토랑 & 칵테일 바. Bahnstr. 76.",
    "priceLevel": 2,
    "menu": [
      "팟타이",
      "그린 커리",
      "똠얌꿍"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 24,
    "name": "Jay by Sila Thai",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.236739,
    "lng": 6.7792161,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "Sila Thai의 두 번째 매장, 채식 메뉴 강화. Nordstr. 31.",
    "priceLevel": 2,
    "menu": [
      "채식 커리",
      "팟타이"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 25,
    "name": "Yoonsim Korean BBQ",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2209671,
    "lng": 6.7886605,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "손질된 마리네이드 고기가 강점인 코리안 BBQ. Bismarckstr. 83.",
    "priceLevel": 2,
    "menu": [
      "갈비",
      "삼겹살 BBQ",
      "김치찌개"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 26,
    "name": "Leckere Linie",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.197709,
    "lng": 6.7763897,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "메로빙거플라츠 근처 배달 위주 한식당.",
    "priceLevel": 1,
    "menu": [
      "도시락",
      "볶음 요리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 27,
    "name": "Dodo&Jojo Seoul Deli",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.228029,
    "lng": 6.7930737,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "핫도그·프라이드치킨 등 한국식 길거리 음식 퓨전. Gerresheimer Str. 12.",
    "priceLevel": 2,
    "menu": [
      "치즈 핫도그",
      "코리안 프라이드치킨",
      "떡볶이"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 28,
    "name": "KUMO Dorayaki & Softeis",
    "category": "카페",
    "type": "cafe",
    "lat": 51.222343,
    "lng": 6.7860316,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "말차·타로 소프트아이스크림과 도라야키 전문점. Oststr. 109.",
    "priceLevel": 1,
    "menu": [
      "도라야키",
      "말차 소프트아이스크림"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 29,
    "name": "Mmaah! Eat Korean",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2258466,
    "lng": 6.7757676,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "훈스뤼켄 거리의 아담한 한식 치킨 전문점.",
    "priceLevel": 1,
    "menu": [
      "코리안 프라이드치킨"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 30,
    "name": "Sojubar Düsseldorf",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2217451,
    "lng": 6.7888268,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "한국식 프라이드치킨과 소주 바. Charlottenstr. 49.",
    "priceLevel": 1,
    "menu": [
      "양념/후라이드 치킨",
      "소주"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 31,
    "name": "GiMi",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2236356,
    "lng": 6.8042873,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "플링거른 남부의 가정식 한식당. 비건 비빔밥 있음.",
    "priceLevel": 2,
    "menu": [
      "간장 치킨",
      "채소 비빔밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 32,
    "name": "Kushi-Tei of Tokyo",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2232202,
    "lng": 6.7896631,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "꼬치구이와 스시 전문. Immermannstr. 38.",
    "priceLevel": 3,
    "menu": [
      "참치 스시",
      "꼬치구이(야키토리)",
      "장어구이"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 33,
    "name": "Yaki-The-Emon",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2247321,
    "lng": 6.7889248,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "오코노미야키·타코야키 등 철판요리 전문 이자카야. Klosterstr. 72.",
    "priceLevel": 2,
    "menu": [
      "오코노미야키",
      "야키소바",
      "타코야키"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 34,
    "name": "Yabase",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2247963,
    "lng": 6.7887578,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "신선한 스시·사시미로 유명. Klosterstr. 70.",
    "priceLevel": 3,
    "menu": [
      "스시 세트",
      "사시미",
      "장어(우나기)"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 35,
    "name": "Sapporo Ramen Dosanko",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2237965,
    "lng": 6.7865137,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "삿포로식 미소라멘 전문. Marienstr. 34.",
    "priceLevel": 2,
    "menu": [
      "미소 라멘",
      "돼지고기 볶음밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 36,
    "name": "Umaimon Little Tokyo",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2233339,
    "lng": 6.7895598,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "탄탄라멘과 치킨가스라멘이 유명. Immermannstr. 36.",
    "priceLevel": 2,
    "menu": [
      "탄탄 라멘",
      "치킨가스 라멘"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 37,
    "name": "Tammani Japanese Deli + Cafe",
    "category": "일식",
    "type": "cafe",
    "lat": 51.2112344,
    "lng": 6.7633192,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "일본식 델리 겸 카페. 우동과 말차 라떼. Bilker Allee 1.",
    "priceLevel": 1,
    "menu": [
      "가라아게",
      "우동",
      "말차 라떼"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 38,
    "name": "Takumi 2nd Tonkotsu",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2251692,
    "lng": 6.7882311,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "돈코츠(진한 돼지육수) 라멘 전문점. Oststr. 51.",
    "priceLevel": 2,
    "menu": [
      "돈코츠 라멘",
      "타코야키"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 39,
    "name": "Ramen Takezo Bilker Allee",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2110043,
    "lng": 6.7678152,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "Takezo의 빌크 지점. Bilker Allee 56.",
    "priceLevel": 2,
    "menu": [
      "유즈시오 라멘",
      "가키아게동"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 40,
    "name": "Takumi 3rd Chicken & Veggie",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2247166,
    "lng": 6.7889542,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "치킨·채식 라멘 전문. 비건 다시마 육수 사용. Klosterstr. 72.",
    "priceLevel": 2,
    "menu": [
      "파이탄 치킨 라멘",
      "채식 라멘",
      "가라아게"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 41,
    "name": "Maruyasu Immermann",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2245943,
    "lng": 6.7856002,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "셀프서비스 스시·우동 델리. Immermannstr. 11.",
    "priceLevel": 2,
    "menu": [
      "에비카츠동",
      "기츠네 우동",
      "초밥 세트"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 42,
    "name": "BaBa Sushi (Fürstenwall)",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2147537,
    "lng": 6.7687561,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "고급스러운 인테리어의 스시 레스토랑. Fürstenwall 66B.",
    "priceLevel": 2,
    "menu": [
      "초밥 롤",
      "사시미"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 43,
    "name": "SeSu Seafood & Sushi",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2232137,
    "lng": 6.7741317,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "칼스플라츠 마켓의 굴·스시 스탠드.",
    "priceLevel": 2,
    "menu": [
      "생굴",
      "초밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 44,
    "name": "Narumi Sushi & Ramen",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2143483,
    "lng": 6.7870688,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "작지만 알찬 스시·라멘집. 마늘 에다마메가 별미. Helmholtzstr. 34.",
    "priceLevel": 1,
    "menu": [
      "고질라롤",
      "마늘 에다마메",
      "라멘"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 45,
    "name": "BaBa Sushi (Münsterstraße)",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2417385,
    "lng": 6.7830085,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "BaBa Sushi 2호점, 포(Pho)도 같이 판매. Münsterstr. 22.",
    "priceLevel": 2,
    "menu": [
      "초밥",
      "쌀국수(포)"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 46,
    "name": "Koi Sushi",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2256232,
    "lng": 6.7919289,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "QR코드 주문 방식의 스시·벤토 전문점.",
    "priceLevel": 1,
    "menu": [
      "벤토 박스",
      "초밥 세트"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 47,
    "name": "Nana Sushi",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2004418,
    "lng": 6.8395137,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "포장·배달 전문 스시집, 필라델피아롤이 인기.",
    "priceLevel": 1,
    "menu": [
      "필라델피아롤",
      "초밥 세트"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 48,
    "name": "MAKI Sushi und Burrito",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2261474,
    "lng": 6.7724277,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "스시부리또 퓨전. Burgpl. 7.",
    "priceLevel": 2,
    "menu": [
      "스시 부리또",
      "스시 타코"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 49,
    "name": "Izakaya Sushi Bar Takezo",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2163556,
    "lng": 6.7765096,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "규탄(우설) 세트로 유명한 정통 이자카야. Friedrichstr. 49.",
    "priceLevel": 2,
    "menu": [
      "규탄(우설) 정식",
      "챠소바"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 50,
    "name": "Bai Wei Fang",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2209354,
    "lng": 6.790974,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "바오지·유탸오·또우장 등 중국식 아침식사 전문. Friedrich-Ebert-Str. 53.",
    "priceLevel": 1,
    "menu": [
      "바오즈",
      "유탸오",
      "또우장(콩우유)"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 51,
    "name": "Xiao Long Kan",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2214687,
    "lng": 6.7893511,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "쓰촨식 훠궈(마라탕) 대형 전문점. Friedrich-Ebert-Str. 31.",
    "priceLevel": 3,
    "menu": [
      "훠궈(마라탕)",
      "매운 소스"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 52,
    "name": "Gourmet Palast Düsseldorf",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2068796,
    "lng": 6.8215625,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "스시·해산물·중식이 섞인 대형 뷔페.",
    "priceLevel": 2,
    "menu": [
      "무제한 뷔페",
      "초밥",
      "해산물"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 53,
    "name": "Tang Wang",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2260582,
    "lng": 6.7866396,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "딤섬과 샤오롱바오가 유명한 정통 중식당. Liesegangstr. 15.",
    "priceLevel": 2,
    "menu": [
      "샤오롱바오",
      "딤섬"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 54,
    "name": "Asia 5 Sterne",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2428377,
    "lng": 6.7192552,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "대형 아시아 뷔페 레스토랑. Hansaallee 247.",
    "priceLevel": 2,
    "menu": [
      "무제한 뷔페",
      "초밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 55,
    "name": "Bambus Garten",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.28035,
    "lng": 6.781868,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "공항 근처의 대형 중식 뷔페.",
    "priceLevel": 1,
    "menu": [
      "무제한 뷔페",
      "그릴 요리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 56,
    "name": "蟠道山 Bergpfad",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2252145,
    "lng": 6.7863848,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "쓰촨식 고급 중식당. Klosterstr. 35.",
    "priceLevel": 3,
    "menu": [
      "쿠민 양고기",
      "생선 요리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 57,
    "name": "Tengri Tagh Uigur Restaurant",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.221527,
    "lng": 6.7857466,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "위구르식 양고기·큰접시치킨 전문. Oststr. 120.",
    "priceLevel": 2,
    "menu": [
      "큰접시치킨(다판지)",
      "양고기 꼬치",
      "손칼국수"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 58,
    "name": "Chuan Wei Chuan",
    "category": "중식",
    "type": "restaurant",
    "lat": 51.2195608,
    "lng": 6.7846654,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "충칭식 정통 쓰촨 요리. Bahnstr. 59.",
    "priceLevel": 2,
    "menu": [
      "가지 요리(디싼시엔)",
      "양고기 꼬치"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 59,
    "name": "To1980 Vietnamese Street Food",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2191527,
    "lng": 6.7860657,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "쌀국수와 반미로 유명한 베트남 스트리트푸드. Graf-Adolf-Str. 70a.",
    "priceLevel": 2,
    "menu": [
      "분보후에",
      "반미",
      "생춘권"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 60,
    "name": "To1980 Ga Bánh Mì",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2213241,
    "lng": 6.7885579,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "반미(베트남 샌드위치) 전문점. Bismarckstr. 82.",
    "priceLevel": 1,
    "menu": [
      "반미 샌드위치"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 61,
    "name": "To1980 Mì Kitchen",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2213614,
    "lng": 6.7884403,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "국수 위주의 베트남 퓨전 레스토랑. Bismarckstr. 82.",
    "priceLevel": 2,
    "menu": [
      "세트 메뉴(쉐프초이스)",
      "여름 음료"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 62,
    "name": "Ha Noi Pho",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2189893,
    "lng": 6.7844622,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "하노이식 정통 쌀국수. Graf-Adolf-Str. 58.",
    "priceLevel": 1,
    "menu": [
      "쌀국수(포)",
      "오리 커리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 63,
    "name": "LêVy",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.21581,
    "lng": 6.78466,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "글루텐프리 옵션이 있는 베트남 레스토랑. Hüttenstr. 47A.",
    "priceLevel": 2,
    "menu": [
      "분짜",
      "쌀국수",
      "베트남 커피"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 64,
    "name": "To1980 VEGAN",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2228336,
    "lng": 6.7903441,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "100% 비건 베트남 레스토랑. Immermannstr. 46.",
    "priceLevel": 2,
    "menu": [
      "비건 쌀국수",
      "비건 스몰디시"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 65,
    "name": "Vietnam Street Food",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2108864,
    "lng": 6.7771994,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "채식 쌀국수가 특히 좋은 평. Bilker Allee 164.",
    "priceLevel": 2,
    "menu": [
      "채식 쌀국수",
      "베트남 커피"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 66,
    "name": "Phox – Feine Phở Küche",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2202897,
    "lng": 6.7858155,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "깔끔한 육수의 쌀국수 전문점. Stresemannstr. 32.",
    "priceLevel": 2,
    "menu": [
      "소고기 쌀국수",
      "반콧"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 67,
    "name": "BAMI House",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2157691,
    "lng": 6.7771962,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "베트남식 반미 샌드위치 전문. Herzogstr. 10b.",
    "priceLevel": 1,
    "menu": [
      "반미 샌드위치(비건/치킨)"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 68,
    "name": "Bếp Việt",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2284303,
    "lng": 6.7911423,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "가정식 베트남 쌀국수집. Am Wehrhahn 40.",
    "priceLevel": 1,
    "menu": [
      "쌀국수(포보)",
      "크리스피 덕"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 69,
    "name": "Lay Thai Restaurant & Lounge",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.2399686,
    "lng": 6.7997705,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "커리와 태국식 아이스티가 인기인 라운지형 태국식당. Weseler Str. 35.",
    "priceLevel": 2,
    "menu": [
      "레드 커리",
      "태국식 아이스티"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 70,
    "name": "Ayutthaya Thai Imbiss",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.2254539,
    "lng": 6.8108341,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "소박하지만 정통성 있는 작은 태국 분식점. Behrenstr. 44.",
    "priceLevel": 1,
    "menu": [
      "팟타이",
      "커리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 71,
    "name": "Khao Hom",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.1612424,
    "lng": 6.8851005,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "친환경 포장 용기를 쓰는 태국 테이크아웃 전문점.",
    "priceLevel": 2,
    "menu": [
      "커리",
      "볶음 요리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 72,
    "name": "Lily's Asian Cuisine",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2109588,
    "lng": 6.7687863,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "베트남 가족 운영 반미·쌀국수 맛집. Bilker Allee 64.",
    "priceLevel": 1,
    "menu": [
      "반미",
      "쌀국수"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 73,
    "name": "Baan Thai",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.2239707,
    "lng": 6.7728806,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "태국 상무부 인증을 받은 정통 태국 레스토랑. Carlsplatz 인근.",
    "priceLevel": 2,
    "menu": [
      "팟타이",
      "그린 커리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 74,
    "name": "WELA",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.219903,
    "lng": 6.7845695,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "태국 파인다이닝, 8코스 테이스팅 메뉴. Oststr. 158.",
    "priceLevel": 3,
    "menu": [
      "8코스 테이스팅 메뉴",
      "똠얌꿍"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 75,
    "name": "Pho Chop Restaurant",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2260276,
    "lng": 6.77272,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "쌀국수와 스시를 함께 파는 알트슈타트의 아시안 레스토랑.",
    "priceLevel": 1,
    "menu": [
      "크런치롤",
      "쌀국수"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 76,
    "name": "Eastery Restaurant",
    "category": "베트남",
    "type": "restaurant",
    "lat": 51.2171646,
    "lng": 6.779019,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "망고 퓨전 요리가 특징인 베트남 퓨전 레스토랑. Talstr. 2A.",
    "priceLevel": 2,
    "menu": [
      "망고 퓨전 요리",
      "생강 스파이시 드링크"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 77,
    "name": "Tains 아시아마트",
    "category": "마트",
    "type": "market",
    "lat": 51.2226283,
    "lng": 6.7907966,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "한중일 식료품과 즉석 초밥·교자를 파는 대형 아시아 마트. Immermannstr. 50-52.",
    "priceLevel": null,
    "menu": [
      "즉석 초밥/교자",
      "말차 디저트"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 78,
    "name": "Dawayo 다와요 마트",
    "category": "마트",
    "type": "market",
    "lat": 51.2142994,
    "lng": 6.8220588,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "온라인 배송도 하는 한인 마트. 즉석 라면기도 있음.",
    "priceLevel": null,
    "menu": [
      "한국 식료품",
      "즉석 라면"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 79,
    "name": "Dae-Yang 아시아 식료품",
    "category": "마트",
    "type": "market",
    "lat": 51.22401,
    "lng": 6.7867,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "일본식 베이커리와 식료품을 함께 파는 마트. Immermannstr. 21.",
    "priceLevel": null,
    "menu": [
      "멜론빵",
      "에비후라이"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 80,
    "name": "Go Asia Supermarkt",
    "category": "마트",
    "type": "market",
    "lat": 51.2272152,
    "lng": 6.7871016,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "쇼도우 거리 근처의 대형 아시아 슈퍼마켓.",
    "priceLevel": null,
    "menu": [
      "냉동식품",
      "아시아 소스류"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 81,
    "name": "Food Jung",
    "category": "마트",
    "type": "restaurant",
    "lat": 51.2235598,
    "lng": 6.7873056,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "김밥·족발 등 즉석 한식을 파는 소규모 마트. Oststr. 76.",
    "priceLevel": 1,
    "menu": [
      "김치김밥",
      "불고기김밥",
      "족발"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 82,
    "name": "BulGogi BBQ",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.221936,
    "lng": 6.7862642,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "정통 코리안 BBQ, 무제한 반찬바. Bismarckstr. 51.",
    "priceLevel": 2,
    "menu": [
      "와규 세트",
      "무제한 반찬"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 83,
    "name": "Kochi Restaurant 연변꼬치",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2276566,
    "lng": 6.8051978,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "연변식 회전 꼬치구이. 한중 국경 지역 스타일. Wetterstr. 2.",
    "priceLevel": 2,
    "menu": [
      "양꼬치",
      "회전 꼬치구이"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 84,
    "name": "New Asia BBQ",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2627457,
    "lng": 6.7622298,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "해물파전이 인기인 코리안 BBQ. Am Hain 44.",
    "priceLevel": 2,
    "menu": [
      "해물파전",
      "코리안 BBQ"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 85,
    "name": "Gogi",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.2224047,
    "lng": 6.7849254,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "육회비빔밥과 삼겹살로 유명한 코리안 BBQ. Bismarckstr. 33.",
    "priceLevel": 2,
    "menu": [
      "육회비빔밥",
      "삼겹살"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 86,
    "name": "Hot Iron Yakiniku",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.2182906,
    "lng": 6.78361,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "무제한 야키니쿠 뷔페, 배기 후드 설치. Karl-Rudolf-Str. 174.",
    "priceLevel": 2,
    "menu": [
      "무제한 야키니쿠",
      "초밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 87,
    "name": "Sphere Bay Manga Café",
    "category": "카페",
    "type": "cafe",
    "lat": 51.223544,
    "lng": 6.787673,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "만화 카페 겸 버블티 전문점. Immermannstr. 29.",
    "priceLevel": 2,
    "menu": [
      "버블티(커스텀)",
      "타피오카"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 88,
    "name": "Café Pi To Go",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2260963,
    "lng": 6.7878136,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "마카롱과 버블티 카페. Liesegangstr. 10.",
    "priceLevel": 1,
    "menu": [
      "버블티",
      "마카롱"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 89,
    "name": "Two Friends Coffee & Bubble Tea",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2112547,
    "lng": 6.7965973,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "말차와 스무디가 인기인 커피·버블티 카페.",
    "priceLevel": 1,
    "menu": [
      "말차 라떼",
      "스무디"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 90,
    "name": "The Alley Düsseldorf",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2211831,
    "lng": 6.7900271,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "타로 코코넛 밀크티로 유명. Friedrich-Ebert-Str. 45.",
    "priceLevel": 1,
    "menu": [
      "타로 코코넛 밀크티",
      "흑당 버블티"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 91,
    "name": "Mr. Box Tea",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2279986,
    "lng": 6.7891725,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "베어하안 지하의 아기자기한 버블티 가게.",
    "priceLevel": 1,
    "menu": [
      "버블티",
      "마카롱"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 92,
    "name": "CoCo Bubble Tea",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2253261,
    "lng": 6.7755242,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "비건 옵션 커스터마이징이 가능한 버블티 전문점.",
    "priceLevel": 1,
    "menu": [
      "버블티(비건 가능)"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 93,
    "name": "Teamate",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2216388,
    "lng": 6.7917851,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "중앙역 근처 버블티·티라미수 카페. Immermannstr. 65C.",
    "priceLevel": 1,
    "menu": [
      "말차 라떼",
      "타로 밀크티",
      "티라미수"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 94,
    "name": "Fentcha",
    "category": "카페",
    "type": "cafe",
    "lat": 51.2261666,
    "lng": 6.7769162,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "하인리히하이네알레 지하역의 조용한 티하우스.",
    "priceLevel": 1,
    "menu": [
      "패션프루트 그린티",
      "타로 밀크티"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 95,
    "name": "Pozangmacha (포장마차)",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.220138,
    "lng": 6.793122,
    "hasVegan": false,
    "hasSpicy": true,
    "note": "한국식 실내 포장마차 감성을 그대로 옮겨온 곳. 안주류와 치킨이 인기예요.",
    "priceLevel": 2,
    "menu": [
      "닭강정",
      "부대찌개",
      "골뱅이무침"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 96,
    "name": "Koreana (코리아나)",
    "category": "한식",
    "type": "restaurant",
    "lat": 51.222345,
    "lng": 6.789123,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "깔끔하고 정갈한 한식 찬방 스타일. 비빔밥과 찌개류가 정성스럽게 나옵니다.",
    "priceLevel": 2,
    "menu": [
      "순두부찌개",
      "제육돌솥비빔밥"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 97,
    "name": "Takumi Chicken & Veggie (Lorettostraße)",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.21689,
    "lng": 6.769543,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "빌크(Bilk) 지구 근처에 위치한 타쿠미의 치킨/채식 특화 지점.",
    "priceLevel": 2,
    "menu": [
      "토마토 라멘",
      "비건 탄탄멘",
      "치킨 가라아게"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 98,
    "name": "Soba-An (소바안)",
    "category": "일식",
    "type": "restaurant",
    "lat": 51.224123,
    "lng": 6.785432,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "직접 메밀을 갈아 만드는 정통 수제 소바 전문점. 대기 줄이 긴 편입니다.",
    "priceLevel": 3,
    "menu": [
      "텐자루 소바",
      "온소바"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 99,
    "name": "Luang Prabang",
    "category": "태국",
    "type": "restaurant",
    "lat": 51.235432,
    "lng": 6.812345,
    "hasVegan": true,
    "hasSpicy": true,
    "note": "플링거른에 위치한 라오스·태국 요리 전문점. 이국적인 인테리어와 향신료가 매력적이에요.",
    "priceLevel": 2,
    "menu": [
      "랍 (Larb)",
      "태국식 커리"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 100,
    "name": "Holocafé Düsseldorf",
    "category": "오락",
    "type": "culture",
    "lat": 51.2247402,
    "lng": 6.7850765,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "VR 게임·방탈출·보드게임을 즐길 수 있는 체험형 카페. Immermannstr. 7.",
    "priceLevel": 2,
    "menu": [
      "VR 방탈출",
      "보드게임"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 101,
    "name": "Meeple und Macchiato",
    "category": "오락",
    "type": "culture",
    "lat": 51.2066243,
    "lng": 6.7787055,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "빌크 지역의 아늑한 보드게임 카페. 입장료 있고 게임 추천도 해줘요.",
    "priceLevel": 1,
    "menu": [
      "보드게임 무제한",
      "티/디저트"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 102,
    "name": "Takagi Books & More",
    "category": "서점",
    "type": "culture",
    "lat": 51.22347,
    "lng": 6.7878099999999995,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "임머만 거리의 대표 일본 서점. 만화·소설·문구류 다양. Immermannstr. 31.",
    "priceLevel": null,
    "menu": [
      "만화(망가)",
      "문구",
      "소설"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 103,
    "name": "Bookstore Nippon",
    "category": "서점",
    "type": "culture",
    "lat": 51.2222301,
    "lng": 6.7902100999999995,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "일본어 원서 전문 서점. 지브리 관련 상품도 있음. Immermannstr. 53.",
    "priceLevel": null,
    "menu": [
      "일본어 원서",
      "지브리 굿즈",
      "문구"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 104,
    "name": "Little Tokyo Manga GmbH",
    "category": "서점",
    "type": "culture",
    "lat": 51.2223821,
    "lng": 6.789892600000001,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "만화·피규어 전문점. 희귀 굿즈도 자주 들어옴. Immermannstr. 51.",
    "priceLevel": null,
    "menu": [
      "만화",
      "피규어",
      "굿즈"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 105,
    "name": "Manga-Mafia Store",
    "category": "서점",
    "type": "culture",
    "lat": 51.2219772,
    "lng": 6.7908468,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "만화·만화 전문 서점, 기념품도 판매. Immermannstr. 59.",
    "priceLevel": null,
    "menu": [
      "만화",
      "만화 굿즈"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 106,
    "name": "Aiko's Mochi³",
    "category": "디저트",
    "type": "cafe",
    "lat": 51.2235852,
    "lng": 6.7890391999999995,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "찹쌀떡(다이후쿠)과 말차 음료 전문점. 애니메이션풍 인테리어. Immermannstr. 30.",
    "priceLevel": 1,
    "menu": [
      "다이후쿠(찹쌀떡)",
      "말차라떼",
      "당고"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 107,
    "name": "Miao's Café",
    "category": "디저트",
    "type": "cafe",
    "lat": 51.220767099999996,
    "lng": 6.787459,
    "hasVegan": true,
    "hasSpicy": false,
    "note": "유럽에서 보기 드문 대만식 망고빙수 전문점. Charlottenstr. 44.",
    "priceLevel": 1,
    "menu": [
      "망고빙수",
      "망고커피"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 108,
    "name": "Buni Café 不甜",
    "category": "디저트",
    "type": "cafe",
    "lat": 51.2225289,
    "lng": 6.7860983,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "타로볼, 망고포멜로사고 등 대만식 디저트 전문점. Oststr. 107.",
    "priceLevel": 2,
    "menu": [
      "망고포멜로사고",
      "타로볼",
      "수플레팬케이크"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 109,
    "name": "Moka Café Soufflé",
    "category": "디저트",
    "type": "cafe",
    "lat": 51.2233282,
    "lng": 6.7866491,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "폭신한 수플레팬케이크 전문 카페. Oststr. 89.",
    "priceLevel": 2,
    "menu": [
      "수플레팬케이크",
      "말차라떼"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 110,
    "name": "Little Tokyo 거리 (임머만 거리)",
    "category": "명소",
    "type": "culture",
    "lat": 51.2237392,
    "lng": 6.7880343,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "뒤셀도르프 '리틀 도쿄'의 심장부. 일본풍 간판과 상점들이 늘어선 대표 산책·포토 코스.",
    "priceLevel": null,
    "menu": [
      "거리 전체 산책",
      "간판 포토스팟"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 111,
    "name": "Rune Store (Japanmeile)",
    "category": "굿즈",
    "type": "culture",
    "lat": 51.22115720000001,
    "lng": 6.7889721000000005,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "대형 만화·피규어·K-pop 굿즈 매장. 개인 판매 위탁도 가능. Bismarckstr. 88.",
    "priceLevel": null,
    "menu": [
      "피규어",
      "K-pop 포토카드",
      "만화"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 112,
    "name": "Cardinvestor Düsseldorf",
    "category": "굿즈",
    "type": "culture",
    "lat": 51.228305999999996,
    "lng": 6.7876015999999995,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "포켓몬·원피스·지브리 등 트레이딩 카드·피규어 전문점. Jacobistr. 20.",
    "priceLevel": null,
    "menu": [
      "트레이딩카드",
      "피규어"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 113,
    "name": "Studio Ghibli Pop-Up Store",
    "category": "굿즈",
    "type": "culture",
    "lat": 51.224241199999994,
    "lng": 6.7723704,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "지브리 스튜디오 공식 굿즈 팝업스토어. Berger Str. 25.",
    "priceLevel": null,
    "menu": [
      "지브리 굿즈",
      "피규어"
    ],
    "hasPhotoSpot": true
  },
  {
    "id": 114,
    "name": "Toys und Helden",
    "category": "굿즈",
    "type": "culture",
    "lat": 51.225322899999995,
    "lng": 6.7754169,
    "hasVegan": false,
    "hasSpicy": false,
    "note": "레트로 장난감·만화·게임 수집품 전문점. 애니/SF 팬 성지. Flinger Str. 45.",
    "priceLevel": null,
    "menu": [
      "빈티지 피규어",
      "만화",
      "레트로 게임"
    ],
    "hasPhotoSpot": false
  },
  {
    "id": 115,
    "name": "EKŌ-Haus der Japanischen Kultur",
    "category": "명소",
    "type": "culture",
    "lat": 51.239655,
    "lng": 6.7455529,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": true,
    "note": "일본 사찰·정원·다도 체험이 가능한 문화센터. 사전 예약 필요, 조용히 관람해야 해요. Brüggener Weg 6.",
    "priceLevel": null,
    "menu": [
      "사찰·정원",
      "다도 체험"
    ]
  },
  {
    "id": 116,
    "name": "일본식 정원 (노드파크)",
    "category": "명소",
    "type": "culture",
    "lat": 51.2565628,
    "lng": 6.744292499999999,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": true,
    "note": "노드파크 안에 있는 일본식 정원. 벚꽃 시즌(3~4월)이 특히 아름다워요.",
    "priceLevel": null,
    "menu": [
      "일본식 정원",
      "산책"
    ]
  },
  {
    "id": 117,
    "name": "Karaoke NOZOMI",
    "category": "오락",
    "type": "culture",
    "lat": 51.2225726,
    "lng": 6.7845397,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": false,
    "note": "일본인이 운영하는 정통 가라오케 바. 일본어 안내가 많아 색다른 경험. Bismarckstr. 29.",
    "priceLevel": null,
    "menu": [
      "가라오케 룸",
      "일본 노래방"
    ]
  },
  {
    "id": 118,
    "name": "Muse Karaoke",
    "category": "오락",
    "type": "culture",
    "lat": 51.2238834,
    "lng": 6.7923211,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": false,
    "note": "임머만 거리 인근 가라오케. 방음 잘 되고 곡 목록 다양. Klosterstr. 81.",
    "priceLevel": 2,
    "menu": [
      "가라오케 룸"
    ]
  },
  {
    "id": 119,
    "name": "Gilson Karaoke",
    "category": "오락",
    "type": "culture",
    "lat": 51.2221894,
    "lng": 6.7875489,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": false,
    "note": "최신곡부터 클래식까지 곡이 다양한 가라오케. Friedrich-Ebert-Str. 13.",
    "priceLevel": null,
    "menu": [
      "가라오케 룸"
    ]
  },
  {
    "id": 120,
    "name": "Lime Light Karaoke Box",
    "category": "오락",
    "type": "culture",
    "lat": 51.2229081,
    "lng": 6.7886995,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": true,
    "note": "80년대 일본풍 레트로 인테리어의 독특한 가라오케 박스. Immermannstr. 41.",
    "priceLevel": null,
    "menu": [
      "레트로 가라오케"
    ]
  },
  {
    "id": 121,
    "name": "Kirschblüte (벚꽃 명소)",
    "category": "명소",
    "type": "culture",
    "lat": 51.2147843,
    "lng": 6.8032257,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": true,
    "note": "오버빌크 성 요셉 성당 앞 벚꽃길. 3월 말~4월 초가 절정이에요.",
    "priceLevel": null,
    "menu": [
      "벚꽃 포토스팟"
    ]
  },
  {
    "id": 122,
    "name": "Sakura Bar",
    "category": "오락",
    "type": "culture",
    "lat": 51.222620299999996,
    "lng": 6.7908121999999995,
    "hasVegan": false,
    "hasSpicy": false,
    "hasPhotoSpot": false,
    "note": "판단·망고 등 아시아 재료를 쓰는 시그니처 칵테일 바. Immermannstr. 50.",
    "priceLevel": 3,
    "menu": [
      "판단 스매시",
      "망고 언체인드"
    ]
  }
];

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
  if (count === 0) return "시작 전";
  if (count < total * 0.1) return "초보";
  if (count < total * 0.3) return "단골";
  if (count < total * 0.6) return "고수";
  return "마스터";
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
  const label = isRealGpsLocation ? "내 위치" : "중앙역";
  return km < 1 ? `📍 ${label}에서 약 ${Math.round(km * 1000)}m` : `📍 ${label}에서 약 ${km.toFixed(1)}km`;
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
  if (category === "마트") return "🛒 마트";
  if (category === "카페") return "☕ 카페";
  if (category === "오락") return "🎮 오락";
  if (category === "서점") return "📚 서점";
  if (category === "디저트") return "🍡 디저트";
  if (category === "명소") return "🏯 명소";
  if (category === "굿즈") return "🎁 굿즈";
  const flag = getFlagSvg(category);
  return flag ? `${flag}${category}` : category;
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
    alert("경로 안내 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
    return;
  }
  if (!userLocation) {
    alert("먼저 '📍 내 위치' 버튼을 눌러주세요!");
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
    ? "📍 출발점: 내 위치"
    : "📍 출발점: 뒤셀도르프 중앙역";
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
    alert("지금 필터 조건에 맞는 식당이 없어서 추천 코스를 못 만들었어요. 필터를 좀 풀어보시겠어요?");
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
    alert(`아직 취향을 분석하기엔 데이터가 부족해요 (${liked.length}/3곳).\n마음에 드는 곳을 즐겨찾기하거나 가본 곳으로 체크해보세요!`);
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
    alert("취향에 맞는 새로운 곳을 아직 못 찾았어요. 조금 더 다양한 곳을 둘러봐 주세요!");
    return;
  }

  const topScore = Math.max(...scored.map((c) => c.score));
  const bestMatches = scored.filter((c) => c.score === topScore);
  const pick = bestMatches[Math.floor(Math.random() * bestMatches.length)].place;

  // 4. "왜 추천했는지" 이유 문장 만들기
  const reasons = [];
  if (prefersSpicy && pick.hasSpicy) reasons.push("매운 음식");
  if (prefersVegan && pick.hasVegan) reasons.push("비건 메뉴");
  if (topCategories.includes(pick.category)) reasons.push(pick.category);
  const reasonText = reasons.length > 0 ? `평소 ${reasons.join("·")}을(를) 좋아하시길래` : "취향을 분석해보니";

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
        조건에 맞는 곳이 없어요.<br>검색어나 필터를 조정해보세요.
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
    ? "📍 내 위치 기준으로 거리 표시 중 (다시 찾기)"
    : "📍 중앙역 기준으로 거리 표시 중 (다시 찾기)";
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
    btn.textContent = "브라우저가 위치 기능을 지원하지 않아요";
    return;
  }
  btn.textContent = "위치 찾는 중...";

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

async function startApp() {
  const ok = await loadAllLibraries();
  if (!ok) {
    document.getElementById("map").innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:2rem;color:#888;">지도를 불러오지 못했습니다.<br>인터넷 연결을 확인하시거나, 다른 네트워크(예: 휴대폰 핫스팟)에서 다시 열어보세요.</div>';
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
    btn.innerHTML = cat === "전체" ? "전체" : getCategoryLabel(cat);
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
    btn.textContent = opt.label;
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
  