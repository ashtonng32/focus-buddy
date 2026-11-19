// Opens the Claude Android app with a ready-made first message (falls back to the website).
// The same text can be copied to the clipboard in case the app opens with an empty box.
export function stuckPrompt(task: string, tasksApp: string) {
  return (
    `I'm stuck on "${task}" and could use a hand. ` +
    `Ask me one quick question about what's in the way, then help me find a tiny first step. ` +
    `My Today list in ${tasksApp} might help.`
  );
}

export function claudeLink(task: string, tasksApp: string) {
  const q = encodeURIComponent(stuckPrompt(task, tasksApp));
  const web = `https://claude.ai/new?q=${q}`;
  return `intent://claude.ai/new?q=${q}#Intent;scheme=https;package=com.anthropic.claude;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}

export async function copyPrompt(task: string, tasksApp: string) {
  try {
    await navigator.clipboard.writeText(stuckPrompt(task, tasksApp));
    return true;
  } catch {
    return false; // clipboard blocked: the link still carries the prompt
  }
}
