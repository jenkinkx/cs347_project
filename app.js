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
            <button class="logout-btn" id="logoutBtn">Sign out</button>
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
          selectedGroupId = null;
          refreshAvatar();
          closeModal();
          if (routeFromHash() !== 'groups') location.hash = '#groups';
          render();
        });
      }
    });
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function saveState() {
    localStorage.setItem('dg_state', JSON.stringify({ groups, currentUser, selectedGroupId }));
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

  async function fetchComments(postId) {
    const res = await getJSON(`/posts/${postId}/comments/`);
    return res?.results || [];
  }

  async function createComment(postId, text, parentId = null) {
    return postJSON(`/posts/${postId}/comments/`, { text, parent_id: parentId });
  }

  // --- State (loaded from backend) ---------------------------------------
  let currentUser = { id: 'anon', name: 'Guest', initials: 'GU' };
  let groups = [];
  let selectedGroupId = null;

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
    groups = apiGroups.map((g, idx) => {
      const memberNames = Array.isArray(g.member_usernames) ? g.member_usernames : [];
      const memberDetails = Array.isArray(g.member_details) ? g.member_details : [];
      const membersFromIds = Array.isArray(g.members)
        ? g.members.map((id) => {
          const detail = memberDetails.find((m) => String(m.id) === String(id));
          return { id: String(id), name: detail?.name || detail?.username || 'Member' };
        })
        : [];
      const members = membersFromIds.length
        ? membersFromIds
        : memberDetails.length
          ? memberDetails.map((m) => ({ id: String(m.id), name: m.name || m.username || 'Member' }))
          : memberNames.map((n) => ({ id: n, name: n }));
      const parsedCount = Number(g.member_count);
      const memberCount = Number.isFinite(parsedCount)
        ? parsedCount
        : (Array.isArray(g.members) ? g.members.length : memberNames.length);
      return {
        id: g.id,
        name: g.name,
        color: g.color || '#6b9bff',
        description: g.description || '',
        cover: g.cover_url || '',
        members,
        memberNames,
        memberCount,
        isPrivate: !g.is_public,
        isCreator: Boolean(g.is_creator),
        isMember: g.is_member !== false,
        posts: [],
        expanded: idx === 0,
      };
    });
    if (!selectedGroupId && groups.length) {
      selectedGroupId = groups[0].id;
    }
    // Load posts for each group
    await Promise.all(groups.map(async (g) => {
      try {
        const res = await getJSON(`/posts/?group_id=${encodeURIComponent(g.id)}`);
        g.posts = (res?.results || []).map((p) => ({
          id: p.id,
          userId: p.author_id ? String(p.author_id) : (p.author || p.user_name || 'unknown'),
          userName: p.user_name || p.author || 'Unknown',
          imageUrl: p.image_url || svgPlaceholder('IMG'),
          caption: p.caption || '',
          date: p.date || todayISO(),
          comments: Array.isArray(p.comments) ? p.comments : [],
          commentCount: Number(p.comment_count || (p.comments?.length || 0)),
          latestComment: Array.isArray(p.comments) && p.comments.length ? p.comments[0].text : '',
        }));
      } catch (e) {
        g.posts = [];
      }
    }));
  }

  // --- Simple router -------------------------------------------------------
  function routeFromHash() {
    return location.hash.replace('#', '') || 'groups';
  }
  function setActiveTab(route) {
    $$('.nav-tab').forEach((a) => a.classList.toggle('is-active', a.dataset.route === route));
  }
  window.addEventListener('hashchange', render);

  // --- Rendering -----------------------------------------------------------
  function render() {
    const route = routeFromHash();
    setActiveTab(route);
    if (route === 'groups') renderGroups();
    else if (route === 'user') renderUser();
    else renderGroups();
  }

  // Home View (legacy) ------------------------------------------------------
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
        <div class="row" style="gap:8px; justify-content:flex-end;">
          <button id="homeJoinBtn" class="ghost-btn">Join Group</button>
          <button id="addGroupBtn" class="primary-btn">+ New Group</button>
        </div>
      </div>
      <div id="groupList"></div>
    `;
    app.replaceChildren(container);
    $('#addGroupBtn').addEventListener('click', () => openGroupEditor());
    $('#homeJoinBtn').addEventListener('click', () => openJoinGroupDialog());
    const list = $('#groupList');
    const q = $('#homeSearch');
    function paint() {
      const term = q.value.trim().toLowerCase();
      const filtered = groups.filter(g => g.name.toLowerCase().includes(term));
      if (!filtered.length) {
        list.innerHTML = `
          <section class="group-card" style="text-align:center; padding:24px;">
            <div class="muted" style="margin-bottom:12px;">You haven't joined any groups yet.</div>
            <button class="primary-btn" id="emptyJoinBtn">Find a Group to Join</button>
          </section>
        `;
        const emptyBtn = $('#emptyJoinBtn');
        if (emptyBtn) emptyBtn.addEventListener('click', () => openJoinGroupDialog());
        return;
      }
      list.replaceChildren(...filtered.map(renderGroupCard));
    }
    q.addEventListener('input', paint);
    paint();
  }

  // Home View (new) ---------------------------------------------------------
  function renderHomeV2() {
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
      <div class="home-layout">
        <aside class="side-list">
          <div class="search-row" style="margin-bottom:10px;">
            <input id="homeSearch" class="search-input" placeholder="Search groups..." />
            <button id="addGroupBtn" class="primary-btn">+ New</button>
          </div>
          <div id="groupSideList"></div>
        </aside>
        <section id="groupDetail" class="detail-pane"></section>
      </div>
    `;
    app.replaceChildren(container);
    $('#addGroupBtn').addEventListener('click', () => openGroupEditor());

    const q = $('#homeSearch');
    const side = $('#groupSideList');
    function renderSide() {
      const term = (q.value || '').trim().toLowerCase();
      side.replaceChildren(...groups
        .filter(g => g.name.toLowerCase().includes(term))
        .map(g => {
          const el = document.createElement('button');
          el.className = `side-item ${String(g.id) === String(selectedGroupId) ? 'selected' : ''}`;
          const postedToday = (g.posts || []).some(p => (p.userId === currentUser.id || p.userName === (currentUser.name||'')) && p.date === todayISO());
          el.innerHTML = `
            <span class="group-dot" style="background:${g.color}"></span>
            <div class="side-meta">
              <div class="name">${g.name}</div>
              <div class="muted small">${(Array.isArray(g.members) ? g.members.length : (Array.isArray(g.memberNames) ? g.memberNames.length : 0))} members • ${postedToday ? 'Posted today ✅' : 'Post today required'}</div>
            </div>`;
          el.addEventListener('click', () => { selectedGroupId = g.id; saveState(); renderGroupDetail(); renderSide(); });
          return el;
        }));
    }
    function renderGroupDetail() {
      const pane = $('#groupDetail');
      const g = groups.find(x => String(x.id) === String(selectedGroupId)) || groups[0];
      if (!g) { pane.innerHTML = '<div class="muted">No groups yet. Create one to get started.</div>'; return; }
      const uniqueUsers = g.memberNames && g.memberNames.length ? g.memberNames : Array.from(new Set((g.posts||[]).map(p => p.userName).filter(Boolean)));
      const photos = (g.posts || []);
      const me = (currentUser && currentUser.name) || '';
      const postedToday = (g.posts || []).some(p => (p && (p.userId === currentUser.id || p.userName === me) && p.date === todayISO()));
      pane.innerHTML = `
        <div class="group-card">
          ${g.cover ? `<div class="cover-banner"><img src="${g.cover}" alt="${g.name} cover" /></div>` : ''}
          <div class="group-hero">
            <div class="row" style="gap:12px; align-items:center;">
              <span class="group-dot" style="width:18px; height:18px; background:${g.color}"></span>
              <h2 class="group-title" style="margin:0; font-size:22px;">${g.name}</h2>
            </div>
            <div class="row" style="gap:8px;">
              <span class="chip">${(Array.isArray(g.members) ? g.members.length : (Array.isArray(g.memberNames) ? g.memberNames.length : 0))} member${((Array.isArray(g.members) ? g.members.length : (Array.isArray(g.memberNames) ? g.memberNames.length : 0)) === 1) ? '' : 's'}</span>
              ${uniqueUsers.slice(0,6).map(n => `<span class="chip">${n}</span>`).join('')}
            </div>
            <div class="muted">${g.description || 'No description'}</div>
            <div class="row" style="gap:8px;">
              <button class="primary-btn" id="addPhotoBtn">+ Add Photo</button>
              <a class="ghost-btn" href="/groups/${g.id}/invite/" target="_blank">Invite</a>
            </div>
          </div>
          <div class="group-content">
            ${postedToday
              ? (photos.length ? `<div class="post-grid">${photos.map(renderPostCardHTML).join('')}</div>` : `<div class="muted" style="padding:12px;">No photos yet. Be the first to post!</div>`)
              : `<div class="group-card" style="text-align:center; padding:14px; background: rgba(255,255,255,.03); border-radius: 12px;">
                   <div style="font-weight:600;">Feed locked</div>
                   <div class="muted">Post a photo today to view others' posts.</div>
                   <div class="row" style="justify-content:center; margin-top:8px;">
                     <button class="primary-btn" id="unlockBtn">Post Now</button>
                   </div>
                 </div>`}
          </div>
        </div>
      `;
      const addBtn = $('#addPhotoBtn', pane);
      if (addBtn) addBtn.addEventListener('click', () => openAddPostDialog(g.id));
      const unlock = $('#unlockBtn', pane);
      if (unlock) unlock.addEventListener('click', () => openAddPostDialog(g.id));
      $$('.post-card', pane).forEach((el) => attachPostHandlers(el, g.id));
    }
    q.addEventListener('input', () => { renderSide(); });
    renderSide();
    renderGroupDetail();
  }

  function renderGroupCard(group) {
    const meName = (currentUser && currentUser.name) || '';
    const postedByMeToday = (group.posts || []).some(p => (p && (p.userId === currentUser.id || p.userName === meName)) && p.date === todayISO());
    const visibleMembers = (group.members || []).slice(0, 6);
    const memberCount = group.memberCount ?? group.members.length;
    const remainingMembers = Math.max(0, memberCount - visibleMembers.length);
    const card = document.createElement('section');
    card.className = 'group-card';
    card.innerHTML = `
      ${group.cover ? `<div class="cover-thumb"><img src="${group.cover}" alt="${group.name} cover" /></div>` : ''}
      <div class="group-header">
        <span class="group-dot" style="background:${group.color}"></span>
        <div class="row" style="gap:12px">
          <div class="group-title">${group.name}</div>
          ${group.isPrivate ? '<span class="chip chip-private">Private</span>' : ''}
          <div class="group-date">${fmtDate(new Date())}</div>
          <div class="post-today ${postedByMeToday ? 'is-done' : ''}">
            <span class="dot"></span>
            ${postedByMeToday ? 'Posted today' : 'Post today required'}
          </div>
        </div>
        <div class="group-actions">
          <button class="ghost-btn" aria-label="Leaderboard" title="Leaderboard" data-leaderboard>🏆 Leaderboard</button>
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
            ${visibleMembers.length ? visibleMembers.map(m => `<span class='chip'>${m.name}</span>`).join(' ') : '<span class="muted">No members yet</span>'}
            ${remainingMembers > 0 ? `<span class='chip'>+${remainingMembers} more</span>` : ''}
          </div>
          ${group.isPrivate ? '<div><span class="chip chip-private">Private group — hidden from search</span></div>' : ''}
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
    const commentBlurb = post.latestComment ? post.latestComment : (post.commentCount ? 'View comments' : '');
    return `
      <article class="post-card" data-post-id="${post.id}">
        <img class="post-thumb" src="${post.imageUrl}" alt="Post by ${post.userName}" />
        <div class="post-meta">
          <span class="${isMe ? 'me' : ''}">${post.userName}</span>
          <button class="icon" title="Open">🔍</button>
        </div>
        ${post.commentCount ? `<div class="comment-preview">💬 ${post.commentCount} • ${commentBlurb}</div>` : ''}
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
  function openJoinGroupDialog() {
    if (!currentUser || currentUser.id === 'anon') { openAuthModal(); return; }
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <label>Search Public Groups
        <input id="joinSearch" class="search-input" placeholder="Type at least 2 characters..." />
      </label>
      <div id="joinResults" class="join-results muted">Start typing to explore public groups.</div>
    `;
    let searchTimer = null;

    async function performSearch(query) {
      const panel = $('#joinResults', wrap);
      if (!panel) return;
      const q = (query || '').trim();
      if (q.length < 2) {
        panel.innerHTML = `<div class="muted">Type at least 2 characters to search.</div>`;
        return;
      }
      panel.innerHTML = `<div class="muted">Searching&hellip;</div>`;
      try {
        const res = await getJSON(`/groups/?discover=1&q=${encodeURIComponent(q)}`);
        const results = res?.results || [];
        if (!results.length) {
          panel.innerHTML = `<div class="muted">No public groups found.</div>`;
          return;
        }
        panel.innerHTML = results.map((g) => `
          <article class="join-card">
            <div class="join-card__meta">
              <div class="row" style="gap:8px; align-items:center;">
                <span class="group-dot" style="background:${g.color || '#6b9bff'}"></span>
                <strong>${g.name}</strong>
                ${g.is_private ? '<span class="chip chip-private">Private</span>' : ''}
              </div>
              <div class="muted" style="font-size:13px;">${(g.member_count || 0)} member${g.member_count === 1 ? '' : 's'}</div>
            </div>
            <div class="join-card__desc">${g.description || '<span class="muted">No description</span>'}</div>
            <div class="row" style="justify-content:flex-end;">
              <button class="primary-btn" data-join="${g.id}" ${g.is_private ? 'disabled' : ''}>${g.is_private ? 'Private' : 'Join'}</button>
            </div>
          </article>
        `).join('');
        $$('[data-join]', panel).forEach((btn) => {
          btn.addEventListener('click', async () => {
            const groupId = btn.dataset.join;
            if (!groupId) return;
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Joining...';
            try {
              await postJSON(`/groups/${groupId}/join/`, {});
              await loadGroups();
              saveState();
              closeModal();
              render();
            } catch (e) {
              alert(e?.data?.detail || e.message || 'Unable to join group');
              btn.disabled = false;
              btn.textContent = original;
            }
          });
        });
      } catch (e) {
        panel.innerHTML = `<div class="muted">Search failed. Please try again.</div>`;
      }
    }

    openModal('Join Group', wrap, {
      onOpen() {
        const input = $('#joinSearch', wrap);
        if (input) {
          input.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => performSearch(input.value), 300);
          });
          input.focus();
        }
      }
    });
  }

  function renderGroups() {
    const app = document.getElementById('app');
    const container = document.createElement('div');
    if (!currentUser || currentUser.id === 'anon') {
      container.innerHTML = `
        <div class="row" style="justify-content:space-between; margin-bottom:12px;">
          <h2 style="margin:0">Groups</h2>
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
      <div class="home-layout">
        <aside class="side-list">
          <div class="search-row" style="margin-bottom:10px;">
            <input id="groupSearch" class="search-input" placeholder="Search groups..." />
            <button id="createGroupBtn" class="primary-btn">+ New</button>
          </div>
          <div id="groupSideList"></div>
        </aside>
        <section id="groupDetail" class="detail-pane"></section>
      </div>
    `;
    app.replaceChildren(container);
    $('#createGroupBtn').addEventListener('click', () => openGroupEditor());
    const joinBtn = $('#joinGroupBtn');
    if (joinBtn) joinBtn.addEventListener('click', () => openJoinGroupDialog());

    const q = $('#groupSearch');
    const side = $('#groupSideList');
    function renderSide() {
      const term = (q.value || '').trim().toLowerCase();
      side.replaceChildren(...groups
        .filter(g => g.name.toLowerCase().includes(term))
        .map(g => {
          const el = document.createElement('button');
          el.className = `side-item ${String(g.id) === String(selectedGroupId) ? 'selected' : ''}`;
          const postedToday = (g.posts || []).some(p => (p.userId === currentUser.id || p.userName === (currentUser.name||'')) && p.date === todayISO());
          el.innerHTML = `
            ${g.cover ? `<span class="cover-thumb"><img src="${g.cover}" alt="${g.name} cover"></span>` : `<span class="group-dot" style="background:${g.color}"></span>`}
            <div class="side-meta">
              <div class="name">${g.name}</div>
              <div class="muted small">${Array.isArray(g.members) ? g.members.length : 0} members • ${postedToday ? 'Posted today ✅' : 'Post today required'}</div>
            </div>`;
          el.addEventListener('click', () => { selectedGroupId = g.id; saveState(); renderGroupDetail(); renderSide(); });
          return el;
        }));
    }
    function renderGroupDetail() {
      const pane = $('#groupDetail');
      const g = groups.find(x => String(x.id) === String(selectedGroupId)) || groups[0];
      if (!g) { pane.innerHTML = '<div class="muted">No groups yet. Create one to get started.</div>'; return; }
      const uniqueUsers = Array.from(new Set((g.posts||[]).map(p => p.userName).filter(Boolean)));
      const photos = (g.posts || []);
      pane.innerHTML = `
        <div class="group-card">
          ${g.cover ? `<div class="cover-banner"><img src="${g.cover}" alt="${g.name} cover" /></div>` : ''}
          <div class="group-hero">
            <div class="row" style="gap:12px; align-items:center;">
              <span class="group-dot" style="width:18px; height:18px; background:${g.color}"></span>
              <h2 class="group-title" style="margin:0; font-size:22px;">${g.name}</h2>
            </div>
            <div class="row" style="gap:8px;">
              <span class="chip">${(Array.isArray(g.members) ? g.members.length : (Array.isArray(g.memberNames) ? g.memberNames.length : 0))} member${((Array.isArray(g.members) ? g.members.length : (Array.isArray(g.memberNames) ? g.memberNames.length : 0)) === 1) ? '' : 's'}</span>
              ${uniqueUsers.slice(0,6).map(n => `<span class="chip">${n}</span>`).join('')}
            </div>
            <div class="muted">${g.description || 'No description'}</div>
            <div class="row" style="gap:8px;">
              <button class="primary-btn" id="addPhotoBtn">+ Add Photo</button>
              <button class="ghost-btn" data-act="lb">🏆 Leaderboard</button>
            </div>
          </div>
          <div class="group-content">
            ${photos.length ? `<div class="post-grid">${photos.map(renderPostCardHTML).join('')}</div>` : `<div class="muted" style="padding:12px;">No photos yet. Be the first to post!</div>`}
          </div>
        </div>
      `;
      const addPhoto = $('#addPhotoBtn', pane);
      if (addPhoto) addPhoto.addEventListener('click', () => openAddPostDialog(g.id));
      const lbBtn = $('[data-act="lb"]', pane);
      if (lbBtn) lbBtn.addEventListener('click', () => openLeaderboardModal(g, 'weekly'));
      $$('.post-card', pane).forEach((el) => attachPostHandlers(el, g.id));
    }
    if (!groups.length) {
      const detail = $('#groupDetail');
      if (detail) {
        detail.innerHTML = `
          <section class="group-card" style="text-align:center; padding:32px;">
            <div class="muted" style="margin-bottom:12px;">No groups yet.</div>
            <div class="row" style="gap:8px; justify-content:center;">
              <button class="primary-btn" id="groupsJoinCta">Join Group</button>
              <button class="ghost-btn" id="groupsCreateCta">Create Group</button>
            </div>
          </section>
        `;
        $('#groupsJoinCta').addEventListener('click', () => openJoinGroupDialog());
        $('#groupsCreateCta').addEventListener('click', () => openGroupEditor());
      }
      return;
    }
    q.addEventListener('input', () => { renderSide(); });
    // Ensure we have a selection by default
    if (!selectedGroupId && groups.length) selectedGroupId = groups[0].id;
    renderSide();
    renderGroupDetail();
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
          ${g.cover ? `<span class="cover-thumb" style="width:40px; height:40px;"><img src="${g.cover}" alt="${g.name} cover" /></span>` : `<span class="group-dot" style="background:${g.color}"></span>`}
          <div>
            <div style="font-weight:600">${g.name}</div>
            <div class="muted" style="font-size:13px">${g.members.length} members</div>
          </div>
          <div class="tile-actions">
            <button class="ghost-btn" data-act="open">Open</button>
          </div>
        </div>
      `;
      el.querySelector('[data-act="open"]').addEventListener('click', () => { location.hash = '#groups'; requestAnimationFrame(() => { selectedGroupId = g.id; saveState(); render(); }); });
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
      <div class="comments">
        <div class="row" style="justify-content:space-between;">
          <strong>Comments</strong>
          <span class="muted" id="commentCount"></span>
        </div>
        <div id="commentList" class="comment-list muted">Loading comments...</div>
        <div id="replyMeta" class="muted hidden" style="font-size:12px; gap:6px; align-items:center;"></div>
        ${currentUser && currentUser.id !== 'anon' ? `
          <div class="row" style="gap:8px;">
            <input id="commentInput" class="search-input" placeholder="Add a comment..." />
            <button class="primary-btn" id="commentSubmit">Post</button>
          </div>
        ` : `<div class="muted">Sign in to add a comment.</div>`}
      </div>
    `;
    openModal('Post', wrap, {
      onOpen(root) {
        if ($('#editBtn', wrap)) $('#editBtn', wrap).addEventListener('click', () => { closeModal(); openEditPostModal(post, group); });
        const listEl = $('#commentList', wrap);
        const countEl = $('#commentCount', wrap);
        const replyMeta = $('#replyMeta', wrap);
        let commentTree = Array.isArray(post.comments) ? post.comments : [];
        let replyTo = null;

        function renderComments(list) {
          if (!listEl) return;
          if (!list || !list.length) {
            listEl.innerHTML = '<div class="muted">No comments yet.</div>';
            if (countEl) countEl.textContent = '';
            return;
          }
          listEl.classList.remove('muted');

          function renderTree(nodes, level = 0) {
            return nodes.map(c => {
              const replies = Array.isArray(c.replies) && c.replies.length ? renderTree(c.replies, level + 1) : '';
              return `
                <div class="comment" data-id="${c.id}" style="margin-left:${level * 12}px;">
                  <div class="row" style="justify-content:space-between;">
                    <strong>${c.user_name || 'User'}</strong>
                    <span class="muted" style="font-size:12px;">${fmtDate(new Date(c.created_at))}</span>
                  </div>
                  <div>${c.text}</div>
                  <div class="row" style="justify-content:flex-end; gap:6px;">
                    <button class="ghost-btn" data-reply="${c.id}" style="padding:4px 6px; font-size:12px;">Reply</button>
                  </div>
                </div>
                ${replies}
              `;
            }).join('');
          }

          listEl.innerHTML = renderTree(list);
          function countNodes(nodes) {
            return nodes.reduce((acc, n) => acc + 1 + (Array.isArray(n.replies) ? countNodes(n.replies) : 0), 0);
          }
          const totalCount = countNodes(list);
          if (countEl) countEl.textContent = `${totalCount} comment${totalCount === 1 ? '' : 's'}`;

          $$('[data-reply]', listEl).forEach(btn => {
            btn.addEventListener('click', () => {
              replyTo = btn.dataset.reply;
              const target = findCommentById(commentTree, replyTo);
              if (replyMeta) {
                replyMeta.classList.remove('hidden');
                replyMeta.innerHTML = `
                  <span>Replying to <strong>${target?.user_name || 'comment'}</strong></span>
                  <button class="ghost-btn" id="clearReply" style="padding:4px 6px; font-size:12px;">Cancel</button>
                `;
                $('#clearReply', replyMeta)?.addEventListener('click', () => clearReply());
              }
              const input = $('#commentInput', wrap);
              if (input) input.focus();
            });
          });
        }

        function clearReply() {
          replyTo = null;
          if (replyMeta) {
            replyMeta.classList.add('hidden');
            replyMeta.innerHTML = '';
          }
        }

        function findCommentById(nodes, id) {
          for (const c of nodes || []) {
            if (String(c.id) === String(id)) return c;
            const found = findCommentById(c.replies || [], id);
            if (found) return found;
          }
          return null;
        }

        function insertComment(tree, parentId, newComment) {
          if (!parentId) {
            tree.unshift(newComment);
            return true;
          }
          for (const c of tree) {
            if (String(c.id) === String(parentId)) {
              c.replies = c.replies || [];
              c.replies.unshift(newComment);
              return true;
            }
            if (c.replies && insertComment(c.replies, parentId, newComment)) return true;
          }
          return false;
        }

        async function loadComments() {
          if (listEl) listEl.innerHTML = '<div class="muted">Loading comments...</div>';
          try {
            const items = await fetchComments(post.id);
            commentTree = items;
            post.comments = items;
            const countNodes = (nodes) => nodes.reduce((acc, n) => acc + 1 + (Array.isArray(n.replies) ? countNodes(n.replies) : 0), 0);
            post.commentCount = countNodes(items);
            renderComments(items);
          } catch (e) {
            if (listEl) listEl.innerHTML = '<div class="muted">Unable to load comments.</div>';
          }
        }

        loadComments();

        const submit = $('#commentSubmit', wrap);
        if (submit) {
          submit.addEventListener('click', async () => {
            if (!currentUser || currentUser.id === 'anon') { openAuthModal(); return; }
            const input = $('#commentInput', wrap);
            const text = (input?.value || '').trim();
            if (!text) return;
            submit.disabled = true;
            submit.textContent = 'Posting...';
            try {
              const created = await createComment(post.id, text, replyTo);
              input.value = '';
              if (!commentTree) commentTree = [];
              insertComment(commentTree, replyTo, { ...created, replies: [] });
              clearReply();
              post.comments = commentTree;
              post.commentCount = (post.commentCount || 0) + 1;
              if (!replyTo) post.latestComment = created.text;
              renderComments(commentTree);
            } catch (e) {
              alert(e?.data?.detail || e.message || 'Failed to post comment');
            } finally {
              submit.disabled = false;
              submit.textContent = 'Post';
            }
          });
        }
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
    if (!isNew && group && !group.isCreator) {
      alert('Only the group creator can edit this group.');
      return;
    }
    const model = group ? { ...group } : { name: '', color: '#6b9bff', description: '', isPrivate: false };
    let coverFile = null;
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
        <label>Cover Image
          <input id="gCover" type="file" accept="image/*" />
          ${model.cover ? `<div class="muted" style="font-size:12px;">Current cover set</div>` : '<div class="muted" style="font-size:12px;">Optional</div>'}
        </label>
        
        <div class="row" style="justify-content:flex-end; gap:8px;">
          ${!isNew ? '<button class="ghost-btn" id="delete">Delete</button>' : ''}
          <button class="ghost-btn" data-close>Cancel</button>
          <button class="primary-btn" id="save">${isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    `;
    openModal(isNew ? 'Create Group' : 'Edit Group', wrap, { onOpen(){
      const coverInput = $('#gCover', wrap);
      if (coverInput) coverInput.addEventListener('change', (e) => { coverFile = e.target.files?.[0] || null; });
      $('#save', wrap).addEventListener('click', async () => {
        const name = ($('#gName', wrap).value || '').trim() || 'Untitled Group';
        const color = $('#gColor', wrap).value;
        const description = ($('#gDesc', wrap).value || '').trim();
        const isPrivate = Boolean($('#gPrivate', wrap)?.checked);
        try {
          if (isNew) {
            const created = await postJSON('/groups/', { name, color, description, is_public: !isPrivate });
            // Reload from backend to normalize shape and fetch posts
            await loadGroups();
            // Focus the newly created group on Home
            selectedGroupId = created?.id || selectedGroupId;
            saveState();
            const ng = groups.find(x => String(x.id) === String(created.id));
            if (coverFile && ng) {
              const fd = new FormData();
              fd.append('cover', coverFile);
              try { await uploadForm(`/groups/${ng.id}/cover/`, fd); await loadGroups(); } catch {}
            }
            if (routeFromHash() !== 'groups') location.hash = '#groups';
          } else {
            const g = await patchJSON(`/groups/${group.id}/`, { name, color, description, is_public: !isPrivate });
            const idx = groups.findIndex(x => x.id === group.id);
            if (idx !== -1) groups[idx] = { ...groups[idx], ...g, cover: g.cover_url || groups[idx].cover };
            if (coverFile) {
              const fd = new FormData();
              fd.append('cover', coverFile);
              try { await uploadForm(`/groups/${group.id}/cover/`, fd); await loadGroups(); } catch {}
            }
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
          if (!groups.length) selectedGroupId = null; else if (String(selectedGroupId) === String(group.id)) selectedGroupId = groups[0].id;
          saveState();
          closeModal();
          render();
        } catch (e) {
          alert(e?.data?.detail || e.message || 'Delete failed');
        }
      });
    }});
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
    try {
      const st = loadState && loadState();
      if (st && typeof st === 'object') {
        selectedGroupId = st.selectedGroupId || null;
      }
    } catch {}
    try { await initAuth(); } catch {}
    try {
      if (currentUser && currentUser.id !== 'anon') {
        await loadGroups();
      } else {
        groups = [];
      }
    } catch { }
    refreshAvatar();
    if (!location.hash) location.hash = '#groups';
    notifyDaily();
    render();
  }

  function groupsNeedingPostToday() {
    const me = (currentUser.name || '');
    const today = todayISO();
    return groups.filter(g => !((g.posts || []).some(p => p && (p.userId === currentUser.id || p.userName === me) && p.date === today)));
  }

  function notifyDaily() {
    if (!currentUser || currentUser.id === 'anon') return;
    const today = todayISO();
    const key = 'dg_last_notice';
    const last = localStorage.getItem(key);
    const due = last !== today;
    const missing = groupsNeedingPostToday();
    if (missing.length && due) {
      const bar = document.createElement('div');
      bar.className = 'notice-bar';
      bar.innerHTML = `
        <div class="row" style="justify-content:space-between; align-items:center; width:100%;">
          <div><strong>Daily reminder:</strong> You have ${missing.length} group${missing.length!==1?'s':''} to post in today.</div>
          <div class="row" style="gap:8px;">
            <button class="ghost-btn" id="jumpBtn">Review</button>
            <button class="ghost-btn" id="dismissBtn" aria-label="Dismiss">Dismiss</button>
          </div>
        </div>`;
      document.body.appendChild(bar);
      $('#dismissBtn', bar).addEventListener('click', () => { bar.remove(); localStorage.setItem(key, today); });
      $('#jumpBtn', bar).addEventListener('click', () => {
        location.hash = '#groups';
        selectedGroupId = missing[0]?.id || selectedGroupId;
        saveState();
        bar.remove();
        localStorage.setItem(key, today);
        render();
      });
    }
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
