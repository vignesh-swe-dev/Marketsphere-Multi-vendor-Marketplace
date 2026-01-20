import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatMoneyCompact, formatDate } from './formatters.ts';

test('formatMoney formats 24900 paise as ₹249.00 with 2 decimals', () => {
  const result = formatMoney(24900);
  assert.equal(result.replace(/\s/g, ' '), '₹249.00');
});

test('formatMoney formats with Indian digit grouping and 2 decimals (₹1,23,456.00)', () => {
  const result = formatMoney(12345600);
  assert.equal(result.replace(/\s/g, ' '), '₹1,23,456.00');
});

test('formatMoney handles ₹0.00 correctly', () => {
  const result = formatMoney(0);
  assert.equal(result.replace(/\s/g, ' '), '₹0.00');
});

test('formatMoney handles negative amounts for refunds', () => {
  const result = formatMoney(-150050);
  assert.equal(result.replace(/\s/g, ' '), '-₹1,500.50');
});

test('formatMoneyCompact formats Thousand (K)', () => {
  const result = formatMoneyCompact(1240000);
  assert.equal(result, '₹12.4K');
});

test('formatMoneyCompact formats Lakh (L)', () => {
  const result = formatMoneyCompact(32000000);
  assert.equal(result, '₹3.2L');
});

test('formatMoneyCompact formats Crore (Cr)', () => {
  const result = formatMoneyCompact(1500000000);
  assert.equal(result, '₹1.5Cr');
});

test('formatDate formats in Indian format DD MMM YYYY in IST', () => {
  const result = formatDate('2026-10-20T03:12:00Z');
  assert.match(result, /20 Oct 2026/);
});
