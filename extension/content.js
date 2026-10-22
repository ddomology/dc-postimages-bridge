/* DC Postimages helper — bundled code only; no cookie, login or submit access. */
(function () {
  'use strict';

  const MAX_TEXT = 200000;
  const MAX_IMAGES = 100;
  const UPLOAD_ORIGIN = 'https://postimages.org';

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

  function validReply(event, session) {
    return !!(session && !session.received && event.origin === UPLOAD_ORIGIN &&
      event.source === session.popup && event.data &&
      event.data.id === session.id && typeof event.data.message === 'string');
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { imageUrl, extractImages, imageMarkup, uploadUrl, validReply };
    return;
  }
  if (!/^\/(?:mgallery\/|mini\/|person\/)?board\/write\/?$/.test(location.pathname)) return;
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

  function mount(memo, editor, jq) {
    if (document.getElementById('dc-postimages-helper')) return;
    const host = document.createElement('div');
    host.id = 'dc-postimages-helper';
    host.style.cssText = 'display:block;clear:both;margin:12px 0;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host{color-scheme:light;font:13px/1.6 "Malgun Gothic",system-ui,sans-serif;color:#203047}
        *{box-sizing:border-box} .panel{border:1px solid #cbd9ed;border-radius:8px;background:#f5f8ff;padding:14px 16px}
        .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.brand{font-size:14px;color:#253e70;font-weight:700;margin-right:auto}
        .tag{font-size:11px;color:#61718a;font-weight:400;margin-left:7px}button{font:inherit;border:1px solid #bac8dd;background:#fff;color:#243854;border-radius:5px;padding:7px 12px;cursor:pointer}
        button:hover{background:#eaf0fb}button:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid #9abfff;outline-offset:2px}
        button.primary{background:#315fb5;color:#fff;border-color:#315fb5;font-weight:700}button.primary:hover{background:#244d98}
        button:disabled{opacity:.6;cursor:wait}.hint{margin:8px 0 0;font-size:12px;color:#60718b}
        #status{margin-top:7px;overflow-wrap:anywhere}#status[data-kind=error]{color:#a52d26}#status[data-kind=success]{color:#19653e}
        details{margin-top:8px}summary{cursor:pointer;color:#3f5780;width:fit-content}textarea{display:block;width:100%;min-height:85px;resize:vertical;border:1px solid #c4d0e2;border-radius:5px;padding:9px;margin:8px 0;font:12px/1.6 monospace;color:#172c48;background:#fff}
        label{display:block;margin-top:8px}.small{font-size:12px;color:#60718b}a{color:#315fb5} [hidden]{display:none!important}
      </style>
      <section class="panel" aria-label="Postimages 이미지 도우미">
        <div class="row"><span class="brand">Postimages 이미지 도우미<span class="tag">비공식 확장</span></span>
          <button class="primary" id="upload" type="button">Postimages 이미지 업로드</button>
          <button id="retry" type="button" hidden>삽입 다시 시도</button></div>
        <p class="hint">선택한 이미지를 Postimages에 올린 뒤 본문에 넣습니다. 글 등록은 디시의 등록 버튼으로 진행하세요.</p>
        <div id="status" role="status" aria-live="polite">본문에서 넣을 위치를 선택한 다음 업로드하세요.</div>
        <details id="manual"><summary>직접 링크로 넣기 · 자동 삽입이 안 될 때</summary>
          <label for="links">Postimages 직접 링크 / 포럼 코드</label>
          <textarea id="links" placeholder="https://i.postimg.cc/…/image.png" spellcheck="false"></textarea>
          <button id="insert" type="button">링크를 본문에 삽입</button>
          <p class="small">업로드 결과의 ‘직접 링크’ 또는 ‘포럼용 핫링크’를 복사하세요. 여러 장도 가능합니다. 이미지는 링크를 아는 사람이 볼 수 있습니다.</p>
        </details>
      </section>`;
    editor.before(host);
    const $memo = jq(memo);
    const uploadButton = root.getElementById('upload');
    const retryButton = root.getElementById('retry');
    const links = root.getElementById('links');
    const status = root.getElementById('status');
    let active = null;
    let queued = null;
    let closeTimer = null;

    function report(message, kind = 'info') {
      status.textContent = message;
      status.dataset.kind = kind;
    }
    function isCodeView() { return !!$memo.summernote('codeview.isActivated'); }
    function saveCursor() {
      if (!isCodeView()) {
        const selection = window.getSelection();
        const editable = editor.querySelector('.note-editable');
        if (selection && editable.contains(selection.anchorNode) && editable.contains(selection.focusNode)) {
          $memo.summernote('editor.setLastRange');
        }
      }
    }
    function stopWatching() {
      clearInterval(closeTimer);
      closeTimer = null;
      uploadButton.textContent = 'Postimages 이미지 업로드';
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
      const editable = editor.querySelector('.note-editable');
      const beforeCount = editable.querySelectorAll('img').length;
      try {
        $memo.summernote('focus');
        const saved = $memo.summernote('editor.getLastRange');
        if (!saved || !editable.contains(saved.sc) || !editable.contains(saved.ec)) {
          // Undo, HTML edits or page callbacks can detach the saved caret.
          // In that case append without deleting any part of the current draft.
          const range = document.createRange();
          range.selectNodeContents(editable);
          range.collapse(false);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          $memo.summernote('editor.setLastRange');
        }
        $memo.summernote('restoreRange');
        // Snapshot recent typing/codeview edits before the insertion so Undo
        // restores the exact current draft, even before typing's debounce runs.
        $memo.summernote('editor.afterCommand');
        $memo.summernote('pasteHTML', imageMarkup(urls));
        queued = null;
        retryButton.hidden = true;
        report(urls.length + '장의 이미지를 본문에 넣었습니다. 내용을 확인한 뒤 디시에서 등록하세요.', 'success');
      } catch {
        // Do not offer a blind retry if the editor changed before an exception.
        if (editable.querySelectorAll('img').length !== beforeCount) {
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
        report('열려 있는 Postimages 창에서 이미지를 선택해 주세요.');
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
      active = { id, popup, received: false };
      uploadButton.textContent = '업로드 창으로 이동';
      report('Postimages 창에서 이미지를 선택하세요. 업로드가 끝나면 본문에 자동으로 들어갑니다.');
      closeTimer = setInterval(() => {
        if (active && active.popup.closed) {
          const received = active.received;
          stopWatching();
          if (!received) report('업로드 창이 닫혔습니다. 이미지가 들어오지 않았다면 직접 링크를 붙여 넣어 주세요.');
        }
      }, 1000);
    });
    window.addEventListener('message', event => {
      if (!validReply(event, active)) return;
      active.received = true;
      stopWatching();
      try { insert(extractImages(event.data.message, true)); }
      catch (error) {
        root.getElementById('manual').open = true;
        report(error.message, 'error');
      }
    });
    retryButton.addEventListener('click', () => { if (queued) insert(queued); });
    root.getElementById('insert').addEventListener('click', () => {
      try { insert(extractImages(links.value)); }
      catch (error) { report(error.message, 'error'); }
    });
    window.addEventListener('pagehide', stopWatching, { once: true });
  }
})();
