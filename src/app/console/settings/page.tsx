import { requireAgency } from '@/lib/auth';
import { Shell } from '@/components/Shell';
import { consoleNav } from '@/lib/nav';
import { getAiSettingsView, ANTHROPIC_MODELS, OPENAI_MODEL_SUGGESTIONS } from '@/lib/ai/settings';
import { SettingsForm } from '@/components/studio/SettingsForm';

export default async function SettingsPage() {
  const profile = await requireAgency();
  const view = await getAiSettingsView();

  return (
    <Shell profile={profile} nav={consoleNav('settings')}>
      <div className="max-w-[760px]">
        <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>
        <p className="text-muted mt-1 mb-5 text-[13.5px]">
          AI keys used to draft brand kits and generate posts. Stored encrypted, readable only by the server, never sent back to the browser.
        </p>
        <SettingsForm view={view} anthropicModels={ANTHROPIC_MODELS} openaiSuggestions={OPENAI_MODEL_SUGGESTIONS} />
      </div>
    </Shell>
  );
}
