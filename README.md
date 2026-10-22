# 디시 이미지 브릿지

PC 크롬·엣지용 Manifest V3 확장프로그램입니다. 디시 글쓰기 화면의 Summernote 편집기에 Postimages 업로드 버튼을 추가합니다. Tampermonkey는 필요 없습니다.

## 설치

1. `dc-postimages-extension.zip`을 압축 해제합니다.
2. 크롬 주소창에 `chrome://extensions`를 입력합니다. 엣지는 `edge://extensions`입니다.
3. **개발자 모드**를 켭니다.
4. **압축해제된 확장 프로그램을 로드합니다**를 누르고 `manifest.json`이 들어 있는 폴더를 선택합니다.
5. 이미 열려 있던 디시 PC 글쓰기 페이지를 새로고침합니다.

확장 폴더는 설치 후에도 남겨 두세요. 업데이트할 때 파일을 교체하고 확장 관리 화면에서 새로고침한 뒤 디시 페이지도 새로고침합니다. 삭제는 확장 관리 화면의 **삭제**로 할 수 있습니다.

## 사용

1. https://gall.dcinside.com/mgallery/board/write/?id=thesingularity 를 엽니다.
2. HTML 모드를 끈 상태에서 본문에 커서를 놓습니다.
3. 본문 위의 **Postimages 이미지 업로드**를 누릅니다.
4. Postimages 창에서 이미지를 선택합니다. 업로드 결과가 본문에 삽입됩니다.
5. 본문을 확인하고 디시의 닉네임·비밀번호·자동입력 방지 등 필요한 항목을 입력한 뒤 **등록**합니다.

한 번에 여러 장을 넣을 수 있습니다. 삽입 후 디시 편집기의 실행 취소도 사용할 수 있습니다. 업로드 후 삭제·관리 링크가 필요하면 Postimages에서 직접 보관하거나 본인 Postimages 계정을 이용하세요. 본문에서 이미지를 지워도 Postimages 원본이 삭제되지는 않습니다.

자동 삽입 실패 시 도우미의 **직접 링크로 넣기**를 열고, Postimages의 직접 이미지 링크(`https://i.postimg.cc/...`)나 포럼용 핫링크를 붙여 넣습니다. `postimg.cc/...`로 시작하는 이미지 소개 페이지 주소는 직접 이미지 주소가 아닙니다.

## 범위와 데이터 처리

- 디시 PC의 `board/write`, `mgallery/board/write`, `mini/board/write`, `person/board/write` 경로에만 주입합니다. 실제 화면 분석 대상은 특이점이 온다 마이너 갤러리입니다. 다른 유형은 동일한 Summernote 구조일 때 동작합니다.
- 모바일 웹·앱·글 수정 화면·Firefox는 이번 버전의 대상이 아닙니다.
- 브라우저 기본 쿠키와 디시의 로그인·인증·등록 기능은 원래 페이지에서 처리합니다. 확장이 쿠키·비밀번호를 읽거나 서버로 전송하지 않습니다.
- 업로드는 Postimages가 제공하는 공식 게시판용 팝업에서 사용자가 선택한 파일로 진행합니다. Postimages에는 업로드 파일과 갤러리 주소가 전달됩니다. 이미지 링크는 비공개 저장소가 아니며, 링크를 아는 사람이 열어볼 수 있습니다.
- 확장이 수집하는 분석 정보, 별도 서버, 저장소, 광고, 외부 실행 코드가 없습니다. Postimages 사이트 자체의 정책·광고·용량 제한은 적용됩니다.
- 도우미는 최종 글 등록을 자동으로 누르지 않습니다. 외부 이미지가 디시의 서버 필터에 의해 삭제되거나 표시되지 않을 수 있습니다. 게시 후 저장·표시까지의 실제 검증은 남아 있습니다.
- 디시인사이드 및 Postimages와 제휴하지 않은 비공식 도구입니다.

## 개발과 검증

추가 패키지를 설치하지 않고 Node.js에서 실행할 수 있습니다.

```sh
node --test tests/core.test.cjs
node --check extension/content.js
```

`extension/`이 로드할 원본입니다. `docs/`에는 GitHub Pages용 설치 안내 페이지와 배포 ZIP이 있습니다. 이 저장소를 GitHub에 올리고 Settings → Pages → Deploy from a branch → main /docs를 선택하면 안내 페이지를 호스팅할 수 있습니다. GitHub Pages는 배포·안내를 담당하며 글쓰기는 디시에서 진행됩니다. 압축해제 설치 방식은 크롬 웹스토어의 자동 업데이트를 제공하지 않습니다.

요청 흐름 분석과 검증 범위는 `REQUEST-FLOW.md`, `VALIDATION.md`에 기록합니다.
