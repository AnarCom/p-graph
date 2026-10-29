import { describe, expect, it } from 'vitest';
import { decodeNodeTypeDrag, encodeNodeTypeDrag } from './paletteDrag';

describe('palette drag payload', () => {
  it('round-trips a node type reference', () => {
    const payload = {
      type: 'builtin.read-file',
      version: 1,
    };

    expect(decodeNodeTypeDrag(encodeNodeTypeDrag(payload))).toEqual(payload);
  });

  it('rejects malformed drag data', () => {
    expect(decodeNodeTypeDrag('not-json')).toBeNull();
    expect(decodeNodeTypeDrag('{"type": 1}')).toBeNull();
  });
});

