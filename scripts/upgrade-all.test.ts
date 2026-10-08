import {test,expect} from 'bun:test';
import {compareSemVer,selectHighestSemVer} from './upgrade-all.ts';

test('stable outranks a prerelease of the same version',()=>{
  expect(selectHighestSemVer(['2.0.0-rc.2','2.0.0','1.9.9'])).toBe('2.0.0');
});
test('higher prereleases outrank lower stable releases',()=>{
  expect(selectHighestSemVer(['2.8.9','3.0.0-alpha.1','3.0.0-rc.2'])).toBe('3.0.0-rc.2');
});
test('numeric prerelease components follow SemVer ordering',()=>{
  expect(compareSemVer('1.0.0-rc.10','1.0.0-rc.2')).toBeGreaterThan(0);
  expect(compareSemVer('1.0.0-1','1.0.0-alpha')).toBeLessThan(0);
  expect(compareSemVer('1.0.0+build2','1.0.0+build1')).toBe(0);
});
test('invalid tags are ignored and invalid-only lists fail',()=>{
  expect(selectHighestSemVer(['v3.0.0','1.2.3','nonsense'])).toBe('1.2.3');
  expect(()=>selectHighestSemVer(['tag-only'])).toThrow(/No valid/);
});
