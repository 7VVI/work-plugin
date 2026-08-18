import { describe, it, expect } from 'vitest';
import { urlMatchScore, urlMatchesSystem } from '../../../src/shared/utils/url';

describe('urlMatchScore', () => {
  it('同 hostname 但端口不同时不匹配（localhost 开发环境）', () => {
    expect(urlMatchesSystem('http://localhost:3000/login', 'http://localhost:8080')).toBe(false);
    expect(urlMatchScore('http://localhost:3000/login', 'http://localhost:8080')).toBe(0);
  });

  it('端口一致、系统未指定路径时匹配任意路径', () => {
    expect(urlMatchesSystem('https://example.com/admin/login', 'https://example.com')).toBe(true);
    expect(urlMatchScore('https://example.com/admin/login', 'https://example.com')).toBe(1);
  });

  it('系统指定路径时要求标签页路径以系统路径开头', () => {
    expect(urlMatchesSystem('https://example.com/app1/dashboard', 'https://example.com/app1')).toBe(true);
    expect(urlMatchesSystem('https://example.com/app2/dashboard', 'https://example.com/app1')).toBe(false);
  });

  it('完整 URL 完全一致时得分最高', () => {
    expect(urlMatchScore('https://example.com/app', 'https://example.com/app')).toBe(3);
    expect(urlMatchScore('https://example.com/app', 'https://example.com/app')).toBeGreaterThan(
      urlMatchScore('https://example.com/app/dashboard', 'https://example.com/app'),
    );
    expect(urlMatchScore('https://example.com/app/dashboard', 'https://example.com/app')).toBeGreaterThan(
      urlMatchScore('https://example.com/app/dashboard', 'https://example.com'),
    );
  });

  it('http/https 视为同站', () => {
    expect(urlMatchesSystem('https://example.com/login', 'http://example.com')).toBe(true);
  });

  it('非 http 协议要求协议完全一致', () => {
    expect(urlMatchesSystem('chrome-extension://abc/login', 'chrome-extension://abc')).toBe(true);
    expect(urlMatchesSystem('ftp://example.com/login', 'http://example.com')).toBe(false);
  });

  it('hostname 不同时不匹配', () => {
    expect(urlMatchesSystem('https://a.example.com/login', 'https://example.com')).toBe(false);
    expect(urlMatchesSystem('https://example.com/login', 'https://other.com')).toBe(false);
  });

  it('不会把 example.comx 误匹配为 example.com', () => {
    expect(urlMatchesSystem('https://example.comx/login', 'https://example.com')).toBe(false);
    expect(urlMatchesSystem('https://example.com.evil.com/login', 'https://example.com')).toBe(false);
  });

  it('非法 URL 不匹配', () => {
    expect(urlMatchesSystem('not a url', 'https://example.com')).toBe(false);
  });
});
