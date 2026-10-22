const test = require('node:test');
const assert = require('node:assert/strict');
const { imageUrl, extractImages, imageMarkup, uploadUrl, validReply } = require('../extension/content.js');
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
