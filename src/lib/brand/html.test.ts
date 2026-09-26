import { describe, expect, test } from 'vitest';
import { extractColors, extractFonts, findAboutLink, htmlToText, isPrivateIp, metaContent, pageTitle } from './html';

describe('isPrivateIp', () => {
  test.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', 'not-an-ip',
  ])('%s is blocked', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  test.each(['8.8.8.8', '104.21.3.4', '172.32.0.1', '2606:4700::1111', '::ffff:1.1.1.1'])('%s is public', (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

const PAGE = `<!doctype html><html><head>
<title>Gemrion &amp; Co | Brand, web, ads</title>
<meta name="description" content="We tell you when you're wasting money.">
<meta name="theme-color" content="#0D1023">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Fraunces&display=swap" rel="stylesheet">
<style>body{color:#F4F2EA;background:#0d1023;font-family:'Inter',sans-serif} .a{color:#c6a15a} .b{color:#C6A15A} .c{color:#fff}</style>
<script>var x = "<p>not text</p>";</script>
</head><body>
<nav><a href="/about-us">About</a><a href="https://other.com/about">Other</a></nav>
<h1>Honest marketing</h1><p>For founders&nbsp;who hate waste.</p>
<!-- hidden comment -->
</body></html>`;

describe('page parsing', () => {
  test('htmlToText drops scripts, styles and comments and decodes entities', () => {
    const text = htmlToText(PAGE);
    expect(text).toContain('Honest marketing');
    expect(text).toContain('For founders who hate waste.');
    expect(text).not.toContain('not text');
    expect(text).not.toContain('hidden comment');
    expect(text).not.toContain('font-family');
  });

  test('htmlToText respects the max length', () => {
    expect(htmlToText('<p>abcdefghij</p>', 4)).toBe('abcd');
  });

  test('title and meta', () => {
    expect(pageTitle(PAGE)).toBe('Gemrion & Co | Brand, web, ads');
    expect(metaContent(PAGE, 'description')).toBe("We tell you when you're wasting money.");
  });

  test('extractColors puts theme-color first and merges case/short forms', () => {
    const colors = extractColors(PAGE);
    expect(colors[0]).toBe('#0d1023');
    expect(colors).toContain('#c6a15a');
    expect(colors).toContain('#ffffff');
    expect(new Set(colors).size).toBe(colors.length);
  });

  test('extractFonts reads Google Fonts families and CSS declarations', () => {
    expect(extractFonts(PAGE)).toEqual(['DM Sans', 'Fraunces', 'Inter']);
  });

  test('findAboutLink returns a same-origin about page only', () => {
    expect(findAboutLink(PAGE, new URL('https://gemrion.com/'))?.toString()).toBe('https://gemrion.com/about-us');
    expect(findAboutLink('<a href="https://x.com/about">About</a>', new URL('https://gemrion.com/'))).toBeNull();
  });
});
