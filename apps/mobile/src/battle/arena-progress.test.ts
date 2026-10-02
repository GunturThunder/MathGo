import { arenaProgress } from './arena-progress';

describe('arena progress (S5-06)', () => {
  it('the design example: 842 trophies is Times Tower, 28 % of the way, 358 to go', () => {
    const p = arenaProgress(842);
    expect(p).toMatchObject({ arena: 3, name: 'Times Tower', next: 1_200, toGo: 358 });
    expect(p.share).toBeCloseTo(0.284, 3);
  });

  it('arena floors and the first arena', () => {
    expect(arenaProgress(0)).toMatchObject({
      arena: 1,
      name: 'Counting Camp',
      share: 0,
      toGo: 300,
    });
    expect(arenaProgress(299)).toMatchObject({ arena: 1, toGo: 1 });
    expect(arenaProgress(300)).toMatchObject({ arena: 2, name: 'Plus Plains', share: 0 });
  });

  it('the top arena has no next one', () => {
    expect(arenaProgress(2_500)).toMatchObject({
      arena: 5,
      name: 'Power Peak',
      next: null,
      toGo: null,
      share: 1,
    });
  });

  it('bad input is treated as 0', () => {
    expect(arenaProgress(-5).arena).toBe(1);
  });
});
