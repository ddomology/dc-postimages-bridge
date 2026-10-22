/* Browser fixture for /mgallery/board/modify/. Load with DC's jQuery and
 * Summernote before content.js. Uses synthetic content and mock upload replies. */
const form = document.getElementById('write');
form.id = 'modify';
const subject = document.getElementById('subject');
subject.disabled = false;
subject.value = '기존 글 제목';
const postNumber = document.createElement('input');
postNumber.type = 'hidden'; postNumber.name = 'no'; postNumber.value = '12345';
form.append(postNumber);
const $memo = $('#memo');
$memo.summernote({ height: 230, toolbar: [['view', ['codeview', 'undo', 'redo']]] });
const original = '<p><b>기존 본문</b>과 <a href="https://example.com/">링크</a></p>' +
  '<p><img src="https://i.postimg.cc/QA000001/existing.png" alt="기존 이미지"></p>' +
  '<table><tbody><tr><td>표 내용</td></tr></tbody></table>' +
  '<div class="wrt_guide_preview_inn" contenteditable="false">기존 글에 저장된 내용</div><p>끝</p>';
$memo.summernote('code', original);
let popupUrl;
window.open = url => { popupUrl = url; return window; };
document.getElementById('results').textContent = '글 수정 화면 검사 준비 완료';
document.getElementById('run-tests').onclick = async function () {
  this.disabled = true;
  const lines = [];
  const root = document.getElementById('dc-postimages-helper')?.shadowRoot;
  const editable = document.querySelector('.note-editable');
  const image = 'https://i.postimg.cc/QA000001/added.png';
  const added = () => editable.querySelectorAll('img[src="' + image + '"]').length;
  function check(value, label) { if (!value) throw new Error(label); lines.push('PASS ' + label); }
  function insert() { root.getElementById('links').value = image; root.getElementById('insert').click(); }
  function reset() {
    $memo.summernote('code', original);
    const range = document.createRange(); range.selectNodeContents(editable); range.collapse(false);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    $memo.summernote('editor.setLastRange');
  }
  try {
    check(root && document.querySelectorAll('#dc-postimages-helper').length === 1, '수정 폼에서도 도우미 한 번 표시');
    check(editable.innerHTML === original, '수정 화면 진입 시 기존 본문을 전혀 바꾸지 않음');
    const guide = document.createElement('div'); guide.className = 'wrt_guide_preview_inn'; guide.textContent = '지연 로드된 기존 내용'; editable.append(guide);
    await new Promise(resolve => setTimeout(resolve, 30));
    check(guide.isConnected, '수정 화면에는 안내문 자동 정리를 적용하지 않음');
    reset(); insert();
    check(added() === 1 && editable.querySelector('img[alt="기존 이미지"]') && editable.querySelector('a').textContent === '링크' && editable.querySelector('td').textContent === '표 내용' && editable.textContent.includes('기존 글에 저장된 내용'), '직접 링크 삽입 시 기존 이미지·링크·표·본문 보존');
    check(subject.value === '기존 글 제목' && postNumber.value === '12345', '제목과 게시글 번호 유지');
    $memo.summernote('undo');
    check(editable.innerHTML === original, '실행 취소 한 번으로 기존 본문 복원');
    reset(); $memo.summernote('codeview.toggle');
    const code = document.querySelector('.note-codable').value;
    insert();
    check(document.querySelector('.note-codable').value === code && added() === 0 && !root.getElementById('retry').hidden, 'HTML 편집 중에는 원문을 바꾸지 않고 링크 보관');
    $memo.summernote('codeview.toggle'); root.getElementById('retry').click();
    check(added() === 1, 'HTML 모드 종료 후 삽입');
    reset(); root.getElementById('upload').click();
    const url = new URL(popupUrl);
    const callback = new URL(decodeURIComponent(url.searchParams.get('forumurl')));
    check(callback.pathname === '/mgallery/board/write/' && !callback.searchParams.has('no'), '수정 인증 없이 결과를 받을 글쓰기 콜백 주소 사용');
    const payload = { id: url.searchParams.get('areaid'), message: encodeURIComponent(image) };
    window.dispatchEvent(new MessageEvent('message', {origin:'https://postimages.org', source:window, data:payload}));
    check(added() === 1 && root.getElementById('retry').hidden, '업로드 응답을 원래 수정 본문에 자동 삽입');
    window.dispatchEvent(new MessageEvent('message', {origin:'https://postimages.org', source:window, data:payload}));
    check(added() === 1, '같은 업로드 응답 중복 삽입 방지');
    $memo.summernote('undo');
    check(editable.innerHTML === original, '자동 삽입도 실행 취소로 원문 복원');
  } catch (error) { lines.push('FAIL ' + error.stack); }
  document.getElementById('results').textContent = lines.join('\n') + '\n실제 업로드·글 수정 저장 없음';
  this.disabled = false;
};
