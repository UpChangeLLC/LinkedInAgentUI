import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownMessage } from '../MarkdownMessage';

describe('MarkdownMessage', () => {
  it('renders bold, lists and inline code as HTML elements (not raw markdown)', () => {
    const { container } = render(
      <MarkdownMessage content={'Here is **bold** and `code`.\n\n- one\n- two'} />,
    );
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('code')).toBeTruthy();
    expect(container.querySelectorAll('li')).toHaveLength(2);
    // raw markdown tokens should not survive as literal text
    expect(container.textContent).not.toContain('**bold**');
  });

  it('does not execute raw HTML in the content (XSS-safe)', () => {
    const { container } = render(
      <MarkdownMessage content={'<img src=x onerror="alert(1)"> hello'} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders GFM features like tables', () => {
    const { container } = render(
      <MarkdownMessage content={'| a | b |\n| - | - |\n| 1 | 2 |'} />,
    );
    expect(container.querySelector('table')).toBeTruthy();
  });
});
