/* Browser regression fixture. Load before content.js with DC's jQuery and
 * Summernote, #write textarea#memo, #run-tests and #results. No upload/post. */
let isWrtGuide = false;
let silentFixture = true;
let focusDepth = 0;
function removeFixtureGuide() {
  const guide = document.querySelector('.note-editable .wrt_guide_preview_inn');
  if (guide) { guide.remove(); isWrtGuide = false; }
  if (++focusDepth > 8) { focusDepth = 0; throw new Error('Recursive guide focus'); }
  try { $('#memo').summernote('focus'); } finally { focusDepth--; }
}
$('#memo').summernote({ height: 160, toolbar: [['view', ['codeview', 'undo', 'redo']]], callbacks: {
  onFocus() { if (isWrtGuide) removeFixtureGuide(); },
  onChange() { if (!silentFixture && isWrtGuide) removeFixtureGuide(); }
} });
const guideMarkup = '<div class="wrt_guide_preview_inn" contenteditable="false">게시글 작성시 말머리 안내<br><b>The Singularity is Coming</b></div>';
$('#memo').summernote('code', '<p><br></p>' + guideMarkup);
isWrtGuide = true;
silentFixture = false;
let popupUrl;
window.open = url => { popupUrl = url; return window; };
document.getElementById('results').textContent = '안내문·첫 삽입 회귀 검사 준비 완료';
document.getElementById('run-tests').onclick = async function () {
  this.disabled = true;
  const lines = [];
  const $memo = $('#memo');
  const editable = document.querySelector('.note-editable');
  const root = document.getElementById('dc-postimages-helper').shadowRoot;
  const url = 'https://i.postimg.cc/QA000001/first-insert.png';
  const pause = () => new Promise(resolve => setTimeout(resolve, 30));
  const hasGuide = () => !!editable.querySelector('.wrt_guide_preview_inn, #wrt_guide_preview_inn');
  const count = () => editable.querySelectorAll('img[src="' + url + '"]').length;
  function check(value, name) { lines.push((value ? 'PASS ' : 'FAIL ') + name); }
  function reset(html = '<p>기존 본문 보존</p>') {
    isWrtGuide = false;
    silentFixture = true;
    if ($memo.summernote('codeview.isActivated')) $memo.summernote('codeview.toggle');
    $memo.summernote('code', html);
    silentFixture = false;
  }
  function caret(node, offset) {
    const range = document.createRange();
    range.setStart(node, offset); range.collapse(true);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    $memo.summernote('editor.setLastRange');
  }
  function insert() { root.getElementById('links').value = url; root.getElementById('insert').click(); }
  try {
    check(!hasGuide() && $memo.summernote('code') === '<p><br></p>', '최초 안내문만 제거하고 빈 문단 유지');
    reset('<p>기존 본문 <a href="https://example.com">링크</a></p><div contenteditable="false">보존할 위젯</div><p><img src="https://i.postimg.cc/QA000001/existing.png"></p>');
    const draft = editable.innerHTML;
    document.getElementById('subject').disabled = false;
    document.getElementById('subject').focus();
    const activeElement = document.activeElement;
    editable.insertAdjacentHTML('beforeend', guideMarkup);
    document.getElementById('memo').value = editable.innerHTML;
    isWrtGuide = true;
    await pause();
    check(editable.innerHTML === draft && !hasGuide(), '늦게 들어온 안내문 제거, 본문·링크·이미지·위젯 보존');
    check(document.activeElement === activeElement, '안내문 정리 시 제목 입력 포커스 유지');
    check(document.getElementById('memo').value === draft, '원본 textarea 동기화');
    // DC can set its guide flag after the guide DOM has already been removed.
    isWrtGuide = true;
    insert();
    check(count() === 1 && !isWrtGuide, '늦게 설정된 안내문 상태도 삽입 전 정리');

    reset();
    $memo.summernote('codeview.toggle');
    const code = '<p>HTML에서 작성 중</p>' + guideMarkup;
    document.querySelector('.note-codable').value = code;
    editable.insertAdjacentHTML('beforeend', guideMarkup);
    await pause();
    check(document.querySelector('.note-codable').value === code, 'HTML 모드의 작성 내용 보존');
    $memo.summernote('codeview.toggle');
    await pause();
    check(!hasGuide() && editable.textContent === 'HTML에서 작성 중', 'HTML 모드 종료 시 안내문만 정리');

    reset('<p>앞뒤 본문</p>' + guideMarkup);
    const guide = editable.querySelector('.wrt_guide_preview_inn');
    caret(guide.firstChild, 3);
    isWrtGuide = true;
    insert();
    check(count() === 1 && !hasGuide() && editable.textContent.includes('앞뒤 본문'), '안내문 내부의 오래된 커서에서도 첫 삽입 성공');

    reset('<p></p>');
    const p = editable.firstChild;
    p.append(document.createTextNode('앞'), document.createTextNode('중간뒤'));
    caret(p.lastChild, 2);
    insert();
    check(count() === 1 && root.getElementById('retry').hidden, '텍스트 노드 병합 후에도 재시도 버튼 없이 첫 삽입 성공');
    check(editable.innerHTML.indexOf('앞중간') < editable.innerHTML.indexOf('<img') && editable.innerHTML.lastIndexOf('뒤') > editable.innerHTML.indexOf('<img'), '노드 병합 후 원래 커서 위치에 삽입');
    $memo.summernote('undo');
    check(count() === 0 && editable.textContent === '앞중간뒤', '실행 취소 한 번으로 현재 본문 복원');

    reset();
    caret(editable.firstChild.firstChild, 5);
    editable.firstChild.firstChild.textContent = '짧음';
    insert();
    check(count() === 1 && editable.textContent.includes('짧음'), '오래된 커서 오프셋 복구');

    reset();
    const editor = $memo.data('summernote').modules.editor;
    const originalPaste = editor.pasteHTML;
    let attempts = 0;
    editor.pasteHTML = function (markup) { if (++attempts === 1) throw new Error('Transient range'); return originalPaste.call(this, markup); };
    insert();
    editor.pasteHTML = originalPaste;
    check(count() === 1 && attempts === 2 && root.getElementById('retry').hidden, '본문 변화 없는 일시 오류는 한 번 자동 복구');

    reset(); attempts = 0;
    editor.pasteHTML = function (markup) { attempts++; originalPaste.call(this, markup); throw new Error('After paste'); };
    insert();
    editor.pasteHTML = originalPaste;
    check(count() === 1 && attempts === 1 && root.getElementById('retry').hidden, '일부 변경 뒤 오류가 나면 중복 삽입하지 않음');

    reset('<p>자동 삽입 본문</p>' + guideMarkup);
    isWrtGuide = true;
    root.getElementById('upload').click();
    const payload = { id: new URL(popupUrl).searchParams.get('areaid'), message: encodeURIComponent('[img]' + url + '[/img]') };
    window.dispatchEvent(new MessageEvent('message', {origin:'https://postimages.org', source:window, data:payload}));
    window.dispatchEvent(new MessageEvent('message', {origin:'https://postimages.org', source:window, data:payload}));
    check(count() === 1 && !hasGuide() && root.getElementById('status').dataset.kind === 'success', '안내문이 있는 업로드 응답도 한 번만 자동 삽입');
  } catch (error) { lines.push('FAIL ' + error.stack); }
  document.getElementById('results').textContent = lines.join('\n') + '\n실제 업로드·글 등록 없음';
  this.disabled = false;
};
