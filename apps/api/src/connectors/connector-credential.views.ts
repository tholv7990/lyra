import type { ConnectorCredentialInfo } from '@lyra/shared';
import type { ConnectorCredentialDocument } from './connector-credential.schema';

// Safe transport shape — never includes encryptedKey.
export function toConnectorCredentialInfo(
  doc: ConnectorCredentialDocument | null,
  connector: string,
): ConnectorCredentialInfo {
  if (!doc) return { connector, connected: false };
  return { connector: doc.connector, connected: true, last4: doc.last4 };
}
