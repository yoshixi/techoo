import { isIncomingShareIntentPath, shareIntentToPostBody } from '@/lib/shareIntentPost';

describe('shareIntentToPostBody', () => {
  it('keeps plain text', () => {
    expect(shareIntentToPostBody({ text: '  hello from notes  ' })).toBe('hello from notes');
  });

  it('keeps a link that is already the text', () => {
    expect(
      shareIntentToPostBody({
        text: 'https://example.com/story',
        webUrl: 'https://example.com/story',
      })
    ).toBe('https://example.com/story');
  });

  it('puts a page title above its link', () => {
    expect(
      shareIntentToPostBody({
        text: 'https://example.com/story',
        webUrl: 'https://example.com/story',
        meta: { title: 'A story' },
      })
    ).toBe('A story\n\nhttps://example.com/story');
  });

  it('does not repeat a link already written in the text', () => {
    expect(
      shareIntentToPostBody({
        text: 'Read this https://example.com/story today',
        webUrl: 'https://example.com/story',
      })
    ).toBe('Read this https://example.com/story today');
  });

  it('returns an empty body when the share has no text', () => {
    expect(shareIntentToPostBody({ text: '   ', webUrl: null, meta: { title: '  ' } })).toBe('');
    expect(shareIntentToPostBody({})).toBe('');
  });
});

describe('isIncomingShareIntentPath', () => {
  it('matches the iOS share-extension launch url', () => {
    expect(
      isIncomingShareIntentPath('techoo://dataUrl=techooShareKey#media', 'techooShareKey')
    ).toBe(true);
  });

  it('ignores ordinary app links', () => {
    expect(isIncomingShareIntentPath('techoo://auth-callback?code=1', 'techooShareKey')).toBe(
      false
    );
    expect(isIncomingShareIntentPath('', 'techooShareKey')).toBe(false);
  });
});
