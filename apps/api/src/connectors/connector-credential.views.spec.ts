import { toConnectorCredentialInfo } from './connector-credential.views';

describe('toConnectorCredentialInfo', () => {
  it('reports disconnected when there is no doc', () => {
    expect(toConnectorCredentialInfo(null, 'postiz')).toEqual({ connector: 'postiz', connected: false });
  });
  it('exposes only connector + connected + last4 (never the key)', () => {
    const doc = { connector: 'postiz', last4: 'cdef', encryptedKey: 'iv:tag:ct' } as never;
    expect(toConnectorCredentialInfo(doc, 'postiz')).toEqual({
      connector: 'postiz', connected: true, last4: 'cdef',
    });
  });
});
