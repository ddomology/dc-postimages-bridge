const test = require('node:test');
const assert = require('node:assert/strict');
const { imageUrl, extractImages, imageMarkup, uploadUrl, validReply, redirectResult, validRedirect, editorMode } = require('../extension/content.js');
const img = 'https://i.postimg.cc/AbCd1234/photo.png';

test('Postimages hotlink BBCode and multiple images retain order, excluding page links', () => {
  const code = '[url=https://postimg.cc/1234][img]' + img + '[/img][/url]\n[img]https://i.postimg.cc/second/2.webp[/img]';
  assert.deepEqual(extractImages(code), [img, 'https://i.postimg.cc/second/2.webp']);
  assert.deepEqual(extractImages(encodeURIComponent(code), true), extractImages(code));
});
test('Direct links and HTML links produce URLs, never remote markup', () => {
  const text = '<img src="' + img + '" onerror="alert(1)"><script>alert(2)</script>';
  assert.deepEqual(extractImages(text), [img]);
  assert.ok(!imageMarkup(extractImages(text)).includes('onerror'));
  assert.ok(!imageMarkup(extractImages(text)).includes('script'));
});
test('Reject dangerous schemes, misleading domains, credentials and nondefault ports', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'http://i.postimg.cc/a/b.png',
    'https://i.postimg.cc.evil.test/a/b.png', 'https://i.postimg.cc@evil.test/a/b.png',
    'https://user:pass@i.postimg.cc/a/b.png', 'https://i.postimg.cc:444/a/b.png', 'https://postimg.cc/abc']) {
    assert.equal(imageUrl(url), null, url);
  }
  assert.throws(() => extractImages('[img]javascript:alert(1)[/img]'));
  assert.throws(() => imageMarkup(['javascript:alert(1)']));
});
test('Handle filenames with URL escapes without decoding twice', () => {
  const url = 'https://i.postimg.cc/abcd/file%20name.png';
  assert.deepEqual(extractImages(encodeURIComponent('[img]' + url + '[/img]'), true), [url]);
  assert.deepEqual(extractImages(url), [url]);
  assert.throws(() => extractImages('%ZZ', true));
});
test('Deduplicate and bound returned data', () => {
  assert.deepEqual(extractImages(img + '\n' + img), [img]);
  assert.throws(() => extractImages('x'.repeat(200001)));
  assert.throws(() => extractImages(Array.from({ length: 101 }, (_, i) => `https://i.postimg.cc/abc/${i}.png`).join('\n')));
  assert.throws(() => extractImages(null));
});
test('Escape attribute characters and decode HTML ampersands', () => {
  const url = img + '?width=100&height=200';
  assert.ok(imageMarkup([url]).includes('&amp;height'));
  assert.deepEqual(extractImages(url.replace('&', '&amp;')), [url]);
});
test('Popup URL follows official plugin contract, omitting unrelated page data', () => {
  const url = new URL(uploadUrl('dcpi_unit', 'https://gall.dcinside.com/mgallery/board/write/?id=thesingularity&secret=ignored'));
  assert.equal(url.origin, 'https://postimages.org');
  assert.equal(url.pathname, '/upload');
  assert.equal(url.searchParams.get('pm'), '1');
  assert.equal(url.searchParams.get('code'), 'hotlink');
  assert.equal(decodeURIComponent(url.searchParams.get('forumurl')), 'https://gall.dcinside.com/mgallery/board/write/?id=thesingularity');
  assert.ok(!url.href.includes('secret'));
});

test('Only supported write and modify routes run, and each is in the manifest', () => {
  const manifest = require('../extension/manifest.json');
  const matches = manifest.content_scripts[0].matches;
  for (const prefix of ['', 'mgallery/', 'mini/', 'person/']) {
    for (const mode of ['write', 'modify']) {
      const path = '/' + prefix + 'board/' + mode;
      assert.equal(editorMode(path), mode);
      assert.equal(editorMode(path + '/'), mode);
      assert.ok(matches.includes('https://gall.dcinside.com' + path + '*'));
    }
  }
  for (const path of ['/mgallery/board/view/', '/board/lists/', '/board/modify_password_submit',
    '/board/writeSomething', '/board/modify/extra', '/other/board/modify/', '/']) {
    assert.equal(editorMode(path), null, path);
  }
});

