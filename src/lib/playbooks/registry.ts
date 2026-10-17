import { captionsPlaybook } from './captions';
import { carouselPlaybook } from './carousel';
import { hooksPlaybook } from './hooks';
import type { Playbook } from './types';

/** Every playbook the app can run. Add new ported skills here. */
export const PLAYBOOKS: readonly Playbook[] = [hooksPlaybook, carouselPlaybook, captionsPlaybook] as readonly Playbook[];

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

/** The value stored in jobs.playbook, e.g. "carousel-builder@v1". */
export function playbookRef(p: Pick<Playbook, 'id' | 'version'>): string {
  return `${p.id}@v${p.version}`;
}
