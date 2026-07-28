import type { ProjectDocument } from './types';

export function createEmptyDocument(id = crypto.randomUUID()): ProjectDocument {
  return {
    id,
    version: '1.0.0',
    metadata: {
      title: 'Untitled Design',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      authorId: null,
    },
    product: {
      manifestId: 'standard-tee',
      colorHex: '#111111',
    },
    nodes: {},
    children: [],
  };
}
