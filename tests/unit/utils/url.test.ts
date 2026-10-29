import { describe, it, expect } from 'vitest';
import { hostMatchesSystem, urlMatchScore, urlMatchesSystem, matchUrl } from '../../../src/shared/utils/url';

describe('urlMatchScore', () => {
  it('同 hostname 但端口不同时不匹配（localhost 开发环境）', () => {
    expect(urlMatchesSystem('http://localhost:3000/login', 'http://localhost:8080')).toBe(false);
    expect(urlMatchScore('http://localhost:3000/login', 'http://localhost:8080')).toBe(0);
  });

  it('端口一致、系统未指定路径时匹配任意路径', () => {
    expect(urlMatchesSystem('https://example.com/admin/login', 'https://example.com')).toBe(true);
    expect(urlMatchScore('https://example.com/admin/login', 'https://example.com')).toBeGreaterThan(0);
  });

  it('系统指定路径时要求标签页路径在段边界上', () => {
    expect(urlMatchesSystem('https://example.com/app1/dashboard', 'https://example.com/app1')).toBe(true);
    expect(urlMatchesSystem('https://example.com/app2/dashboard', 'https://example.com/app1')).toBe(false);
  });

  it('路径前缀不会跨段误匹配（/app 不应匹配 /app2）', () => {
    expect(urlMatchesSystem('https://example.com/app2/login', 'https://example.com/app')).toBe(false);
    expect(urlMatchesSystem('https://example.com/application/login', 'https://example.com/app')).toBe(false);
    expect(urlMatchesSystem('https://example.com/app/login', 'https://example.com/app')).toBe(true);
  });

  it('忽略末尾斜杠差异', () => {
    expect(urlMatchesSystem('https://example.com/app', 'https://example.com/app/')).toBe(true);
    expect(urlMatchesSystem('https://example.com/app/', 'https://example.com/app')).toBe(true);
    expect(urlMatchesSystem('https://example.com/app/login', 'https://example.com/app/')).toBe(true);
  });

  it('保存的路径越深越精确', () => {
    const tab = 'https://example.com/a/b/login';
    expect(urlMatchScore(tab, 'https://example.com/a/b')).toBeGreaterThan(
      urlMatchScore(tab, 'https://example.com/a'),
    );
    expect(urlMatchScore(tab, 'https://example.com/a')).toBeGreaterThan(
      urlMatchScore(tab, 'https://example.com'),
    );
  });

  it('完整 URL 完全一致时得分最高', () => {
    const tab = 'https://example.com/app/login';
    expect(urlMatchScore(tab, tab)).toBeGreaterThan(
      urlMatchScore(tab, 'https://example.com/app'),
    );
    expect(urlMatchScore(tab, 'https://example.com/app')).toBeGreaterThan(
      urlMatchScore(tab, 'https://example.com'),
    );
  });

  it('hash 路由参与匹配，避免同域 SPA 项目互相误配', () => {
    expect(urlMatchesSystem('https://example.com/#/app1/login', 'https://example.com/#/app1')).toBe(true);
    expect(urlMatchesSystem('https://example.com/#/app2/login', 'https://example.com/#/app1')).toBe(false);
    expect(urlMatchesSystem('https://example.com/#/app10/login', 'https://example.com/#/app1')).toBe(false);
  });

  it('hash 路由比根路径更精确', () => {
    expect(
      urlMatchScore('https://example.com/#/app1/login', 'https://example.com/#/app1'),
    ).toBeGreaterThan(
      urlMatchScore('https://example.com/#/app1/login', 'https://example.com'),
    );
  });

  it('普通锚点不参与路径匹配', () => {
    expect(urlMatchesSystem('https://example.com/app#section', 'https://example.com/app')).toBe(true);
  });

  it('查询参数用于区分同路径系统', () => {
    const tab = 'https://example.com/login?project=b';
    expect(matchUrl(tab, 'https://example.com/login?project=b')?.queryMatch).toBe(true);
    expect(matchUrl(tab, 'https://example.com/login?project=a')?.queryMatch).toBe(false);
    // 保存 URL 无查询参数时不构成约束
    expect(matchUrl(tab, 'https://example.com/login')?.queryMatch).toBe(true);
  });

  it('http/https 视为同站，但标记协议是否一致', () => {
    expect(urlMatchesSystem('https://example.com/login', 'http://example.com')).toBe(true);
    expect(matchUrl('https://example.com/login', 'http://example.com')?.protocolMatch).toBe(false);
    expect(matchUrl('https://example.com/login', 'https://example.com')?.protocolMatch).toBe(true);
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

describe('hostMatchesSystem', () => {
  it('同一 host 不同路径视为同站（用于登录页兜底）', () => {
    expect(hostMatchesSystem('https://agtest.zhdgps.com/user/login', 'https://agtest.zhdgps.com/system/user')).toBe(true);
    expect(hostMatchesSystem('https://example.com/anything', 'https://example.com')).toBe(true);
  });

  it('端口不同、域名不同都不算同站', () => {
    expect(hostMatchesSystem('http://localhost:3000/login', 'http://localhost:8080')).toBe(false);
    expect(hostMatchesSystem('https://a.example.com/login', 'https://example.com')).toBe(false);
  });

  it('http/https 跨协议仍算同站，其他协议不算', () => {
    expect(hostMatchesSystem('https://example.com/login', 'http://example.com')).toBe(true);
    expect(hostMatchesSystem('ftp://example.com/login', 'http://example.com')).toBe(false);
  });
});
