/**
 * Cost ceilings, tested without network. livePage charges the budget on every
 * request and every byte, so exhausting it must throw BudgetExceeded rather
 * than keep spending. The same three limits are exercised against a live page
 * by work/network-budget.test.ts, which CI does not run.
 */
import {test,expect} from 'bun:test';
import {newBudget,BudgetExceeded,DEFAULT_BUDGET,spent} from './research/page.ts';

test('default budgets are finite',()=>{
  expect(DEFAULT_BUDGET.maxFetches).toBeLessThan(1000);
  expect(DEFAULT_BUDGET.maxBytes).toBeLessThan(100_000_000);
  expect(DEFAULT_BUDGET.deadlineMs).toBeLessThan(600_000);
});

test('a fresh budget starts unspent',()=>{
  const b=newBudget();
  expect(spent(b)).toEqual({fetches:0,bytes:0,ms:0});
});

test('overrides are honoured',()=>{
  const b=newBudget({maxFetches:3,deadlineMs:1000});
  expect(b.maxFetches).toBe(3);
  expect(b.deadlineMs).toBe(1000);
  expect(b.maxBytes).toBe(DEFAULT_BUDGET.maxBytes);
});

test('exceeding a limit is a distinct, catchable error',()=>{
  const e=new BudgetExceeded('Retrieval budget exhausted: test.');
  expect(e).toBeInstanceOf(Error);
  expect(e.message).toMatch(/budget exhausted/i);
});
