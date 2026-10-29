import { describe, it, expect } from 'vitest';
import {
  UNGROUPED_GROUP_ID,
  isUngrouped,
  matchesGroupFilter,
} from '../../../src/shared/utils/groupFilter';

describe('group filter', () => {
  it('treats empty group ids as ungrouped', () => {
    expect(isUngrouped(undefined)).toBe(true);
    expect(isUngrouped('')).toBe(true);
    expect(isUngrouped(null)).toBe(true);
    expect(isUngrouped('grp_1')).toBe(false);
  });

  it('all matches every record', () => {
    expect(matchesGroupFilter(undefined, 'all')).toBe(true);
    expect(matchesGroupFilter('grp_1', 'all')).toBe(true);
  });

  it('the ungrouped bucket only matches records without a group', () => {
    expect(matchesGroupFilter(undefined, UNGROUPED_GROUP_ID)).toBe(true);
    expect(matchesGroupFilter('', UNGROUPED_GROUP_ID)).toBe(true);
    expect(matchesGroupFilter('grp_1', UNGROUPED_GROUP_ID)).toBe(false);
  });

  it('a concrete group only matches its own records', () => {
    expect(matchesGroupFilter('grp_1', 'grp_1')).toBe(true);
    expect(matchesGroupFilter('grp_2', 'grp_1')).toBe(false);
    expect(matchesGroupFilter(undefined, 'grp_1')).toBe(false);
  });
});
