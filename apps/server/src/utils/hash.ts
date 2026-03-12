import { createHash } from 'node:crypto';

export function hashText(text: string) {
  return createHash('sha256').update(text.trim()).digest('hex');
}

