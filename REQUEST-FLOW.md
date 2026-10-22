# 요청 흐름

v1.0.2 · 분석일 2026-10-22

화면의 **이미지 업로드** 버튼은 Postimages 팝업을 열고, **직접 링크로 넣기(자동 삽입이 안 될 때)**는 링크를 편집기에 삽입합니다. v1.0.2는 결과가 글쓰기 URL로 돌아오는 리다이렉트 경로를 추가 처리합니다.

## Postimages

공식 게시판 플러그인 `https://mod.postimage.org/phpbb3-ko-hotlink.js`는 `/upload` 팝업을 열 때 `mode=phpbb3`, `areaid`, `hash=1`, `pm=1`, `lang=ko`, `code=hotlink`, `forumurl`을 전달합니다. `forumurl`은 원본 플러그인처럼 사전 URL 인코딩 후 쿼리로 인코딩합니다.

팝업의 폼은 `POST https://postimages.org/json`으로 multipart 업로드합니다. 페이지 및 업로드 자바스크립트에서 확인한 주요 필드는 `file`, `gallery`, `optsize`, `expire`, `numfiles`, `upload_session`입니다. 팝업은 게시판 연동용 매개변수도 함께 처리합니다.

업로드 결과는 두 경로로 반환됩니다.

1. Postimages에서 opener로 `{id: window.name, message: encodedResult}`를 postMessage로 전달합니다. 확장은 출처 `https://postimages.org`, 정확한 팝업 WindowProxy와 세션 ID를 확인합니다.
2. 직접 메시지를 사용할 수 없거나 결과 요청이 실패하면 `/mod`를 거쳐 원래 글쓰기 URL로 돌아옵니다. URL fragment의 `postimage_id`와 `postimage_text`에 결과가 담깁니다. v1.0.1까지는 이 경로를 처리하지 못했습니다.

리다이렉트된 창은 결과를 한 번 디코딩하고 이미지 URL만 추려 원래 창에 전달합니다. same-origin postMessage는 팝업·출처·세션 ID를 확인합니다. opener 연결이 끊긴 경우에는 같은 origin의 세션별 BroadcastChannel을 사용합니다. 채널 이름은 업로드를 시작할 때 생성한 128비트 무작위 ID로 분리합니다. 쿠키·localStorage·확장 저장소를 사용하지 않습니다.

원래 창은 결과를 한 번만 처리하고 확인 응답을 보냅니다. 콜백 창은 확인 응답을 받으면 닫힙니다. 5초 안에 연결되지 않으면 업로드 링크를 읽기 전용 입력란에 남겨 수동으로 복구할 수 있게 합니다. 이미지가 삽입되거나 본문에 넣을 링크가 보관된 뒤에만 확인 응답을 보냅니다.

두 경로 모두 응답 HTML을 실행하거나 그대로 삽입하지 않습니다. `https://i.postimg.cc/` URL만 검증해 새 이미지 태그를 만듭니다.

확장은 Postimages의 비공개 업로드 API를 재구현하거나 API 키를 보관하지 않습니다. 공식 팝업이 업로드와 서비스 측 인증을 담당합니다.

## 디시

분석한 페이지: https://gall.dcinside.com/mgallery/board/write/?id=thesingularity

편집기는 `#write textarea#memo`를 Summernote로 초기화합니다. 확장은 동일한 편집기 API의 `editor.setLastRange`, `restoreRange`, `pasteHTML`을 사용하므로 원래 글쓰기 폼에 본문을 유지합니다. 로그인 관련 DOM이나 쿠키에는 접근하지 않습니다.

페이지의 기존 등록 스크립트는 `/block/block/` 요청 후 `/board/forms/article_submit`에 본문과 폼 값을 보냅니다. CSRF, 동적 폼 값, 자동입력 방지 및 적용된 Turnstile 절차가 연계됩니다. 확장은 이 요청을 복제·가로채거나 토큰을 수정하지 않습니다.

디시의 2026-10-21 공지는 보안 대응에 따른 자체 이미지·동영상 업로드 중단이며 글 작성은 유지된다고 안내합니다. 확장은 중단된 디시 업로드 함수를 변경하지 않고 외부 호스팅 이미지를 편집기에 넣습니다. 서버가 외부 이미지를 최종 저장·표시하는지는 별도 검증 대상입니다.

## 분석 근거

- https://postimages.org/plugins
- https://postimages.org/plugins/phpbb
- https://mod.postimage.org/phpbb3-ko-hotlink.js
- https://postimgs.org/4160/s.js
- https://gall.dcinside.com/_js/editor_write_new.js?v=25110501
- https://gall.dcinside.com/_js/turnstile_write.js?v=261016
- https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts

세션별 토큰·쿠키·IP 값과 원본 페이지 덤프는 배포 파일에 포함하지 않습니다.
