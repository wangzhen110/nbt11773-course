/* NB/T 11773—2025 互动学习课程 · 逻辑层 */
(function () {
  'use strict';

  var CHAPTERS = [];
  for (var i = 1; i <= 9; i++) {
    var k = 'CH' + (i < 10 ? '0' + i : i);
    if (window[k]) CHAPTERS.push(window[k]);
  }

  var ALL = [];
  CHAPTERS.forEach(function (c) {
    c.questions.forEach(function (q) {
      ALL.push({ ch: c, q: q });
    });
  });
  ALL.forEach(function (it, i) { it.gid = i; it.q._gid = i; });

  /* ---------- 存储 ---------- */
  var KEY = 'nbt11773_v1';
  var ST = { ans: {}, mark: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) ST = JSON.parse(raw);
  } catch (e) {}
  if (!ST.ans) ST.ans = {};
  if (!ST.mark) ST.mark = {};
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {}
  }

  /* ---------- 元素 ---------- */
  function $(id) { return document.getElementById(id); }
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  var view = 'lecture';
  var curChap = 0;
  var slideIdx = 0;
  var playTimer = null;
  var playing = false;
  var speakOn = false;

  // 答题状态
  var pool = [];
  var qi = 0;
  var answered = false;      // 当前题是否已提交
  var chosen = [];

  /* ---------- 引用规范链接化（课程内知识库跳转） ---------- */
  var STD_RE = /((?:GB(?:\/T|\/Z)?|JB(?:\/T)?|TSG|AQ|GA|YD(?:\/T)?|DL(?:\/T)?|JGJ|QB(?:\/T)?|HG(?:\/T)?|WS(?:\/T)?|SN(?:\/T)?)\s?-?\s?\d{3,5}(?:\.\d+)*)(?:—\d{4})?(?![0-9])/g;
  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* 纯文本 → 带 data-kb 链接的 HTML（用于解析文本，点击打开课程内知识库） */
  function linkStandards(txt) {
    return escHtml(txt).replace(STD_RE, function (m) {
      return '<a class="std-link" data-kb="' + m + '">' + m + '</a>';
    });
  }
  /* 已渲染的 HTML 节点 → 遍历文本节点加链接 */
  function linkStdNodes(root) {
    if (!root || !root.querySelectorAll) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentNode;
        if (p && p.closest && p.closest('a,button,script,style')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var list = [];
    while (w.nextNode()) list.push(w.currentNode);
    list.forEach(function (n) {
      var txt = n.nodeValue;
      if (!STD_RE.test(txt)) return;
      STD_RE.lastIndex = 0;
      var frag = document.createDocumentFragment(), last = 0, m;
      while ((m = STD_RE.exec(txt))) {
        if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        var a = document.createElement('a');
        a.className = 'std-link';
        a.dataset.kb = m[0];
        a.textContent = m[0];
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
    STD_RE.lastIndex = 0;
  }

  /* ---------- 知识库（课程内知识点） ---------- */
  function kbMap(p) {
    if (!window.KB) return null;
    if (KB.standards && KB.standards[p]) return p; // 规范号直接命中
    if (p.includes('封面')) return '封面';
    if (p.includes('前言')) return '前言';
    if (p.includes('第1章') || p === '1 范围') return '第1章 范围';
    if (p.includes('第2章') || p === '2 规范性引用文件') return '第2章 规范性引用文件';
    if (p.includes('第3章')) return '第3章 术语和定义';
    if (p.includes('第4章')) return '第4章 技术要求';
    if (p.includes('第5章')) return '第5章 装配';
    if (p.includes('第6章')) return '第6章 检验';
    if (p.includes('第7章')) return '第7章 包装、储存和运输';
    var fm = p.match(/^(图\d+)/);
    if (fm) return fm[1];
    var tm = p.match(/^(表\d+)/);
    if (tm) return tm[1];
    var cm = p.match(/^(\d+(?:\.\d+)+)/);
    if (cm) return cm[1];
    return null;
  }
  /* 知识库文本排版：转义 → 按行 → 行首序号/条款号加粗 → <br> 连接 */
  function fmtKbText(txt) {
    return escHtml(txt).split('\n').map(function (line) {
      return line
        .replace(/^(\s*\d+(?:\.\d+)*[\.、]?\s)/, '<b class="kb-no">$1</b>')
        .replace(/^(\s*(?:第[一二三四五六七八九十百]+[章节]|[一二三四五六七八九十]+、|表\s*\d+|图\s*\d+)\s)/, '<b class="kb-no">$1</b>');
    }).join('<br>');
  }
  function openKb(src, label) {
    if (!window.KB) { alert('知识库未加载'); return; }
    var parts = src.split(/[；;，,、+~～]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var html = '';
    parts.forEach(function (p) {
      var key = kbMap(p);
      var entry = key && (KB.items[key] || KB.special[key] || KB.standards[key]);
      if (entry) {
        var head = '<div class="kb-key">' + escHtml(key) + (entry.t ? ' ' + escHtml(entry.t) : '') + '</div>';
        var text = '<div class="kb-text">' + fmtKbText(entry.c) + '</div>';
        html += '<div class="kb-item">' + head + text + '</div>';
      } else {
        html += '<div class="kb-item"><div class="kb-key">' + escHtml(p) + '</div><div class="kb-text">（该出处暂无知识库条目）</div></div>';
      }
    });
    $('kbTitle').textContent = label + '：' + src;
    $('kbBody').innerHTML = html;
    $('kbModal').classList.remove('hidden');
  }
  function closeKb() { $('kbModal').classList.add('hidden'); }

  /* ============ 章节导航 ============ */
  function buildNav() {
    var nav = $('chapNav');
    nav.innerHTML = '';
    // 移动端下拉框与当前章节保持同步
    if (typeof mSel !== 'undefined' && mSel) mSel.value = String(CHAPTERS[curChap].id);
    CHAPTERS.forEach(function (c, i) {
      var d = document.createElement('div');
      d.className = 'chap-item' + (i === curChap ? ' active' : '');
      d.innerHTML = '<span>' + c.title + '</span><span class="cnum">' + c.questions.length + ' 题</span>';
      d.onclick = function () {
        curChap = i; slideIdx = 0;
        stopPlay();
        buildNav();
        if (view === 'lecture') renderSlide();
        else { $('fChapter').value = String(c.id); applyFilter(false); }
      };
      nav.appendChild(d);
    });
  }

  /* ============ 讲解 ============ */
  function renderSlide() {
    var c = CHAPTERS[curChap];
    var sl = c.slides[slideIdx];
    $('lecChap').textContent = '第 ' + c.id + ' 章';
    $('lecTitle').textContent = c.title;
    var html = '<h3>' + sl.h + '</h3>' + sl.body;
    if (sl.src) html += '<div class="src">出处：' + sl.src + '</div>';
    $('lecSlide').innerHTML = html;
    linkStdNodes($('lecSlide'));
    $('lecIdx').textContent = (slideIdx + 1) + ' / ' + c.slides.length;
    $('lecBar').style.width = ((slideIdx + 1) / c.slides.length * 100) + '%';
    var dots = $('lecDots'); dots.innerHTML = '';
    c.slides.forEach(function (_, i) {
      var dd = document.createElement('div');
      dd.className = 'dot' + (i === slideIdx ? ' on' : '');
      dd.onclick = function () { slideIdx = i; renderSlide(); };
      dots.appendChild(dd);
    });
    $('lecPrev').disabled = slideIdx === 0;
    $('lecNext').disabled = slideIdx === c.slides.length - 1;
    // 窄屏下宽表格会被容器裁切，加提示告知可横向滑动
    enhanceTables();
  }

  /* 给超出可视宽度的表格加「可滑动」提示与两侧渐隐 */
  function enhanceTables() {
    var slide = $('lecSlide');
    var tables = slide.querySelectorAll('table');
    Array.prototype.forEach.call(tables, function (t) {
      var wrap = t.parentNode;
      if (wrap && wrap.classList && wrap.classList.contains('tbl-wrap')) return;
      var box = document.createElement('div');
      box.className = 'tbl-wrap';
      t.parentNode.insertBefore(box, t);
      box.appendChild(t);
      var tip = document.createElement('div');
      tip.className = 'tbl-tip hidden';
      tip.textContent = '← 左右滑动查看完整表格 →';
      box.parentNode.insertBefore(tip, box);
      var check = function () {
        var w = box.querySelector('table');
        if (!w) return;
        var over = w.scrollWidth - w.clientWidth > 2;
        tip.classList.toggle('hidden', !over || w.scrollLeft > 4);
        box.classList.toggle('scrollable', over);
        // 滑到最右端时去掉右侧渐隐
        box.classList.toggle('at-end', w.scrollLeft + w.clientWidth >= w.scrollWidth - 4);
        box.classList.toggle('at-start', w.scrollLeft <= 4);
      };
      t.addEventListener('scroll', check, { passive: true });
      check();
    });
  }

  /* 语音讲解（浏览器 TTS，需用户点击启用） */
  function slideText() {
    return ($('lecSlide').textContent || '').replace(/\s+/g, ' ').trim();
  }
  function speakCurrent(onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    var u = new window.SpeechSynthesisUtterance(slideText());
    u.lang = 'zh-CN';
    u.rate = 1.05;
    if (onEnd) u.onend = onEnd;
    try { window.speechSynthesis.speak(u); } catch (e) { if (onEnd) onEnd(); }
  }
  function cancelSpeak() {
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  function stopPlay() {
    playing = false;
    if (playTimer) { clearTimeout(playTimer); playTimer = null; }
    cancelSpeak();
    $('lecPlay').textContent = '自动播放';
    $('lecPlay').classList.remove('primary');
  }
  function advance() {
    var c = CHAPTERS[curChap];
    if (slideIdx >= c.slides.length - 1) { stopPlay(); return; }
    slideIdx++;
    renderSlide();
    runStep();
  }
  function runStep() {
    var c = CHAPTERS[curChap];
    if (speakOn) {
      speakCurrent(function () {
        if (!playing) return;
        playTimer = setTimeout(function () {
          playTimer = null;
          if (!playing) return;
          if (slideIdx >= c.slides.length - 1) { stopPlay(); return; }
          advance();
        }, 900);
      });
    } else {
      playTimer = setTimeout(function () { playTimer = null; advance(); }, 9000);
    }
  }
  function startPlay() {
    playing = true;
    $('lecPlay').textContent = '暂停';
    $('lecPlay').classList.add('primary');
    runStep();
  }

  $('lecPrev').onclick = function () {
    if (slideIdx > 0) {
      stopPlay(); slideIdx--; renderSlide();
      if (speakOn) speakCurrent(null);
    }
  };
  $('lecNext').onclick = function () {
    var c = CHAPTERS[curChap];
    if (slideIdx < c.slides.length - 1) {
      stopPlay(); slideIdx++; renderSlide();
      if (speakOn) speakCurrent(null);
    }
  };
  $('lecPlay').onclick = function () { playing ? stopPlay() : startPlay(); };
  $('lecSpeak').onclick = function () {
    speakOn = !speakOn;
    $('lecSpeak').textContent = speakOn ? '语音讲解 ✓' : '语音讲解';
    $('lecSpeak').classList.toggle('primary', speakOn);
    if (speakOn) speakCurrent(null); else cancelSpeak();
  };
  $('lecToQuiz').onclick = function () {
    switchView('quiz');
    $('fChapter').value = String(CHAPTERS[curChap].id);
    $('fScope').value = 'all';
    applyFilter(false);
  };

  /* ============ 筛选 ============ */
  function matchScope(it) {
    var s = $('fScope').value;
    var rec = ST.ans[it.gid];
    if (s === 'undo') return !rec;
    if (s === 'wrong') return rec && !rec.ok;
    if (s === 'right') return rec && rec.ok;
    return true;
  }
  function applyFilter(keepChapter) {
    var ch = $('fChapter').value;
    var ty = $('fType').value;
    pool = ALL.filter(function (it) {
      if (ch !== 'all' && it.ch.id !== parseInt(ch, 10)) return false;
      if (keepChapter && it.ch.id !== CHAPTERS[curChap].id) return false;
      if (ty !== 'all' && it.q.t !== ty) return false;
      if (!matchScope(it)) return false;
      return true;
    });
    if ($('fShuffle').checked) pool.sort(function () { return Math.random() - 0.5; });
    qi = 0;
    if (!pool.length) { renderEmpty(); return; }
    renderQ();
  }
  function renderEmpty() {
    $('qChapter').textContent = '无匹配题目';
    $('qType').textContent = '—';
    $('qIdx').textContent = '0 / 0';
    $('qSourceTag').textContent = '—';
    $('qText').textContent = '当前筛选条件下没有题目，请调整章节、题型或范围。';
    $('qOptions').innerHTML = '';
    $('qFeedback').classList.add('hidden');
    $('quizRange').textContent = '0 题';
    $('jumpGrid').innerHTML = '';
    $('qNext').textContent = '下一题 →';
  }

  /* ============ 渲染题目 ============ */
  function optsOf(q) {
    if (q.t === 'judge') return ['正确', '错误'];
    return q.o;
  }
  function renderQ() {
    var it = pool[qi];
    var q = it.q;
    answered = false; chosen = [];
    var rec = ST.ans[it.gid];

    $('qChapter').textContent = '第' + it.ch.id + '章 ' + it.ch.title;
    $('qType').textContent = q.t === 'single' ? '单选题' : q.t === 'multi' ? '多选题' : '判断题';
    $('qIdx').textContent = (qi + 1) + ' / ' + pool.length;
    $('qSourceTag').textContent = '出处见解析';
    $('qText').textContent = q.q;
    $('quizRange').textContent = '共 ' + pool.length + ' 题';

    var wrap = $('qOptions');
    wrap.innerHTML = '';
    wrap.className = 'options' + (q.t === 'multi' ? ' opt-multi' : '');
    optsOf(q).forEach(function (txt, i) {
      var d = document.createElement('div');
      d.className = 'opt';
      d.innerHTML = '<div class="letter">' + LETTERS[i] + '</div><div>' + txt + '</div>';
      d.onclick = function () { pick(i, d); };
      wrap.appendChild(d);
    });

    $('qFeedback').classList.add('hidden');
    $('qMark').style.display = 'none';

    if (rec) {
      // 已答过：直接展示历史结果
      answered = true;
      chosen = rec.pick.slice();
      lockAndShow(rec.ok);
    } else {
      $('qNext').textContent = (q.t === 'multi') ? '提交答案' : '下一题 →';
    }
    renderJump();
    updateTopStats();
  }

  function pick(i, el) {
    if (answered) return;
    var it = pool[qi], q = it.q;
    var nodes = $('qOptions').children;
    if (q.t === 'multi') {
      var k = chosen.indexOf(i);
      if (k >= 0) { chosen.splice(k, 1); el.classList.remove('sel'); }
      else { chosen.push(i); el.classList.add('sel'); }
      $('qNext').textContent = chosen.length ? '提交答案（已选 ' + chosen.length + ' 项）' : '提交答案';
      return;
    }
    chosen = [i];
    for (var n = 0; n < nodes.length; n++) nodes[n].classList.remove('sel');
    el.classList.add('sel');
    submit();
  }

  function submit() {
    var it = pool[qi], q = it.q;
    if (!chosen.length) return;
    var ok = chosen.length === q.a.length && q.a.every(function (x) { return chosen.indexOf(x) >= 0; });
    ST.ans[it.gid] = { ok: ok, pick: chosen.slice() };
    save();
    answered = true;
    lockAndShow(ok);
    renderJump();
    updateTopStats();
  }

  function lockAndShow(ok) {
    var it = pool[qi], q = it.q;
    var nodes = $('qOptions').children;
    for (var n = 0; n < nodes.length; n++) {
      nodes[n].classList.add('locked');
      nodes[n].classList.remove('sel');
      if (q.a.indexOf(n) >= 0) nodes[n].classList.add('right');
      else if (chosen.indexOf(n) >= 0) nodes[n].classList.add('wrong');
    }
    var fb = $('qFeedback');
    fb.classList.remove('hidden');
    var head = $('fbHead');
    head.className = 'fb-head ' + (ok ? 'ok' : 'bad');
    head.textContent = ok ? '✓ 回答正确' : '✗ 回答错误';
    $('fbAnswer').textContent = q.a.map(function (x) { return LETTERS[x] + '. ' + optsOf(q)[x]; }).join('　|　');
    $('fbExplain').innerHTML = linkStandards(q.e);
    $('fbSource').innerHTML = '<button type="button" class="src-link" data-src="' + escHtml(q.s) + '">出处：' + escHtml(q.s) + ' <span class="src-arrow">▸</span></button>';
    $('qMark').style.display = 'inline-block';
    $('qMark').textContent = ST.mark[it.gid] ? '已标记 ★' : '标记错题';
    $('qNext').textContent = '下一题 →';
  }

  function renderJump() {
    var g = $('jumpGrid'); g.innerHTML = '';
    pool.forEach(function (it, i) {
      var rec = ST.ans[it.gid];
      var b = document.createElement('button');
      b.className = 'jump-btn' + (i === qi ? ' cur' : '') + (rec ? (rec.ok ? ' right' : ' wrong') : '');
      b.textContent = i + 1;
      b.onclick = function () { qi = i; renderQ(); window.scrollTo(0, 0); };
      g.appendChild(b);
    });
  }

  /* ============ 顶栏统计 ============ */
  function updateTopStats() {
    var done = 0, right = 0;
    for (var k in ST.ans) { if (ST.ans.hasOwnProperty(k)) { done++; if (ST.ans[k].ok) right++; } }
    $('sDone').textContent = done;
    $('sRight').textContent = right;
    $('sWrong').textContent = done - right;
    $('sRate').textContent = done ? Math.round(right / done * 100) + '%' : '—';
    $('totalCount').textContent = ALL.length;
  }

  /* ============ 按钮 ============ */
  $('qPrev').onclick = function () { if (qi > 0) { qi--; renderQ(); window.scrollTo(0, 0); } };
  $('qNext').onclick = function () {
    var it = pool[qi];
    if (it && !answered && it.q.t === 'multi') { submit(); return; }
    if (qi < pool.length - 1) { qi++; renderQ(); window.scrollTo(0, 0); }
  };
  $('qMark').onclick = function () {
    var it = pool[qi];
    if (ST.mark[it.gid]) delete ST.mark[it.gid]; else ST.mark[it.gid] = 1;
    save();
    $('qMark').textContent = ST.mark[it.gid] ? '已标记 ★' : '标记错题';
  };
  $('fChapter').onchange = function () { applyFilter(false); };
  $('fType').onchange = function () { applyFilter(false); };
  $('fScope').onchange = function () { applyFilter(false); };
  $('fShuffle').onchange = function () { applyFilter(false); };
  $('btnReset').onclick = function () {
    if (confirm('确定清空全部答题记录与标记吗？此操作不可撤销。')) {
      ST = { ans: {}, mark: {} }; save();
      applyFilter(false); updateTopStats(); renderStats();
    }
  };

  /* ============ 统计视图 ============ */
  function renderStats() {
    var done = 0, right = 0;
    for (var k in ST.ans) { if (ST.ans.hasOwnProperty(k)) { done++; if (ST.ans[k].ok) right++; } }
    var marks = Object.keys(ST.mark).length;
    $('statCards').innerHTML =
      '<div class="scard"><b>' + ALL.length + '</b><span>题库总题量</span></div>' +
      '<div class="scard"><b>' + done + '</b><span>已作答题数</span></div>' +
      '<div class="scard"><b>' + right + '</b><span>答对题数</span></div>' +
      '<div class="scard"><b>' + (done ? Math.round(right / done * 100) + '%' : '—') + '</b><span>总正确率</span></div>' +
      '<div class="scard"><b>' + marks + '</b><span>手动标记</span></div>' +
      '<div class="scard"><b>' + Math.round(done / ALL.length * 100) + '%</b><span>完成进度</span></div>';

    var cs = $('chapStats'); cs.innerHTML = '';
    CHAPTERS.forEach(function (c) {
      var tot = c.questions.length, d = 0, r = 0;
      c.questions.forEach(function (q) {
        var rec = ST.ans[q._gid];
        if (rec) { d++; if (rec.ok) r++; }
      });
      var pct = d ? Math.round(r / d * 100) : 0;
      var row = document.createElement('div');
      row.className = 'cs-row';
      row.innerHTML = '<div class="cs-name">第' + c.id + '章 ' + c.title + '</div>' +
        '<div class="cs-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="cs-val">' + (d ? r + '/' + d + ' · ' + pct + '%' : '未开始') + '</div>';
      cs.appendChild(row);
    });

    var wl = $('wrongList'); wl.innerHTML = '';
    var bad = ALL.filter(function (it) { var r = ST.ans[it.gid]; return r && !r.ok; });
    if (!bad.length) {
      wl.innerHTML = '<div class="empty">还没有错题。做错的题目会自动出现在这里。</div>';
      return;
    }
    bad.forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'wrong-item';
      d.innerHTML = '<b>第' + it.ch.id + '章 · ' + it.q.q.slice(0, 60) + (it.q.q.length > 60 ? '…' : '') + '</b>' +
        '<div style="margin-top:4px;color:#7b8493">正确：' + it.q.a.map(function (x) { return LETTERS[x]; }).join('') + '　出处：' + it.q.s + '</div>';
      d.onclick = function () {
        switchView('quiz');
        $('fChapter').value = 'all'; $('fType').value = 'all'; $('fScope').value = 'all';
        applyFilter(false);
        var pos = pool.indexOf(it);
        if (pos >= 0) { qi = pos; renderQ(); }
      };
      wl.appendChild(d);
    });
  }

  /* ============ 视图切换 ============ */
  function switchView(v) {
    view = v;
    ['lecture', 'quiz', 'fill', 'stats'].forEach(function (n) {
      $('view-' + n).classList.toggle('hidden', n !== v);
    });
    document.querySelectorAll('.mode-btn, .mnav-btn[data-view]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === v);
    });
    if (v !== 'lecture') stopPlay();
    if (v === 'lecture') renderSlide();
    if (v === 'stats') renderStats();
    if (v === 'fill' && !fpool.length) fApplyFilter();
    if (v === 'quiz' && !pool.length) {
      $('fChapter').value = String(CHAPTERS[curChap].id);
      applyFilter(false);
    } else if (v === 'quiz' && $('fChapter').value !== 'all'
               && $('fChapter').value !== String(CHAPTERS[curChap].id)) {
      // 当前浏览的章节与筛选章节不一致时，跟随当前章节
      $('fChapter').value = String(CHAPTERS[curChap].id);
      applyFilter(false);
    }
  }
  document.querySelectorAll('.mode-btn, .mnav-btn[data-view]').forEach(function (b) {
    if (b.dataset.view) b.onclick = function () { switchView(b.dataset.view); };
  });

  /* ============ 移动端章节选择 ============ */
  var mSel = $('mChapter');
  CHAPTERS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = '第' + c.id + '章 ' + c.title;
    mSel.appendChild(o);
  });
  mSel.onchange = function () {
    var id = parseInt(mSel.value, 10);
    CHAPTERS.forEach(function (c, i) { if (c.id === id) curChap = i; });
    slideIdx = 0;
    buildNav();
    if (view === 'lecture') renderSlide();
    else switchView('lecture');
  };
  function syncMobileChapter() {
    if (mSel.value !== String(CHAPTERS[curChap].id)) {
      mSel.value = String(CHAPTERS[curChap].id);
    }
  }

  /* ============ 进度导入 / 导出（跨设备） ============ */
  var BACKUP_KEY = 'nbt11773_v1';
  function countProgress() {
    var done = 0, right = 0;
    for (var k in ST.ans) {
      if (ST.ans.hasOwnProperty(k)) { done++; if (ST.ans[k].ok) right++; }
    }
    return { done: done, right: right };
  }
  function openSync() {
    $('syncModal').classList.remove('hidden');
    $('syncStatus').textContent = '';
    $('syncStatus').className = 'modal-status';
    var p = countProgress();
    $('syncSum').textContent = '当前设备进度：已答 ' + p.done + ' 题，答对 ' + p.right + ' 题。';
  }
  function closeSync() { $('syncModal').classList.add('hidden'); }

  /* 知识库弹窗事件（出处/规范号点击 → 课程内知识点） */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.src-link, .std-link') : null;
    if (!el) return;
    e.preventDefault();
    var src = el.dataset.kb || el.dataset.src || el.textContent.trim();
    openKb(src, el.classList.contains('std-link') ? '引用规范' : '出处');
  });
  $('kbClose').onclick = closeKb;
  $('kbMask').onclick = closeKb;

  $('btnSync2').onclick = openSync;
  $('mSync').onclick = openSync;
  $('syncClose').onclick = closeSync;
  $('syncMask').onclick = closeSync;

  $('btnExport').onclick = function () {
    try {
      var data = { app: 'NB/T 11773—2025 学习课程', ver: 1, at: Date.now(), progress: ST };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var d = new Date();
      var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
      a.href = url;
      a.download = '内附件技术规范-学习进度-' + stamp + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      var p = countProgress();
      $('syncStatus').className = 'modal-status ok';
      $('syncStatus').textContent = '已导出 ' + p.done + ' 条答题记录，文件已下载。把它发到新设备即可导入。';
    } catch (err) {
      $('syncStatus').className = 'modal-status err';
      $('syncStatus').textContent = '导出失败：' + err.message;
    }
  };

  $('btnImport').onclick = function () { $('fileInput').click(); };
  $('fileInput').onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var obj = JSON.parse(rd.result);
        var p = obj && obj.progress ? obj.progress : obj;
        if (!p || typeof p !== 'object' || !p.ans) throw new Error('文件格式不正确');
        var merge = Object.keys(ST.ans).length > 0 &&
                    !confirm('本机已有答题记录。\n\n点「确定」= 合并两边的进度（推荐）\n点「取消」= 用导入的记录覆盖本机');
        if (merge) {
          for (var k in p.ans) { if (p.ans.hasOwnProperty(k)) ST.ans[k] = p.ans[k]; }
          if (p.mark) { for (var m in p.mark) { if (p.mark.hasOwnProperty(m)) ST.mark[m] = p.mark[m]; } }
        } else {
          ST.ans = p.ans || {};
          ST.mark = p.mark || {};
        }
        save();
        updateTopStats();
        if (view === 'stats') renderStats();
        if (view === 'quiz') renderQuestion();
        var c = countProgress();
        $('syncStatus').className = 'modal-status ok';
        $('syncStatus').textContent = '导入成功！当前已答 ' + c.done + ' 题，答对 ' + c.right + ' 题。';
        $('syncSum').textContent = '进度已写入本机浏览器，可继续学习。';
      } catch (err2) {
        $('syncStatus').className = 'modal-status err';
        $('syncStatus').textContent = '导入失败：' + err2.message;
      }
      e.target.value = '';
    };
    rd.readAsText(f);
  };

  /* ============ PWA：离线可用 + 添加到桌面 ============ */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    deferredPrompt = ev;
    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua);
    if (isIOS && !/Safari/.test(ua)) return;
    $('installGuide').textContent = isIOS
      ? 'Safari 底部「分享」→「添加到主屏幕」'
      : '添加后断网也能继续学习';
    $('installDo').textContent = isIOS ? '知道了' : '添加';
    if (sessionStorage.getItem('nbt11773_install_no') !== '1') {
      $('installTip').classList.remove('hidden');
    }
  });
  $('installNo').onclick = function () {
    $('installTip').classList.add('hidden');
    try { sessionStorage.setItem('nbt11773_install_no', '1'); } catch (e) {}
  };
  $('installDo').onclick = function () {
    $('installTip').classList.add('hidden');
    try { sessionStorage.setItem('nbt11773_install_no', '1'); } catch (e) {}
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
    }
  };
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  /* ============ 填空题（巩固模式） ============ */
  var FILL = window.FILL || null;
  var FPOOL = [];
  if (FILL && FILL.questions) {
    FILL.questions.forEach(function (q, i) { FPOOL.push({ ch: FILL, q: q, gid: 'F' + i }); });
  }
  var FKEY = 'nbt11773_fill_v1';
  var STF = { ans: {}, mark: {} };
  try { var rf = localStorage.getItem(FKEY); if (rf) STF = JSON.parse(rf); } catch (e) {}
  if (!STF.ans) STF.ans = {};
  if (!STF.mark) STF.mark = {};
  function fsave() { try { localStorage.setItem(FKEY, JSON.stringify(STF)); } catch (e) {} }

  var fpool = [];
  var fq = 0;
  var fanswered = false;

  function normIn(s) {
    return ('' + s)
      // 去掉不可见字符（零宽空格/BOM/软连字符等，复制粘贴或输入法常带入，trim 去不掉）
      .replace(/[\u200B-\u200D\uFEFF\u2060\u180E\u00AD\u00A0]/g, '')
      .replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/\u3000/g, ' ')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }
  function fMatch(acc, val) {
    return acc.some(function (a) { return normIn(a) === normIn(val); });
  }
  function fStats() {
    var done = 0, right = 0;
    for (var k in STF.ans) { if (STF.ans.hasOwnProperty(k)) { done++; if (STF.ans[k].ok) right++; } }
    return { done: done, right: right, rate: done ? Math.round(right / done * 100) : null };
  }
  function fRenderStats() {
    var st = fStats();
    $('ffStats').textContent = '填空题库共 ' + FPOOL.length + ' 题 · 已答 ' + st.done +
      ' · 答对 ' + st.right + (st.rate !== null ? ' · 正确率 ' + st.rate + '%' : '');
  }
  function fApplyFilter() {
    var ch = $('ffChapter').value;
    var sc = $('ffScope').value;
    fpool = FPOOL.filter(function (it) {
      if (ch !== 'all' && it.q.ch !== parseInt(ch, 10)) return false;
      var rec = STF.ans[it.gid];
      if (sc === 'undo') return !rec;
      if (sc === 'wrong') return rec && !rec.ok;
      if (sc === 'right') return rec && rec.ok;
      return true;
    });
    if ($('ffShuffle').checked) fpool.sort(function () { return Math.random() - 0.5; });
    fq = 0;
    if (!fpool.length) { fRenderEmpty(); return; }
    fRenderQ();
  }
  function fRenderEmpty() {
    $('fqChapter').textContent = '无匹配题目';
    $('fqType').textContent = '—';
    $('fqIdx').textContent = '0 / 0';
    $('fqSourceTag').textContent = '—';
    $('fqText').textContent = '当前筛选条件下没有填空题，请调整章节或范围。';
    $('fqOptions').innerHTML = '';
    $('fqFeedback').classList.add('hidden');
    $('ffRange').textContent = '0 题';
    $('fjumpGrid').innerHTML = '';
    $('fqNext').textContent = '下一题 →';
    fRenderStats();
  }
  function fRenderQ() {
    var it = fpool[fq];
    var q = it.q;
    fanswered = false;
    var rec = STF.ans[it.gid];

    $('fqChapter').textContent = '第' + q.ch + '章';
    $('fqType').textContent = '填空题';
    $('fqIdx').textContent = (fq + 1) + ' / ' + fpool.length;
    $('fqSourceTag').textContent = '出处见解析';
    $('fqText').textContent = q.q;
    $('ffRange').textContent = '共 ' + fpool.length + ' 题';

    var wrap = $('fqOptions');
    wrap.innerHTML = '';
    wrap.className = 'options fill-opts';
    q.a.forEach(function (_, i) {
      var d = document.createElement('div');
      d.className = 'fill-row';
      d.innerHTML = '<span class="fill-no">第 ' + (i + 1) + ' 空</span>' +
        '<input class="fill-input" type="text" autocomplete="off" placeholder="在此输入答案">';
      wrap.appendChild(d);
    });

    $('fqFeedback').classList.add('hidden');
    $('fqMark').style.display = 'none';

    if (rec) {
      fanswered = true;
      fShowResult(rec.ok, rec.pick);
    } else {
      $('fqNext').textContent = '提交答案';
    }
    fRenderJump();
    fRenderStats();
  }
  function fSubmit() {
    var it = fpool[fq];
    var q = it.q;
    var inputs = document.querySelectorAll('#fqOptions .fill-input');
    var vals = [];
    for (var i = 0; i < inputs.length; i++) vals.push(inputs[i].value.trim());
    var empty = vals.filter(function (v) { return v === ''; }).length;
    if (empty) {
      alert('还有 ' + empty + ' 个空未填写，请填完再提交。');
      return;
    }
    var ok = q.a.length === vals.length && q.a.every(function (acc, i) { return fMatch(acc, vals[i]); });
    STF.ans[it.gid] = { ok: ok, pick: vals };
    fsave();
    fanswered = true;
    fShowResult(ok, vals);
    fRenderJump();
    fRenderStats();
  }
  function fShowResult(ok, pick) {
    var it = fpool[fq];
    var q = it.q;
    var fb = $('fqFeedback');
    fb.classList.remove('hidden');
    var head = $('ffbHead');
    head.className = 'fb-head ' + (ok ? 'ok' : 'bad');
    head.textContent = ok ? '✓ 回答正确' : '✗ 回答错误';
    $('ffbAnswer').textContent = q.a.map(function (acc, i) {
      return '第' + (i + 1) + '空：' + acc.join(' 或 ');
    }).join('　|　');
    $('ffbExplain').innerHTML = linkStandards(q.e);
    $('ffbSource').innerHTML = '<button type="button" class="src-link" data-src="' + escHtml(q.s) + '">出处：' + escHtml(q.s) + ' <span class="src-arrow">▸</span></button>';
    var inputs = document.querySelectorAll('#fqOptions .fill-input');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].disabled = true;
      var okk = fMatch(q.a[i], pick[i]);
      inputs[i].classList.add(okk ? 'right' : 'wrong');
      if (!okk) { inputs[i].value = q.a[i][0]; inputs[i].classList.add('show-ans'); }
    }
    $('fqMark').style.display = 'inline-block';
    $('fqMark').textContent = STF.mark[it.gid] ? '已标记 ★' : '标记错题';
    $('fqNext').textContent = '下一题 →';
  }
  function fRenderJump() {
    var g = $('fjumpGrid'); g.innerHTML = '';
    fpool.forEach(function (it, i) {
      var rec = STF.ans[it.gid];
      var b = document.createElement('button');
      b.className = 'jump-btn' + (i === fq ? ' cur' : '') + (rec ? (rec.ok ? ' right' : ' wrong') : '');
      b.textContent = i + 1;
      b.onclick = function () { fq = i; fRenderQ(); window.scrollTo(0, 0); };
      g.appendChild(b);
    });
  }
  if ($('ffChapter')) {
    var fsel = $('ffChapter');
    CHAPTERS.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id; o.textContent = '第' + c.id + '章';
      fsel.appendChild(o);
    });
    $('fqPrev').onclick = function () { if (fq > 0) { fq--; fRenderQ(); window.scrollTo(0, 0); } };
    $('fqNext').onclick = function () {
      if (!fanswered) { fSubmit(); return; }
      if (fq < fpool.length - 1) { fq++; fRenderQ(); window.scrollTo(0, 0); }
    };
    $('fqMark').onclick = function () {
      var it = fpool[fq];
      if (STF.mark[it.gid]) delete STF.mark[it.gid]; else STF.mark[it.gid] = 1;
      fsave();
      $('fqMark').textContent = STF.mark[it.gid] ? '已标记 ★' : '标记错题';
    };
    $('ffChapter').onchange = fApplyFilter;
    $('ffScope').onchange = fApplyFilter;
    $('ffShuffle').onchange = fApplyFilter;
    fApplyFilter();
  }

  /* ============ 初始化 ============ */
  var sel = $('fChapter');
  CHAPTERS.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.id; o.textContent = '第' + c.id + '章 ' + c.title;
    sel.appendChild(o);
  });
  buildNav();
  renderSlide();
  applyFilter(true);
  updateTopStats();
  $('totalCount').textContent = ALL.length;

  document.addEventListener('keydown', function (e) {
    if (view === 'quiz') {
      if (e.key >= '1' && e.key <= '6') {
        var i = parseInt(e.key, 10) - 1;
        var nodes = $('qOptions').children;
        if (nodes[i] && !answered) nodes[i].click();
      }
      if (e.key === 'Enter') $('qNext').click();
    }
    if (view === 'fill' && e.key === 'Enter') $('fqNext').click();
  });
})();
