// ===== 다국어(i18n) 데이터 =====
// 한국어(ko)가 기본값. 영어(en)/독일어(de)는 사용자가 언어 버튼을 눌렀을 때 적용됨.
// (터키어/아랍어는 추후 추가 예정 - 아랍어는 텍스트 방향이 반대(RTL)라 레이아웃 작업이 추가로 필요함)

// 참고: 장소별 번역(note/menu)은 이제 이 파일이 아니라 Supabase의
// place_translations 테이블에서 fetchPlaces()가 가져와요 (script.js 참고).
// UI 문구/카테고리명처럼 "고정된 인터페이스 텍스트"만 이 파일에 남겨뒀어요.

const CATEGORY_TRANSLATIONS = {
  "한식": {
    "en": "Korean",
    "de": "Koreanisch"
  },
  "일식": {
    "en": "Japanese",
    "de": "Japanisch"
  },
  "중식": {
    "en": "Chinese",
    "de": "Chinesisch"
  },
  "베트남": {
    "en": "Vietnamese",
    "de": "Vietnamesisch"
  },
  "태국": {
    "en": "Thai",
    "de": "Thailändisch"
  },
  "마트": {
    "en": "Mart",
    "de": "Markt"
  },
  "카페": {
    "en": "Cafe",
    "de": "Café"
  },
  "오락": {
    "en": "Entertainment",
    "de": "Unterhaltung"
  },
  "서점": {
    "en": "Bookstore",
    "de": "Buchladen"
  },
  "디저트": {
    "en": "Dessert",
    "de": "Dessert"
  },
  "명소": {
    "en": "Landmark",
    "de": "Sehenswürdigkeit"
  },
  "굿즈": {
    "en": "Goods",
    "de": "Merch"
  },
  "전체": {
    "en": "All",
    "de": "Alle"
  }
};