test('Modify uploads use a public write callback without post/authentication data', () => {
  for (const prefix of ['', 'mgallery/', 'mini/', 'person/']) {
    for (const slash of ['', '/']) {
      const page = 'https://gall.dcinside.com/' + prefix + 'board/modify' + slash +
        '?id=thesingularity&no=12345&key=private-key&password=private-password#private-fragment';
      const upload = new URL(uploadUrl('dcpi_unit', page));
      const callback = decodeURIComponent(upload.searchParams.get('forumurl'));
      assert.equal(callback, 'https://gall.dcinside.com/' + prefix + 'board/write/?id=thesingularity');
      assert.ok(!upload.href.includes('12345') && !upload.href.includes('private'));
    }
  }
});
test('Replies must match origin, exact popup, session id and cannot replay', () => {
  const popup = {};
  const session = { id: 'abc', popup, received: false };
  const good = { origin: 'https://postimages.org', source: popup, data: { id: 'abc', message: img } };
  assert.equal(validReply(good, session), true);
  assert.equal(validReply({ ...good, origin: 'https://evil.test' }, session), false);
  assert.equal(validReply({ ...good, source: {} }, session), false);
  assert.equal(validReply({ ...good, data: { id: 'stale', message: img } }, session), false);
  assert.equal(validReply(good, { ...session, received: true }), false);
  assert.equal(validReply(good, null), false);
});

const callbackId = 'dcpi_' + 'a'.repeat(32);
function callbackHash(text, id = callbackId) {
  return '#' + new URLSearchParams({ postimage_id: id, postimage_text: text });
}

test('Redirect callback extracts image URLs from the official fragment fields', () => {
  const data = redirectResult(callbackHash('[url=https://postimg.cc/abc][img]' + img + '[/img][/url]'));
  assert.deepEqual(data, { type: 'dcpi:redirect', id: callbackId, message: img });
  assert.equal(validRedirect(data, callbackId), true);
  assert.equal(validRedirect(data, 'different-session'), false);
  assert.equal(validRedirect({ ...data, type: 'unknown' }, callbackId), false);
});

test('Callback decodes exactly once and preserves plus signs and filename escapes', () => {
  const url = 'https://i.postimg.cc/abc/image%20name+plus.png';
  assert.equal(redirectResult(callbackHash('[img]' + url + '[/img]')).message, url);
});

test('Callback rejects unrelated, duplicate, invalid, or oversized fragment data', () => {
  for (const hash of ['', '#section', callbackHash(img, 'pi_other_plugin'),
    callbackHash('javascript:alert(1)'), callbackHash(img) + '&postimage_id=' + callbackId,
    callbackHash(img) + '&postimage_text=' + encodeURIComponent(img),
    callbackHash('x'.repeat(200001)), '#'+ 'x'.repeat(601000)]) {
    assert.equal(redirectResult(hash), null);
  }
});

test('Redirect messages need the original same-origin popup and explicit callback type', () => {
  const popup = {};
  const session = { id: callbackId, popup, origin: 'https://gall.dcinside.com', received: false };
  const data = redirectResult(callbackHash(img));
  const good = { origin: session.origin, source: popup, data };
  assert.equal(validReply(good, session), true);
  assert.equal(validReply({ ...good, source: {} }, session), false);
  assert.equal(validReply({ ...good, origin: 'https://evil.test' }, session), false);
  assert.equal(validReply({ ...good, data: { id: callbackId, message: img } }, session), false);
  assert.equal(validReply(good, { ...session, received: true }), false);
});
