/*
 * רשימת קניות – נשמרת בשני קבצי TXT בריפו של GitHub, בלי שרת:
 *   shopping_list.txt – מה לקנות עכשיו (כמויות, ו-✓ למה שכבר נקנה)
 *   all_items.txt     – כל הפריטים, לפי קטגוריות
 * האתר קורא ומעדכן אותם דרך ה-API של GitHub (עם טוקן אישי של מי שמעדכן).
 * ההגדרות (ריפו, ענף) נמצאות בקובץ config.js.
 */

const MAX_QTY = 99;
const CHECK = "✓";
const SHOPPING_FILE = "shopping_list.txt";
const ITEMS_FILE = "all_items.txt";
const ALL_LABEL = "כל הקטגוריות";

const SHOPPING_HEADER =
`# רשימת קניות נוכחית – מתעדכנת מהאתר
# מבנה: קטגוריה: מוצר, מוצר x2, ✓מוצר שנקנה
`;
const ITEMS_HEADER =
`# כל הפריטים – מהם בוחרים מה להוסיף לרשימת הקניות
# מבנה: קטגוריה: מוצר, מוצר, מוצר
`;
const COMBINED_HEADER =
`# מבנה: קטגוריה: מוצר, מוצר x2, ✓מוצר שנקנה, מוצר x0
# מוצר בכמות 0 (x0) נשאר ברשימת כל הפריטים אבל לא ברשימת הקניות
`;

// גיבוי למקרה שאי אפשר לטעון את הקבצים בכלל (למשל פתיחת index.html מהדיסק)
const FALLBACK_ITEMS = `מוצרי חלב: חלב, גבינה לבנה, גבינה צהובה, יוגורט
ירקות: מלפפון, עגבניה, חסה, כרוב, גזר
פירות: תפוח, אגס, בננה, לימון
בשר: סטייק כבש, בשר טחון, צלי`;
const FALLBACK_LIST = `מוצרי חלב: חלב x2, יוגורט x4
ירקות: מלפפון x3, עגבניה x4
פירות: תפוח x5`;

/* ---------- פענוח וכתיבה של הקבצים (לוגיקה בלי דפדפן) ---------- */

// "✓חלב x2" -> { name: "חלב", qty: 2, done: true }.  בלי x -> כמות 1.
function parseItem(raw) {
    let s = String(raw).trim();
    let done = false;
    if (s.startsWith(CHECK)) { done = true; s = s.slice(CHECK.length).trim(); }
    const m = s.match(/^(.*?)\s*[x×*]\s*(\d{1,2})$/i);
    if (m && m[1].trim()) {
        return { name: m[1].trim(), qty: Math.min(MAX_QTY, Number(m[2])), done };
    }
    return { name: s, qty: 1, done };
}

// "קטגוריה: מוצר, מוצר x2" -> [{ name, items: [{ name, qty, done }] }]
// שורות ריקות והערות (#) מדולגות. קטגוריה שחוזרת פעמיים – מתמזגת.
function parseList(text) {
    const cats = [];
    const byName = new Map();

    String(text).replace(/^﻿/, "").split(/\r?\n/).forEach((raw) => {
        const line = raw.trim();
        if (!line || line.startsWith("#")) return;

        const colon = line.indexOf(":");
        if (colon === -1) return;

        const name = line.slice(0, colon).trim();
        if (!name) return;

        let cat = byName.get(name);
        if (!cat) {
            cat = { name, items: [] };
            byName.set(name, cat);
            cats.push(cat);
        }

        line.slice(colon + 1).split(/[,،]/).forEach((part) => {
            if (!part.trim()) return;
            const item = parseItem(part);
            if (item.name && !cat.items.some((x) => x.name === item.name)) {
                cat.items.push(item);
            }
        });
    });

    return cats;
}

// שמות לא יכולים להכיל : או , כי הם מפרידים בקובץ
const cleanName = (s) => String(s).replace(/[:,،\r\n]+/g, " ").replace(/\s+/g, " ").trim();

const lineOf = (name, parts) => (parts.length ? `${name}: ${parts.join(", ")}` : `${name}:`);

// all_items.txt – שמות בלבד
function serializeCatalog(cats) {
    const lines = [];
    cats.forEach((c) => {
        const name = cleanName(c.name);
        if (!name) return;
        const seen = new Set();
        const parts = [];
        c.items.forEach((it) => {
            const n = cleanName(it.name);
            if (n && !seen.has(n)) { seen.add(n); parts.push(n); }
        });
        lines.push(lineOf(name, parts));
    });
    return ITEMS_HEADER + lines.join("\n") + "\n";
}

// shopping_list.txt – רק מוצרים בכמות 1 ומעלה
function serializeShopping(cats) {
    const lines = [];
    cats.forEach((c) => {
        const name = cleanName(c.name);
        if (!name) return;
        const parts = [];
        c.items.forEach((it) => {
            const n = cleanName(it.name);
            const q = Number(it.qty);
            if (!n || !(q > 0)) return;
            parts.push((it.done ? CHECK : "") + n + (q > 1 ? ` x${q}` : ""));
        });
        if (parts.length) lines.push(lineOf(name, parts));
    });
    return SHOPPING_HEADER + lines.join("\n") + "\n";
}