const UI_TRANSLATIONS = {
  "ko": {
    "headerTitle": "뒤셀도르프 아시안 컬처 맵",
    "headerSubtitle": "맛집·마트부터 만화카페·서점·명소까지",
    "searchPlaceholder": "장소 이름으로 검색...",
    "filterMoreCollapsed": "⚙️ 필터 더보기 ▾",
    "filterMoreExpanded": "⚙️ 필터 접기 ▴",
    "priceAll": "전체 가격",
    "veganLabel": "🌱 비건 있음",
    "spicyLabel": "🌶️ 매운 음식 있음",
    "photospotLabel": "📸 인생샷 스팟만 보기",
    "favonlyLabel": "⭐ 즐겨찾기 해둔 곳만 보기",
    "locateDefault": "📍 내 위치",
    "locateSearching": "위치 찾는 중...",
    "locateActiveReal": "📍 내 위치 기준으로 거리 표시 중 (다시 찾기)",
    "locateActiveFallback": "📍 중앙역 기준으로 거리 표시 중 (다시 찾기)",
    "locateUnsupported": "브라우저가 위치 기능을 지원하지 않아요",
    "clearRouteBtn": "🚗 경로 지우기",
    "courseEmpty": "아직 담은 곳이 없어요. 장소를 담거나 추천 코스를 받아보세요.",
    "courseClearBtn": "🗑 비우기",
    "courseRecommendBtn": "🎲 추천 코스 짜줘",
    "courseStartReal": "📍 출발점: 내 위치",
    "courseStartFallback": "📍 출발점: 뒤셀도르프 중앙역",
    "rouletteBtn": "🎲 오늘 뭐 하지?",
    "rouletteModalSubtitle": "오늘의 추천",
    "modalConfirm": "확인",
    "tasteRecommendBtn": "🎯 내 취향 맞춤 추천 보기",
    "levelNotStarted": "시작 전",
    "levelBeginner": "초보",
    "levelRegular": "단골",
    "levelExpert": "고수",
    "levelMaster": "마스터",
    "reasonSpicy": "매운 음식",
    "reasonVegan": "비건 메뉴",
    "reasonPrefix": "평소 {reasons}을(를) 좋아하시길래",
    "reasonDefault": "취향을 분석해보니",
    "alertRoutingLibFailed": "경로 안내 라이브러리를 불러오지 못했어요. 인터넷 연결을 확인해주세요.",
    "alertNeedLocation": "먼저 '📍 내 위치' 버튼을 눌러주세요!",
    "alertNoRestaurantForCourse": "지금 필터 조건에 맞는 식당이 없어서 추천 코스를 못 만들었어요. 필터를 좀 풀어보시겠어요?",
    "alertTasteNotEnough": "아직 취향을 분석하기엔 데이터가 부족해요 ({count}/3곳).\n마음에 드는 곳을 즐겨찾기하거나 가본 곳으로 체크해보세요!",
    "alertTasteNoMatch": "취향에 맞는 새로운 곳을 아직 못 찾았어요. 조금 더 다양한 곳을 둘러봐 주세요!",
    "noResults": "조건에 맞는 곳이 없어요.<br>검색어나 필터를 조정해보세요.",
    "mapLoading": "지도를 불러오는 중...",
    "mapLoadFailed": "지도를 불러오지 못했습니다.<br>인터넷 연결을 확인하시거나, 다른 네트워크(예: 휴대폰 핫스팟)에서 다시 열어보세요.",
    "dataLoadFailed": "장소 데이터를 불러오지 못했습니다.<br>잠시 후 새로고침 해보세요."
  },
  "en": {
    "headerTitle": "Düsseldorf Asian Culture Map",
    "headerSubtitle": "From restaurants and marts to manga cafes, bookstores, and landmarks",
    "searchPlaceholder": "Search by place name...",
    "filterMoreCollapsed": "⚙️ More filters ▾",
    "filterMoreExpanded": "⚙️ Hide filters ▴",
    "priceAll": "All prices",
    "veganLabel": "🌱 Vegan available",
    "spicyLabel": "🌶️ Spicy available",
    "photospotLabel": "📸 Photo spots only",
    "favonlyLabel": "⭐ Favorites only",
    "locateDefault": "📍 My location",
    "locateSearching": "Finding location...",
    "locateActiveReal": "📍 Showing distances from my location (tap to refresh)",
    "locateActiveFallback": "📍 Showing distances from Hbf (tap to retry)",
    "locateUnsupported": "This browser doesn't support location",
    "clearRouteBtn": "🚗 Clear route",
    "courseEmpty": "You haven't added any places yet. Add one, or get a recommended course.",
    "courseClearBtn": "🗑 Clear",
    "courseRecommendBtn": "🎲 Get a recommended course",
    "courseStartReal": "📍 Start: my location",
    "courseStartFallback": "📍 Start: Düsseldorf Hbf",
    "rouletteBtn": "🎲 What now?",
    "rouletteModalSubtitle": "Today's pick",
    "modalConfirm": "OK",
    "tasteRecommendBtn": "🎯 See my taste-based pick",
    "levelNotStarted": "Not started",
    "levelBeginner": "Beginner",
    "levelRegular": "Regular",
    "levelExpert": "Expert",
    "levelMaster": "Master",
    "reasonSpicy": "spicy food",
    "reasonVegan": "vegan options",
    "reasonPrefix": "Since you usually like {reasons}",
    "reasonDefault": "Based on your taste",
    "alertRoutingLibFailed": "Couldn't load the routing library. Please check your internet connection.",
    "alertNeedLocation": "Please tap the '📍 My location' button first!",
    "alertNoRestaurantForCourse": "No restaurants match your current filters, so a course couldn't be created. Try loosening the filters?",
    "alertTasteNotEnough": "Not enough data to analyze your taste yet ({count}/3 places).\nTry favoriting or marking some places as visited!",
    "alertTasteNoMatch": "Couldn't find a new place matching your taste. Try exploring a bit more variety!",
    "noResults": "No places match your filters.<br>Try adjusting your search or filters.",
    "mapLoading": "Loading map...",
    "mapLoadFailed": "Couldn't load the map.<br>Check your internet connection, or try a different network (e.g. mobile hotspot).",
    "dataLoadFailed": "Couldn't load place data.<br>Please refresh in a moment."
  },
  "de": {
    "headerTitle": "Düsseldorf Asian Culture Map",
    "headerSubtitle": "Von Restaurants und Märkten bis zu Manga-Cafés, Buchläden und Sehenswürdigkeiten",
    "searchPlaceholder": "Nach Namen suchen...",
    "filterMoreCollapsed": "⚙️ Mehr Filter ▾",
    "filterMoreExpanded": "⚙️ Filter ausblenden ▴",
    "priceAll": "Alle Preise",
    "veganLabel": "🌱 Vegan verfügbar",
    "spicyLabel": "🌶️ Scharf verfügbar",
    "photospotLabel": "📸 Nur Fotospots",
    "favonlyLabel": "⭐ Nur Favoriten",
    "locateDefault": "📍 Mein Standort",
    "locateSearching": "Standort wird gesucht...",
    "locateActiveReal": "📍 Entfernungen von meinem Standort (erneut suchen)",
    "locateActiveFallback": "📍 Entfernungen vom Hbf (erneut versuchen)",
    "locateUnsupported": "Dieser Browser unterstützt keine Standortfunktion",
    "clearRouteBtn": "🚗 Route löschen",
    "courseEmpty": "Noch keine Orte hinzugefügt. Füge einen hinzu oder lass dir eine Route vorschlagen.",
    "courseClearBtn": "🗑 Leeren",
    "courseRecommendBtn": "🎲 Route vorschlagen lassen",
    "courseStartReal": "📍 Start: mein Standort",
    "courseStartFallback": "📍 Start: Düsseldorf Hbf",
    "rouletteBtn": "🎲 Was jetzt?",
    "rouletteModalSubtitle": "Heutiger Tipp",
    "modalConfirm": "OK",
    "tasteRecommendBtn": "🎯 Meine Empfehlung ansehen",
    "levelNotStarted": "Noch nicht gestartet",
    "levelBeginner": "Anfänger",
    "levelRegular": "Stammgast",
    "levelExpert": "Profi",
    "levelMaster": "Meister",
    "reasonSpicy": "scharfes Essen",
    "reasonVegan": "vegane Optionen",
    "reasonPrefix": "Da du meist {reasons} magst",
    "reasonDefault": "Basierend auf deinem Geschmack",
    "alertRoutingLibFailed": "Die Routing-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.",
    "alertNeedLocation": "Bitte zuerst auf '📍 Mein Standort' tippen!",
    "alertNoRestaurantForCourse": "Keine Restaurants entsprechen den aktuellen Filtern, daher konnte keine Route erstellt werden. Filter lockern?",
    "alertTasteNotEnough": "Noch nicht genug Daten für eine Geschmacksanalyse ({count}/3 Orte).\nFüge Favoriten hinzu oder markiere besuchte Orte!",
    "alertTasteNoMatch": "Kein neuer Ort passend zu deinem Geschmack gefunden. Erkunde etwas mehr Vielfalt!",
    "noResults": "Keine Orte gefunden.<br>Passe deine Suche oder Filter an.",
    "mapLoading": "Karte wird geladen...",
    "mapLoadFailed": "Karte konnte nicht geladen werden.<br>Bitte Internetverbindung prüfen oder ein anderes Netzwerk (z. B. Mobilfunk-Hotspot) versuchen.",
    "dataLoadFailed": "Ortsdaten konnten nicht geladen werden.<br>Bitte in Kürze erneut versuchen."
  }
};

