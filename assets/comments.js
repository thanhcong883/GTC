/* ===========================================================================
   Public annotations — highlight a passage, leave a note.

   The hard part is not the UI. It is the anchor. A comment that stores DOM
   offsets breaks the moment a word is edited anywhere earlier in the page, and
   silently reattaches to the wrong sentence. So an anchor is stored the way the
   W3C Web Annotation model stores one: the quoted text plus a little context on
   each side. On load the quote is searched for again.

   Three outcomes, and the third is the one that matters:
     exact + context match   -> anchored
     exact matches, context moved -> anchored, marked as moved
     quote is gone           -> ORPHANED, shown with what it used to point at

   Admitting a lost anchor is better than pointing at the wrong words.

   Usage, one identical line per page:
     <script defer src="/assets/comments.js" data-page="day20"></script>

   The root defaults to <main> when the page has one and <body> otherwise, so
   the 20 day pages — which use four different layout wrappers between them —
   need no per-page selector. data-root overrides it if a page ever needs that.
   =========================================================================== */
(function () {
  "use strict";

  var script = document.currentScript ||
    document.querySelector('script[src*="comments.js"]');
  var PAGE = (script && script.dataset.page) || "";
  var ROOT_SEL = (script && script.dataset.root) || "";
  if (!PAGE) return;

  var CONTEXT = 40;      // characters of context stored on each side
  var MAX_BODY = 2000;
  var API = "/api/comments";

  var root, state = { comments: [], loading: true, error: null, draft: null };

  /* ---------------------------------------------------------------- styles */
  var CSS = [
    ':root{--cmt-hl:#ffe9b8;--cmt-hl-on:#ffd678}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--cmt-hl:#4a3a17;--cmt-hl-on:#6b5320}}',
    ':root[data-theme="dark"]{--cmt-hl:#4a3a17;--cmt-hl-on:#6b5320}',
    'mark.cmt-hl{background:var(--cmt-hl);color:inherit;border-radius:2px;padding:0 1px;cursor:pointer;',
    '  box-decoration-break:clone;-webkit-box-decoration-break:clone}',
    'mark.cmt-hl:hover,mark.cmt-hl.on{background:var(--cmt-hl-on)}',
    '.cmt-tip{position:absolute;z-index:60;transform:translate(-50%,-100%);',
    '  background:var(--navy,#111a3e);color:#fff;border:0;border-radius:8px;padding:7px 13px;',
    '  font:700 12px var(--mono,monospace);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}',
    '.cmt-tip::after{content:"";position:absolute;left:50%;top:100%;margin-left:-5px;',
    '  border:5px solid transparent;border-top-color:var(--navy,#111a3e)}',
    '.cmt-at{display:block;background:none;border:0;padding:1px 6px;margin:-4px 0 8px;',
    '  border-radius:5px;cursor:pointer;font:600 10px var(--mono,monospace);',
    '  letter-spacing:.04em;color:var(--navy-faint,#8b95b5);opacity:0;',
    '  transition:opacity .15s;white-space:nowrap}',
    'h2:hover + .cmt-at,h3:hover + .cmt-at,.cmt-at:hover,.cmt-at:focus-visible{opacity:1}',
    '.cmt-at:hover{color:var(--orange,#f9660e);background:var(--border-soft,#f0f2f8)}',
    '@media (hover:none){.cmt-at{opacity:.7}}',
    '.cmt-wrap{max-width:820px;margin:56px auto 0;border-top:1px solid var(--border,#e7e9f2);',
    '  padding:30px 20px 0}',
    '.cmt-wrap h2{font-size:20px;letter-spacing:-.02em;margin:0 0 4px}',
    '.cmt-wrap .cmt-dek{color:var(--navy-soft,#5a6488);font-size:14px;margin:0 0 20px;max-width:64ch}',
    '.cmt-form{background:var(--card,#fff);border:1px solid var(--border,#e7e9f2);',
    '  border-radius:13px;padding:16px 18px;margin:0 0 22px}',
    '.cmt-quote{background:var(--cmt-hl);border-radius:7px;padding:9px 12px;margin:0 0 12px;',
    '  font-size:13px;line-height:1.6;color:var(--navy,#111a3e)}',
    '.cmt-quote b{display:block;font:700 9px var(--mono,monospace);letter-spacing:.11em;',
    '  text-transform:uppercase;opacity:.65;margin-bottom:4px}',
    '.cmt-form label{display:block;font:700 9px var(--mono,monospace);letter-spacing:.11em;',
    '  text-transform:uppercase;color:var(--navy-faint,#8b95b5);margin:0 0 5px}',
    '.cmt-form input,.cmt-form textarea{width:100%;padding:9px 11px;border-radius:8px;',
    '  border:1px solid var(--border,#e7e9f2);background:var(--surface-soft,#fbfcff);',
    '  color:var(--navy,#111a3e);font:14px/1.6 inherit;margin:0 0 12px}',
    '.cmt-form textarea{min-height:92px;resize:vertical}',
    '.cmt-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.cmt-btn{padding:9px 17px;border-radius:8px;border:1px solid transparent;cursor:pointer;',
    '  font:700 12.5px var(--mono,monospace)}',
    '.cmt-btn.go{background:var(--orange,#f9660e);color:#fff}',
    '.cmt-btn.go:disabled{opacity:.5;cursor:not-allowed}',
    '.cmt-btn.ghost{background:transparent;border-color:var(--border,#e7e9f2);color:var(--navy-soft,#5a6488)}',
    '.cmt-count{font:700 10px var(--mono,monospace);letter-spacing:.1em;color:var(--navy-faint,#8b95b5)}',
    '.cmt-msg{font-size:13px;margin:10px 0 0}',
    '.cmt-msg.err{color:var(--red,#c64b3e)}',
    '.cmt-msg.ok{color:var(--green,#1e9257)}',
    '.cmt-list{list-style:none;margin:0;padding:0;max-width:none}',
    '.cmt-item{border:1px solid var(--border,#e7e9f2);border-radius:12px;padding:14px 16px;',
    '  margin:0 0 11px;background:var(--card,#fff)}',
    '.cmt-item.on{border-color:var(--orange,#f9660e)}',
    '.cmt-head{display:flex;flex-wrap:wrap;gap:9px;align-items:baseline;margin-bottom:7px}',
    '.cmt-who{font-weight:700;font-size:13.5px}',
    '.cmt-when{font:11px var(--mono,monospace);color:var(--navy-faint,#8b95b5)}',
    '.cmt-flag{font:700 8.5px var(--mono,monospace);letter-spacing:.08em;text-transform:uppercase;',
    '  padding:2px 6px;border-radius:4px}',
    '.cmt-flag.moved{background:var(--amber-soft,#f7edda);color:var(--amber,#b0771a)}',
    '.cmt-flag.orphan{background:var(--red-soft,#f8e6e3);color:var(--red,#c64b3e)}',
    '.cmt-ref{font-size:12.5px;color:var(--navy-soft,#5a6488);border-left:1px solid var(--border,#e7e9f2);',
    '  padding-left:10px;margin:0 0 8px;line-height:1.55}',
    '.cmt-ref button{background:none;border:0;padding:0;color:var(--orange,#f9660e);cursor:pointer;',
    '  font:inherit;text-decoration:underline}',
    '.cmt-body{font-size:14px;line-height:1.65;white-space:pre-wrap;word-wrap:break-word;margin:0}',
    '.cmt-empty{color:var(--navy-faint,#8b95b5);font-size:14px;font-style:italic}'
  ].join("\n");

  /* ------------------------------------------------------- text flattening */
  /* A flat string of the article plus a map back to the text nodes it came
     from. Rebuilt whenever the DOM changes, which is why anchors resolve one
     at a time rather than in a single pass over a stale map. */
  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, SVG: 1, NOSCRIPT: 1, TEMPLATE: 1,
    HEADER: 1, NAV: 1, FOOTER: 1, ASIDE: 1,
    BUTTON: 1, SELECT: 1, TEXTAREA: 1, OPTION: 1
  };

  function flatten(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        while (p && p !== el) {
          if (SKIP_TAGS[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (p.classList && (p.classList.contains("cmt-wrap") ||
                              p.classList.contains("toc") ||
                              p.classList.contains("toc-mobile"))) {
            return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var text = "", nodes = [], n;
    while ((n = walker.nextNode())) {
      nodes.push({ node: n, start: text.length, end: text.length + n.nodeValue.length });
      text += n.nodeValue;
    }
    return { text: text, nodes: nodes };
  }

  function norm(s) { return s.replace(/\s+/g, " ").trim(); }

  /* ------------------------------------------------------ anchor resolution */
  /* Every occurrence of the quote is scored by how much of the stored context
     still surrounds it. The best match wins; a tie on zero context still
     anchors, but is reported as moved rather than silently accepted. */
  function resolve(flat, anchor) {
    var hay = flat.text, needle = anchor.exact;
    if (!needle) return null;

    var hits = [], i = hay.indexOf(needle);
    while (i !== -1) { hits.push(i); i = hay.indexOf(needle, i + 1); }
    if (!hits.length) return null;

    var best = null;
    hits.forEach(function (at) {
      var pre = norm(hay.slice(Math.max(0, at - CONTEXT), at));
      var suf = norm(hay.slice(at + needle.length, at + needle.length + CONTEXT));
      var score = 0;
      if (anchor.prefix && pre.endsWith(norm(anchor.prefix).slice(-CONTEXT))) score += 2;
      if (anchor.suffix && suf.startsWith(norm(anchor.suffix).slice(0, CONTEXT))) score += 2;
      if (!anchor.prefix && !anchor.suffix) score += 1;
      if (!best || score > best.score) best = { at: at, score: score };
    });

    return {
      start: best.at,
      end: best.at + needle.length,
      moved: best.score < 2 && (!!anchor.prefix || !!anchor.suffix),
      ambiguous: hits.length > 1
    };
  }

  function highlight(flat, range, id) {
    flat.nodes.forEach(function (entry) {
      if (entry.end <= range.start || entry.start >= range.end) return;
      var s = Math.max(range.start, entry.start) - entry.start;
      var e = Math.min(range.end, entry.end) - entry.start;
      if (e <= s) return;
      var node = entry.node;
      var tail = s > 0 ? node.splitText(s) : node;
      if (e - s < tail.nodeValue.length) tail.splitText(e - s);
      var mark = document.createElement("mark");
      mark.className = "cmt-hl";
      mark.dataset.cmt = id;
      tail.parentNode.insertBefore(mark, tail);
      mark.appendChild(tail);
    });
  }

  function clearHighlights() {
    root.querySelectorAll("mark.cmt-hl").forEach(function (m) {
      var parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }

  function applyAnchors() {
    clearHighlights();
    state.comments.forEach(function (c) {
      c._state = null;
      if (!c.anchor) return;
      var flat = flatten(root);            // rebuilt per anchor: the DOM just moved
      var hit = resolve(flat, c.anchor);
      if (!hit) { c._state = "orphan"; return; }
      c._state = hit.moved ? "moved" : "anchored";
      highlight(flat, hit, c.id);
    });
  }

  /* ------------------------------------------------- keyboard entry point */
  /* Selecting text is a mouse gesture. Without this, anyone navigating by
     keyboard or screen reader can only leave a general comment, never attach
     one to a passage. Each section heading gets a real <button>, so it is
     reachable by Tab and announced like any other control. */
  /* The heading's own words, with nothing this script added. An earlier version
     read h.textContent while the button lived inside the heading, so the button
     label "bình luận mục này" ended up inside the stored quote — and the anchor
     then pointed at text that exists only because the annotator is running. */
  function ownText(node) {
    var clone = node.cloneNode(true);
    clone.querySelectorAll(".cmt-at").forEach(function (b) { b.remove(); });
    return clone.textContent.trim();
  }

  function anchorForNode(node) {
    var flat = flatten(root);
    var exact = ownText(node);
    if (!exact) return null;
    var at = flat.text.indexOf(exact);
    if (at === -1) {
      var loose = norm(exact);
      at = flat.text.indexOf(loose);
      if (at === -1) return null;
      exact = loose;
    }
    return {
      exact: exact,
      prefix: flat.text.slice(Math.max(0, at - CONTEXT), at),
      suffix: flat.text.slice(at + exact.length, at + exact.length + CONTEXT)
    };
  }

  function addHeadingButtons() {
    root.querySelectorAll("h2, h3").forEach(function (h) {
      if (h.closest(".cmt-wrap")) return;
      if (h.nextElementSibling && h.nextElementSibling.classList.contains("cmt-at")) return;
      var b = el("button", "cmt-at", "bình luận mục này");
      b.type = "button";
      b.setAttribute("aria-label", "Bình luận về mục: " + ownText(h));
      b.addEventListener("click", function () {
        var a = anchorForNode(h);
        if (!a) return;
        state.draft = a;
        renderPanel();
        var box = document.getElementById("cmt-body");
        wrap.scrollIntoView({ behavior: "smooth", block: "start" });
        if (box) box.focus();
      });
      /* Placed after the heading, never inside it, so the heading's text stays
         exactly what the author wrote. */
      h.insertAdjacentElement("afterend", b);
    });
  }

  /* ------------------------------------------------------------ selection */
  var tip = null;

  function killTip() { if (tip) { tip.remove(); tip = null; } }

  function captureSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    var range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;
    var exact = sel.toString();
    if (!exact.trim() || exact.length > 400) return null;

    var flat = flatten(root);
    var offset = -1;
    for (var i = 0; i < flat.nodes.length; i++) {
      if (flat.nodes[i].node === range.startContainer) {
        offset = flat.nodes[i].start + range.startOffset;
        break;
      }
    }
    if (offset === -1) offset = flat.text.indexOf(exact);
    if (offset === -1) return null;

    return {
      exact: exact,
      prefix: flat.text.slice(Math.max(0, offset - CONTEXT), offset),
      suffix: flat.text.slice(offset + exact.length, offset + exact.length + CONTEXT)
    };
  }

  document.addEventListener("mouseup", function (e) {
    if (e.target.closest && e.target.closest(".cmt-wrap")) return;
    setTimeout(function () {
      killTip();
      var anchor = captureSelection();
      if (!anchor) return;
      var rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      tip = document.createElement("button");
      tip.className = "cmt-tip";
      tip.type = "button";
      tip.textContent = "Bình luận đoạn này";
      tip.style.left = rect.left + rect.width / 2 + window.scrollX + "px";
      tip.style.top = rect.top + window.scrollY - 8 + "px";
      tip.addEventListener("click", function () {
        state.draft = anchor;
        killTip();
        renderPanel();
        document.getElementById("cmt-body").focus();
      });
      document.body.appendChild(tip);
    }, 10);
  });

  document.addEventListener("scroll", killTip, { passive: true });

  /* --------------------------------------------------------------- panel */
  function fmt(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
           " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* Every value from the API lands through textContent or a value property.
     Nothing a commenter writes is ever parsed as HTML. */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var wrap;

  function renderPanel() {
    wrap.textContent = "";

    var h = el("h2", null, "Nhận xét");
    var dek = el("p", "cmt-dek",
      "Bôi đen bất kỳ đoạn nào trong bài để gắn nhận xét vào đúng chỗ đó, " +
      "hoặc viết một nhận xét chung ở đây. Ai cũng viết được, và hiện ngay.");
    wrap.appendChild(h);
    wrap.appendChild(dek);

    /* form */
    var form = el("form", "cmt-form");
    if (state.draft) {
      var q = el("div", "cmt-quote");
      q.appendChild(el("b", null, "Đang bình luận về"));
      q.appendChild(document.createTextNode("“" + state.draft.exact + "”"));
      form.appendChild(q);
    }

    var lName = el("label", null, "Tên");
    lName.setAttribute("for", "cmt-name");
    var iName = document.createElement("input");
    iName.id = "cmt-name";
    iName.maxLength = 40;
    iName.placeholder = "Tên bạn (để trống cũng được)";
    iName.value = localStorage.getItem("cmt-name") || "";

    var lBody = el("label", null, "Nhận xét");
    lBody.setAttribute("for", "cmt-body");
    var iBody = document.createElement("textarea");
    iBody.id = "cmt-body";
    iBody.maxLength = MAX_BODY;
    iBody.required = true;
    iBody.placeholder = "Viết nhận xét…";

    form.appendChild(lName); form.appendChild(iName);
    form.appendChild(lBody); form.appendChild(iBody);

    var row = el("div", "cmt-row");
    var send = el("button", "cmt-btn go", "Gửi");
    send.type = "submit";
    row.appendChild(send);
    if (state.draft) {
      var drop = el("button", "cmt-btn ghost", "Bỏ đoạn đã chọn");
      drop.type = "button";
      drop.addEventListener("click", function () { state.draft = null; renderPanel(); });
      row.appendChild(drop);
    }
    row.appendChild(el("span", "cmt-count", state.comments.length + " nhận xét"));
    form.appendChild(row);

    var msg = el("p", "cmt-msg");
    form.appendChild(msg);

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var body = iBody.value.trim();
      if (!body) return;
      send.disabled = true;
      msg.className = "cmt-msg";
      msg.textContent = "Đang gửi…";
      localStorage.setItem("cmt-name", iName.value.trim());

      fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page: PAGE,
          author: iName.value.trim(),
          body: body,
          anchor: state.draft
        })
      }).then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
      }).then(function (res) {
        send.disabled = false;
        if (!res.ok) {
          msg.className = "cmt-msg err";
          msg.textContent = res.status === 429
            ? "Bạn gửi hơi nhanh. Thử lại sau " + (res.d.retryAfter || 60) + " giây."
            : "Không gửi được: " + (res.d.error || res.status);
          return;
        }
        state.comments.unshift(res.d.comment);
        state.draft = null;
        renderPanel();
        applyAnchors();
      }).catch(function () {
        send.disabled = false;
        msg.className = "cmt-msg err";
        msg.textContent = "Lỗi mạng. Nhận xét chưa được gửi.";
      });
    });

    wrap.appendChild(form);

    /* list */
    if (state.loading) { wrap.appendChild(el("p", "cmt-empty", "Đang tải…")); return; }
    if (state.error) {
      wrap.appendChild(el("p", "cmt-msg err", "Không tải được nhận xét: " + state.error));
      return;
    }
    if (!state.comments.length) {
      wrap.appendChild(el("p", "cmt-empty", "Chưa có nhận xét nào."));
      return;
    }

    var list = el("ul", "cmt-list");
    state.comments.forEach(function (c) {
      var li = el("li", "cmt-item");
      li.dataset.id = c.id;

      var head = el("div", "cmt-head");
      head.appendChild(el("span", "cmt-who", c.author || "Ẩn danh"));
      head.appendChild(el("span", "cmt-when", fmt(c.createdAt)));
      if (c._state === "moved") head.appendChild(el("span", "cmt-flag moved", "đã dịch chỗ"));
      if (c._state === "orphan") head.appendChild(el("span", "cmt-flag orphan", "mất neo"));
      li.appendChild(head);

      if (c.anchor) {
        var ref = el("div", "cmt-ref");
        if (c._state === "orphan") {
          ref.appendChild(document.createTextNode(
            "Đoạn văn bản này không còn trong bài. Nội dung nó từng trỏ tới: "));
          ref.appendChild(el("i", null, "“" + c.anchor.exact + "”"));
        } else {
          var jump = el("button", null, "“" + c.anchor.exact + "”");
          jump.type = "button";
          jump.addEventListener("click", function () { focusMark(c.id); });
          ref.appendChild(jump);
        }
        li.appendChild(ref);
      }

      li.appendChild(el("p", "cmt-body", c.body));
      list.appendChild(li);
    });
    wrap.appendChild(list);
  }

  function focusMark(id) {
    var m = root.querySelector('mark.cmt-hl[data-cmt="' + id + '"]');
    if (!m) return;
    m.scrollIntoView({ behavior: "smooth", block: "center" });
    root.querySelectorAll("mark.cmt-hl.on").forEach(function (x) { x.classList.remove("on"); });
    root.querySelectorAll('mark.cmt-hl[data-cmt="' + id + '"]')
        .forEach(function (x) { x.classList.add("on"); });
  }

  function focusComment(id) {
    var li = wrap.querySelector('.cmt-item[data-id="' + id + '"]');
    if (!li) return;
    li.scrollIntoView({ behavior: "smooth", block: "center" });
    wrap.querySelectorAll(".cmt-item.on").forEach(function (x) { x.classList.remove("on"); });
    li.classList.add("on");
  }

  document.addEventListener("click", function (e) {
    var m = e.target.closest && e.target.closest("mark.cmt-hl");
    if (m) focusComment(m.dataset.cmt);
  });

  /* ----------------------------------------------------------------- boot */
  function boot() {
    /* The day pages use four different layout wrappers between them, and on
       several of them the wrapper class repeats for the header bar too. <main>
       when present, <body> otherwise, is the one rule that holds everywhere. */
    root = (ROOT_SEL && document.querySelector(ROOT_SEL)) ||
           document.querySelector("main") ||
           document.body;
    if (!root) return;

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    wrap = el("section", "cmt-wrap");
    wrap.id = "comments";
    root.appendChild(wrap);
    renderPanel();
    addHeadingButtons();

    fetch(API + "?page=" + encodeURIComponent(PAGE))
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        state.comments = d.comments || [];
        state.loading = false;
        applyAnchors();   // sets each comment's _state, which the panel reports
        renderPanel();
      })
      .catch(function (err) {
        state.loading = false;
        state.error = String(err.message || err);
        renderPanel();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