// תצוגת הטקסט בעורך: כל הפריטים, עם כמויות (x0 = לא ברשימת הקניות)
function serializeCombined(cats) {
    const lines = [];
    cats.forEach((c) => {
        const name = cleanName(c.name);
        if (!name) return;
        const parts = [];
        c.items.forEach((it) => {
            const n = cleanName(it.name);
            if (!n) return;
            const q = Number.isFinite(Number(it.qty)) ? Number(it.qty) : 1;
            parts.push((it.done && q > 0 ? CHECK : "") + n + (q === 1 ? "" : ` x${q}`));
        });
        lines.push(lineOf(name, parts));
    });
    return COMBINED_HEADER + lines.join("\n") + "\n";
}

// מאחד את "כל הפריטים" ואת "רשימת הקניות" למודל אחד לתצוגה.
// פריט שמופיע רק ברשימת הקניות (נוסף ידנית בקובץ) נכנס גם הוא.
function mergeModel(catalog, list) {
    const out = [];
    const byName = new Map();
    const ensure = (name) => {
        let c = byName.get(name);
        if (!c) { c = { name, items: [] }; byName.set(name, c); out.push(c); }
        return c;
    };

    catalog.forEach((c) => {
        const oc = ensure(c.name);
        c.items.forEach((it) => {
            if (!oc.items.some((x) => x.name === it.name)) oc.items.push({ name: it.name, qty: 0, done: false });
        });
    });

    list.forEach((c) => {
        const oc = ensure(c.name);
        c.items.forEach((it) => {
            let x = oc.items.find((y) => y.name === it.name);
            if (!x) { x = { name: it.name, qty: 0, done: false }; oc.items.push(x); }
            x.qty = it.qty;
            x.done = it.qty > 0 && it.done;
        });
    });

    return out;
}

// פעולות קטנות על רשימת הקניות: "סומן/בוטל סימון" ו"כמות חדשה".
// הן מוחלות על הגרסה העדכנית ביותר שבריפו, כדי לא לדרוס שינויים של אחרים.
function applyOps(cats, ops) {
    const find = (catName, name) => {
        const c = cats.find((x) => x.name === catName) || null;
        return { c, it: c ? c.items.find((i) => i.name === name) || null : null };
    };

    ops.forEach((op) => {
        if (op.t === "done") {
            const { it } = find(op.cat, op.name);
            if (it) it.done = Boolean(op.done);
        } else if (op.t === "qty") {
            let { c, it } = find(op.cat, op.name);
            if (!(op.qty > 0)) {
                if (it) c.items.splice(c.items.indexOf(it), 1);
                return;
            }
            if (!c) { c = { name: op.cat, items: [] }; cats.push(c); }
            if (!it) { it = { name: op.name, qty: op.qty, done: false }; c.items.push(it); }
            else it.qty = op.qty;
        }
    });
    return cats;
}

const itemKey = (cat, item) => `${cat}|${item}`;

// base64 <-> UTF-8 (ל-API של GitHub)
function encodeB64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}
function decodeB64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

if (typeof module !== "undefined") {
    module.exports = {
        parseItem, parseList, cleanName, serializeCatalog, serializeShopping, serializeCombined,
        mergeModel, applyOps, itemKey, encodeB64, decodeB64,
    };
}

/* ====================================================================== */
/* ---------- מכאן – ממשק בדפדפן ---------- */
/* ====================================================================== */

