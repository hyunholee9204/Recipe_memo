/* =========================================================
   레시피 노트 — v1
   순수 JS + localStorage. 프레임워크/서버 없음.
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "recipe-note:v1";
  const SCHEMA_VERSION = 1;

  /* ---------- 상태 ---------- */
  const state = {
    recipes: [],
    filter: "전체", // 전체 | 즐겨찾기 | (카테고리명)
    query: "",
  };

  /* ---------- DOM ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const els = {
    grid: $("#recipeGrid"),
    empty: $("#emptyState"),
    listMeta: $("#listMeta"),
    filterBar: $("#filterBar"),
    search: $("#searchInput"),
    newBtn: $("#newRecipeBtn"),
    overlay: $("#overlay"),
    sheetBody: $("#sheetBody"),
    sheetClose: $("#sheetClose"),
    menuBtn: $("#menuBtn"),
    menuDropdown: $("#menuDropdown"),
    exportBtn: $("#exportBtn"),
    importBtn: $("#importBtn"),
    importInput: $("#importInput"),
    detailTpl: $("#detailTemplate"),
    formTpl: $("#formTemplate"),
  };

  /* ---------- 저장소 ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed.recipes;
      return Array.isArray(list) ? list.map(normalizeRecipe) : [];
    } catch (err) {
      console.error("저장된 데이터를 읽지 못했습니다.", err);
      return [];
    }
  }

  function save() {
    const payload = { schema: SCHEMA_VERSION, recipes: state.recipes };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error(err);
      alert(
        "저장 공간이 부족합니다. 사진 용량이 큰 레시피를 줄이거나 일부를 삭제한 뒤 다시 시도하세요."
      );
    }
  }

  function normalizeRecipe(r = {}) {
    return {
      id: r.id || uid(),
      title: (r.title || "제목 없음").toString(),
      category: r.category || "기타",
      time: Number.isFinite(+r.time) && +r.time > 0 ? Math.round(+r.time) : null,
      difficulty: r.difficulty || "쉬움",
      tags: Array.isArray(r.tags) ? r.tags.filter(Boolean) : [],
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean) : [],
      steps: Array.isArray(r.steps) ? r.steps.filter(Boolean) : [],
      memo: (r.memo || "").toString(),
      rating: clampRating(r.rating),
      image: typeof r.image === "string" ? r.image : null,
      favorite: !!r.favorite,
      createdAt: r.createdAt || Date.now(),
      updatedAt: r.updatedAt || r.createdAt || Date.now(),
    };
  }

  function uid() {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }

  /* 0 ~ 5 사이 0.5 단위로 보정 */
  function clampRating(v) {
    const n = Math.round((+v || 0) * 2) / 2;
    return Math.min(5, Math.max(0, n));
  }

  /* 별점 rating을 별 5개 HTML 문자열로 */
  function starMarkup(rating) {
    const r = clampRating(rating);
    let html = "";
    for (let i = 1; i <= 5; i++) {
      let cls = "star";
      if (r >= i) cls += " star--full";
      else if (r >= i - 0.5) cls += " star--half";
      html += `<span class="${cls}" data-star="${i}"></span>`;
    }
    return html;
  }

  /*
   * 편집용 별점 위젯.
   * 같은 별을 누를 때마다: 빈칸 → 반칸 → 꽉참 → (그 별 비우기) 순으로 순환.
   */
  function attachRatingInput(wrap, initial, onChange) {
    const starsEl = wrap.querySelector("[data-rating-stars]");
    const labelEl = wrap.querySelector("[data-rating-label]");
    const clearEl = wrap.querySelector("[data-rating-clear]");
    let rating = clampRating(initial);

    paint();

    starsEl.addEventListener("click", (e) => {
      const star = e.target.closest("[data-star]");
      if (!star) return;
      const i = +star.dataset.star;
      if (rating === i) rating = i - 1; // 꽉 찬 별을 다시 누르면 그 별을 비움
      else if (rating === i - 0.5) rating = i; // 반칸 → 꽉참
      else rating = i - 0.5; // 그 외 → 반칸부터
      rating = clampRating(rating);
      paint();
      onChange(rating);
    });

    clearEl.addEventListener("click", () => {
      rating = 0;
      paint();
      onChange(rating);
    });

    function paint() {
      starsEl.innerHTML = starMarkup(rating);
      labelEl.textContent = rating ? `${rating.toFixed(1)} / 5` : "평가 없음";
      clearEl.hidden = !rating;
    }
  }

  /* ---------- 파생 데이터 ---------- */
  function visibleRecipes() {
    const q = state.query.trim().toLowerCase();
    return state.recipes
      .filter((r) => {
        if (state.filter === "즐겨찾기" && !r.favorite) return false;
        if (
          state.filter !== "전체" &&
          state.filter !== "즐겨찾기" &&
          r.category !== state.filter
        )
          return false;
        if (!q) return true;
        const haystack = [
          r.title,
          r.category,
          r.memo,
          r.tags.join(" "),
          r.ingredients.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function usedCategories() {
    return [...new Set(state.recipes.map((r) => r.category))];
  }

  /* ---------- 렌더링 ---------- */
  function render() {
    renderFilters();
    renderList();
  }

  function renderFilters() {
    const base = ["전체", "즐겨찾기"];
    const cats = usedCategories();
    const all = [...base, ...cats];
    els.filterBar.innerHTML = "";
    all.forEach((name) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (state.filter === name ? " chip--active" : "");
      const count =
        name === "전체"
          ? state.recipes.length
          : name === "즐겨찾기"
          ? state.recipes.filter((r) => r.favorite).length
          : state.recipes.filter((r) => r.category === name).length;
      btn.textContent = `${name} ${count}`;
      btn.addEventListener("click", () => {
        state.filter = name;
        render();
      });
      els.filterBar.appendChild(btn);
    });
  }

  function renderList() {
    const list = visibleRecipes();
    els.grid.innerHTML = "";

    if (state.recipes.length === 0) {
      showEmpty(
        "아직 저장한 레시피가 없어요",
        "오른쪽 위 <strong>+ 새 레시피</strong> 버튼으로 첫 레시피를 기록해보세요."
      );
      els.listMeta.textContent = "";
      return;
    }

    if (list.length === 0) {
      showEmpty("조건에 맞는 레시피가 없어요", "검색어나 필터를 바꿔보세요.");
      els.listMeta.textContent = "";
      return;
    }

    els.empty.hidden = true;
    els.listMeta.textContent = `${list.length}개 표시 중 · 전체 ${state.recipes.length}개`;

    list.forEach((r) => els.grid.appendChild(recipeCard(r)));
  }

  function showEmpty(title, html) {
    els.empty.hidden = false;
    els.empty.innerHTML = `<h2>${title}</h2><p>${html}</p>`;
  }

  function recipeCard(r) {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const thumb = document.createElement("div");
    thumb.className = "card__thumb";
    if (r.image) {
      thumb.style.backgroundImage = `url("${r.image}")`;
    } else {
      thumb.classList.add("card__thumb--placeholder");
      thumb.textContent = "🍳";
    }

    const fav = document.createElement("button");
    fav.className = "card__fav";
    fav.textContent = r.favorite ? "★" : "☆";
    fav.setAttribute("aria-label", r.favorite ? "즐겨찾기 해제" : "즐겨찾기");
    fav.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(r.id);
    });
    thumb.appendChild(fav);

    const body = document.createElement("div");
    body.className = "card__body";

    const title = document.createElement("h3");
    title.className = "card__title";
    title.textContent = r.title;

    const divider = document.createElement("hr");
    divider.className = "card__divider";

    const meta = document.createElement("div");
    meta.className = "card__meta";

    if (r.rating > 0) {
      const stars = document.createElement("span");
      stars.className = "stars stars--sm";
      stars.innerHTML = starMarkup(r.rating);
      stars.title = `내 평가 ${r.rating.toFixed(1)} / 5`;
      meta.appendChild(stars);
    }

    const bits = [r.category];
    if (r.time) bits.push(`⏱ ${r.time}분`);
    bits.push(r.difficulty);
    bits.forEach((b) => {
      const s = document.createElement("span");
      s.className = "pill";
      s.textContent = b;
      meta.appendChild(s);
    });

    body.append(title, divider, meta);
    card.append(thumb, body);

    const open = () => openDetail(r.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    return card;
  }

  /* ---------- 상세 보기 ---------- */
  function openDetail(id) {
    const r = state.recipes.find((x) => x.id === id);
    if (!r) return;

    const node = els.detailTpl.content.cloneNode(true);

    const media = node.querySelector("[data-media]");
    if (r.image) {
      const img = new Image();
      img.src = r.image;
      img.alt = r.title;
      media.appendChild(img);
    }

    node.querySelector("[data-title]").textContent = r.title;

    const favBtn = node.querySelector("[data-fav]");
    favBtn.textContent = r.favorite ? "★" : "☆";
    favBtn.setAttribute("aria-pressed", String(r.favorite));
    favBtn.addEventListener("click", () => {
      toggleFavorite(r.id);
      const on = state.recipes.find((x) => x.id === r.id).favorite;
      favBtn.textContent = on ? "★" : "☆";
      favBtn.setAttribute("aria-pressed", String(on));
    });

    const ratingWrap = node.querySelector("[data-rating]");
    if (r.rating > 0) {
      ratingWrap.hidden = false;
      ratingWrap.querySelector("[data-rating-stars]").innerHTML = starMarkup(
        r.rating
      );
      ratingWrap.querySelector("[data-rating-label]").textContent =
        `내 평가 ${r.rating.toFixed(1)} / 5`;
    }

    const badges = node.querySelector("[data-badges]");
    const badgeBits = [r.category];
    if (r.time) badgeBits.push(`⏱ ${r.time}분`);
    badgeBits.push(`난이도 ${r.difficulty}`);
    badgeBits.forEach((b) => {
      const s = document.createElement("span");
      s.textContent = b;
      badges.appendChild(s);
    });
    r.tags.forEach((t) => {
      const s = document.createElement("span");
      s.className = "tag";
      s.textContent = "#" + t;
      badges.appendChild(s);
    });

    const ing = node.querySelector("[data-ingredients]");
    if (r.ingredients.length === 0) {
      ing.innerHTML = "<li>등록된 재료가 없어요</li>";
    } else {
      r.ingredients.forEach((item) => {
        const li = document.createElement("li");
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        const span = document.createElement("span");
        span.textContent = item;
        label.append(cb, span);
        li.appendChild(label);
        ing.appendChild(li);
      });
    }

    const steps = node.querySelector("[data-steps]");
    if (r.steps.length === 0) {
      steps.innerHTML = "<li>등록된 조리 단계가 없어요</li>";
    } else {
      r.steps.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        steps.appendChild(li);
      });
    }

    if (r.memo.trim()) {
      node.querySelector("[data-memo-wrap]").hidden = false;
      node.querySelector("[data-memo]").textContent = r.memo;
    }

    node.querySelector("[data-timestamp]").textContent =
      `수정: ${formatDate(r.updatedAt)} · 등록: ${formatDate(r.createdAt)}`;

    node.querySelector("[data-edit]").addEventListener("click", () =>
      openForm(r.id)
    );
    node.querySelector("[data-delete]").addEventListener("click", () => {
      if (confirm(`"${r.title}" 레시피를 삭제할까요?`)) {
        deleteRecipe(r.id);
        closeSheet();
      }
    });

    showSheet(node);
  }

  /* ---------- 폼 (신규 / 편집) ---------- */
  function openForm(id) {
    const editing = id ? state.recipes.find((x) => x.id === id) : null;
    const node = els.formTpl.content.cloneNode(true);
    const form = node.querySelector("[data-form]");

    node.querySelector("[data-form-title]").textContent = editing
      ? "레시피 수정"
      : "새 레시피";

    // 이미지 처리
    let imageData = editing ? editing.image : null;
    const picker = node.querySelector("[data-image-picker]");
    const fileInput = picker.querySelector('input[name="image"]');
    const pickBtn = picker.querySelector("[data-image-btn]");
    const clearBtn = picker.querySelector("[data-image-clear]");
    const preview = picker.querySelector("[data-image-preview]");

    function paintPreview() {
      if (imageData) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${imageData}" alt="미리보기" />`;
        clearBtn.hidden = false;
        pickBtn.textContent = "사진 변경";
      } else {
        preview.hidden = true;
        preview.innerHTML = "";
        clearBtn.hidden = true;
        pickBtn.textContent = "사진 선택";
      }
    }
    paintPreview();

    pickBtn.addEventListener("click", () => fileInput.click());
    clearBtn.addEventListener("click", () => {
      imageData = null;
      fileInput.value = "";
      paintPreview();
    });
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        imageData = await resizeImage(file, 1000, 0.72);
        paintPreview();
      } catch (err) {
        console.error(err);
        alert("이미지를 불러오지 못했습니다.");
      }
    });

    // 별점 위젯
    let ratingValue = editing ? editing.rating : 0;
    attachRatingInput(
      node.querySelector("[data-rating-input]"),
      ratingValue,
      (v) => {
        ratingValue = v;
      }
    );

    // 편집 시 기존 값 채우기
    if (editing) {
      form.title.value = editing.title;
      form.category.value = editing.category;
      form.time.value = editing.time ?? "";
      form.difficulty.value = editing.difficulty;
      form.tags.value = editing.tags.join(", ");
      form.ingredients.value = editing.ingredients.join("\n");
      form.steps.value = editing.steps.join("\n");
      form.memo.value = editing.memo;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        title: form.title.value.trim(),
        category: form.category.value,
        time: form.time.value ? +form.time.value : null,
        difficulty: form.difficulty.value,
        tags: splitList(form.tags.value, ","),
        ingredients: splitList(form.ingredients.value, "\n"),
        steps: splitList(form.steps.value, "\n"),
        memo: form.memo.value.trim(),
        rating: ratingValue,
        image: imageData,
      };
      if (!data.title) {
        form.title.focus();
        return;
      }
      if (editing) {
        updateRecipe(editing.id, data);
        openDetail(editing.id);
      } else {
        const created = addRecipe(data);
        openDetail(created.id);
      }
    });

    node.querySelector("[data-cancel]").addEventListener("click", () => {
      if (editing) openDetail(editing.id);
      else closeSheet();
    });

    showSheet(node);
    setTimeout(() => form.title.focus(), 50);
  }

  /* ---------- 변경 연산 ---------- */
  function addRecipe(data) {
    const now = Date.now();
    const recipe = normalizeRecipe({ ...data, createdAt: now, updatedAt: now });
    state.recipes.push(recipe);
    save();
    render();
    return recipe;
  }

  function updateRecipe(id, data) {
    const i = state.recipes.findIndex((x) => x.id === id);
    if (i < 0) return;
    state.recipes[i] = normalizeRecipe({
      ...state.recipes[i],
      ...data,
      id,
      updatedAt: Date.now(),
    });
    save();
    render();
  }

  function deleteRecipe(id) {
    state.recipes = state.recipes.filter((x) => x.id !== id);
    save();
    render();
  }

  function toggleFavorite(id) {
    const r = state.recipes.find((x) => x.id === id);
    if (!r) return;
    r.favorite = !r.favorite;
    r.updatedAt = Date.now();
    save();
    render();
  }

  /* ---------- 백업 / 복원 ---------- */
  function exportJSON() {
    if (state.recipes.length === 0) {
      alert("내보낼 레시피가 없어요.");
      return;
    }
    const payload = {
      schema: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      recipes: state.recipes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `recipe-note-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : parsed.recipes;
        if (!Array.isArray(incoming)) throw new Error("형식 오류");

        const existingIds = new Set(state.recipes.map((r) => r.id));
        let added = 0;
        incoming.forEach((raw) => {
          const rec = normalizeRecipe(raw);
          if (existingIds.has(rec.id)) rec.id = uid();
          state.recipes.push(rec);
          existingIds.add(rec.id);
          added++;
        });
        save();
        render();
        alert(`${added}개의 레시피를 불러왔어요.`);
      } catch (err) {
        console.error(err);
        alert("파일을 읽지 못했어요. 이 앱에서 내보낸 JSON 파일인지 확인하세요.");
      }
    };
    reader.readAsText(file);
  }

  /* ---------- 유틸 ---------- */
  function splitList(text, sep) {
    return text
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "-";
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }

  function resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 시트 열고 닫기 ---------- */
  function showSheet(node) {
    els.sheetBody.innerHTML = "";
    els.sheetBody.appendChild(node);
    els.overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    els.overlay.hidden = true;
    els.sheetBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  /* ---------- 이벤트 배선 ---------- */
  function wire() {
    els.newBtn.addEventListener("click", () => openForm(null));
    els.sheetClose.addEventListener("click", closeSheet);
    els.overlay.addEventListener("click", (e) => {
      if (e.target === els.overlay) closeSheet();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.overlay.hidden) closeSheet();
    });

    let searchTimer;
    els.search.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = els.search.value;
        renderList();
      }, 150);
    });

    els.menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      els.menuDropdown.hidden = !els.menuDropdown.hidden;
    });
    document.addEventListener("click", () => {
      els.menuDropdown.hidden = true;
    });
    els.menuDropdown.addEventListener("click", (e) => e.stopPropagation());

    els.exportBtn.addEventListener("click", () => {
      exportJSON();
      els.menuDropdown.hidden = true;
    });
    els.importBtn.addEventListener("click", () => els.importInput.click());
    els.importInput.addEventListener("change", () => {
      const file = els.importInput.files[0];
      if (file) importJSON(file);
      els.importInput.value = "";
      els.menuDropdown.hidden = true;
    });
  }

  /* ---------- 첫 실행 샘플 ---------- */
  function seedIfEmpty() {
    if (localStorage.getItem(STORAGE_KEY)) return;
    state.recipes = [
      normalizeRecipe({
        title: "계란 간장밥",
        category: "한식",
        time: 7,
        difficulty: "쉬움",
        tags: ["자취요리", "5분", "재료최소"],
        ingredients: ["따뜻한 밥 1공기", "계란 1개", "간장 1큰술", "참기름 1작은술", "김가루 조금"],
        steps: [
          "팬에 기름을 두르고 계란프라이를 반숙으로 부친다",
          "따뜻한 밥 위에 계란프라이를 올린다",
          "간장과 참기름을 두르고 김가루를 뿌린다",
          "노른자를 터뜨려 비벼 먹는다",
        ],
        memo: "밥이 뜨거울수록 맛있음. 버터 한 조각 넣으면 더 고소함.",
        rating: 4.5,
      }),
    ];
    save();
  }

  /* ---------- 광고 (Google AdSense) ----------
     헤드의 adsbygoogle.js 로 "자동 광고"는 이미 동작한다.
     아래는 수동 배치 슬롯 — AdSense 콘솔에서 광고 단위를 만들고
     data-ad-slot 값을 넣으면 그 자리에 광고가 뜬다. (예: data-ad-slot="1234567890")
     슬롯이 비어 있으면(placeholder) 자리만 차지하지 않도록 숨긴다. */
  function initAds() {
    const units = document.querySelectorAll("ins.adsbygoogle");
    let active = 0;
    units.forEach((ins) => {
      const slot = ins.getAttribute("data-ad-slot") || "";
      const box = ins.closest(".ad-slot");
      if (/^\d{6,}$/.test(slot) && slot !== "0000000000") {
        if (box) box.hidden = false;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          active++;
        } catch (_) {
          /* 광고 차단기 등 — 무시 */
        }
      }
    });
    return active;
  }

  /* ---------- 부트 ---------- */
  function init() {
    seedIfEmpty();
    state.recipes = load();
    wire();
    render();
    initAds();
  }

  init();
})();
