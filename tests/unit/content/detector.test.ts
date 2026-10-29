import { describe, it, expect, beforeEach } from 'vitest';
import { detectLoginForm } from '../../../src/content/detector';

function mockRect(element: HTMLElement, width: number, height: number, top: number, left: number): void {
  element.getBoundingClientRect = () =>
    ({
      width,
      height,
      top,
      left,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe('detectLoginForm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('ignores hidden 0×0 inputs and picks the nearest visible username', () => {
    document.body.innerHTML = `
      <form>
        <input id="ghost" type="text">
        <input id="user" type="text" placeholder="用户名">
        <input id="pwd" type="password" placeholder="密码">
        <input id="captcha" type="text" placeholder="验证码">
      </form>`;

    const ghost = document.getElementById('ghost')!;
    const user = document.getElementById('user')!;
    const pwd = document.getElementById('pwd')!;
    const captcha = document.getElementById('captcha')!;
    mockRect(ghost, 0, 0, 0, 0);
    mockRect(user, 260, 30, 100, 20);
    mockRect(pwd, 260, 30, 140, 20);
    mockRect(captcha, 100, 30, 180, 20);

    const forms = detectLoginForm();
    expect(forms).toHaveLength(1);
    expect(forms[0].usernameField.id).toBe('user');
    expect(forms[0].passwordField.id).toBe('pwd');
  });

  it('prefers the closest visible text input before the password', () => {
    document.body.innerHTML = `
      <form>
        <input id="search" type="text" placeholder="搜索">
        <input id="user" type="text" placeholder="用户名">
        <input id="pwd" type="password">
      </form>`;

    const search = document.getElementById('search')!;
    const user = document.getElementById('user')!;
    const pwd = document.getElementById('pwd')!;
    mockRect(search, 200, 30, 0, 20);
    mockRect(user, 260, 30, 100, 20);
    mockRect(pwd, 260, 30, 140, 20);

    expect(detectLoginForm()[0].usernameField.id).toBe('user');
  });

  it('skips hidden password inputs', () => {
    document.body.innerHTML = `
      <form>
        <input id="user" type="text">
        <input id="pwd" type="password" style="display: none">
      </form>`;

    mockRect(document.getElementById('user')!, 260, 30, 100, 20);
    mockRect(document.getElementById('pwd')!, 260, 30, 140, 20);

    expect(detectLoginForm()).toHaveLength(0);
  });

  it('supports tel inputs as username candidates', () => {
    document.body.innerHTML = `
      <form>
        <input id="phone" type="tel" placeholder="手机号">
        <input id="pwd" type="password">
      </form>`;

    mockRect(document.getElementById('phone')!, 260, 30, 100, 20);
    mockRect(document.getElementById('pwd')!, 260, 30, 140, 20);

    expect(detectLoginForm()[0].usernameField.id).toBe('phone');
  });
});
