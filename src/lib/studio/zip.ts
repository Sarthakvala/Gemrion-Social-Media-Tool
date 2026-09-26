import JSZip from 'jszip';
import { calendarCsv, captionsFile, postFolderName, slugify, type ExportablePost } from './export';

export interface ZipPost extends ExportablePost {
  urls: string[];
}

async function addImages(folder: JSZip, post: ZipPost) {
  for (let i = 0; i < post.urls.length; i++) {
    const res = await fetch(post.urls[i]);
    if (!res.ok) throw new Error(`Slide ${i + 1} of "${post.title}" failed to render (${res.status}).`);
    const ext = (res.headers.get('content-type') ?? '').includes('jpeg') ? 'jpg' : 'png';
    folder.file(`slide-${String(i + 1).padStart(2, '0')}.${ext}`, await res.blob());
  }
  folder.file('captions.txt', captionsFile(post));
}

function save(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function downloadPost(post: ZipPost) {
  const zip = new JSZip();
  await addImages(zip, post);
  save(await zip.generateAsync({ type: 'blob' }), `${postFolderName(post, 0)}.zip`);
}

export async function downloadMonth(
  posts: ZipPost[],
  name: string,
  onProgress?: (done: number, total: number) => void
) {
  const zip = new JSZip();
  zip.file('calendar.csv', calendarCsv(posts));
  for (let i = 0; i < posts.length; i++) {
    await addImages(zip.folder(postFolderName(posts[i], i))!, posts[i]);
    onProgress?.(i + 1, posts.length);
  }
  save(await zip.generateAsync({ type: 'blob' }), `${slugify(name, 60)}.zip`);
}
