// ==UserScript==
// @name         GOD MODE v10 Loader (iOS Focus ready)
// @namespace    dev.luongtuyen.godmode
// @version      10.0.0
// @description  Loader fetch-based, retry 3 lần + cache offline — chạy trên Focus/Userscripts iOS lẫn Android, không cần GM_xmlhttpRequest
// @author       Thien Tai Tu Toi
// @match        https://olm.vn/*
// @match        https://*.olm.vn/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
;(function () {
  'use strict';
  const SERVER_BASE = 'https://modgame.vercel.app';
  const SECRET = "a7f3c9e1b2d48506fae1c7d3b9f0e2a4c6d8f1a3b5e7c9d0f2a4c6e8b1d3f5a7";
  const AP = "/87eca45c96a7";
  const CACHE_KEY = '_tl_boot_cache_v10';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;

  function b64ToBytes(b64) {
    const bin = atob(b64); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function bootstrapKey() {
    if (!subtle) throw new Error('Trình duyệt không hỗ trợ WebCrypto (cần HTTPS / iOS 13+)');
    const base = await subtle.importKey('raw', enc.encode(SECRET), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('tl-bootstrap-v8-salt'), iterations: 1000, hash: 'SHA-256' }, base, 256);
    return subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['decrypt']);
  }
  async function fetchBootstrap() {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(SERVER_BASE + AP + '/bootstrap.js', { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (!json || !json.ok || !json.payload) throw new Error('payload lỗi');
        const key = await bootstrapKey();
        const plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(json.payload.iv) }, key, b64ToBytes(json.payload.data));
        const src = dec.decode(plain);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ v: json.v || 0, src: src, t: Date.now() })); } catch (_) {}
        return { src: src, v: json.v || 0 };
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && typeof c.src === 'string') return { src: c.src, v: c.v || 0, _cached: true };
    } catch (_) {}
    throw lastErr;
  }
  function showFail(msg) {
    try { const old = document.getElementById('tl-loader-fail'); if (old) old.remove(); } catch (_) {}
    const div = document.createElement('div');
    div.id = 'tl-loader-fail';
    div.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0d1117;color:#ff6b6b;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:14px;padding:20px;text-align:center;white-space:pre-wrap;';
    div.textContent = '⚠️ GOD MODE loader: ' + msg;
    (document.documentElement || document.body).appendChild(div);
  }
  function runConnector(src) {
    try {
      if (typeof window.GM_xmlhttpRequest !== 'function') {
        window.GM_xmlhttpRequest = function (opts) {
          opts = opts || {};
          const init = { method: opts.method || 'GET', credentials: 'include' };
          init.headers = Object.assign({}, opts.headers);
          if (opts.data != null) {
            init.body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data);
            if (!init.headers['Content-Type'] && !init.headers['content-type']) init.headers['Content-Type'] = 'application/json';
          }
          fetch(opts.url, init).then(function (r) {
            r.text().then(function (t) {
              if (opts.onload) opts.onload({ status: r.status, responseText: t, response: t, finalUrl: r.url });
            }).catch(function (e) { if (opts.onerror) opts.onerror(e); });
          }).catch(function (e) { if (opts.onerror) opts.onerror(e); });
        };
      }
      const fn = new Function('GM_xmlhttpRequest', 'GM_addStyle', 'unsafeWindow', src);
      fn.call(window, window.GM_xmlhttpRequest, (window.GM_addStyle || function () {}), window.unsafeWindow || window);
    } catch (e) {
      showFail('Lỗi chạy connector: ' + (e && e.message ? e.message : e));
    }
  }
  fetchBootstrap().then(function (r) { runConnector(r.src); })
    .catch(function (e) { showFail('không tải được code từ server: ' + (e && e.message ? e.message : e)); });
})();