let currentLang = "ko"; // 기본 언어

// UI 문구 하나 가져오기: t("searchPlaceholder") 처럼 사용
function t(key) {
  return (UI_TRANSLATIONS[currentLang] && UI_TRANSLATIONS[currentLang][key]) || UI_TRANSLATIONS.ko[key] || key;
}

// 카테고리 이름 번역 (예: "한식" -> "Korean"). 내부 로직(필터링/색상)은 항상 원래 한국어 값을 씀,
// 이 함수는 "보여주는 이름"만 바꿔주는 용도.
function translateCategoryName(category) {
  if (currentLang === "ko") return category;
  const entry = CATEGORY_TRANSLATIONS[category];
  return entry ? entry[currentLang] || category : category;
}

// basePlaces(항상 한국어 원본)에 현재 언어의 note/menu를 덮어씌워서 places를 다시 만듦.
// category/type/좌표/불리언 값 등은 절대 안 바꿈 (필터링/마커색상 로직이 한국어 값 기준으로 동작하기 때문)
function applyPlaceTranslations(lang) {
  if (lang === "ko") {
    places = basePlaces.map((p) => ({ ...p }));
    return;
  }
  places = basePlaces.map((p) => {
    const tr = p._translations && p._translations[lang];
    if (!tr) return { ...p };
    // tr.name이 존재하면 번역된 이름으로 덮어쓰고, 없으면 원본 한국어 이름을 유지합니다.
    return { ...p, name: tr.name || p.name, note: tr.note, menu: tr.menu };
  });
}
