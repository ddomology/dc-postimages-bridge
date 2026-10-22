# 확인한 요청 흐름 — 2026-10-22

## Postimages

공식 게시판 플러그인 `https://mod.postimage.org/phpbb3-ko-hotlink.js`는 `/upload` 팝업을 열 때 `mode=phpbb3`, `areaid`, `hash=1`, `pm=1`, `lang=ko`, `code=hotlink`, `forumurl`을 전달합니다. `forumurl`은 원본 플러그인처럼 사전 URL 인코딩 후 쿼리로 인코딩합니다.

팝업의 폼은 `POST https://postimages.org/json`으로 multipart 업로드합니다. 페이지 및 업로드 자바스크립트에서 확인한 주요 필드는 `file`, `gallery`, `optsize`, `expire`, `numfiles`, `upload_session`입니다. 팝업은 게시판 연동용 매개변수도 함께 처리합니다.

업로드 완료 시 Postimages는 연동 결과를 만들고 opener에 `{id: window.name, message: encodedResult}`를 postMessage로 전달합니다. 확장은 `origin === https://postimages.org`, 열린 팝업의 WindowProxy, 무작위 세션 ID를 모두 확인합니다. 응답의 HTML 자체는 실행하거나 삽입하지 않고 `https://i.postimg.cc/` 이미지 URL만 추출해 새 이미지 태그를 만듭니다.

확장은 Postimages의 비공개 업로드 API를 재구현하거나 API 키를 보관하지 않습니다. 공식 팝업이 업로드와 서비스 측 인증을 담당합니다.

## 디시

분석한 페이지: https://gall.dcinside.com/mgallery/board/write/?id=thesingularity

편집기는 `#write textarea#memo`를 Summernote로 초기화합니다. 도우미는 동일한 편집기 API의 `saveRange`, `restoreRange`, `pasteHTML`을 사용하므로 원래 글쓰기 폼에 본문을 유지합니다. 로그인 관련 DOM이나 쿠키에는 접근하지 않습니다.

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
