(() => {
  // scripts/calendar-view.mjs
  var iso = (date2) => date2.toISOString().slice(0, 10);
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw Error("Invalid calendar date");
    const parsed = /* @__PURE__ */ new Date(value + "T00:00:00Z");
    if (!Number.isFinite(+parsed) || iso(parsed) !== value) throw Error("Invalid calendar date");
    return parsed;
  }
  function calendarPeriod(value, view = "day") {
    const start = date(value);
    if (!["day", "month", "list"].includes(view)) throw Error("Unknown calendar view");
    if (view === "month") start.setUTCDate(1);
    const end = new Date(start);
    if (view === "month") {
      end.setUTCMonth(end.getUTCMonth() + 1);
      end.setUTCDate(0);
    }
    return { start: iso(start), end: view === "list" ? null : iso(end) };
  }
  function shiftCalendarDate(value, view, direction) {
    if (![-1, 1].includes(direction)) throw Error("Invalid calendar direction");
    const period = calendarPeriod(value, view), next = date(period.start);
    if (view === "month") next.setUTCMonth(next.getUTCMonth() + direction);
    else next.setUTCDate(next.getUTCDate() + direction);
    return iso(next);
  }
  function calendarView(manifest, { date: day, view = "day", query = "" } = {}) {
    if (manifest?.schema !== "website-cloner-calendar/v1" || !Array.isArray(manifest.events)) throw Error("Invalid calendar manifest");
    const period = calendarPeriod(day, view), needle = String(query).trim().toLocaleLowerCase();
    return manifest.events.filter((event) => {
      const start = event.start.slice(0, 10), end = date(event.end.slice(0, 10));
      date(start);
      if (!event.allDay && event.end.slice(11) === "00:00:00" && event.end > event.start) end.setUTCDate(end.getUTCDate() - 1);
      return iso(end) >= period.start && (!period.end || start <= period.end) && (!needle || [event.title, event.description, event.venue].join(" ").toLocaleLowerCase().includes(needle));
    }).sort((a, b) => a.start.localeCompare(b.start) || a.route.localeCompare(b.route));
  }
  function calendarMonthGrid(manifest, value, weekStartsOn = 0) {
    if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) throw Error("Invalid calendar week start");
    const period = calendarPeriod(value, "month"), first = date(period.start), last = date(period.end);
    first.setUTCDate(first.getUTCDate() - (first.getUTCDay() - weekStartsOn + 7) % 7);
    last.setUTCDate(last.getUTCDate() + (weekStartsOn + 6 - last.getUTCDay() + 7) % 7);
    const intervals = manifest.events.map((event) => {
      const start = event.start.slice(0, 10), end = date(event.end.slice(0, 10));
      date(start);
      if (!event.allDay && event.end.slice(11) === "00:00:00" && event.end > event.start) end.setUTCDate(end.getUTCDate() - 1);
      return { event, start, end: iso(end) };
    }).filter((e) => e.end >= iso(first) && e.start <= iso(last)).sort((a, b) => a.event.start.localeCompare(b.event.start) || a.event.route.localeCompare(b.event.route));
    const weeks = [];
    for (let current = new Date(first); current <= last; current.setUTCDate(current.getUTCDate() + 1)) {
      if (!weeks.length || weeks.at(-1).length === 7) weeks.push([]);
      const column = weeks.at(-1).length, day = iso(current);
      weeks.at(-1).push({ date: day, inMonth: day.slice(0, 7) === period.start.slice(0, 7), events: intervals.filter((e) => e.start <= day && e.end >= day).map(({ event, start, end }) => ({ event, multiday: event.allDay || end > start, display: start === day || column === 0, width: Math.min(7 - column, Math.round((+date(end) - +current) / 864e5) + 1), startsHere: start === day, endsThisWeek: end <= iso(new Date(+current + (6 - column) * 864e5)) })) });
    }
    return weeks;
  }

  // scripts/event-presentation.mjs
  var pad = (n) => String(n).padStart(2, "0");
  var localStamp = (date2) => date2.toISOString().slice(0, 19).replace("T", " ");
  function parse(value) {
    const text = String(value || "").replace("T", " ").replace(/Z$/, "");
    if (!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(text)) throw Error("Invalid event date");
    const date2 = /* @__PURE__ */ new Date(text.slice(0, 10) + "T" + (text.slice(11) || "00:00:00") + "Z");
    if (!Number.isFinite(+date2) || localStamp(date2) !== (text.length === 10 ? text + " 00:00:00" : text)) throw Error("Invalid event date");
    return date2;
  }
  var dates = ["MMMM d, yyyy", "d MMMM yyyy", "MMMM d yyyy", "MMM d, yyyy", "d MMM yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "d/M/yyyy", "M/d/yyyy", "dd.MM.yyyy", "MMMM yyyy", "MMM yyyy", "M/yyyy", "MM/yyyy", "yyyy/MM", "EEE", "EEEE", "d", "dd"];
  var times = ["h:mm a", "h:mm A", "hh:mm a", "HH:mm", "H:mm", "HH:mm:ss", "h a", "h A"];
  var formatPartsCache = /* @__PURE__ */ new Map();
  function format(value, pattern, locale = "en") {
    const key = value + "\0" + locale;
    let parts = formatPartsCache.get(key);
    if (!parts) {
      const d = parse(value), hour = d.getUTCHours(), period = new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", hour12: true }).formatToParts(d).find((p) => p.type === "dayPeriod")?.value || (hour < 12 ? "am" : "pm"), intl = (options) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(d);
      parts = { yyyy: String(d.getUTCFullYear()), yy: pad(d.getUTCFullYear() % 100), MMMM: intl({ month: "long" }), MMM: intl({ month: "short" }), MM: pad(d.getUTCMonth() + 1), M: String(d.getUTCMonth() + 1), dd: pad(d.getUTCDate()), d: String(d.getUTCDate()), EEEE: intl({ weekday: "long" }), EEE: intl({ weekday: "short" }), HH: pad(hour), H: String(hour), hh: pad(hour % 12 || 12), h: String(hour % 12 || 12), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()), a: period.toLocaleLowerCase(locale), A: period.toLocaleUpperCase(locale) };
      formatPartsCache.set(key, parts);
      if (formatPartsCache.size > 256) formatPartsCache.delete(formatPartsCache.keys().next().value);
    }
    return pattern.replace(/\[[^\]]*\]|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a|A/g, (t) => t.startsWith("[") ? t.slice(1, -1) : parts[t]);
  }
  function eventFormat(text, value, locale = "en") {
    const normalized = String(text).replace(/\s+/g, " ").trim();
    const numeric = /^(\d{1,2})([/.])(\d{1,2})\2\d{4}(?:\b|$)/.exec(normalized);
    if (numeric && Number(numeric[1]) === Number(numeric[3])) return null;
    for (const date2 of dates) {
      if (format(value, date2, locale) === normalized) return { date: date2, time: null, separator: "" };
      for (const time of times) for (const separator of [" @ ", " at ", " ", " \u2013 ", ", "]) if (format(value, date2, locale) + separator + format(value, time, locale) === normalized) return { date: date2, time, separator };
    }
    for (const time of times) if (format(value, time, locale) === normalized) return { date: null, time, separator: "" };
    return null;
  }
  function formatEventValue(value, spec, locale = "en", mode = "both") {
    if (!spec) throw Error("Source event date format could not be inferred");
    const date2 = spec.date && mode !== "time" ? format(value, spec.date, locale) : "", time = spec.time && mode !== "date" ? format(value, spec.time, locale) : "";
    return date2 + (date2 && time ? spec.separator : "") + time;
  }

  // scripts/calendar-list.mjs
  function calendarListPage(manifest, date2, pageSize, page = 1) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1e3) throw Error("Calendar page size is unavailable");
    if (!Number.isInteger(page) || page < 1 || page > 1e6) throw Error("Invalid calendar page");
    const all = calendarView(manifest, { date: date2, view: "list" }), pages = Math.max(1, Math.ceil(all.length / pageSize));
    page = Math.min(page, pages);
    const entries = all.slice((page - 1) * pageSize, page * pageSize), first = page === 1 ? date2 : entries[0]?.start.slice(0, 10) || date2, start = first < date2 ? date2 : first, last = entries.at(-1)?.start.slice(0, 10) || date2, end = last < start ? date2 : last;
    return { entries, page, pages, total: all.length, hasPrevious: page > 1, hasNext: page < pages, start, end, showEnd: page < pages && new Set(entries.map((e) => e.start.slice(0, 10))).size > 1 && start !== end };
  }
  function renderListHeading(button, definition, state, { fragment: fragment2, locale = "en", today } = {}) {
    if (!button) return;
    if (!definition?.time || !definition?.formats || !state.hasNext && !definition.fallback) throw Error("Calendar list heading templates are unavailable");
    const useNow = state.hasNext && state.page === 1 && state.start === today && definition.nowTime;
    const time = fragment2(state.hasNext ? useNow || definition.time : definition.fallback).firstElementChild;
    time.setAttribute("datetime", state.start);
    if (state.hasNext && !useNow) for (const [i, span] of [...time.querySelectorAll("span")].entries()) {
      if (!definition.formats[i]) throw Error("Calendar list date format is unavailable");
      span.textContent = formatEventValue(state.start, definition.formats[i], locale);
    }
    const nodes = [time];
    if (state.showEnd) {
      if (!definition.separator || !definition.endTime) throw Error("Calendar list range template is unavailable");
      nodes.push(fragment2(definition.separator));
      const end = fragment2(definition.endTime).firstElementChild;
      end.setAttribute("datetime", state.end);
      for (const [i, span] of [...end.querySelectorAll("span")].entries()) {
        const spec = definition.endFormats?.[i] || definition.formats[i];
        if (!spec) throw Error("Calendar list range format is unavailable");
        span.textContent = formatEventValue(state.end, spec, locale);
      }
      nodes.push(end);
    }
    button.querySelectorAll(".tribe-events-c-top-bar__datepicker-time,.tribe-events-c-top-bar__datepicker-separator").forEach((n) => n.remove());
    button.prepend(...nodes);
  }
  function renderListNavigation(root, state, date2, onSelect) {
    for (const [selector, enabled, page] of [[".tribe-events-c-nav__prev", state.hasPrevious, state.page - 1], [".tribe-events-c-nav__next", state.hasNext, state.page + 1]]) for (const old of root.querySelectorAll(selector)) {
      const next = document.createElement(enabled ? "a" : "button");
      for (const attr of old.attributes) if (!/^(href|disabled|aria-disabled|data-migration-unavailable|data-calendar-page|type|rel)$/i.test(attr.name) && !/^on/i.test(attr.name)) next.setAttribute(attr.name, attr.value);
      next.innerHTML = old.innerHTML;
      if (enabled) {
        const url = new URL(location.href);
        url.searchParams.set("calendar-date", date2);
        url.searchParams.set("calendar-page", String(page));
        next.href = url.href;
        next.rel = page > state.page ? "next" : "prev";
        next.dataset.calendarPage = String(page);
        next.addEventListener("click", (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          onSelect(page);
        });
      } else {
        next.type = "button";
        next.disabled = true;
      }
      old.replaceWith(next);
    }
  }

  // scripts/calendar-clock.mjs
  function calendarClock(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const zone = value.timeZone ?? value.timezone_string;
    if (typeof zone === "string" && zone.length > 0 && zone.length <= 100) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return { timeZone: zone };
      } catch {
      }
    }
    const offset = value.offsetMinutes ?? (typeof value.gmt_offset === "number" ? value.gmt_offset * 60 : void 0);
    if (Number.isInteger(offset) && Math.abs(offset) <= 14 * 60) return { offsetMinutes: offset };
    return null;
  }
  function calendarToday(value, now = /* @__PURE__ */ new Date()) {
    const clock = calendarClock(value);
    if (clock?.timeZone) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: clock.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
      return `${parts.year}-${parts.month}-${parts.day}`;
    }
    if (clock) return new Date(now.valueOf() + clock.offsetMinutes * 6e4).toISOString().slice(0, 10);
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  }

  // scripts/calendar-picker.mjs
  function calendarPicker({ root, button, input, view, locale, getDate, onSelect, data, fragment: fragment2 }) {
    const container = root.querySelector('[data-js="tribe-events-top-bar-datepicker-container"]');
    if (!container) return false;
    let popup, selected, cursor, mode, weekStart, request = 0, loading = false;
    let clock;
    try {
      clock = JSON.parse(root.getAttribute("data-migration-calendar-clock"));
    } catch {
    }
    const date2 = (value) => /* @__PURE__ */ new Date(value + "T00:00:00Z"), iso2 = (value) => value.toISOString().slice(0, 10), format2 = (value, options) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(value);
    const node = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text !== void 0) el.textContent = text;
      return el;
    };
    const control = (cls, text, action, label = text) => {
      const b = node("button", cls, text);
      b.type = "button";
      if (label) b.setAttribute("aria-label", label);
      b.addEventListener("click", action);
      return b;
    };
    const close = (focus = true) => {
      request++;
      loading = false;
      button.removeAttribute("aria-busy");
      popup?.remove();
      popup = null;
      button.classList.remove("tribe-events-c-top-bar__datepicker-button--open");
      button.setAttribute("aria-expanded", "false");
      input.hidden = true;
      if (focus) button.focus();
    };
    function choose(value) {
      close();
      onSelect(value);
    }
    function paint(focus = false) {
      popup.replaceChildren();
      const section = node("div", "datepicker-" + ["days", "months", "years"][mode]), table = node("table", "table-condensed");
      table.setAttribute("role", "grid");
      section.append(table);
      popup.append(section);
      const head = node("thead"), row = node("tr"), body = node("tbody");
      table.append(head, body);
      head.append(row);
      const shift = (direction) => {
        if (mode === 0) cursor.setUTCMonth(cursor.getUTCMonth() + direction);
        else cursor.setUTCFullYear(cursor.getUTCFullYear() + direction * (mode === 2 ? 10 : 1));
        paint(true);
      };
      for (const direction of [-1, 0, 1]) {
        const th = node("th");
        row.append(th);
        let b;
        if (!direction) {
          th.colSpan = 5;
          const year = cursor.getUTCFullYear(), title = mode === 0 ? format2(cursor, { month: "long", year: "numeric" }) : mode === 1 ? String(year) : Math.floor(year / 10) * 10 + "-" + (Math.floor(year / 10) * 10 + 9);
          b = control("datepicker-switch", title, () => {
            if (mode < 2) {
              mode++;
              paint(true);
            }
          });
          if (mode === 2) b.setAttribute("aria-disabled", "true");
        } else {
          b = control(direction < 0 ? "prev" : "next", "", () => shift(direction), direction < 0 ? "Previous" : "Next");
          const svg = root.querySelector(".tribe-events-c-top-bar__nav-link--" + (direction < 0 ? "prev" : "next") + " svg");
          if (svg) {
            const icon = fragment2(svg.outerHTML).firstElementChild;
            icon.setAttribute("class", "tribe-common-c-svgicon tribe-events-c-top-bar__datepicker-nav-icon-svg");
            b.append(icon);
          } else b.textContent = direction < 0 ? "\u2039" : "\u203A";
        }
        th.append(b);
      }
      const todayValue = calendarToday(clock);
      const state = (b, value, precision) => {
        const key = value.slice(0, precision), current = todayValue.slice(0, precision);
        if (key < current) b.classList.add("past");
        else if (key === current) b.classList.add("current");
        if (key === selected.slice(0, precision)) {
          b.classList.add("active");
          b.setAttribute("aria-selected", "true");
          if (mode) b.classList.add("focused");
        }
      };
      if (mode === 0) {
        const headings = node("tr");
        head.append(headings);
        for (let i = 0; i < 7; i++) {
          const day = new Date(Date.UTC(2024, 0, 7 + (weekStart + i) % 7)), name = format2(day, { weekday: "long" }), th = node("th", "dow");
          th.scope = "col";
          th.title = name;
          th.setAttribute("aria-label", name);
          const abbr = node("abbr", "", format2(day, { weekday: "narrow" }));
          abbr.title = name;
          th.append(abbr);
          headings.append(th);
        }
        const start = new Date(cursor);
        start.setUTCDate(0);
        start.setUTCDate(start.getUTCDate() - (start.getUTCDay() - weekStart + 7) % 7);
        let tr;
        for (let i = 0; i < 42; i++) {
          if (i % 7 === 0) {
            tr = node("tr");
            body.append(tr);
          }
          const d = new Date(start);
          d.setUTCDate(d.getUTCDate() + i);
          const value = iso2(d), td = node("td"), b = control("day", String(d.getUTCDate()), () => choose(value), format2(d, { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
          b.dataset.date = String(+d);
          if (value.slice(0, 7) < iso2(cursor).slice(0, 7)) b.classList.add("old");
          else if (value.slice(0, 7) > iso2(cursor).slice(0, 7)) b.classList.add("new");
          state(b, value, 10);
          td.append(b);
          tr.append(td);
        }
      } else {
        const tr = node("tr"), td = node("td"), grid = node("div", "datepicker-grid");
        td.colSpan = 7;
        td.append(grid);
        tr.append(td);
        body.append(tr);
        const y = cursor.getUTCFullYear(), first = mode === 1 ? 0 : Math.floor(y / 10) * 10 - 1;
        for (let i = 0; i < 12; i++) {
          const d = new Date(Date.UTC(mode === 1 ? y : first + i, mode === 1 ? i : 0, 1)), value = iso2(d), b = control(mode === 1 ? "month" : "year", mode === 1 ? format2(d, { month: "short" }) : String(d.getUTCFullYear()), () => {
            cursor = d;
            if (mode === 1 && view === "month") choose(value);
            else {
              mode--;
              paint(true);
            }
          }, mode === 1 ? format2(d, { month: "long", year: "numeric" }) : String(d.getUTCFullYear()));
          state(b, value, mode === 1 ? 7 : 4);
          if (mode === 2 && i === 0) b.classList.add("old");
          if (mode === 2 && i === 11) b.classList.add("new");
          grid.append(b);
        }
      }
      if (focus) (popup.querySelector("[aria-selected=true]") || popup.querySelector(".datepicker-switch")).focus({ preventScroll: true });
    }
    async function open() {
      const ticket = ++request;
      loading = true;
      button.setAttribute("aria-busy", "true");
      try {
        const { presentation } = await data();
        if (ticket !== request) return;
        const configured = root.getAttribute("data-migration-calendar-week-start");
        weekStart = /^[0-6]$/.test(configured ?? "") ? Number(configured) : presentation.weekStartsOn;
        if (!Number.isInteger(weekStart) || weekStart < 0 || weekStart > 6) throw Error("Calendar week start is unavailable");
        selected = getDate();
        calendarPeriod(selected);
        cursor = date2(selected);
        cursor.setUTCDate(1);
        mode = view === "month" ? 1 : 0;
        loading = false;
        button.removeAttribute("aria-busy");
        popup = node("div", "datepicker datepicker-dropdown dropdown-menu datepicker-orient-left datepicker-orient-bottom");
        popup.setAttribute("role", "dialog");
        popup.setAttribute("aria-label", "Calendar");
        popup.id = (input.id || "local-calendar") + "-picker";
        Object.assign(popup.style, { top: "0px", left: "-1px", zIndex: "10", display: "block" });
        container.append(popup);
        button.setAttribute("aria-controls", popup.id);
        button.setAttribute("aria-expanded", "true");
        button.classList.add("tribe-events-c-top-bar__datepicker-button--open");
        paint();
        (popup.querySelector("[aria-selected=true]") || popup.querySelector(".datepicker-switch")).focus({ preventScroll: true });
      } catch {
        if (ticket !== request) return;
        loading = false;
        button.removeAttribute("aria-busy");
        input.hidden = false;
        input.type = "date";
        input.value = getDate();
        input.classList.remove("tribe-common-a11y-visual-hide");
        input.removeAttribute("tabindex");
        button.setAttribute("aria-controls", input.id);
        button.setAttribute("aria-expanded", "true");
        input.focus();
      }
    }
    input.hidden = true;
    input.type = "date";
    input.value = getDate();
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      if (loading || popup || button.getAttribute("aria-expanded") === "true") close();
      else open();
    });
    input.addEventListener("change", () => choose(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
    container.addEventListener("keydown", (e) => {
      if (!popup) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      const cells = [...popup.querySelectorAll(".day,.month,.year")], index = cells.indexOf(document.activeElement), columns = mode === 0 ? 7 : 4;
      let next;
      if (index < 0) return;
      switch (e.key) {
        case "ArrowLeft":
          next = index - 1;
          break;
        case "ArrowRight":
          next = index + 1;
          break;
        case "ArrowUp":
          next = index - columns;
          break;
        case "ArrowDown":
          next = index + columns;
          break;
        case "Home":
          next = e.ctrlKey ? 0 : index - index % columns;
          break;
        case "End":
          next = e.ctrlKey ? cells.length - 1 : Math.min(cells.length - 1, index - index % columns + columns - 1);
          break;
        default:
          return;
      }
      e.preventDefault();
      cells[Math.max(0, Math.min(cells.length - 1, next))]?.focus();
    });
    document.addEventListener("pointerdown", (e) => {
      if ((popup || loading) && !container.contains(e.target) && !button.contains(e.target)) close(false);
    });
    return true;
  }

  // scripts/calendar-month-renderer.mjs
  function renderCalendarMonth(manifest, presentation, day, { fragment: fragment2, locale = "en", today = calendarToday() } = {}) {
    const weeks = calendarMonthGrid(manifest, day, presentation.weekStartsOn ?? 0), shells = presentation.shells;
    if (!shells.month || !shells.monthCell || !shells.monthMobile || !shells.monthMobileDay) throw Error("Month calendar templates are missing");
    const grid = fragment2(shells.month).firstElementChild, mobile = fragment2(shells.monthMobile).firstElementChild, body = grid.querySelector("tbody");
    const rootId = "calendar-" + day.slice(0, 7), label = (value) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "long" }).format(/* @__PURE__ */ new Date(value + "T00:00:00Z"));
    for (const week of weeks) {
      const row = shells.monthWeek ? fragment2(shells.monthWeek).firstElementChild : document.createElement("tr");
      for (const data of week) {
        const cell = fragment2(data.events.length && shells.monthEventCell ? shells.monthEventCell : shells.monthCell).firstElementChild;
        for (const suffix of ["current", "past", "other-month", "past-month", "next-month"]) cell.classList.remove("tribe-events-calendar-month__day--" + suffix);
        const sourceMonth = today.slice(5, 7), cellMonth = data.date.slice(5, 7);
        for (const [suffix, active] of [["current", data.date === today], ["past", data.date < today], ["other-month", cellMonth !== sourceMonth], ["past-month", cellMonth < sourceMonth], ["next-month", cellMonth > sourceMonth]]) if (active) cell.classList.add("tribe-events-calendar-month__day--" + suffix);
        const id = rootId + "-" + data.date, desktop = cell.querySelector(".tribe-events-calendar-month__day-cell--desktop"), button = cell.querySelector(".tribe-events-calendar-month__day-cell--mobile");
        if (desktop) {
          desktop.id = id;
          cell.setAttribute("aria-labelledby", id);
        }
        for (const time of cell.querySelectorAll("time")) {
          time.setAttribute("datetime", data.date);
          time.textContent = String(Number(data.date.slice(8)));
        }
        for (const text of cell.querySelectorAll(".tribe-common-a11y-visual-hide")) text.textContent = text.textContent.replace(/\d+/, String(data.events.length));
        if (!data.events.length) for (const icon of cell.querySelectorAll(".tribe-events-calendar-month__mobile-events-icon")) icon.remove();
        const panel = fragment2(shells.monthMobileDay).firstElementChild;
        panel.id = id + "-mobile";
        panel.classList.remove("tribe-events-calendar-month-mobile-events__mobile-day--show");
        panel.hidden = data.date !== today;
        panel.tabIndex = -1;
        if (data.date === today) panel.classList.add("tribe-events-calendar-month-mobile-events__mobile-day--show");
        if (button) {
          button.setAttribute("aria-controls", panel.id);
          button.setAttribute("aria-expanded", "false");
          button.setAttribute("aria-label", label(data.date) + ", " + data.events.length + (data.events.length === 1 ? " event" : " events"));
          button.classList.toggle("tribe-events-calendar-month__day-cell--selected", data.date === today);
          button.setAttribute("aria-expanded", String(data.date === today));
          button.dataset.calendarDay = data.date;
          button.addEventListener("click", () => {
            const open = button.getAttribute("aria-expanded") !== "true";
            for (const b of grid.querySelectorAll("[data-calendar-day]")) {
              b.setAttribute("aria-expanded", "false");
              b.classList.remove("tribe-events-calendar-month__day-cell--selected");
            }
            for (const p of mobile.children) {
              p.hidden = true;
              p.classList.remove("tribe-events-calendar-month-mobile-events__mobile-day--show");
            }
            if (open) {
              button.setAttribute("aria-expanded", "true");
              button.classList.add("tribe-events-calendar-month__day-cell--selected");
              panel.hidden = false;
              panel.classList.add("tribe-events-calendar-month-mobile-events__mobile-day--show");
              panel.focus({ preventScroll: true });
            }
          });
          panel.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
              panel.hidden = true;
              panel.classList.remove("tribe-events-calendar-month-mobile-events__mobile-day--show");
              button.setAttribute("aria-expanded", "false");
              button.classList.remove("tribe-events-calendar-month__day-cell--selected");
              button.focus();
            }
          });
        }
        const container = cell.querySelector(".tribe-events-calendar-month__events");
        if (!container) throw Error("Month event container is missing");
        container.replaceChildren();
        for (const item of data.events) {
          const templates = presentation.entries[item.event.route], kind = item.multiday ? "monthMultiday" : "month";
          if (!templates?.[kind] || !templates.monthMobile) throw Error("Month event templates are missing");
          const card = fragment2(templates[kind]).firstElementChild;
          const ids = /* @__PURE__ */ new Map();
          for (const e of card.querySelectorAll("[id]")) {
            const prior = e.id;
            e.id = id + "-" + prior;
            ids.set(prior, e.id);
          }
          for (const e of card.querySelectorAll("[aria-describedby],[data-tooltip-content]")) {
            for (const attr of ["aria-describedby", "data-tooltip-content"]) {
              const value = e.getAttribute(attr);
              if (value) {
                const key = value.replace(/^#/, "");
                if (ids.has(key)) e.setAttribute(attr, (value.startsWith("#") ? "#" : "") + ids.get(key));
              }
            }
          }
          if (item.multiday) {
            for (const c of [...card.classList]) if (/^tribe-events-calendar-month__multiday-event--/.test(c)) card.classList.remove(c);
            card.classList.add("tribe-events-calendar-month__multiday-event--width-" + item.width);
            if (item.display) card.classList.add("tribe-events-calendar-month__multiday-event--display");
            if (item.startsHere) card.classList.add("tribe-events-calendar-month__multiday-event--start");
            if (item.endsThisWeek) card.classList.add("tribe-events-calendar-month__multiday-event--end");
          }
          container.append(card);
          panel.append(fragment2(templates.monthMobile));
        }
        if (!data.events.length) {
          const empty = document.createElement("p");
          empty.textContent = "No events for this date.";
          panel.append(empty);
        }
        row.append(cell);
        mobile.append(panel);
      }
      body.append(row);
    }
    return { grid, mobile };
  }

  // scripts/calendar-runtime.mjs
  var selectors = { list: ".tribe-events-calendar-list", day: ".tribe-events-calendar-day", month: ".tribe-events-calendar-month" };
  function fragment(html) {
    const t = document.createElement("template");
    t.innerHTML = html;
    for (const e of t.content.querySelectorAll("script,iframe,object,embed")) e.remove();
    for (const e of t.content.querySelectorAll("*")) for (const a of [...e.attributes]) if (/^on/i.test(a.name) || /^(href|src)$/i.test(a.name) && /^\s*(?:javascript|data):/i.test(a.value)) e.removeAttribute(a.name);
    return t.content;
  }
  for (const root of document.querySelectorAll("[data-migration-calendar]")) {
    const view = Object.keys(selectors).find((k) => root.querySelector(selectors[k]));
    if (!view) continue;
    const locale = document.documentElement.lang || "en", button = root.querySelector(".tribe-events-c-top-bar__datepicker-button"), input = root.querySelector('[data-js="tribe-events-top-bar-date"]');
    let listConfig;
    try {
      listConfig = JSON.parse(root.getAttribute("data-migration-calendar-list"));
    } catch {
    }
    let clock;
    try {
      clock = JSON.parse(root.getAttribute("data-migration-calendar-clock"));
    } catch {
    }
    let day = root.querySelector(".tribe-events-c-top-bar__datepicker-time")?.getAttribute("datetime")?.slice(0, 10) || calendarToday(clock), pending, version = 0;
    if (view === "month" && /^\d{4}-\d{2}$/.test(day)) day += "-01";
    const todayDate = () => {
      const today = calendarToday(clock);
      return view === "month" ? today.slice(0, 7) + "-01" : today;
    };
    const pickerDate = () => view === "list" ? root.querySelector(".tribe-events-c-top-bar__datepicker-time")?.getAttribute("datetime") || day : day;
    const requestedDate = (value) => value === "today" ? todayDate() : value;
    const initialDay = day, initialContent = root.querySelector(selectors[view]).cloneNode(true), initialMobile = root.querySelector(".tribe-events-calendar-month-mobile-events")?.cloneNode(true), initialTime = root.querySelector(".tribe-events-c-top-bar__datepicker-time")?.cloneNode(true);
    const preserveListLabel = view === "list" && root.querySelectorAll(".tribe-events-c-top-bar__datepicker-time").length === 1 && !!root.querySelector(".tribe-events-c-nav__next:disabled");
    const compact = root.getAttribute("data-migration-calendar-compact-format"), labelFormats = [...initialTime?.querySelectorAll("span") || []].map((span) => {
      const text = span.textContent.replace(/\s+/g, " ").trim();
      if (compact && view !== "month" && span.classList.contains("tribe-events-c-top-bar__datepicker-mobile")) {
        const spec = { date: compact, time: null, separator: "" };
        try {
          if (formatEventValue(initialDay, spec, locale) === text) return spec;
        } catch {
        }
      }
      return eventFormat(text, initialDay, locale) || (preserveListLabel && !/\p{N}/u.test(text) ? { literal: text } : null);
    });
    const navigation = [];
    const updateLinks = () => {
      for (const a of root.querySelectorAll("a[data-calendar-view-route]")) {
        const url = new URL(a.dataset.calendarViewRoute, location.href);
        if (url.origin === location.origin) {
          url.searchParams.set("calendar-date", day);
          a.href = url.href;
        }
      }
      for (const { a, direction } of navigation) {
        const url = new URL(location.href);
        url.searchParams.set("calendar-date", shiftCalendarDate(day, view, direction));
        a.href = url.href;
      }
    };
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.hidden = true;
    root.append(status);
    async function data() {
      if (!pending) pending = (async () => {
        const url = new URL(root.dataset.migrationCalendar, location.href);
        if (url.origin !== location.origin) throw Error("Calendar data must be local");
        const urls = [url.href, url.href.replace(/\.json$/, ".presentation.json")];
        const [manifest, presentation] = await Promise.all(urls.map(async (u) => {
          const r = await fetch(u, { credentials: "same-origin" });
          if (!r.ok) throw Error("Calendar data unavailable");
          return r.json();
        }));
        if (presentation.schema !== "website-cloner-calendar-presentation/v1") throw Error("Invalid calendar presentation");
        return { manifest, presentation };
      })().catch((e) => {
        pending = null;
        throw e;
      });
      return pending;
    }
    const label = (value, options) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(/* @__PURE__ */ new Date(value.replace(" ", "T") + "Z"));
    async function render(next, push = true, requestedPage2 = 1) {
      const ticket = ++version;
      try {
        calendarPeriod(next, view);
        root.setAttribute("aria-busy", "true");
        const { manifest, presentation } = await data();
        if (ticket !== version) return;
        if (view === "list" && listConfig && presentation.paginationIssues?.length) throw Error("Calendar list page sizes conflict across source captures");
        const list = view === "list" && listConfig && presentation.listPagination ? calendarListPage(manifest, next, presentation.listPagination.pageSize, requestedPage2) : null;
        const entries = list ? list.entries : calendarView(manifest, { date: next, view }), shell = presentation.shells[view];
        if (!shell || view !== "month" && entries.some((e) => !presentation.entries[e.route]?.[view])) throw Error("This calendar view needs missing event templates");
        const month = view === "month" ? renderCalendarMonth(manifest, presentation, next, { fragment, locale, today: calendarToday(clock) }) : null;
        const replacement = month ? month.grid : fragment(shell).firstElementChild;
        let lastGroup;
        for (const event of view === "month" ? [] : entries) {
          const group = view === "list" ? event.start.slice(0, 7) : event.allDay ? "all-day" : event.start.slice(0, 10) < next ? "ongoing" : event.start.slice(11, 16);
          if (group !== lastGroup) {
            const kind = view === "list" ? "listGroup" : event.allDay ? "dayAllDayGroup" : event.start.slice(0, 10) < next ? "dayOngoingGroup" : "dayGroup", markup = presentation.shells[kind];
            if (markup) {
              const heading = fragment(markup), time2 = heading.querySelector("time");
              if (time2) {
                time2.textContent = presentation.formats?.[kind] ? formatEventValue(event.start, presentation.formats[kind], locale) : view === "list" ? label(event.start, { month: "long", year: "numeric" }) : label(event.start, { hour: "numeric", minute: "2-digit", hour12: /am|pm/i.test(time2.textContent) });
                time2.setAttribute("datetime", view === "list" ? event.start.slice(0, 7) : event.start.slice(11, 16));
              }
              replacement.append(heading);
            }
            lastGroup = group;
          }
          replacement.append(fragment(presentation.entries[event.route][view]));
        }
        if (list) renderListHeading(button, presentation.listPagination.heading, list, { fragment, locale, today: calendarToday(clock) });
        root.querySelector(selectors[view]).replaceWith(replacement);
        if (month) root.querySelector(".tribe-events-calendar-month-mobile-events")?.replaceWith(month.mobile);
        day = next;
        const time = root.querySelector(".tribe-events-c-top-bar__datepicker-time");
        if (time && !list) {
          time.setAttribute("datetime", day);
          for (const [index, span] of [...time.querySelectorAll("span")].entries()) span.textContent = labelFormats[index]?.literal ?? (labelFormats[index] ? formatEventValue(day, labelFormats[index], locale) : label(day + " 00:00:00", view === "month" ? { month: "long", year: "numeric" } : { month: "long", day: "numeric", year: "numeric" }));
        }
        if (list) {
          renderListNavigation(root, list, day, (page) => render(day, true, page));
        }
        if (input) input.value = pickerDate();
        updateLinks();
        status.classList.add("tribe-common-a11y-visual-hide");
        status.hidden = false;
        status.textContent = entries.length ? `${entries.length} events` : "No events for this date.";
        if (push) {
          const url = new URL(location.href);
          url.searchParams.set("calendar-date", day);
          if (list && list.page > 1) url.searchParams.set("calendar-page", String(list.page));
          else url.searchParams.delete("calendar-page");
          if (url.href !== location.href) history.pushState({}, "", url);
        }
      } catch (error) {
        if (ticket === version) {
          status.classList.remove("tribe-common-a11y-visual-hide");
          status.hidden = false;
          status.textContent = error.message;
        }
      } finally {
        if (ticket === version) root.removeAttribute("aria-busy");
      }
    }
    if (button && input && !calendarPicker({ root, button, input, view, locale, getDate: pickerDate, onSelect: render, data, fragment })) {
      input.type = "date";
      input.value = pickerDate();
      input.removeAttribute("tabindex");
      input.classList.remove("tribe-common-a11y-visual-hide");
      input.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", input.id);
      button.addEventListener("click", () => {
        input.hidden = !input.hidden;
        button.setAttribute("aria-expanded", String(!input.hidden));
        if (!input.hidden) input.focus();
      });
      input.addEventListener("change", () => {
        const next = input.value;
        input.hidden = true;
        button.setAttribute("aria-expanded", "false");
        button.focus();
        render(next);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          input.hidden = true;
          button.setAttribute("aria-expanded", "false");
          button.focus();
        }
      });
    }
    if (view === "day" || view === "month") for (const a of root.querySelectorAll(".tribe-events-c-top-bar__nav-link,.tribe-events-c-nav__next,.tribe-events-c-nav__prev")) {
      const direction = a.matches('[class*="--next"],.tribe-events-c-nav__next') ? 1 : -1;
      a.removeAttribute("aria-disabled");
      a.removeAttribute("data-migration-unavailable");
      a.href = location.pathname + "?calendar-date=" + shiftCalendarDate(day, view, direction);
      navigation.push({ a, direction });
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        render(shiftCalendarDate(day, view, direction));
      });
    }
    if (view === "month") root.addEventListener("click", async (e) => {
      const button2 = e.target.closest("[data-js=tribe-events-calendar-month-day-cell-mobile]");
      if (!button2 || button2.dataset.calendarDay) return;
      const selected = button2.querySelector("time[datetime]")?.getAttribute("datetime");
      if (selected) {
        await render(day, false);
        root.querySelector('[data-calendar-day="' + selected + '"]')?.click();
      }
    });
    for (const a of root.querySelectorAll("a.tribe-events-c-top-bar__today-button")) {
      const url = new URL(location.href);
      url.searchParams.set("calendar-date", "today");
      url.searchParams.delete("calendar-page");
      a.href = url.href;
      a.removeAttribute("aria-disabled");
      a.removeAttribute("data-migration-unavailable");
      if (a.title === "This destination was not included in this static export.") a.removeAttribute("title");
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        render(todayDate());
      });
    }
    updateLinks();
    const params = new URL(location.href).searchParams, initial = params.get("calendar-date"), requestedPage = () => Number(new URL(location.href).searchParams.get("calendar-page") || "1");
    if (initial || params.has("calendar-page")) render(requestedDate(initial || listConfig?.date || initialDay), false, requestedPage());
    else if (view === "list" && listConfig) render(requestedDate(listConfig.date || initialDay), false, listConfig.page || 1);
    addEventListener("popstate", () => {
      const selected = new URL(location.href).searchParams.get("calendar-date");
      if (selected) render(requestedDate(selected), false, requestedPage());
      else if (view === "list" && listConfig) render(requestedDate(listConfig.date || initialDay), false, listConfig.page || 1);
      else {
        version++;
        day = initialDay;
        root.querySelector(selectors[view]).replaceWith(initialContent.cloneNode(true));
        if (initialMobile) root.querySelector(".tribe-events-calendar-month-mobile-events")?.replaceWith(initialMobile.cloneNode(true));
        const current = root.querySelector(".tribe-events-c-top-bar__datepicker-time");
        if (current && initialTime) current.replaceWith(initialTime.cloneNode(true));
        status.hidden = true;
        root.removeAttribute("aria-busy");
        if (input) input.value = pickerDate();
        updateLinks();
      }
    });
  }
})();
