import { addSlots, removeHashtagGroup, removeSignature, removeSlot, saveHashtagGroup, saveSignature } from '@/app/console/clients/[id]/channels/settings-actions';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  clientId: string;
  timezone: string;
  slots: { id: string; weekday: number; local_time: string }[];
  signatures: { id: string; name: string; body: string; is_default: boolean }[];
  groups: { id: string; name: string; tags: string[] }[];
}

function Hidden({ clientId, id }: { clientId: string; id?: string }) {
  return (
    <>
      <input type="hidden" name="client_id" value={clientId} />
      {id && <input type="hidden" name="id" value={id} />}
    </>
  );
}

/** Queue times, signatures and hashtag groups for one brand. Plain server-action forms. */
export function PublishingSettings({ clientId, timezone, slots, signatures, groups }: Props) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className="panel p-4 flex flex-col gap-3">
        <div>
          <span className="lbl">Queue times</span>
          <p className="text-muted text-[12.5px] mt-1">&quot;Add to queue&quot; takes the next free time. Times are in {timezone} (set in the brand kit).</p>
        </div>
        <div className="flex flex-col gap-1">
          {slots.length === 0 && <span className="mono text-faint">none yet</span>}
          {DAYS.map((d, i) => {
            const day = slots.filter((s) => s.weekday === i);
            if (!day.length) return null;
            return (
              <div key={d} className="flex items-center gap-2 flex-wrap">
                <span className="mono w-9">{d}</span>
                {day.map((s) => (
                  <form key={s.id} action={removeSlot}>
                    <Hidden clientId={clientId} id={s.id} />
                    <button className="pill hover:text-failed" title="Remove">
                      {s.local_time.slice(0, 5)} ✕
                    </button>
                  </form>
                ))}
              </div>
            );
          })}
        </div>
        <form action={addSlots} className="flex flex-col gap-2 border-t border-line pt-3">
          <Hidden clientId={clientId} />
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1 mono">
                <input type="checkbox" name="weekday" value={i} defaultChecked={i >= 1 && i <= 5} />
                {d}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="time" name="time" defaultValue="09:00" required />
            <button className="btn btn-sm">Add time</button>
          </div>
        </form>
      </section>

      <section className="panel p-4 flex flex-col gap-3">
        <div>
          <span className="lbl">Signatures</span>
          <p className="text-muted text-[12.5px] mt-1">The default signature is added under every post unless a channel&apos;s text is edited by hand.</p>
        </div>
        {signatures.map((s) => (
          <div key={s.id} className="border border-line rounded-md p-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[13px]">{s.name}</span>
              {s.is_default && <span className="pill pill-approved">default</span>}
              <form action={removeSignature} className="ml-auto">
                <Hidden clientId={clientId} id={s.id} />
                <button className="btn btn-ghost btn-sm">Remove</button>
              </form>
            </div>
            <p className="text-[12.5px] text-ink-2 whitespace-pre-wrap">{s.body}</p>
          </div>
        ))}
        <form action={saveSignature} className="flex flex-col gap-2 border-t border-line pt-3">
          <Hidden clientId={clientId} />
          <input name="name" placeholder="Name, e.g. Standard" maxLength={80} required />
          <textarea name="body" rows={2} placeholder="— The Gemrion team | gemrion.com" maxLength={2000} required />
          <label className="flex items-center gap-2 mono">
            <input type="checkbox" name="is_default" /> Use by default
          </label>
          <button className="btn btn-sm self-start">Save signature</button>
        </form>
      </section>

      <section className="panel p-4 flex flex-col gap-3">
        <div>
          <span className="lbl">Hashtag groups</span>
          <p className="text-muted text-[12.5px] mt-1">Reusable sets to insert in the composer.</p>
        </div>
        {groups.map((g) => (
          <div key={g.id} className="border border-line rounded-md p-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[13px]">{g.name}</span>
              <form action={removeHashtagGroup} className="ml-auto">
                <Hidden clientId={clientId} id={g.id} />
                <button className="btn btn-ghost btn-sm">Remove</button>
              </form>
            </div>
            <p className="mono text-faint break-words">{g.tags.map((t) => `#${t}`).join(' ')}</p>
          </div>
        ))}
        <form action={saveHashtagGroup} className="flex flex-col gap-2 border-t border-line pt-3">
          <Hidden clientId={clientId} />
          <input name="name" placeholder="Name, e.g. Finance core" maxLength={80} required />
          <textarea name="tags" rows={2} placeholder="#cashflow #cfo #smallbusiness" required />
          <button className="btn btn-sm self-start">Save group</button>
        </form>
      </section>
    </div>
  );
}
