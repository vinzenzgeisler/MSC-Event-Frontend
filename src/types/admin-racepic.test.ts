import { describe, expect, it } from 'vitest';
import { isRacePicEnabled } from '../config/runtime';

describe('RacePic runtime contract', () => {
  it('defaults to disabled when no runtime flag is present', () => {
    expect(isRacePicEnabled()).toBe(false);
  });
});
