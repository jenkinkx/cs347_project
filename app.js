// test
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const API_BASE = window.DG_API_BASE || window.API_BASE || 'http://127.0.0.1:8000/api';

  // --- Utilities -----------------------------------------------------------
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });

  //** leaderboard utils */

  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return startOfDay(d); }
  function isSameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }

  function inWindow(date, period) {
    const dt = new Date(date);
    if (period === 'daily') return isSameDay(dt, new Date());
    if (period === 'weekly') return dt >= daysAgo(6);      // last 7 days including today
    if (period === 'monthly') return dt >= daysAgo(29);     // last 30 days
    return true;
  }

  // returns the streak
  function currentStreakForUser(posts) {
    // build a set of iso days the user posted
    const days = new Set(posts.map(p => new Date(p.date).toISOString().slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < 365; i++) { // cap at 1yr
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      if (days.has(iso)) streak++;
      else break;
    }
    return streak;
  }

  // build a per-group leaderboard
  function buildLeaderboard(group, period = 'weekly') {
    const memberIndex = new Map(group.members.map(m => [m.id, m]));
    // bucket posts by user
    const byUser = new Map();
    for (const p of group.posts) {
      if (!byUser.has(p.userId)) byUser.set(p.userId, []);
      byUser.get(p.userId).push(p);
    }
    // include members with 0 posts
    for (const m of group.members) {
      if (!byUser.has(m.id)) byUser.set(m.id, []);
    }

    const rows = [];
    for (const [userId, posts] of byUser) {
      const member = memberIndex.get(userId) || { id: userId, name: posts[0]?.userName || 'Unknown' };
      const inPeriod = posts.filter(p => inWindow(p.date, period));
      const totalPosts = inPeriod.length;

      // active days = distinct calendar dates with >=1 post in the window
      const activeDaySet = new Set(inPeriod.map(p => new Date(p.date).toISOString().slice(0, 10)));
      const activeDays = activeDaySet.size;

      const streak = currentStreakForUser(posts); // overall streak (not limited to window)

      const lastPost = posts
        .map(p => new Date(p.date))
        .sort((a, b) => b - a)[0] || null;

      rows.push({
        userId, name: member.name || 'Unknown',
        activeDays, totalPosts, streak, lastPost
      });
    }

    // Sort by activeDays desc, totalPosts desc, streak desc, lastPost desc
    rows.sort((a, b) =>
      (b.activeDays - a.activeDays) ||
      (b.totalPosts - a.totalPosts) ||
      (b.streak - a.streak) ||
      ((b.lastPost?.getTime() || 0) - (a.lastPost?.getTime() || 0))
    );
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }

  function svgPlaceholder(text, bg = '#98c8ff') {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='${bg}'/>
        <stop offset='1' stop-color='#0d1737'/>
      </linearGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <g fill='rgba(255,255,255,0.85)' font-family='Segoe UI, Roboto, Arial' text-anchor='middle'>
        <text x='50%' y='52%' font-size='72' font-weight='700'>${text}</text>
        <text x='50%' y='62%' font-size='22' opacity='0.85'>Photo Placeholder</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // Auth Modal -------------------------------------------------------------
  function openAuthModal() {
    const signedIn = currentUser && currentUser.id !== 'anon';
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      ${signedIn ? `
        <div class="grid" style="gap:10px;">
          <div class="row" style="justify-content:space-between;">
            <div><strong>Signed in as</strong></div>
          </div>
          <div class="row" style="gap:10px;">
            <span class="group-dot" style="background:#5aa6ff"></span>
            <div><strong>${currentUser.name}</strong><div class="muted">@${(currentUser.username || currentUser.name || '').toLowerCase()}</div></div>
          </div>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button class="ghost-btn" data-close>Close</button>
            <button class="primary-btn" id="logoutBtn">Sign out</button>
          </div>
        </div>
      ` : `
        <div class="row" style="gap:8px; margin-bottom:6px;">
          <button class="ghost-btn" id="tabLogin" aria-pressed="true">Sign In</button>
          <button class="ghost-btn" id="tabSignup">Create Account</button>
        </div>
        <div id="loginForm">
          <label>Username
            <input id="loginUser" class="search-input" placeholder="username" />
          </label>
          <label>Password
            <input id="loginPass" class="search-input" type="password" placeholder="••••••" />
          </label>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button class="ghost-btn" data-close>Cancel</button>
            <button class="primary-btn" id="loginBtn">Sign In</button>
          </div>
        </div>
        <div id="signupForm" class="hidden">
          <label>Full name
            <input id="signupName" class="search-input" placeholder="Your name" />
          </label>
          <label>Username
            <input id="signupUser" class="search-input" placeholder="username" />
          </label>
          <label>Password
            <input id="signupPass" class="search-input" type="password" placeholder="Create a password" />
          </label>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button class="ghost-btn" data-close>Cancel</button>
            <button class="primary-btn" id="signupBtn">Create Account</button>
          </div>
        </div>
      `}
    `;
    openModal(signedIn ? 'Account' : 'Welcome', wrap, {
      onOpen() {
        const tabLogin = $('#tabLogin', wrap);
        const tabSignup = $('#tabSignup', wrap);
        const loginForm = $('#loginForm', wrap);
        const signupForm = $('#signupForm', wrap);
        if (tabLogin && tabSignup) {
          tabLogin.addEventListener('click', () => {
            loginForm.classList.remove('hidden');
            signupForm.classList.add('hidden');
          });
          tabSignup.addEventListener('click', () => {
            signupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
          });
        }
        const loginBtn = $('#loginBtn', wrap);
        if (loginBtn) loginBtn.addEventListener('click', async () => {
          const username = ($('#loginUser', wrap).value || '').trim();
          const password = ($('#loginPass', wrap).value || '').trim();
          try {
            const me = await postJSON('/auth/login/', { username, password });
            currentUser = { id: String(me.id), name: me.name || me.username, initials: me.initials || 'ME', username: me.username };
            try { await loadGroups(); } catch { }
            refreshAvatar();
            closeModal();
            render();
          } catch (e) {
            alert(e?.data?.detail || e.message || 'Sign in failed');
          }
        });
        const signupBtn = $('#signupBtn', wrap);
        if (signupBtn) signupBtn.addEventListener('click', async () => {
          const name = ($('#signupName', wrap).value || '').trim();
          const username = ($('#signupUser', wrap).value || '').trim();
          const password = ($('#signupPass', wrap).value || '').trim();
          try {
            const me = await postJSON('/auth/signup/', { name, username, password });
            currentUser = { id: String(me.id), name: me.name || me.username, initials: me.initials || 'ME', username: me.username };
            try { await loadGroups(); } catch { }
            refreshAvatar();
            closeModal();
            render();
          } catch (e) {
            alert(e?.data?.detail || e.message || 'Signup failed');
          }
        });
        const logoutBtn = $('#logoutBtn', wrap);
        if (logoutBtn) logoutBtn.addEventListener('click', async () => {
          try { await postJSON('/auth/logout/', {}); } catch { }
          currentUser = { id: 'anon', name: 'Guest', initials: 'GU' };
          groups = [];
          refreshAvatar();
          closeModal();
          if (routeFromHash() !== 'home') location.hash = '#home';
          render();
        });
      }
    });
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function saveState() {
    localStorage.setItem('dg_state', JSON.stringify({ groups, currentUser }));
  }
  function loadState() {
    const raw = localStorage.getItem('dg_state');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // --- API helpers --------------------------------------------------------
  async function getJSON(path) {
    const res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async function postJSON(path, body) {
    const res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.detail || `POST ${path} failed`), { data });
    return data;
  }

  async function patchJSON(path, body) {
    const res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.detail || `PATCH ${path} failed`), { data });
    return data;
  }

  async function deleteJSON(path) {
    const res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      let data = null; try { data = await res.json(); } catch { }
      throw Object.assign(new Error(data?.detail || `DELETE ${path} failed`), { data });
    }
    try { return await res.json(); } catch { return { ok: true }; }
  }

  async function uploadForm(path, formData) {
    const res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.detail || `Upload ${path} failed`), { data });
    return data;
  }

  // --- State (loaded from backend) ---------------------------------------
  let currentUser = { id: 'anon', name: 'Guest', initials: 'GU' };
  let groups = [];

  async function initAuth() {
    try {
      const me = await getJSON('/auth/me/');
      currentUser = { id: String(me.id), name: me.name || me.username, initials: me.initials || 'ME' };
    } catch (_) {
      // not signed in
    }
  }

  async function loadGroups() {
    const resp = await getJSON('/groups/');
    const apiGroups = resp?.results || [];
    groups = apiGroups.map((g, idx) => ({
      id: g.id,
      name: g.name,
      color: g.color || '#6b9bff',
      description: g.description || '',
      members: [],
      posts: [],
      expanded: idx === 0, // first group open
    }));
    // Load posts for each group
    await Promise.all(groups.map(async (g) => {
      try {
        const res = await getJSON(`/posts/?group_id=${encodeURIComponent(g.id)}`);
        g.posts = (res?.results || []).map((p) => ({
          id: p.id,
          userId: null,
          userName: p.user_name || 'Unknown',
          imageUrl: p.image_url || svgPlaceholder('IMG'),
          caption: p.caption || '',
          date: p.date || todayISO(),
        }));
      } catch (e) {
        g.posts = [];
      }
    }));
  }

  // --- Simple router -------------------------------------------------------
  function routeFromHash() {
    return location.hash.replace('#', '') || 'home';
  }
  function setActiveTab(route) {
    $$('.nav-tab').forEach((a) => a.classList.toggle('is-active', a.dataset.route === route));
  }
  window.addEventListener('hashchange', render);

  // --- Rendering -----------------------------------------------------------
  function render() {
    const route = routeFromHash();
    setActiveTab(route);
    if (route === 'home') renderHome();
    else if (route === 'groups') renderGroups();
    else if (route === 'user') renderUser();
    else renderHome();
  }

  // Home View ---------------------------------------------------------------
  function renderHome() {
    const app = document.getElementById('app');
    const container = document.createElement('div');
    if (!currentUser || currentUser.id === 'anon') {
      container.innerHTML = `
        <div class="row" style="justify-content:space-between; margin-bottom:12px;">
          <h2 style="margin:0">Welcome</h2>
        </div>
        <div class="group-card" style="text-align:center; padding:24px;">
          <div style="font-size:18px; margin-bottom:10px">Sign in to view and post to your groups.</div>
          <button class="primary-btn" id="homeSignIn">Sign In / Create Account</button>
        </div>
      `;
      app.replaceChildren(container);
      $('#homeSignIn').addEventListener('click', openAuthModal);
      return;
    }
    container.innerHTML = `
      <div class="search-row">
        <input id="homeSearch" class="search-input" placeholder="Search your groups..." />
        <button id="addGroupBtn" class="primary-btn">+ New Group</button>
      </div>
      <div id="groupList"></div>
    `;
    app.replaceChildren(container);
    $('#addGroupBtn').addEventListener('click', () => openGroupEditor());
    const list = $('#groupList');
    const q = $('#homeSearch');
    function paint() {
      list.replaceChildren(...groups
        .filter(g => g.name.toLowerCase().includes(q.value.trim().toLowerCase()))
        .map(renderGroupCard));
    }
    q.addEventListener('input', paint);
    paint();
  }

  function renderGroupCard(group) {
    const meName = (currentUser && currentUser.name) || '';
    const postedByMeToday = (group.posts || []).some(p => (p && (p.userId === currentUser.id || p.userName === meName)) && p.date === todayISO());
    const card = document.createElement('section');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-header">
        <span class="group-dot" style="background:${group.color}"></span>
        <div class="row" style="gap:12px">
          <div class="group-title">${group.name}</div>
          <div class="group-date">${fmtDate(new Date())}</div>
          <div class="post-today ${postedByMeToday ? 'is-done' : ''}">
            <span class="dot"></span>
            ${postedByMeToday ? 'Posted today' : 'Post today required'}
          </div>
        </div>
        <div class="group-actions">
          <button class="ghost-btn" aria-label="Leaderboard" title="Leaderboard" data-leaderboard>🏆</button>
          <button class="expand-btn" aria-label="Toggle details">${group.expanded ? 'Collapse' : 'Expand'}</button>
          <button class="plus-btn" title="Add post" aria-label="Add post"></button>
        </div>
      </div>
      <div class="group-content ${group.expanded ? '' : 'hidden'}">
        <div class="post-grid">
          ${(group.posts || []).map(renderPostCardHTML).join('')}
        </div>
        <div class="group-details">
          <div><strong>Description:</strong> ${group.description || '<span class="muted">No description</span>'}</div>
          <div>
            <strong>Members:</strong>
            ${group.members.map(m => `<span class='chip'>${m.name}</span>`).join(' ')}
          </div>
        </div>
      </div>
    `;

    // Expand / collapse
    $('.expand-btn', card).addEventListener('click', () => {
      group.expanded = !group.expanded;
      saveState();
      render();
    });

    // Add post flow
    const plus = $('.plus-btn', card);
    plus.addEventListener('click', () => openAddPostDialog(group.id));

    //leaderboard
    const lb = $('[data-leaderboard]', card);
    lb.addEventListener('click', () => openLeaderboardModal(group, 'weekly'));

    // Post interactions
    $$('.post-card', card).forEach((el) => attachPostHandlers(el, group.id));

    return card;
  }

  function renderPostCardHTML(post) {
    if (!post) return '';
    const isMe = (post.userId === currentUser.id) || (post.userName === (currentUser.name || ''));
    return `
      <article class="post-card" data-post-id="${post.id}">
        <img class="post-thumb" src="${post.imageUrl}" alt="Post by ${post.userName}" />
        <div class="post-meta">
          <span class="${isMe ? 'me' : ''}">${post.userName}</span>
          <button class="icon" title="Open">🔍</button>
        </div>
      </article>
    `;
  }

  function attachPostHandlers(el, groupId) {
    const postId = el.dataset.postId;
    const group = groups.find(g => String(g.id) === String(groupId));
    // dataset values are strings; coerce ids to strings for a safe match
    const post = group ? group.posts.find(p => String(p.id) === String(postId)) : null;
    if (!group || !post) return; // safety guard
    const isMe = (post.userId === currentUser.id) || (post.userName === (currentUser.name || ''));

    $('.post-thumb', el).addEventListener('click', () => openPostModal(post, group));
    $('button.icon', el).addEventListener('click', () => openPostModal(post, group));

    // Optional: right-click to edit own post
    el.addEventListener('contextmenu', (e) => {
      if (!isMe) return;
      e.preventDefault();
      openEditPostModal(post, group);
    });
  }

  // Groups View -------------------------------------------------------------
  function renderGroups() {
    const app = document.getElementById('app');
    const container = document.createElement('div');
    if (!currentUser || currentUser.id === 'anon') {
      container.innerHTML = `
        <div class="row" style="justify-content:space-between; margin-bottom:12px;">
          <h2 style="margin:0">Your Groups</h2>
        </div>
        <div class="group-card" style="text-align:center; padding:24px;">
          <div class="muted" style="font-size:16px; margin-bottom:10px">Please sign in to view your groups.</div>
          <button class="primary-btn" id="groupsSignIn">Sign In</button>
        </div>`;
      app.replaceChildren(container);
      $('#groupsSignIn').addEventListener('click', openAuthModal);
      return;
    }
    container.innerHTML = `
      <div class="row" style="justify-content:space-between; margin-bottom:12px;">
        <h2 style="margin:0">Your Groups</h2>
        <button class="primary-btn" id="createGroupBtn">+ Create Group</button>
      </div>
      <div class="grid cols-3" id="groupGrid"></div>
    `;
    app.replaceChildren(container);
    $('#createGroupBtn').addEventListener('click', () => openGroupEditor());

    const grid = $('#groupGrid');
    groups.forEach(g => {
      const postedToday = (g.posts || []).some(p => (p.userId === currentUser.id || p.userName === (currentUser.name || '')) && p.date === todayISO());
      const tile = document.createElement('div');
      tile.className = 'group-tile';
      tile.innerHTML = `
        <div class="tile-head">
          <span class="group-dot" style="background:${g.color}"></span>
          <div>
            <div style="font-weight:600">${g.name}</div>
            <div class="muted" style="font-size:13px">${g.members.length} members • ${postedToday ? 'Posted today ✅' : 'Post today required'}</div>
          </div>
          <div class="tile-actions">
            <button class="ghost-btn" data-act="open">Open</button>
            <button class="ghost-btn" data-act="edit">Edit</button>
            <button class="ghost-btn" data-act="lb">🏆</button>
          </div>
        </div>
        <div class="muted">${g.description || ''}</div>
      `;
      tile.querySelector('[data-act="open"]').addEventListener('click', () => {
        location.hash = '#home'; requestAnimationFrame(() => {
          g.expanded = true; saveState(); render();
        });
      });
      tile.querySelector('[data-act="edit"]').addEventListener('click', () => openGroupEditor(g));
      tile.querySelector('[data-act="lb"]').addEventListener('click', () => openLeaderboardModal(g, 'weekly'));
      grid.appendChild(tile);
    });
  }

  // User View ---------------------------------------------------------------
  function renderUser() {
    const app = document.getElementById('app');
    const streak = calcStreak();
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="row" style="justify-content:space-between; margin-bottom:14px;">
        <h2 style="margin:0">${currentUser.name}</h2>
        <span class="chip">Member of ${groups.length} group${groups.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="stats">
        <div class="stat-card">
          <div class="muted">Daily Streak</div>
          <div style="font-size:28px; font-weight:700">${streak} days</div>
          <div class="progress-bar"><span style="width:${Math.min(100, 10 * streak)}%"></span></div>
        </div>
        <div class="stat-card">
          <div class="muted">Posts This Week</div>
          <div style="font-size:28px; font-weight:700">${postsThisWeek()}</div>
          <div class="muted" style="margin-top:6px">Across all groups</div>
        </div>
        <div class="stat-card">
          <div class="muted">Today</div>
          <div style="font-size:28px; font-weight:700">${didPostToday() ? 'Complete ✅' : 'Pending'}</div>
          <div class="muted" style="margin-top:6px">${new Date().toLocaleDateString()}</div>
        </div>
      </div>
      <div class="section-title">Your Groups</div>
      <div class="grid cols-3" id="userGroups"></div>
    `;
    app.replaceChildren(container);
    const list = $('#userGroups');
    groups.forEach(g => {
      const el = document.createElement('div');
      el.className = 'group-tile';
      el.innerHTML = `
        <div class="tile-head">
          <span class="group-dot" style="background:${g.color}"></span>
          <div>
            <div style="font-weight:600">${g.name}</div>
            <div class="muted" style="font-size:13px">${g.members.length} members</div>
          </div>
          <div class="tile-actions">
            <button class="ghost-btn" data-act="open">Open</button>
          </div>
        </div>
      `;
      el.querySelector('[data-act="open"]').addEventListener('click', () => { location.hash = '#home'; requestAnimationFrame(render); });
      list.appendChild(el);
    });
  }

  function postsThisWeek() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    const me = (currentUser.name || '');
    return groups.flatMap(g => (g.posts || [])).filter(p => p && new Date(p.date) >= start && (p.userId === currentUser.id || p.userName === me)).length;
  }
  function didPostToday() {
    const me = (currentUser.name || '');
    return groups.some(g => (g.posts || []).some(p => p && (p.userId === currentUser.id || p.userName === me) && p.date === todayISO()));
  }
  function calcStreak() {
    // Count consecutive days (including today) where user posted in any group.
    let streak = 0;
    for (let i = 0; i < 30; i++) { // simple cap
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const me = (currentUser.name || '');
      const posted = groups.some(g => (g.posts || []).some(p => p && (p.userId === currentUser.id || p.userName === me) && p.date === iso));
      if (posted) streak++; else break;
    }
    return streak;
  }

  // --- Modals --------------------------------------------------------------
  function openModal(title, content, opts = {}) {
    const root = $('#modal-root');
    root.classList.add('is-open');
    root.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal" role="dialog" aria-modal="true">
        <header>
          <h3>${title}</h3>
          <button class="close" data-close>✖</button>
        </header>
        <div class="content"></div>
      </div>`;
    const contentEl = $('.content', root);
    if (typeof content === 'string') contentEl.innerHTML = content; else contentEl.replaceChildren(content);
    $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
    function onEscape(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onEscape, { once: true });
    if (opts.onOpen) opts.onOpen(root);
    return { close: closeModal };
  }
  function closeModal() {
    const root = $('#modal-root');
    root.classList.remove('is-open');
    root.innerHTML = '';
  }

  // Add Post ---------------------------------------------------------------
  function openAddPostDialog(groupId) {
    if (!currentUser || currentUser.id === 'anon') {
      openAuthModal();
      return;
    }
    const group = groups.find(g => g.id === groupId);
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="row">
        <span class="group-dot" style="background:${group.color}"></span>
        <div><strong>${group.name}</strong><div class="muted">${fmtDate(new Date())}</div></div>
      </div>
      <div class="row" style="gap:12px; align-items:flex-start;">
        <img id="previewImg" src="${svgPlaceholder('PREVIEW')}" alt="Preview" style="width: 240px; border-radius: 12px; border: 1px solid rgba(255,255,255,.12)"/>
        <div style="flex:1; display:grid; gap:10px;">
          <input id="fileInput" type="file" accept="image/*" style="display:none"/>
          <div class="row">
            <button class="primary-btn" id="choose">Choose Photo</button>
            <span class="muted">.jpg, .png, or .heic</span>
          </div>
          <label>Caption
            <input id="caption" class="search-input" placeholder="How did it go?" />
          </label>
          <div class="row" style="justify-content:flex-end; gap:8px;">
            <button class="ghost-btn" data-close>Cancel</button>
            <button class="primary-btn" id="postBtn">Post</button>
          </div>
        </div>
      </div>`;
    const modal = openModal('New Post', wrap);

    const file = $('#fileInput', wrap);
    const preview = $('#previewImg', wrap);
    let selectedFile = null;
    $('#choose', wrap).addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      selectedFile = f || null;
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { preview.src = reader.result; };
      reader.readAsDataURL(f);
    });
    $('#postBtn', wrap).addEventListener('click', async () => {
      const caption = $('#caption', wrap).value.trim();
      if (!selectedFile) return;
      try {
        const form = new FormData();
        form.append('image', selectedFile);
        form.append('caption', caption);
        form.append('group_id', String(groupId));
        form.append('user_name', (currentUser.name || 'Anonymous'));
        const p = await uploadForm('/posts/upload/', form);

        // I dont know if we want to just keep using the django api or if we want to use s3 for now.
        
        // const s3 = await postJSON('/upload-url/', { kind: 'groups', id: groupId, filename: selectedFile.name, contentType: selectedFile.type });
        // await fetch(s3.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
        // await postJSON('/confirm-upload/', { group_id: groupId, key: s3.key, caption });
        const newPost = {
          id: p.id,
          userId: null,
          userName: p.user_name || currentUser.name || 'Me',
          imageUrl: p.image_url || preview.src,
          caption: p.caption || caption,
          date: p.date || todayISO(),
        };
        group.posts.unshift(newPost);
        group.expanded = true;
        closeModal();
        render();
      } catch (e) {
        alert(e?.data?.detail || e.message || 'Upload failed');
      }
    });
  }

  // Post Modal --------------------------------------------------------------
  function openPostModal(post, group) {
    if (!post || !group) return;
    const wrap = document.createElement('div');
    const isMe = (post.userId === currentUser.id) || (post.userName === (currentUser.name || ''));
    wrap.innerHTML = `
      <img src="${post.imageUrl}" alt="Post image" style="width:100%; border-radius:12px;" />
      <div class="row" style="justify-content:space-between;">
        <div class="row">
          <span class="group-dot" style="background:${group.color}"></span>
          <strong>${group.name}</strong>
          <span class="muted">• ${fmtDate(post.date)}</span>
        </div>
        ${isMe ? '<button class="ghost-btn" id="editBtn">Edit</button>' : ''}
      </div>
      <div><strong>${post.userName}</strong></div>
      <div class="muted">${post.caption || ''}</div>
    `;
    openModal('Post', wrap, {
      onOpen(root) {
        if ($('#editBtn', wrap)) $('#editBtn', wrap).addEventListener('click', () => { closeModal(); openEditPostModal(post, group); });
      }
    });
  }

  function openEditPostModal(post, group) {
    if (!post || !group) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <img src="${post.imageUrl}" alt="Post" style="width:100%; border-radius:12px;"/>
      <label>Caption
        <input id="caption" class="search-input" value="${(post.caption || '').replace(/"/g, '&quot;')}" />
      </label>
      <div class="row" style="justify-content:space-between;">
        <button class="ghost-btn" id="deleteBtn">Delete</button>
        <div class="row" style="gap:8px;">
          <button class="ghost-btn" data-close>Cancel</button>
          <button class="primary-btn" id="saveBtn">Save</button>
        </div>
      </div>
    `;
    openModal('Edit Post', wrap, {
      onOpen() {
        $('#saveBtn', wrap).addEventListener('click', () => {
          post.caption = $('#caption', wrap).value;
          saveState();
          closeModal();
          render();
        });
        $('#deleteBtn', wrap).addEventListener('click', () => {
          group.posts = group.posts.filter(p => p.id !== post.id);
          saveState();
          closeModal();
          render();
        });
      }
    });
  }

  // Group Editor ------------------------------------------------------------
  function openGroupEditor(group) {
    if (!currentUser || currentUser.id === 'anon') { openAuthModal(); return; }
    const isNew = !group;
    const model = group ? { ...group } : { name: '', color: '#6b9bff', description: '' };
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="grid">
        <label>Group Name
          <input id="gName" class="search-input" placeholder="e.g. Running Group" value="${model.name}" />
        </label>
        <label>Color
          <input id="gColor" type="color" class="search-input" style="height: 44px; padding: 4px;" value="${model.color}" />
        </label>
        <label>Description
          <textarea id="gDesc" class="search-input" rows="3" placeholder="What\'s this group about?">${model.description}</textarea>
        </label>
        <div class="row" style="justify-content:flex-end; gap:8px;">
          ${!isNew ? '<button class="ghost-btn" id="delete">Delete</button>' : ''}
          <button class="ghost-btn" data-close>Cancel</button>
          <button class="primary-btn" id="save">${isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    `;
    openModal(isNew ? 'Create Group' : 'Edit Group', wrap, {
      onOpen() {
        $('#save', wrap).addEventListener('click', async () => {
          const name = ($('#gName', wrap).value || '').trim() || 'Untitled Group';
          const color = $('#gColor', wrap).value;
          const description = ($('#gDesc', wrap).value || '').trim();
          try {
            if (isNew) {
              const created = await postJSON('/groups/', { name, color, description });
              // Reload from backend to normalize shape and fetch posts
              await loadGroups();
              // Expand the newly created group on Home
              const ng = groups.find(x => String(x.id) === String(created.id));
              if (ng) ng.expanded = true;
              // Navigate to Home to surface the new group
              if (routeFromHash() !== 'home') location.hash = '#home';
            } else {
              const g = await patchJSON(`/groups/${group.id}/`, { name, color, description });
              const idx = groups.findIndex(x => x.id === group.id);
              if (idx !== -1) groups[idx] = { ...groups[idx], ...g };
            }
            saveState();
            closeModal();
            render();
          } catch (e) {
            alert(e?.data?.detail || e.message || 'Save failed');
          }
        });
        if (!isNew) $('#delete', wrap).addEventListener('click', async () => {
          try {
            await deleteJSON(`/groups/${group.id}/`);
            groups = groups.filter(g => g.id !== group.id);
            saveState();
            closeModal();
            render();
          } catch (e) {
            alert(e?.data?.detail || e.message || 'Delete failed');
          }
        });
      }
    });
  }

  // Boot -------------------------------------------------------------------
  function refreshAvatar() {
    const avatar = document.querySelector('.avatar');
    const initials = (currentUser.name || '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
    if (avatar) avatar.textContent = initials || currentUser.initials || 'ME';
  }

  const userBtn = document.getElementById('userBtn');
  if (userBtn) userBtn.addEventListener('click', openAuthModal);

  async function init() {
    try { await initAuth(); } catch { }
    try {
      if (currentUser && currentUser.id !== 'anon') {
        await loadGroups();
      } else {
        groups = [];
      }
    } catch { }
    refreshAvatar();
    if (!location.hash) location.hash = '#home';
    render();
  }

  init();

  function openLeaderboardModal(group, initialPeriod = 'weekly') {
    let period = initialPeriod; // 'daily' | 'weekly' | 'monthly'
    const wrap = document.createElement('div');

    function paint() {
      const rows = buildLeaderboard(group, period);
      wrap.innerHTML = `
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div class="row" style="gap:10px;">
          <span class="group-dot" style="background:${group.color}"></span>
          <strong>${group.name}</strong>
        </div>
        <div class="row" style="gap:6px;">
          <button class="ghost-btn ${period === 'daily' ? 'is-active' : ''}" data-p="daily">Daily</button>
          <button class="ghost-btn ${period === 'weekly' ? 'is-active' : ''}" data-p="weekly">Weekly</button>
          <button class="ghost-btn ${period === 'monthly' ? 'is-active' : ''}" data-p="monthly">Monthly</button>
        </div>
      </div>
      <div class="table" style="overflow:auto; max-height:60vh;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px;">#</th>
              <th style="text-align:left; padding:8px;">Member</th>
              <th style="text-align:right; padding:8px;">Active Days</th>
              <th style="text-align:right; padding:8px;">Posts</th>
              <th style="text-align:right; padding:8px;">Current Streak</th>
              <th style="text-align:left; padding:8px;">Last Post</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="padding:8px;">${r.rank}</td>
                <td style="padding:8px;">${r.name}</td>
                <td style="padding:8px; text-align:right;">${r.activeDays}</td>
                <td style="padding:8px; text-align:right;">${r.totalPosts}</td>
                <td style="padding:8px; text-align:right;">${r.streak}</td>
                <td style="padding:8px;">${r.lastPost ? fmtDate(r.lastPost) : '<span class="muted">—</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
      // wire period buttons
      wrap.querySelectorAll('[data-p]').forEach(btn => {
        btn.addEventListener('click', () => { period = btn.dataset.p; paint(); });
      });
    }

    paint();
    openModal('🏆 Leaderboard', wrap);
  }
})();



