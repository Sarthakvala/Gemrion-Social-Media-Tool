/** Header for a section that is partly or fully planned: says plainly what exists, what is coming, and what it needs. */
export function PhaseIntro({
  title,
  phase,
  lead,
  coming,
  needs,
}: {
  title: string;
  phase: string;
  lead: string;
  coming: string[];
  needs: string[];
}) {
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        <span className="pill pill-pending">{phase}</span>
      </div>
      <p className="text-muted text-[13.5px] mt-1 mb-5 max-w-[720px]">{lead}</p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="panel p-4">
          <span className="lbl">Coming in this phase</span>
          <ol className="mt-2.5 flex flex-col gap-1.5 text-[13.5px]">
            {coming.map((c, i) => (
              <li key={c} className="flex gap-2.5">
                <span className="mono text-faint w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel p-4">
          <span className="lbl">Needed to switch it on</span>
          <ul className="mt-2.5 flex flex-col gap-1.5 text-[13.5px]">
            {needs.map((n) => (
              <li key={n} className="flex gap-2.5">
                <span className="text-accent shrink-0">●</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
