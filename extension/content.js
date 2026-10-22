/* DC Postimages helper — bundled code only; no cookie, login or submit access. */
(function () {
  'use strict';

  const MAX_TEXT = 200000;
  const MAX_IMAGES = 100;
  const UPLOAD_ORIGIN = 'https://postimages.org';
  const REDIRECT_TYPE = 'dcpi:redirect';
  const ACK_TYPE = 'dcpi:received';

  function imageUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== 'i.postimg.cc' ||
          url.username || url.password || url.port ||
          !/^\/[^/]+\/[^/]+/.test(url.pathname)) return null;
      url.hash = '';
      return url.href;
    } catch { return null; }
  }

  function extractImages(text, encoded = false) {
    if (typeof text !== 'string' || text.length > MAX_TEXT) {
      throw new Error('링크 내용이 너무 길거나 올바르지 않습니다.');
    }
    if (encoded) {
      try { text = decodeURIComponent(text); }
      catch { throw new Error('업로드 결과를 해석하지 못했습니다. 직접 링크를 붙여 넣어 주세요.'); }
    }
    const result = [];
    // Extract URLs only. Never insert returned HTML or executable markup.
    for (const match of text.matchAll(/https:\/\/[^\s<>"'\[\]]+/gi)) {
      const url = imageUrl(match[0].replace(/&amp;/g, '&'));
      if (url && !result.includes(url)) result.push(url);
      if (result.length > MAX_IMAGES) throw new Error('이미지는 한 번에 100장까지 넣을 수 있습니다.');
    }
    if (!result.length) throw new Error('i.postimg.cc로 시작하는 직접 이미지 링크 또는 Postimages의 포럼 코드를 넣어 주세요.');
    return result;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function imageMarkup(urls) {
    if (!Array.isArray(urls) || !urls.length || urls.length > MAX_IMAGES || urls.some(url => !imageUrl(url))) {
      throw new Error('올바른 Postimages 이미지가 아닙니다.');
    }
    return urls.map(url => '<p><img src="' + escapeHtml(imageUrl(url)) +
      '" alt="" style="max-width:100%;height:auto;"></p>').join('') + '<p><br></p>';
  }

  function uploadUrl(areaId, pageUrl) {
    const page = new URL(pageUrl);
    // Pass only the gallery address; exclude any unrelated query parameters.
    const forum = new URL(page.origin + page.pathname);
    if (page.searchParams.has('id')) forum.searchParams.set('id', page.searchParams.get('id'));
    const query = new URLSearchParams({
      mode: 'phpbb3', areaid: areaId, hash: '1', pm: '1', lang: 'ko', code: 'hotlink',
      // Matches the official Postimages plugin's encoding contract.
      forumurl: encodeURIComponent(forum.href)
    });
    return UPLOAD_ORIGIN + '/upload?' + query;
  }

  function redirectResult(hash) {
    if (typeof hash !== 'string' || hash.length > MAX_TEXT * 3 + 512) return null;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const id = params.get('postimage_id');
    if (!/^dcpi_[a-f0-9]{32}$/.test(id || '') ||
        params.getAll('postimage_id').length !== 1 || params.getAll('postimage_text').length !== 1) return null;
    // URLSearchParams decodes the callback once, including encoded '+' signs.
    // Relay only normalized image URLs, never the returned HTML/BBCode.
    try { return { type: REDIRECT_TYPE, id, message: extractImages(params.get('postimage_text')).join('\n') }; }
    catch { return null; }
  }

  function validRedirect(data, id) {
    return !!(data && data.type === REDIRECT_TYPE && data.id === id &&
      typeof data.message === 'string' && data.message.length <= MAX_TEXT);
  }

  function validReply(event, session) {
    return !!(session && !session.received && event.source === session.popup && event.data &&
      event.data.id === session.id && typeof event.data.message === 'string' &&
      (event.origin === UPLOAD_ORIGIN ||
        (event.origin === session.origin && validRedirect(event.data, session.id))));
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { imageUrl, extractImages, imageMarkup, uploadUrl, validReply, redirectResult, validRedirect };
    return;
  }
  if (!/^\/(?:mgallery\/|mini\/|person\/)?board\/write\/?$/.test(location.pathname)) return;
  const returned = redirectResult(location.hash);
  if (returned) { relayRedirect(returned); return; }
  if (document.getElementById('dc-postimages-helper')) return;

  let attempts = 0;
  const initTimer = setInterval(() => {
    attempts++;
    const memo = document.querySelector('#write textarea#memo');
    const editor = memo && memo.parentElement.querySelector('.note-editor');
    const jq = window.jQuery;
    if (memo && editor && jq && jq.fn.summernote && jq(memo).data('summernote')) {
      clearInterval(initTimer);
      mount(memo, editor, jq);
    } else if (attempts >= 120) clearInterval(initTimer);
  }, 250);

  function relayRedirect(data) {
    // Postimages may return through /mod -> forum URL instead of postMessage.
    // BroadcastChannel also works if cross-origin navigation severed opener.
    let channel = null;
    try { channel = new BroadcastChannel('dcpi:' + data.id); } catch {}
    const parent = window.opener;
    let done = false;
    let timer;
    let deadline;
    let fallback;
    function cleanup() {
      clearInterval(timer);
      clearTimeout(deadline);
      channel?.close();
      window.removeEventListener('message', onMessage);
    }
    function acknowledge(message) {
      if (done || !message || message.type !== ACK_TYPE || message.id !== data.id) return;
      done = true;
      cleanup();
      fallback?.remove();
      try { parent?.focus(); } catch {}
      window.close();
    }
    function onMessage(event) {
      if (event.origin === location.origin && event.source === parent) acknowledge(event.data);
    }
    window.addEventListener('message', onMessage);
    if (channel) channel.onmessage = event => acknowledge(event.data);
    function send() {
      try { parent?.postMessage(data, location.origin); } catch {}
      channel?.postMessage(data);
    }
    function showRecovery() {
      if (done) return;
      if (!document.body) { document.addEventListener('DOMContentLoaded', showRecovery, { once: true }); return; }
      fallback = document.createElement('div');
      fallback.setAttribute('role', 'status');
      fallback.style.cssText = 'position:fixed;z-index:2147483647;left:20px;right:20px;top:20px;max-width:640px;margin:auto;padding:20px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#202020;font:14px/1.7 sans-serif;box-shadow:0 4px 20px #0002';
      const text = document.createElement('p');
      text.textContent = '원래 글쓰기 창에 연결하지 못했습니다. 아래 링크를 복사해 원래 창의 ‘직접 링크로 넣기’에 붙여 넣으세요.';
      const input = document.createElement('textarea');
      input.readOnly = true;
      input.value = data.message;
      input.setAttribute('aria-label', '업로드한 이미지 링크');
      input.style.cssText = 'box-sizing:border-box;width:100%;min-height:90px;padding:8px;font:13px/1.6 monospace';
      input.addEventListener('focus', () => input.select());
      fallback.append(text, input);
      document.body.prepend(fallback);
    }
    timer = setInterval(send, 250);
    deadline = setTimeout(() => { cleanup(); showRecovery(); }, 5000);
    window.addEventListener('pagehide', cleanup, { once: true });
    send();
  }

  function mount(memo, editor, jq) {
    if (document.getElementById('dc-postimages-helper')) return;
    const host = document.createElement('div');
    host.id = 'dc-postimages-helper';
    host.style.cssText = 'display:block;clear:both;margin:12px 0;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{color-scheme:light;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",sans-serif;color:#202020}
        *{box-sizing:border-box}.panel{border:1px solid #e2e2e2;border-radius:6px;background:#fff;padding:12px}
        .toolbar{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}
        button{font:inherit;font-weight:500;min-height:34px;border:1px solid #d5d5d5;background:#fff;color:#202020;border-radius:5px;padding:6px 13px;cursor:pointer;white-space:nowrap}
        button:hover{background:#f5f5f5;border-color:#bbb}button:active{background:#ededed}
        button:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid #202020;outline-offset:3px}
        button.primary{background:#202020;color:#fff;border-color:#202020}button.primary:hover{background:#383838;border-color:#383838}button.primary:active{background:#111}
        button:disabled{opacity:.5;cursor:wait}details{flex:1;min-width:240px}
        summary{display:flex;align-items:center;gap:8px;min-height:34px;width:fit-content;list-style:none;cursor:pointer;color:#666;font-size:12px}
        summary::-webkit-details-marker{display:none}summary::before{content:"";width:5px;height:5px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;transform:rotate(-45deg);flex:none}
        details[open]>summary::before{transform:rotate(45deg)}summary:hover{color:#202020}
        .manual-fields{padding-top:10px}textarea{display:block;width:100%;min-height:90px;resize:vertical;border:1px solid #d5d5d5;border-radius:5px;padding:10px;margin:0 0 10px;font:12px/1.6 ui-monospace,Consolas,monospace;color:#202020;background:#fafafa}
        textarea::placeholder{color:#8b8b8b}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
        #status{margin:10px 0 0;font-size:12px;color:#555;overflow-wrap:anywhere}#status[data-kind=error]{color:#a52d26}#retry{margin-top:10px}
        [hidden]{display:none!important}
      </style>
      <section class="panel" aria-label="이미지 업로드">
        <div class="toolbar">
          <button class="primary" id="upload" type="button">이미지 업로드</button>
          <details id="manual"><summary>직접 링크로 넣기(자동 삽입이 안 될 때)</summary>
            <div class="manual-fields">
              <label class="sr-only" for="links">Postimages 직접 링크 또는 포럼 코드</label>
              <textarea id="links" placeholder="https://i.postimg.cc/…/image.png" spellcheck="false"></textarea>
              <button id="insert" type="button">본문에 넣기</button>
            </div>
          </details>
        </div>
        <div id="status" role="status" aria-live="polite" hidden></div>
        <button id="retry" type="button" hidden>삽입 다시 시도</button>
      </section>`;
    editor.before(host);
    const $memo = jq(memo);
    const editable = editor.querySelector('.note-editable');
    const guideSelector = '.wrt_guide_preview_inn, #wrt_guide_preview_inn';
    const uploadButton = root.getElementById('upload');
    const retryButton = root.getElementById('retry');
    const links = root.getElementById('links');
    const status = root.getElementById('status');
    let active = null;
    let queued = null;
    let closeTimer = null;
    let sessionDeadline = null;

    function closeChannel() {
      active?.channel?.close();
      if (active) active.channel = null;
      clearTimeout(sessionDeadline);
    }

    function report(message, kind = 'info') {
      status.textContent = message;
      status.dataset.kind = kind;
      status.hidden = false;
    }
    function isCodeView() { return !!$memo.summernote('codeview.isActivated'); }
    function cleanGuides() {
      // Code view owns a separate buffer. Never overwrite it from the DOM.
      if (isCodeView()) return;
      const guides = editable.querySelectorAll(guideSelector);
      guides.forEach(guide => guide.remove());
      // DC's onFocus/onChange calls wrt_guide_del while this flag is true.
      // That function focuses again even when the guide has already gone.
      // Clear the known guide flag before any Summernote focus/change call.
      // It is a global lexical binding on DC, not a window property.
      if (typeof isWrtGuide === 'boolean') isWrtGuide = false;
      if (!guides.length) return;
      if (!editable.hasChildNodes()) editable.innerHTML = '<p><br></p>';
      memo.value = editable.innerHTML;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
    }
    cleanGuides();
    const guideObserver = new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node =>
        node.nodeType === 1 && (node.matches(guideSelector) || node.querySelector(guideSelector))))) cleanGuides();
    });
    guideObserver.observe(editable, { childList: true, subtree: true });
    $memo.on('summernote.codeview.toggled.dcpi', cleanGuides);

    function usableRange(range) {
      return range && [range.startContainer, range.endContainer].every(node =>
        editable.contains(node) && !(node.nodeType === 1 ? node : node.parentElement)?.closest('[contenteditable="false"]'));
    }
    function savedRange() {
      try {
        const saved = $memo.summernote('editor.getLastRange');
        const range = document.createRange();
        range.setStart(saved.sc, saved.so);
        range.setEnd(saved.ec, saved.eo);
        return usableRange(range) ? range : null;
      } catch { return null; }
    }
    function selectRange(range) {
      if (!usableRange(range)) {
        range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
      }
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      $memo.summernote('editor.setLastRange');
    }
    function saveCursor() {
      if (!isCodeView()) {
        const selection = window.getSelection();
        if (selection && editable.contains(selection.anchorNode) && editable.contains(selection.focusNode)) {
          $memo.summernote('editor.setLastRange');
        }
      }
    }
    function stopWatching() {
      clearInterval(closeTimer);
      closeTimer = null;
      uploadButton.textContent = '이미지 업로드';
    }
    function insert(urls) {
      queued = urls;
      retryButton.hidden = false;
      // Keep a recoverable copy without changing the user's editor on errors.
      links.value = urls.join('\n');
      if (!memo.isConnected || !editor.isConnected) {
        report('편집기가 바뀌었습니다. 직접 링크를 복사해 보관한 뒤 글쓰기 화면을 다시 열어 주세요.', 'error');
        return;
      }
      if (isCodeView()) {
        report('HTML 모드를 끈 다음 ‘삽입 다시 시도’를 눌러 주세요. 이미지 링크는 아래에 보관되어 있습니다.', 'error');
        return;
      }
      let beforeHtml;
      try {
        // A live native Range follows text-node normalization. Summernote's
        // stored wrapper keeps detached nodes and can fail on the first paste.
        const range = savedRange();
        cleanGuides();
        $memo.summernote('focus');
        cleanGuides();
        selectRange(range);
        // Snapshot recent typing/codeview edits before the insertion so Undo
        // restores the current draft. afterCommand normalizes nodes and runs
        // DC callbacks, so refresh the saved range AFTER it, not before it.
        $memo.summernote('editor.afterCommand');
        selectRange(range);
        const markup = imageMarkup(urls);
        const count = url => Array.from(editable.querySelectorAll('img')).filter(img => img.getAttribute('src') === url).length;
        const counts = urls.map(count);
        beforeHtml = editable.innerHTML;
        try {
          $memo.summernote('pasteHTML', markup);
        } catch (error) {
          // One safe fallback only if no part of the draft changed. Never
          // repeat a paste that partially inserted or deleted content.
          if (editable.innerHTML !== beforeHtml || isCodeView()) throw error;
          cleanGuides();
          selectRange(null);
          $memo.summernote('pasteHTML', markup);
        }
        if (urls.some((url, index) => count(url) !== counts[index] + 1)) throw new Error('Incomplete insertion');
        memo.value = editable.innerHTML;
        queued = null;
        retryButton.hidden = true;
        report('이미지 ' + urls.length + '장을 넣었습니다.', 'success');
      } catch {
        // Do not offer a blind retry if the editor changed before an exception.
        if (beforeHtml !== undefined && editable.innerHTML !== beforeHtml) {
          queued = null;
          retryButton.hidden = true;
          report('편집 중 오류가 발생했습니다. 일부 이미지가 들어갔을 수 있으니 본문을 확인해 주세요. 직접 링크는 아래에 남겨 두었습니다.', 'error');
        } else {
          report('본문에 넣지 못했습니다. 넣을 위치를 다시 선택한 뒤 ‘삽입 다시 시도’를 누르세요.', 'error');
        }
      }
    }

    [uploadButton, retryButton, root.getElementById('insert')].forEach(button => {
      button.addEventListener('pointerdown', saveCursor);
      button.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') saveCursor();
      });
    });
    uploadButton.addEventListener('click', () => {
      if (active && !active.received && !active.popup.closed) {
        active.popup.focus();
        report('열린 업로드 창에서 이미지를 선택하세요.');
        return;
      }
      if (isCodeView()) {
        report('HTML 모드를 끈 뒤 업로드하세요.', 'error');
        return;
      }
      const id = 'dcpi_' + crypto.randomUUID().replace(/-/g, '');
      const popup = window.open(uploadUrl(id, location.href), id,
        'popup=yes,width=760,height=740,resizable=yes,scrollbars=yes');
      if (!popup) {
        report('팝업이 차단됐습니다. 이 글쓰기 페이지의 팝업을 허용하고 다시 눌러 주세요. 직접 링크로도 삽입할 수 있습니다.', 'error');
        return;
      }
      stopWatching();
      closeChannel();
      let channel = null;
      try { channel = new BroadcastChannel('dcpi:' + id); } catch {}
      active = { id, popup, origin: location.origin, received: false, channel };
      if (channel) channel.onmessage = event => {
        if (!active || active.received || !validRedirect(event.data, active.id)) return;
        if (receive(event.data.message, false)) {
          channel.postMessage({ type: ACK_TYPE, id });
          closeChannel();
        }
      };
      // One bounded timeout; no background polling after a result is received.
      sessionDeadline = setTimeout(closeChannel, 30 * 60 * 1000);
      uploadButton.textContent = '업로드 창으로 이동';
      report('업로드 창에서 이미지를 선택하세요.');
      closeTimer = setInterval(() => {
        if (active && active.popup.closed) {
          const received = active.received;
          stopWatching();
          if (!received) report('업로드 창이 닫혔습니다. 이미지가 들어오지 않았다면 직접 링크를 붙여 넣어 주세요.');
        }
      }, 1000);
    });
    function receive(message, encoded) {
      try {
        const urls = extractImages(message, encoded);
        active.received = true;
        stopWatching();
        insert(urls);
        return true;
      }
      catch (error) {
        root.getElementById('manual').open = true;
        report(error.message, 'error');
        return false;
      }
    }
    window.addEventListener('message', event => {
      if (!validReply(event, active)) return;
      if (receive(event.data.message, event.origin === UPLOAD_ORIGIN)) {
        if (event.data.type === REDIRECT_TYPE) {
          event.source.postMessage({ type: ACK_TYPE, id: active.id }, active.origin);
        }
        closeChannel();
      }
    });
    retryButton.addEventListener('click', () => { if (queued) insert(queued); });
    root.getElementById('insert').addEventListener('click', () => {
      try { insert(extractImages(links.value)); }
      catch (error) { report(error.message, 'error'); }
    });
    window.addEventListener('pagehide', () => {
      stopWatching();
      closeChannel();
      guideObserver.disconnect();
      $memo.off('.dcpi');
    }, { once: true });
  }
})();