if (typeof document !== "undefined") {

    /* ---------- הגדרות ---------- */

    // https://<user>.github.io/<repo>/  ->  "<user>/<repo>"
    function inferRepo() {
        const h = location.hostname;
        if (!h.endsWith(".github.io")) return "";
        const owner = h.slice(0, -".github.io".length);
        const seg = location.pathname.split("/").filter(Boolean)[0];
        const repo = seg && !/\.html?$/i.test(seg) ? seg : `${owner}.github.io`;
        return `${owner}/${repo}`;
    }

    const CFG = {
        repo: ((typeof GITHUB_REPO === "string" && GITHUB_REPO.trim()) || inferRepo()).replace(/^\/+|\/+$/g, ""),
        branch: (typeof GITHUB_BRANCH === "string" && GITHUB_BRANCH.trim()) || "main",
        syncMs: (typeof SYNC_INTERVAL_MS === "number" && SYNC_INTERVAL_MS >= 5000) ? SYNC_INTERVAL_MS : 20000,
    };

    const API = "https://api.github.com";
    const SAVE_DELAY_MS = 1200;   // שינויים קטנים (סימון, כמות) נשמרים יחד אחרי רגע

    const LS_TOKEN = "shopping.ghToken";        // הטוקן האישי (במכשיר הזה בלבד)
    const LS_LOCAL_DONE = "shopping.localDone"; // סימונים "נקנה" למי שאין לו הרשאת כתיבה
    const LS_CACHE = "shopping.cache";          // עותק אחרון, לפתיחה בלי רשת

    /* ---------- מצב ---------- */

    let known = { list: { text: "", sha: null }, items: { text: "", sha: null } };
    let data = [];                  // [{ name, items: [{ name, qty, done }] }] – כל הפריטים
    let viewIndex = 0;              // 0 = הכל, 1..n = קטגוריה
    let token = "";
    let localDone = {};             // { "קטגוריה|מוצר": true/false }
    let pendingOps = [];
    let flushTimer = null;
    let flushing = false;
    let polling = false;
    let editorOpen = false;
    let loadedFrom = "";            // "github" | "static" | "cache" | "builtin"
    let syncState = "connecting";

    /* ---------- אחסון מקומי ---------- */

    const store = {
        get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } },
        remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
    };

    function loadLocalState() {
        token = store.get(LS_TOKEN) || "";
        try {
            const o = JSON.parse(store.get(LS_LOCAL_DONE) || "{}");
            localDone = o && typeof o === "object" ? o : {};
        } catch (e) { localDone = {}; }
    }
    const saveLocalDone = () => store.set(LS_LOCAL_DONE, JSON.stringify(localDone));

    const canWrite = () => Boolean(token && CFG.repo);

    /* ---------- GitHub API ---------- */

    function apiError(status, message) {
        const e = new Error(message || `HTTP ${status}`);
        e.status = status;
        return e;
    }

    async function gh(path, { method = "GET", body } = {}) {
        const headers = { Accept: "application/vnd.github+json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers["Content-Type"] = "application/json";

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
            const res = await fetch(API + path, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                // "no-cache" = שואלים את GitHub בכל פעם, אבל תשובת 304 לא נספרת במכסת הקריאות
                cache: method === "GET" ? "no-cache" : "no-store",
                signal: ctrl.signal,
            });
            return res;
        } finally {
            clearTimeout(timer);
        }
    }

    const contentsPath = (file) =>
        `/repos/${CFG.repo}/contents/${file.split("/").map(encodeURIComponent).join("/")}`;

    // קורא קובץ מהריפו. קובץ שלא קיים = טקסט ריק (ייווצר בשמירה הראשונה).
    async function readFile(file) {
        const res = await gh(`${contentsPath(file)}?ref=${encodeURIComponent(CFG.branch)}`);
        if (res.status === 404) return { text: "", sha: null };
        if (!res.ok) throw apiError(res.status);
        const json = await res.json();
        if (typeof json.content !== "string") throw apiError(500, "unexpected response");
        return { text: decodeB64(json.content), sha: json.sha };
    }

    async function writeFile(file, text, sha, message) {
        const body = { message, content: encodeB64(text), branch: CFG.branch };
        if (sha) body.sha = sha;
        const res = await gh(contentsPath(file), { method: "PUT", body });
        if (!res.ok) throw apiError(res.status);
        const json = await res.json();
        return json.content && json.content.sha ? json.content.sha : null;
    }

    // שומר קובץ שלם (ממקור העורך). לוקח קודם את הגרסה העדכנית כדי לקבל sha נכון.
    async function saveWholeFile(file, text, message) {
        for (let attempt = 0; attempt < 4; attempt++) {
            const base = await readFile(file);
            if (base.text === text) return base;
            try {
                const sha = await writeFile(file, text, base.sha, message);
                return { text, sha };
            } catch (e) {
                if ((e.status === 409 || e.status === 422) && attempt < 3) continue;
                throw e;
            }
        }
        throw apiError(409);
    }

    function errText(e) {
        const s = e && e.status;
        if (s === 401) return "הטוקן לא תקין או שפג תוקפו. התחברו מחדש.";
        if (s === 403 || s === 404) return "אין הרשאת כתיבה לריפו. בדקו שהטוקן מוגדר ל-Contents: Read and write על הריפו הזה.";
        if (s === 409 || s === 422) return "הקובץ השתנה בו-זמנית אצל מישהו אחר. נסו שוב.";
        if (e && e.name === "AbortError") return "הבקשה ל-GitHub לקחה יותר מדי זמן.";
        return "אין חיבור ל-GitHub. נסו שוב.";
    }

    /* ---------- סטטוס ---------- */

    const SYNC_LABELS = {
        connecting: ["● טוען…", ""],
        ok: ["● מחובר · משותף", "ok"],
        saving: ["● שומר…", ""],
        readonly: ["● קריאה בלבד", "warn"],
        norepo: ["● לא הוגדר ריפו", "warn"],
        offline: ["● אין חיבור", "warn"],
        error: ["● השמירה נכשלה – ננסה שוב", "warn"],
    };

    function setSync(state) {
        syncState = state;
        const node = document.getElementById("syncStatus");
        if (!node) return;
        const label = SYNC_LABELS[state];
        node.textContent = label[0];
        node.className = "sync " + label[1];
    }

    function idleSyncState() {
        if (!CFG.repo) return "norepo";
        if (!token) return "readonly";
        return loadedFrom === "github" ? "ok" : "offline";
    }

    /* ---------- השארת המסך דולק ---------- */

    let wakeLock = null;

    async function keepScreenOn() {
        try {
            if (!("wakeLock" in navigator)) return;
            if (wakeLock !== null && !wakeLock.released) return;
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => { wakeLock = null; });
        } catch (err) {
            console.log("Wake Lock could not be activated:", err);
        }
    }

    /* ---------- רכיבי HTML ---------- */

    const $ = (id) => document.getElementById(id);

    const els = {
        viewTitle: $("viewTitle"),
        viewSummary: $("viewSummary"),
        itemsBox: $("itemsBox"),
        chooseBtn: $("chooseBtn"),
        editBtn: $("editBtn"),
        connectBtn: $("connectBtn"),
        clearBtn: $("clearBtn"),
        chooseOverlay: $("chooseOverlay"),
        categorySelect: $("categorySelect"),
        chooseOk: $("chooseOk"),
        chooseCancel: $("chooseCancel"),
        editOverlay: $("editOverlay"),
        tabVisual: $("tabVisual"),
        tabText: $("tabText"),
        visualPane: $("visualPane"),
        textPane: $("textPane"),
        editorCats: $("editorCats"),
        editorAddBar: $("editorAddBar"),
        openAddItemBtn: $("openAddItemBtn"),
        addItemOverlay: $("addItemOverlay"),
        addItemName: $("addItemName"),
        addItemCategory: $("addItemCategory"),
        addNewCategoryField: $("addNewCategoryField"),
        addNewCategoryName: $("addNewCategoryName"),
        addItemMsg: $("addItemMsg"),
        addItemCancel: $("addItemCancel"),
        addItemConfirm: $("addItemConfirm"),
        newCatInput: $("newCatInput"),
        newCatBtn: $("newCatBtn"),
        editText: $("editText"),
        editMsg: $("editMsg"),
        editCancel: $("editCancel"),
        editSave: $("editSave"),
        connectOverlay: $("connectOverlay"),
        connectIntro: $("connectIntro"),
        tokenInput: $("tokenInput"),
        tokenLink: $("tokenLink"),
        connectMsg: $("connectMsg"),
        connectOk: $("connectOk"),
        connectCancel: $("connectCancel"),
        disconnectBtn: $("disconnectBtn"),
    };

    /* ---------- בניית המודל ---------- */

    function rebuild() {
        data = mergeModel(parseList(known.items.text), parseList(known.list.text));
    }

    function isDone(cat, item) {
        if (canWrite()) return item.done;
        const k = itemKey(cat, item.name);
        return k in localDone ? Boolean(localDone[k]) : item.done;
    }

    const activeItems = (cat) => cat.items.filter((it) => it.qty > 0);

    /* ---------- תצוגה ---------- */

    const viewCount = () => data.length + 1;

    function visibleCategories() {
        return viewIndex === 0 ? data : [data[viewIndex - 1]];
    }

    function stats(cats) {
        let total = 0;
        let done = 0;
        cats.forEach((c) => activeItems(c).forEach((it) => {
            total += 1;
            if (isDone(c.name, it)) done += 1;
        }));
        return { total, done };
    }

    function render() {
        if (viewIndex >= viewCount()) viewIndex = 0;

        const cats = visibleCategories();
        const { total, done } = stats(cats);

        els.viewTitle.innerHTML = '<span class="cart-icon" aria-hidden="true">🛒</span> רשימת קניות';
        els.viewSummary.textContent = "";

        els.connectBtn.textContent = canWrite() ? "🔑 מחובר" : "🔑 התחברות לעדכון";
        els.connectBtn.classList.toggle("connected", canWrite());

        renderItems(cats);
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // כפתורי + / − סביב מספר. onChange מקבל את הכמות החדשה. min=0 בעורך, 1 ברשימה.
    function makeStepper(qty, onChange, min) {
        const wrap = el("div", "stepper");

        const minus = el("button", "", "−");
        minus.type = "button";
        minus.setAttribute("aria-label", "הפחת כמות");

        const num = el("span", "stepper-num");

        const plus = el("button", "", "+");
        plus.type = "button";
        plus.setAttribute("aria-label", "הוסף כמות");

        let current = qty;
        const paint = () => {
            num.textContent = current;
            minus.disabled = current <= min;
            plus.disabled = current >= MAX_QTY;
        };
        paint();

        const step = (delta) => (e) => {
            e.stopPropagation();
            const next = Math.min(MAX_QTY, Math.max(min, current + delta));
            if (next === current) return;
            current = next;
            paint();
            onChange(current);
        };
        minus.addEventListener("click", step(-1));
        plus.addEventListener("click", step(+1));
        wrap.addEventListener("click", (e) => e.stopPropagation());

        wrap.append(plus, num, minus);   // ב-RTL: מינוס בצד שמאל, פלוס בצד ימין
        return wrap;
    }

    function renderItems(cats) {
        const box = els.itemsBox;
        box.innerHTML = "";

        if (!cats.some((c) => activeItems(c).length)) {
            const empty = el("div", "empty",
                data.length === 0
                    ? "הרשימה ריקה."
                    : "אין מוצרים ברשימת הקניות. כדי להוסיף – «עריכת הרשימה» וקבעו כמות לפריטים.");
            box.appendChild(empty);
            return;
        }

        cats.forEach((cat) => {
            const items = activeItems(cat);
            if (!items.length) return;

            const header = el("div", "list-header");
            const { total, done } = stats([cat]);
            header.append(el("span", "", cat.name), el("span", "count", `${done}/${total}`));
            box.appendChild(header);

            items.forEach((item) => {
                const row = el("div", "list-item");
                row.setAttribute("role", "checkbox");
                row.tabIndex = 0;

                const isDoneNow = isDone(cat.name, item);
                row.classList.toggle("done", isDoneNow);
                row.setAttribute("aria-checked", String(isDoneNow));

                row.append(el("span", "box", "✓"), el("span", "item-text", item.name));

                if (canWrite()) {
                    row.appendChild(makeStepper(item.qty, (q) => {
                        item.qty = q;
                        queueOp({ t: "qty", cat: cat.name, name: item.name, qty: q });
                    }, 1));
                } else if (item.qty > 1) {
                    row.appendChild(el("span", "qty-pill", `×${item.qty}`));
                }

                const toggle = () => {
                    const next = !isDone(cat.name, item);
                    if (canWrite()) {
                        item.done = next;
                        queueOp({ t: "done", cat: cat.name, name: item.name, done: next });
                    } else {
                        localDone[itemKey(cat.name, item.name)] = next;
                        saveLocalDone();
                    }
                    render();
                    keepScreenOn();
                };
                row.addEventListener("click", toggle);
                row.addEventListener("keydown", (e) => {
                    if (e.target !== row) return;
                    if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
                });

                box.appendChild(row);
            });
        });
    }

    /* ---------- שמירת שינויים קטנים (סימון / כמות) ---------- */

    function queueOp(op) {
        // פעולה חדשה על אותו מוצר מחליפה את הקודמת
        pendingOps = pendingOps.filter((o) => !(o.t === op.t && o.cat === op.cat && o.name === op.name));
        pendingOps.push(op);
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flushOps, SAVE_DELAY_MS);
        setSync("saving");
    }

    async function flushOps() {
        clearTimeout(flushTimer);
        flushTimer = null;
        if (flushing) return;
        flushing = true;

        try {
            while (pendingOps.length) {
                const ops = pendingOps;
                pendingOps = [];
                let ok = false;
                let lastErr = null;

                for (let attempt = 0; attempt < 4 && !ok; attempt++) {
                    try {
                        // בניסיון הראשון משתמשים במה שכבר ידוע; אחרי התנגשות – קוראים מחדש
                        const base = attempt === 0 && known.list.sha ? known.list : await readFile(SHOPPING_FILE);
                        const text = serializeShopping(applyOps(parseList(base.text), ops));
                        if (text === base.text) { known.list = base; ok = true; break; }
                        const sha = await writeFile(SHOPPING_FILE, text, base.sha, "עדכון רשימת קניות");
                        known.list = { text, sha };
                        ok = true;
                    } catch (e) {
                        lastErr = e;
                        if (e.status === 409 || e.status === 422) { known.list = { text: known.list.text, sha: null }; continue; }
                        break;
                    }
                }

                if (!ok) {
                    console.log("Save failed:", lastErr);
                    pendingOps = ops.concat(pendingOps);   // לא מאבדים – ננסה שוב
                    setSync(lastErr && lastErr.status ? "error" : "offline");
                    flushTimer = setTimeout(flushOps, 8000);
                    if (lastErr && (lastErr.status === 401 || lastErr.status === 403 || lastErr.status === 404)) {
                        alert(errText(lastErr));
                    }
                    return;
                }
            }

            saveCache();
            setSync(idleSyncState());
            if (!pendingOps.length && !editorOpen) {
                rebuild();      // משלבים גם שינויים שאחרים עשו בינתיים
                render();
            }
        } finally {
            flushing = false;
        }
    }

    // ממתין שכל השינויים הקטנים יישמרו (לפני פתיחת העורך)
    async function flushNow() {
        if (flushTimer || pendingOps.length) await flushOps();
        while (flushing) await new Promise((r) => setTimeout(r, 50));
    }

    /* ---------- טעינה וסנכרון ---------- */

    function saveCache() {
        store.set(LS_CACHE, JSON.stringify({ list: known.list.text, items: known.items.text }));
    }

    async function fetchRelative(file) {
        const res = await fetch(`${file}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw apiError(res.status);
        return { text: await res.text(), sha: null };
    }

    async function loadAll() {
        let list = null;
        let items = null;
        loadedFrom = "";

        if (CFG.repo) {
            try {
                [list, items] = await Promise.all([readFile(SHOPPING_FILE), readFile(ITEMS_FILE)]);
                loadedFrom = "github";
            } catch (err) {
                console.log("GitHub read failed, trying site files:", err);
                list = items = null;
            }
        }

        if (!list) {
            const [l, i] = await Promise.allSettled([fetchRelative(SHOPPING_FILE), fetchRelative(ITEMS_FILE)]);
            if (l.status === "fulfilled" || i.status === "fulfilled") {
                list = l.status === "fulfilled" ? l.value : { text: "", sha: null };
                items = i.status === "fulfilled" ? i.value : { text: "", sha: null };
                loadedFrom = "static";
            }
        }

        if (!list) {
            try {
                const c = JSON.parse(store.get(LS_CACHE) || "null");
                if (c && typeof c.list === "string" && typeof c.items === "string") {
                    list = { text: c.list, sha: null };
                    items = { text: c.items, sha: null };
                    loadedFrom = "cache";
                }
            } catch (e) { /* ignore */ }
        }

        if (!list) {
            list = { text: FALLBACK_LIST, sha: null };
            items = { text: FALLBACK_ITEMS, sha: null };
            loadedFrom = "builtin";
        }

        known = { list, items };
        if (loadedFrom === "github") saveCache();
    }

    async function poll() {
        if (!CFG.repo || polling || document.hidden) return;
        if (flushing || flushTimer || pendingOps.length || editorOpen) return;

        polling = true;
        try {
            const [l, i] = await Promise.all([readFile(SHOPPING_FILE), readFile(ITEMS_FILE)]);
            if (flushing || flushTimer || pendingOps.length || editorOpen) return;

            const wasOffline = loadedFrom !== "github";
            loadedFrom = "github";
            if (wasOffline || l.sha !== known.list.sha || i.sha !== known.items.sha || l.text !== known.list.text || i.text !== known.items.text) {
                known = { list: l, items: i };
                saveCache();
                rebuild();
                render();
            }
            setSync(idleSyncState());
        } catch (err) {
            console.log("Poll failed:", err);
            if (syncState === "ok") setSync("offline");
        } finally {
            polling = false;
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") { keepScreenOn(); poll(); }
    });

    /* ---------- ניווט ---------- */


    els.clearBtn.addEventListener("click", () => {
        const targets = [];
        visibleCategories().forEach((c) => activeItems(c).forEach((it) => {
            if (isDone(c.name, it)) targets.push({ c, it });
        }));
        if (!targets.length) return;

        if (canWrite()) {
            targets.forEach(({ c, it }) => {
                it.done = false;
                queueOp({ t: "done", cat: c.name, name: it.name, done: false });
            });
        } else {
            targets.forEach(({ c, it }) => { localDone[itemKey(c.name, it.name)] = false; });
            saveLocalDone();
        }
        render();
    });

    /* ---------- מודאל בחירת קטגוריה ---------- */

    function openChoose() {
        els.categorySelect.innerHTML = "";
        [ALL_LABEL, ...data.map((c) => c.name)].forEach((name, i) => {
            const opt = el("option", "", name);
            opt.value = String(i);
            els.categorySelect.appendChild(opt);
        });
        els.categorySelect.value = String(viewIndex);
        els.chooseOverlay.classList.remove("hidden");
        keepScreenOn();
    }

    const closeChoose = () => els.chooseOverlay.classList.add("hidden");

    if (els.chooseBtn) els.chooseBtn.addEventListener("click", openChoose);
    els.chooseCancel.addEventListener("click", closeChoose);
    els.chooseOverlay.addEventListener("click", (e) => { if (e.target === els.chooseOverlay) closeChoose(); });
    els.chooseOk.addEventListener("click", () => {
        viewIndex = Number(els.categorySelect.value) || 0;
        closeChoose();
        render();
    });

    /* ---------- חיבור ל-GitHub (טוקן) ---------- */

    function setConnectMsg(msg, isError) {
        els.connectMsg.textContent = msg || "";
        els.connectMsg.classList.toggle("error", Boolean(isError));
    }

    function openConnect(reason) {
        const repoText = CFG.repo || "";
        els.connectIntro.textContent = !CFG.repo
            ? "לא הוגדר ריפו. מלאו את GITHUB_REPO בקובץ config.js (או פתחו את האתר מכתובת github.io של הריפו)."
            : `העדכון נכתב לקבצים shopping_list.txt ו-all_items.txt בריפו ${repoText}. ` +
              "לשם כך צריך חשבון GitHub עם הרשאת כתיבה לריפו, וטוקן אישי שנשמר במכשיר הזה בלבד.";
        els.tokenInput.value = "";
        els.tokenInput.disabled = !CFG.repo;
        els.connectOk.disabled = !CFG.repo;
        els.disconnectBtn.classList.toggle("hidden", !token);
        els.tokenLink.href = "https://github.com/settings/personal-access-tokens/new";
        setConnectMsg(reason || (token ? "מחוברים. אפשר להחליף טוקן או להתנתק." : ""));
        els.connectOverlay.classList.remove("hidden");
        if (CFG.repo) els.tokenInput.focus();
    }

    const closeConnect = () => els.connectOverlay.classList.add("hidden");

    async function verifyToken(candidate) {
        const res = await fetch(`${API}/repos/${CFG.repo}`, {
            headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${candidate}` },
            cache: "no-store",
        });
        if (res.status === 401) throw new Error("הטוקן לא תקין או שפג תוקפו.");
        if (res.status === 404) throw new Error("הטוקן לא מקבל גישה לריפו הזה. בחרו אותו ב-Repository access.");
        if (!res.ok) throw new Error(`GitHub החזיר שגיאה (${res.status}).`);
        const info = await res.json();
        if (info.permissions && info.permissions.push === false) {
            throw new Error("אין לחשבון הזה הרשאת כתיבה לריפו. בקשו מבעל הריפו להוסיף אתכם כ-Collaborator.");
        }
    }

    els.connectOk.addEventListener("click", async () => {
        const candidate = els.tokenInput.value.trim();
        if (!candidate) { setConnectMsg("הדביקו את הטוקן.", true); return; }
        els.connectOk.disabled = true;
        setConnectMsg("בודק…");
        try {
            await verifyToken(candidate);
        } catch (err) {
            setConnectMsg(err && err.message && !/Failed to fetch|NetworkError/i.test(err.message)
                ? err.message : "אין חיבור ל-GitHub. נסו שוב.", true);
            els.connectOk.disabled = false;
            return;
        }
        els.connectOk.disabled = false;
        token = candidate;
        store.set(LS_TOKEN, token);
        closeConnect();
        setSync(idleSyncState());
        // סימונים מקומיים שנעשו לפני החיבור לא רלוונטיים יותר
        localDone = {};
        saveLocalDone();
        await poll();
        render();
    });

    els.disconnectBtn.addEventListener("click", () => {
        token = "";
        store.remove(LS_TOKEN);
        closeConnect();
        setSync(idleSyncState());
        render();
    });

    els.connectCancel.addEventListener("click", closeConnect);
    els.connectOverlay.addEventListener("click", (e) => { if (e.target === els.connectOverlay) closeConnect(); });
    els.connectBtn.addEventListener("click", () => openConnect());
    els.tokenInput.addEventListener("keydown", (e) => { if (e.key === "Enter") els.connectOk.click(); });

    /* ---------- עורך חזותי ---------- */

    let draft = [];            // [{ name, items: [{ name, qty, done }] }] – עותק עבודה
    let editorMode = "visual"; // "visual" | "text"

    const cloneData = () =>
        data.map((c) => ({ name: c.name, items: c.items.map((it) => ({ name: it.name, qty: it.qty, done: it.done })) }));

    function setEditMsg(msg, isError) {
        els.editMsg.textContent = msg || "";
        els.editMsg.classList.toggle("error", Boolean(isError));
    }

    function iconButton(label, symbol, className, onClick) {
        const b = el("button", "icon-btn " + (className || ""), symbol);
        b.type = "button";
        b.setAttribute("aria-label", label);
        b.title = label;
        b.addEventListener("click", onClick);
        return b;
    }

    function renderEditor(focusAddFor) {
        const root = els.editorCats;
        root.innerHTML = "";

        if (draft.length === 0) {
            root.appendChild(el("div", "empty", "אין קטגוריות עדיין – הוסיפו אחת למטה."));
        }

        draft.forEach((cat, ci) => {
            const card = el("div", "ed-cat");

            /* כותרת הקטגוריה */
            const head = el("div", "ed-cat-head");
            const nameInput = el("input", "text-input ed-cat-name");
            nameInput.type = "text";
            nameInput.value = cat.name;
            nameInput.maxLength = 40;
            nameInput.setAttribute("aria-label", "שם קטגוריה");
            nameInput.addEventListener("input", () => { cat.name = nameInput.value; });

            const activeCount = () => cat.items.filter((it) => it.qty > 0).length;
            const count = el("span", "ed-count", String(activeCount()));
            count.title = "מוצרים ברשימת הקניות";

            const del = iconButton("מחק קטגוריה", "🗑", "danger", () => {
                if (cat.items.length && !confirm(`למחוק את «${cat.name}» וכל הפריטים בה?`)) return;
                draft.splice(ci, 1);
                renderEditor();
            });
            head.append(nameInput, count, del);
            card.appendChild(head);

            /* פריטים */
            const list = el("div", "ed-items");
            cat.items.forEach((item, ii) => {
                const row = el("div", "ed-item");

                const itemInput = el("input", "text-input ed-item-name");
                itemInput.type = "text";
                itemInput.value = item.name;
                itemInput.maxLength = 60;
                itemInput.setAttribute("aria-label", "שם מוצר");
                itemInput.addEventListener("input", () => { item.name = itemInput.value; });

                // כמות 0 = הפריט נשאר ברשימת כל הפריטים, אבל לא ברשימת הקניות
                row.classList.toggle("zero", item.qty === 0);
                const stepper = makeStepper(item.qty, (q) => {
                    item.qty = q;
                    row.classList.toggle("zero", q === 0);
                    count.textContent = String(activeCount());
                }, 0);

                const rm = iconButton("מחק פריט", "✕", "danger soft", () => {
                    cat.items.splice(ii, 1);
                    renderEditor();
                });

                row.append(itemInput, stepper, rm);
                list.appendChild(row);
            });
            card.appendChild(list);


            root.appendChild(card);
        });

        if (focusAddFor !== undefined) {
            const target = root.querySelector(`.ed-add input[data-cat="${focusAddFor}"]`);
            if (target) target.focus();
        }
    }

    const NEW_CATEGORY_VALUE = "__new_category__";

    function openAddItemDialog() {
        els.addItemCategory.innerHTML = "";
        draft.forEach((cat, index) => {
            const option = el("option", "", cat.name);
            option.value = String(index);
            els.addItemCategory.appendChild(option);
        });
        const newOption = el("option", "", "＋ יצירת קטגוריה חדשה…");
        newOption.value = NEW_CATEGORY_VALUE;
        els.addItemCategory.appendChild(newOption);
        els.addNewCategoryField.classList.toggle("hidden", els.addItemCategory.value !== NEW_CATEGORY_VALUE);
        els.addItemName.value = "";
        els.addNewCategoryName.value = "";
        els.addItemMsg.textContent = "";
        els.addItemOverlay.classList.remove("hidden");
        setTimeout(() => els.addItemName.focus(), 0);
    }

    els.openAddItemBtn.addEventListener("click", openAddItemDialog);
    els.addItemCategory.addEventListener("change", () => {
        const isNew = els.addItemCategory.value === NEW_CATEGORY_VALUE;
        els.addNewCategoryField.classList.toggle("hidden", !isNew);
        if (isNew) els.addNewCategoryName.focus();
    });
    const closeAddItemDialog = () => els.addItemOverlay.classList.add("hidden");
    els.addItemCancel.addEventListener("click", closeAddItemDialog);
    els.addItemOverlay.addEventListener("click", (event) => {
        if (event.target === els.addItemOverlay) closeAddItemDialog();
    });
    els.addItemConfirm.addEventListener("click", () => {
        const parts = els.addItemName.value.split(/[,،]/).map((part) => part.trim()).filter(Boolean);
        if (!parts.length) {
            els.addItemMsg.textContent = "יש להזין שם מוצר.";
            return;
        }
        let category;
        if (els.addItemCategory.value === NEW_CATEGORY_VALUE) {
            const name = cleanName(els.addNewCategoryName.value);
            if (!name) {
                els.addItemMsg.textContent = "יש להזין שם לקטגוריה החדשה.";
                return;
            }
            category = draft.find((cat) => cleanName(cat.name) === name);
            if (!category) {
                category = { name, items: [] };
                draft.push(category);
            }
        } else {
            category = draft[Number(els.addItemCategory.value)];
        }
        if (!category) {
            els.addItemMsg.textContent = "יש לבחור קטגוריה.";
            return;
        }
        parts.forEach((part) => {
            const parsed = parseItem(part);
            const name = cleanName(parsed.name);
            if (name && !category.items.some((item) => cleanName(item.name) === name)) {
                category.items.push({ name, qty: parsed.qty, done: false });
            }
        });
        renderEditor(draft.indexOf(category));
        closeAddItemDialog();
    });
    els.addItemName.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); els.addItemConfirm.click(); }
    });
    els.addNewCategoryName.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); els.addItemConfirm.click(); }
    });

    function addCategory() {
        const name = cleanName(els.newCatInput.value);
        if (!name) return;
        if (draft.some((c) => cleanName(c.name) === name)) {
            setEditMsg("קטגוריה בשם הזה כבר קיימת.", true);
            return;
        }
        setEditMsg("");
        draft.push({ name, items: [] });
        els.newCatInput.value = "";
        renderEditor(draft.length - 1);
        const cards = els.editorCats.querySelectorAll(".ed-cat");
        if (cards.length) cards[cards.length - 1].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    els.newCatBtn.addEventListener("click", addCategory);
    els.newCatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); addCategory(); }
    });

    /* ---------- טאבים: חזותי / טקסט ---------- */

    const hasContent = (text) => text.replace(/^\s*#.*$/gm, "").trim() !== "";

    function setMode(mode) {
        if (mode === editorMode) return true;

        if (mode === "text") {
            els.editorAddBar.classList.add("hidden");
            els.editText.value = serializeCombined(draft);
        } else {
            els.editorAddBar.classList.remove("hidden");
            const text = els.editText.value;
            const parsed = parseList(text);
            if (parsed.length === 0 && hasContent(text)) {
                setEditMsg("לא נמצאה אף שורה במבנה «קטגוריה: מוצר, מוצר».", true);
                return false;
            }
            draft = parsed;
            renderEditor();
        }

        editorMode = mode;
        setEditMsg("");
        els.visualPane.classList.toggle("hidden", mode !== "visual");
        els.textPane.classList.toggle("hidden", mode !== "text");
        els.tabVisual.classList.toggle("active", mode === "visual");
        els.tabText.classList.toggle("active", mode === "text");
        return true;
    }

    els.tabVisual.addEventListener("click", () => setMode("visual"));
    els.tabText.addEventListener("click", () => setMode("text"));

    /* ---------- פתיחה / שמירה ---------- */

    async function openEdit() {
        if (!canWrite()) {
            openConnect(CFG.repo
                ? "כדי לערוך את הרשימה צריך להתחבר ל-GitHub (פעם אחת)."
                : "");
            return;
        }

        await flushNow();
        draft = cloneData();
        editorOpen = true;
        editorMode = "visual";
        els.visualPane.classList.remove("hidden");
        els.textPane.classList.add("hidden");
        els.editorAddBar.classList.remove("hidden");
        els.tabVisual.classList.add("active");
        els.tabText.classList.remove("active");
        els.newCatInput.value = "";
        els.editSave.disabled = false;
        setEditMsg("");
        renderEditor();
        els.editOverlay.classList.remove("hidden");
    }

    function closeEdit() {
        editorOpen = false;
        els.editOverlay.classList.add("hidden");
    }

    els.editBtn.addEventListener("click", openEdit);
    els.editCancel.addEventListener("click", closeEdit);
    els.editOverlay.addEventListener("click", (e) => { if (e.target === els.editOverlay) closeEdit(); });

    els.editSave.addEventListener("click", async () => {
        let cats;
        if (editorMode === "visual") {
            cats = draft;
        } else {
            els.editorAddBar.classList.remove("hidden");
            const text = els.editText.value;
            cats = parseList(text);
            if (cats.length === 0 && hasContent(text)) {
                setEditMsg("לא נמצאה אף שורה במבנה «קטגוריה: מוצר, מוצר».", true);
                return;
            }
        }

        const itemsText = serializeCatalog(cats);
        const listText = serializeShopping(cats);

        els.editSave.disabled = true;
        setEditMsg("שומר ב-GitHub…");
        setSync("saving");
        try {
            const items = await saveWholeFile(ITEMS_FILE, itemsText, "עדכון רשימת פריטים");
            const list = await saveWholeFile(SHOPPING_FILE, listText, "עדכון רשימת קניות");
            known = { list, items };
            loadedFrom = "github";
            saveCache();
            rebuild();
            setSync(idleSyncState());
            closeEdit();
            render();
        } catch (err) {
            console.log("Editor save failed:", err);
            setEditMsg(errText(err), true);
            setSync(idleSyncState());
            els.editSave.disabled = false;
        }
    });

    /* ---------- אתחול ---------- */

    async function init() {
        loadLocalState();
        setSync("connecting");
        keepScreenOn();

        await loadAll();
        rebuild();
        render();
        setSync(idleSyncState());

        setInterval(poll, CFG.syncMs);
    }

    init();
}
