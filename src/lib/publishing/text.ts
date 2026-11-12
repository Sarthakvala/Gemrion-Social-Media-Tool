import { network, type NetworkId } from './networks';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** User-perceived characters: an emoji or accented letter counts as one. */
export function graphemeLength(text: string): number {
  return Array.from(segmenter.segment(text)).length;
}

/** Length the way a given network counts it. */
export function networkLength(id: NetworkId, text: string): number {
  return network(id).countsGraphemes ? graphemeLength(text) : text.length;
}

export interface TextParts {
  body: string;
  hashtags?: string;
  signature?: string;
}

function hashtagLine(raw: string | undefined): string {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(' ');
}

/** Body, then signature, then hashtags, each separated by a blank line; empty parts are skipped. */
export function composeText(parts: TextParts): string {
  return [parts.body.trim(), (parts.signature ?? '').trim(), hashtagLine(parts.hashtags)].filter(Boolean).join('\n\n');
}

export interface MediaSummary {
  images: number;
  videos: number;
  largestImageBytes: number;
}

/** Everything wrong with a post for one network, in plain words. Empty means it can be published. */
export function validateForNetwork(id: NetworkId, text: string, media: MediaSummary): string[] {
  const spec = network(id);
  const problems: string[] = [];
  const hasMedia = media.images + media.videos > 0;
  const limit = hasMedia && spec.captionLimit ? spec.captionLimit : spec.textLimit;
  const length = networkLength(id, text);

  if (!text.trim() && !hasMedia) problems.push('Nothing to post: add text or media.');
  if (length > limit) problems.push(`${spec.name} allows ${limit} characters${hasMedia && spec.captionLimit ? ' with media' : ''}; this is ${length}.`);
  if (spec.mediaRequired && !hasMedia) problems.push(`${spec.name} needs an image or video.`);
  if (media.images > spec.maxImages) problems.push(`${spec.name} takes at most ${spec.maxImages} image${spec.maxImages === 1 ? '' : 's'}; this has ${media.images}.`);
  if (media.videos > 0 && !spec.video) problems.push(`${spec.name} video publishing is not supported yet.`);
  if (media.videos > 1) problems.push('Only one video per post.');
  if (media.videos > 0 && media.images > 0) problems.push('Mix of images and video is not supported in one post.');
  if (media.images > 0 && media.largestImageBytes > spec.maxImageBytes) {
    problems.push(`An image is ${(media.largestImageBytes / 1024 / 1024).toFixed(1)} MB; ${spec.name} allows ${(spec.maxImageBytes / 1024 / 1024).toFixed(1)} MB.`);
  }
  return problems;
}
