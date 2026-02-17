import { describe, expect, it } from 'vitest';
import { createContextPayload } from '../payload';

describe('createContextPayload', () => {
  it('maps editor context to bridge payload shape', () => {
    const payload = createContextPayload({
      workspaceRoot: '/repo',
      openFiles: ['/repo/a.ts', '/repo/b.ts'],
      activeFile: '/repo/a.ts',
      selectionRange: {
        start: { line: 1, character: 2 },
        end: { line: 3, character: 4 }
      }
    });

    expect(payload).toEqual({
      workspace_root: '/repo',
      open_files: ['/repo/a.ts', '/repo/b.ts'],
      active_file: '/repo/a.ts',
      selection_range: {
        start: { line: 1, character: 2 },
        end: { line: 3, character: 4 }
      }
    });
  });
});
