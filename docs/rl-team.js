/* REDEFINE Login for the apps that use the REDEFINE team server (Form Filler, On Field, No Need Ask IO, Calculator).
   Same phone + email + PIN as every REDEFINE app. Master copy: REDEFINE Login/clients/rl-team.js, copied into each app.
   RLTeam.signIn({api, loginApi, appName, cancelable}) shows a full-screen sign-in and resolves with one of:
     {session: {name, code, owner: false, rl: true}}  signed in (code = this phone's own team-server session)
     {old: true}                                      "Owner: sign in with owner code" was chosen
     {cancel: true}                                   closed with "Not now" (only when cancelable)
   RLTeam.signOut(api, session, loginApi) ends the session on the server and forgets the REDEFINE login on this phone. */
(function () {
  if (window.RLTeam) return;
  var CSS = '.rlt{position:fixed;inset:0;z-index:2147483000;background:#F4F5F9;overflow:auto;-webkit-overflow-scrolling:touch;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,"Microsoft YaHei","PingFang SC",sans-serif;color:#1B2A4A;padding:calc(env(safe-area-inset-top,0px) + 28px) 18px 40px;box-sizing:border-box}' +
    '.rlt *{box-sizing:border-box}.rlt .rlt-card{max-width:400px;margin:0 auto}.rlt .rlt-brand{font-weight:800;letter-spacing:.28em;font-size:15px;color:#1B2A4A}' +
    '.rlt h2{font-size:26px;line-height:1.15;margin:6px 0 8px;color:#1B2A4A}.rlt p{margin:0 0 14px;color:#5B6478;font-size:15px}.rlt label{display:block;font-size:14px;font-weight:600;color:#3A4560;margin:12px 0 6px}' +
    '.rlt input{width:100%;font-size:17px;padding:13px 14px;border:1px solid #CDD2DE;border-radius:12px;background:#fff;color:#1B2A4A;-webkit-appearance:none;appearance:none}.rlt input:focus{outline:2px solid #1B2A4A;outline-offset:1px}' +
    '.rlt button{font:inherit;cursor:pointer}.rlt .rlt-go{width:100%;margin-top:18px;padding:14px;border:0;border-radius:12px;background:#1B2A4A;color:#fff;font-weight:700;font-size:17px}.rlt .rlt-go[disabled]{opacity:.6}' +
    '.rlt .rlt-alt{width:100%;margin-top:10px;padding:13px;border:2px solid #1B2A4A;border-radius:12px;background:#fff;color:#1B2A4A;font-weight:700;font-size:16px}' +
    '.rlt .rlt-err{color:#B42318;font-size:14px;min-height:20px;margin-top:10px}.rlt .rlt-small{font-size:13px;color:#5B6478;margin-top:14px}.rlt .rlt-links{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:18px}' +
    '.rlt .rlt-links a{color:#1B2A4A;font-size:13px;text-decoration:underline}.rlt .rlt-or{text-align:center;font-size:13px;color:#5B6478;margin:10px 0 0}';
  function css() { if (document.getElementById('rlt-css')) return; var s = document.createElement('style'); s.id = 'rlt-css'; s.textContent = CSS; document.head.appendChild(s); }
  function nice(v) {   // "WONG KAH JIAN" -> "Wong Kah Jian"; a name typed with care stays as it is
    v = String(v || '').replace(/\s+/g, ' ').trim();
    return v && v === v.toUpperCase() ? v.toLowerCase().replace(/(^|[\s\-'(\/])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }) : v;
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  // keep = true lets a sign-out finish even when the page reloads straight after
  function postJson(url, data, keep) {
    return fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(data || {}), keepalive: !!keep})
      .then(function (r) { return r.json().catch(function () { return {ok: false, error: 'offline'}; }); }, function () { return {ok: false, error: 'offline'}; });
  }
  function postTeam(api, data, keep) {
    return fetch(api, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(data), keepalive: !!keep})
      .then(function (r) { return r.json().catch(function () { return {error: 'upstream_error'}; }); }, function () { return {error: 'offline'}; });
  }
  var MSG = {
    no_match: 'Phone, email or PIN is not right. 资料不对，请再试一次。', wrong: 'Wrong PIN or code. 密码或验证码不对。',
    code_expired: 'This code has expired. Ask your leader for a new code. 验证码已过期，请向领导要新的。',
    locked: 'Too many tries. Wait 15 minutes. 试太多次了，请等 15 分钟。', pin_format: 'PIN must be 6 digits. PIN 必须是 6 位数。',
    pin_too_simple: 'That PIN is too easy to guess. Choose another. PIN 太容易猜，请换一个。',
    offline: 'No connection. Check your internet. 没有网络，请检查连接。', login_failed: 'Please sign in again. 请重新登入。',
    upstream_error: 'The team server had a problem. Try again in a minute. 服务器有问题，请稍后再试。',
    invalid_request: 'The team server needs its update first. Tell your leader. 服务器需要更新，请告诉领导。',
    same: 'The two PINs are not the same. 两次 PIN 不一样。', fill: 'Enter your phone, email and PIN. 请填写手机、电邮和 PIN。'
  };
  function text(code, left) { return (MSG[code] || 'Could not sign in (' + esc(code) + '). 无法登入。') + (code === 'wrong' && left != null ? ' (' + left + ' tries left 次)' : ''); }

  function signIn(o) {
    o = o || {};
    return new Promise(function (done) {
      css();
      var box = document.createElement('div'), st = {phone: '', email: '', code: ''}, prev = document.body.style.overflow;
      box.className = 'rlt'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Sign in');
      document.body.appendChild(box); document.body.style.overflow = 'hidden';
      function finish(r) { box.remove(); document.body.style.overflow = prev; done(r); }
      function $(id) { return box.querySelector('#' + id); }
      function busy(b, on, label) { if (!b) return; b.disabled = on; if (label) b.textContent = label; }
      function head(sub) { return '<div class="rlt-card"><div class="rlt-brand">REDEFINE</div><h2>' + esc(o.appName || 'Sign in') + '</h2>' + sub; }
      function team(token, btn, label) {
        busy(btn, true, 'Signing in… 登入中');
        return postTeam(o.api, {op: 'rlsignin', rltoken: token}).then(function (r) {
          if (r && r.code) return finish({session: {name: r.name, code: r.code, owner: false, rl: true}});
          if (r.error === 'login_failed') { lsSet('rl.token', ''); lsSet('rl.agent', ''); }
          busy(btn, false, label); showLogin(text(r.error));
        });
      }
      function got(r, btn, label) {   // a token from REDEFINE Login: keep it for the other REDEFINE apps on this phone, then sign in here
        lsSet('rl.token', r.token); lsSet('rl.agent', (r.agent && r.agent.name) || '');
        return team(r.token, btn, label);
      }
      function showLogin(msg) {
        var have = lsGet('rl.token'), nm = nice(lsGet('rl.agent'));
        box.innerHTML = head('<p>Sign in with your <b>REDEFINE login</b>, the same phone + email + PIN on every REDEFINE app. You stay signed in on this phone.<br>用 REDEFINE 登入，所有应用都一样，登入后一直保持登录。</p>') +
          (have ? '<button type="button" class="rlt-go" id="rltCont" style="margin-top:4px">Continue as ' + esc(nm || 'me') + ' 继续</button><p class="rlt-or">or sign in below 或在下面登入</p>' : '') +
          '<form id="rltForm" novalidate><label for="rltPhone">Phone number 手机号码</label><input id="rltPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="e.g. 012-345 6789" value="' + esc(st.phone) + '">' +
          '<label for="rltEmail">Email 电邮</label><input id="rltEmail" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="' + esc(st.email) + '">' +
          '<label for="rltSecret">PIN, or the 6-digit code from your leader<br><span style="font-weight:400">PIN，或领导给你的 6 位数验证码</span></label><input id="rltSecret" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password">' +
          '<div class="rlt-err" role="alert">' + (msg || '') + '</div><button class="' + (have ? 'rlt-alt' : 'rlt-go') + '" id="rltGo" type="submit">Sign in 登入</button></form>' +
          '<p class="rlt-small"><b>Forgot your PIN?</b> Ask your leader for a new code. 忘记 PIN？请向领导要新的验证码。</p>' +
          '<div class="rlt-links"><a href="#" id="rltOld">Owner: sign in with owner code</a>' + (o.cancelable ? '<a href="#" id="rltNo">Not now</a>' : '') + '</div></div>';
        if (have) $('rltCont').onclick = function () { team(have, $('rltCont'), 'Continue as ' + (nm || 'me') + ' 继续'); };
        $('rltOld').onclick = function (e) { e.preventDefault(); finish({old: true}); };
        if (o.cancelable) $('rltNo').onclick = function (e) { e.preventDefault(); finish({cancel: true}); };
        $('rltForm').onsubmit = function (e) {
          e.preventDefault();
          var b = $('rltGo'), d = {phone: $('rltPhone').value.trim(), email: $('rltEmail').value.trim(), secret: $('rltSecret').value.trim()};
          st.phone = d.phone; st.email = d.email;
          if (!d.phone || !d.email || !d.secret) { box.querySelector('.rlt-err').textContent = MSG.fill; return; }
          busy(b, true, 'Signing in… 登入中');
          postJson(o.loginApi + '/api/login', d).then(function (r) {
            if (r.ok && r.next === 'set_pin') { st.code = d.secret; return showPin(''); }
            if (r.ok && r.token) return got(r, b, 'Sign in 登入');
            busy(b, false, 'Sign in 登入'); showLogin(text(r.error, r.left));
          });
        };
      }
      function showPin(msg) {
        box.innerHTML = head('<p><b>Choose your own 6-digit PIN.</b> The same PIN works on every REDEFINE app.<br>设定你自己的 6 位数 PIN，所有应用都用这个。</p>') +
          '<form id="rltPin" novalidate><label for="rltP1">New PIN 新 PIN</label><input id="rltP1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">' +
          '<label for="rltP2">Type it again 再输入一次</label><input id="rltP2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password">' +
          '<div class="rlt-err" role="alert">' + (msg || '') + '</div><button class="rlt-go" id="rltSave" type="submit">Save PIN 保存</button></form></div>';
        $('rltPin').onsubmit = function (e) {
          e.preventDefault();
          var a = $('rltP1').value.trim(), b2 = $('rltP2').value.trim(), btn = $('rltSave');
          if (a !== b2) { box.querySelector('.rlt-err').textContent = MSG.same; return; }
          busy(btn, true, 'Saving… 保存中');
          postJson(o.loginApi + '/api/set-pin', {phone: st.phone, email: st.email, code: st.code, pin: a}).then(function (r) {
            if (r.ok && r.token) { st.code = ''; return got(r, btn, 'Save PIN 保存'); }
            busy(btn, false, 'Save PIN 保存');
            if (r.error === 'code_expired' || r.error === 'no_match' || r.error === 'wrong') return showLogin(text(r.error));
            showPin(text(r.error));
          });
        };
      }
      showLogin('');
    });
  }

  function signOut(api, s, loginApi) {
    if (s && s.rl && s.code && api) postTeam(api, {op: 'signout', code: s.code}, true);
    var t = lsGet('rl.token');
    if (t && loginApi) postJson(loginApi + '/api/logout', {token: t}, true);
    lsSet('rl.token', ''); lsSet('rl.agent', '');
  }

  window.RLTeam = {signIn: signIn, signOut: signOut};
})();
