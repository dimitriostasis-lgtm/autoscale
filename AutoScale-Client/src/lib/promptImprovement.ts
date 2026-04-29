export type PromptImprovementKind = "general" | "voiceover";

export function improvePromptDraft(prompt: string, kind: PromptImprovementKind = "general"): string {
  const normalized = prompt
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

  if (!normalized) {
    return "";
  }

  const sentenceCase = normalized.replace(/(^|[.!?]\s+)([a-z])/g, (match) => match.toUpperCase());
  const punctuated = /[.!?]$/.test(sentenceCase) ? sentenceCase : `${sentenceCase}.`;

  if (kind === "voiceover") {
    if (/^Voiceover direction:/i.test(punctuated)) {
      return punctuated;
    }

    return `Voiceover direction: deliver this naturally, clearly, and with a polished human cadence.\n\n${punctuated}`;
  }

  if (/^Improved prompt:/i.test(punctuated)) {
    return punctuated;
  }

  return `Improved prompt: ${punctuated}`;
}
