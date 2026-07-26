import { describe, expect, it } from 'vitest';

import { replaceFinalSection } from '../../lib/server/studio/cliffhanger';

describe('cliffhanger draft rewrite', () => {
  it('replaces only the final paragraph', () => {
    expect(replaceFinalSection('Maya reached the roof.\n\nThe radio went silent.', 'Then it whispered her name again.')).toBe(
      'Maya reached the roof.\n\nThen it whispered her name again.',
    );
  });

  it('preserves a single-paragraph lead-in when possible', () => {
    expect(replaceFinalSection('Maya ran upstairs. The radio went silent.', 'Then it whispered her name again.')).toBe(
      'Maya ran upstairs. Then it whispered her name again.',
    );
  });
});
