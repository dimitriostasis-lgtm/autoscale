import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";

import playgroundReadyImage from "../assets/playground-ready.png";
import { defaultAgencyBillingSettings } from "../lib/billing";
import { cx } from "../lib/cx";
import { uploadReferenceFile } from "../lib/uploads";
import { CREATE_INFLUENCER_MODEL_MUTATION, INFLUENCER_MODELS_QUERY } from "../queries/model";
import { AGENCIES_QUERY } from "../queries/user";
import {
  generationModelOptions,
  getAspectRatioOptionsForGenerationModel,
  getMaxQuantityForGenerationModel,
  getResolutionOptionsForGenerationModel,
  imageGenerationModelOptions,
  normalizeAspectRatioForGenerationModel,
  normalizePoseMultiplierResolution,
  normalizeQualityForGenerationModel,
  normalizePoseMultiplierGenerationModel,
  normalizeResolutionForGenerationModel,
  resolutionLabels,
  theme,
  workerModelLabels,
} from "../styles/theme";
import type { AgencyRecord, BoardSettings, InfluencerModel, UserRecord } from "../types";

interface AgencyInfluencerBuilderPageProps {
  currentUser: UserRecord;
  onCancel: () => void;
  onCreated: (model: InfluencerModel) => void;
}

interface DraftReference {
  id: string;
  label: string;
  imageUrl: string;
  promptSnapshot: string;
}

const defaultPosePromptTemplate = "Keep the same framing and styling while varying the body pose for each multiplied shot.";

function buildInitialSettings(): BoardSettings {
  const generationModel = imageGenerationModelOptions[0];
  const poseMultiplierGenerationModel = normalizePoseMultiplierGenerationModel(generationModel);

  return {
    generationModel,
    resolution: normalizeResolutionForGenerationModel(generationModel, "2k"),
    poseMultiplierResolution: normalizePoseMultiplierResolution("2k", poseMultiplierGenerationModel),
    videoDurationSeconds: null,
    quality: normalizeQualityForGenerationModel(generationModel, "medium"),
    aspectRatio: "auto",
    quantity: 4,
    sdxlWorkspaceMode: "DEFAULT",
    poseMultiplierEnabled: false,
    poseMultiplier: 1,
    poseMultiplierGenerationModel,
    upscale: false,
    faceSwap: false,
    autoPromptGen: false,
    autoPromptImage: false,
    posePromptMode: "AUTO",
    posePromptTemplate: defaultPosePromptTemplate,
    posePromptTemplates: Array.from({ length: 4 }, () => defaultPosePromptTemplate),
    globalReferences: [],
  };
}

function buildPromptPrefix(corePrompt: string, handoffNotes: string, referenceImageUrls: string[]): string {
  const promptParts = [corePrompt.trim()];
  const trimmedHandoffNotes = handoffNotes.trim();

  if (trimmedHandoffNotes) {
    promptParts.push(`Desired influencer facial features and team handoff:\n${trimmedHandoffNotes}`);
  }

  if (referenceImageUrls.length) {
    promptParts.push(`Reference image URLs:\n${referenceImageUrls.map((url) => `- ${url}`).join("\n")}`);
  }

  return promptParts.filter(Boolean).join("\n\n");
}

function formatReferenceLabel(value: string): string {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.hostname.replace(/^www\./, "") || "Pasted reference";
  } catch {
    return "Pasted reference";
  }
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "AI";
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function AgencyInfluencerBuilderPage({ currentUser, onCancel, onCreated }: AgencyInfluencerBuilderPageProps) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [handoffNotes, setHandoffNotes] = useState("");
  const [pastedReferenceUrl, setPastedReferenceUrl] = useState("");
  const [settings, setSettings] = useState<BoardSettings>(() => buildInitialSettings());
  const [draftReferences, setDraftReferences] = useState<DraftReference[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [createInfluencerModelMutation, { loading: creating }] = useMutation<{ createInfluencerModel: InfluencerModel }>(CREATE_INFLUENCER_MODEL_MUTATION);
  const { data, loading, refetch } = useQuery<{ influencerModels: InfluencerModel[] }>(INFLUENCER_MODELS_QUERY, {
    fetchPolicy: "cache-and-network",
    variables: { includeInactive: false },
  });
  const { data: agenciesData } = useQuery<{ agencies: AgencyRecord[] }>(AGENCIES_QUERY, {
    fetchPolicy: "cache-and-network",
  });

  const currentAgency = agenciesData?.agencies.find((agency) => agency.id === currentUser.agencyId) || null;
  const influencerCapacity = currentAgency?.billingSettings.aiInfluencerAllowance ?? defaultAgencyBillingSettings.aiInfluencerAllowance;
  const ownedInfluencers = useMemo(
    () => (data?.influencerModels || []).filter((model) => model.assignedAgencyIds.includes(currentUser.agencyId || "")),
    [currentUser.agencyId, data?.influencerModels],
  );
  const openInfluencerSlots = Math.max(0, influencerCapacity - ownedInfluencers.length);
  const allowedAspectRatioOptions = getAspectRatioOptionsForGenerationModel(settings.generationModel);
  const allowedResolutionOptions = getResolutionOptionsForGenerationModel(settings.generationModel);
  const quantityOptions = Array.from({ length: getMaxQuantityForGenerationModel(settings.generationModel) }, (_, index) => index + 1);
  const referenceImageUrls = useMemo(() => draftReferences.map((reference) => reference.imageUrl), [draftReferences]);
  const hasCreativeBrief = Boolean(prompt.trim() || handoffNotes.trim() || referenceImageUrls.length);
  const canCreate = Boolean(name.trim() && handle.trim() && hasCreativeBrief && openInfluencerSlots > 0 && !creating);

  if (currentUser.role !== "AGENCY_ADMIN") {
    return <div className={theme.cardStrong + " glass-panel p-10 text-[color:var(--text-muted)]"}>Only agency admins can create agency influencers.</div>;
  }

  function updateGenerationModel(nextGenerationModel: string): void {
    const nextQuantity = Math.min(settings.quantity, getMaxQuantityForGenerationModel(nextGenerationModel));

    setSettings((current) => ({
      ...current,
      generationModel: nextGenerationModel,
      resolution: normalizeResolutionForGenerationModel(nextGenerationModel, current.resolution),
      videoDurationSeconds: null,
      quality: normalizeQualityForGenerationModel(nextGenerationModel, current.quality),
      aspectRatio: normalizeAspectRatioForGenerationModel(nextGenerationModel, current.aspectRatio),
      quantity: nextQuantity,
      sdxlWorkspaceMode: imageGenerationModelOptions.includes(nextGenerationModel as (typeof imageGenerationModelOptions)[number]) ? current.sdxlWorkspaceMode : "DEFAULT",
      poseMultiplierEnabled: nextQuantity === 1 ? current.poseMultiplierEnabled : false,
      poseMultiplierGenerationModel: normalizePoseMultiplierGenerationModel(current.poseMultiplierGenerationModel, nextGenerationModel),
    }));
  }

  function addDraftReference(imageUrl: string, label: string): void {
    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) {
      return;
    }

    setDraftReferences((current) => [
      {
        id: `draft-reference-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imageUrl: trimmedUrl,
        label,
        promptSnapshot: prompt.trim() || handoffNotes.trim() || "Draft influencer reference",
      },
      ...current,
    ].slice(0, 18));
  }

  function handleAddPastedReference(): void {
    const trimmedUrl = pastedReferenceUrl.trim();
    if (!trimmedUrl) {
      return;
    }

    addDraftReference(trimmedUrl, formatReferenceLabel(trimmedUrl));
    setPastedReferenceUrl("");
  }

  async function handleReferenceUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setUploadingReference(true);
    setNotice(null);

    try {
      const upload = await uploadReferenceFile(file);
      addDraftReference(upload.url, file.name);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Reference upload failed." });
    } finally {
      setUploadingReference(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!canCreate) {
      if (openInfluencerSlots <= 0) {
        setNotice({ tone: "error", text: "AI influencer allowance is already fully used." });
      } else if (!hasCreativeBrief) {
        setNotice({ tone: "error", text: "Add a prompt, handoff notes, or a reference before creating the influencer." });
      }
      return;
    }

    try {
      const result = await createInfluencerModelMutation({
        variables: {
          input: {
            name: name.trim(),
            handle: handle.trim(),
            description: "",
            avatarImageUrl: referenceImageUrls[0] || null,
            allowedGenerationModels: [...generationModelOptions],
            defaults: {
              generationModel: settings.generationModel,
              resolution: settings.resolution,
              aspectRatio: settings.aspectRatio,
              quantity: settings.quantity,
              promptPrefix: buildPromptPrefix(prompt, handoffNotes, referenceImageUrls),
            },
          },
        },
      });

      const createdModel = result.data?.createInfluencerModel;
      await refetch();

      if (createdModel) {
        setNotice({ tone: "success", text: `Created ${createdModel.name}.` });
        onCreated(createdModel);
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not create influencer." });
    }
  }

  return (
    <form className="generation-workspace space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <section className={theme.cardStrong + " overflow-hidden border-white/10 bg-[#171717]/92 shadow-[0_28px_80px_rgba(0,0,0,0.35)]"}>
        <div className="border-b border-white/8 bg-[#1f1f1f] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#2a2a2a] font-display text-2xl text-white">
                {referenceImageUrls[0] ? <img alt={name || "Draft influencer"} className="h-full w-full object-cover" src={referenceImageUrls[0]} /> : getInitials(name)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Generation workspace</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl text-white sm:text-3xl">{name.trim() || "Draft influencer"}</h1>
                  <span className="rounded-full border border-lime-300/45 bg-lime-300/12 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-lime-100 shadow-[0_0_24px_rgba(190,242,100,0.16)]">
                    Playground
                  </span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/38">{handle.trim() || "@handle"}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/48">
              <span className="rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1.5 uppercase tracking-[0.16em]">
                {referenceImageUrls.length} refs
              </span>
              <span className="rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1.5 uppercase tracking-[0.16em]">
                {ownedInfluencers.length} / {influencerCapacity} used
              </span>
              <span className={cx("rounded-full border px-3 py-1.5 font-bold uppercase tracking-[0.16em]", openInfluencerSlots > 0 ? "border-lime-300/45 bg-lime-300/12 text-lime-100" : "border-rose-300/30 bg-rose-300/10 text-rose-100")}>
                {loading ? "Checking" : `${openInfluencerSlots} slot${openInfluencerSlots === 1 ? "" : "s"} open`}
              </span>
              <button className={theme.buttonSecondary + " rounded-xl border-white/10 bg-[#2a2a2a] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-[#333333]"} onClick={onCancel} type="button">
                Cancel
              </button>
              <button className={theme.buttonPrimary + " rounded-xl px-3 py-2 text-xs"} disabled={!canCreate} type="submit">
                {creating ? "Creating..." : "Create influencer"}
              </button>
            </div>
          </div>
        </div>

        <div className="relative min-h-[68vh] overflow-hidden bg-[#171717]">
          <div className="grid gap-px bg-white/8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {draftReferences.map((reference) => (
              <button key={reference.id} className="group relative aspect-[3/4] overflow-hidden bg-[#202020] text-left" type="button">
                <img alt={reference.label} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={reference.imageUrl} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{reference.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/62">{reference.promptSnapshot}</p>
                </div>
              </button>
            ))}

            {!draftReferences.length ? (
              <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4 flex min-h-[420px] items-center justify-center bg-[#1b1b1b] px-6 text-center">
                <img
                  alt="Ready to bring your idea to life?"
                  className="w-full max-w-[680px] select-none object-contain opacity-95"
                  draggable={false}
                  src={playgroundReadyImage}
                />
              </div>
            ) : null}
          </div>

          {settingsOpen ? (
            <div className="absolute right-4 top-4 z-20 w-[min(420px,calc(100%-2rem))] rounded-[28px] border border-white/10 bg-[#202020]/95 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/42">Settings</p>
                  <p className="mt-2 text-sm font-semibold text-white">Playground defaults</p>
                </div>
                <button className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/62" onClick={() => setSettingsOpen(false)} type="button">
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Influencer name</span>
                  <input className="w-full rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/25" onChange={(event) => setName(event.target.value)} placeholder="Creator name" value={name} />
                </label>
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Handle</span>
                  <input className="w-full rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/25" onChange={(event) => setHandle(event.target.value)} placeholder="@handle" value={handle} />
                </label>

                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Worker model</span>
                  <select className="w-full rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/25" onChange={(event) => updateGenerationModel(event.target.value)} value={settings.generationModel}>
                    {imageGenerationModelOptions.map((option) => (
                      <option key={option} value={option}>
                        {workerModelLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Resolution</span>
                  <select className="w-full rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/25" onChange={(event) => setSettings((current) => ({ ...current, resolution: event.target.value }))} value={settings.resolution}>
                    {allowedResolutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {resolutionLabels[option]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Aspect ratio</span>
                  <select className="w-full rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/25" onChange={(event) => setSettings((current) => ({ ...current, aspectRatio: event.target.value }))} value={normalizeAspectRatioForGenerationModel(settings.generationModel, settings.aspectRatio)}>
                    {allowedAspectRatioOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Quantity</span>
                  <select className="w-full rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/25" onChange={(event) => setSettings((current) => ({ ...current, quantity: Number(event.target.value) }))} value={settings.quantity}>
                    {quantityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Allowance</p>
                  <p className="mt-2 text-sm font-semibold text-white">{ownedInfluencers.length} / {influencerCapacity}</p>
                </div>

                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/42">Team handoff</span>
                  <textarea className="min-h-24 w-full resize-none rounded-xl border border-white/8 bg-[#262626] px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/34 focus:border-lime-300/25" onChange={(event) => setHandoffNotes(event.target.value)} placeholder="Drop desired influencer facial features here..." value={handoffNotes} />
                </label>

                <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    className="h-10 rounded-xl border border-white/8 bg-[#262626] px-3 text-sm text-white outline-none placeholder:text-white/34 focus:border-lime-300/25"
                    onChange={(event) => setPastedReferenceUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddPastedReference();
                      }
                    }}
                    placeholder="Paste generated image URL"
                    value={pastedReferenceUrl}
                  />
                  <button className={theme.buttonSecondary + " h-10 rounded-xl px-3 py-0 text-xs"} disabled={!pastedReferenceUrl.trim()} onClick={handleAddPastedReference} type="button">
                    Add ref
                  </button>
                  <label className={cx(theme.buttonSecondary + " h-10 rounded-xl px-3 py-0 text-xs", uploadingReference ? "cursor-wait opacity-70" : "cursor-pointer")}>
                    {uploadingReference ? "Uploading" : "Upload"}
                    <input accept="image/*" className="hidden" disabled={uploadingReference} onChange={(event) => void handleReferenceUpload(event)} type="file" />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 border-t border-white/8 bg-[#171717]/82 px-4 py-4 backdrop-blur-2xl sm:px-6">
            <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-[32px] border border-white/10 bg-[#252525] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
              <textarea
                className="min-h-16 flex-1 resize-none rounded-[26px] border border-white/8 bg-[#181818] px-5 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/34 focus:border-lime-300/25"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe what you want to generate..."
                value={prompt}
              />
              <button className={theme.buttonSecondary + " h-12 rounded-full px-4"} onClick={() => setSettingsOpen((current) => !current)} type="button">
                Settings
              </button>
              <button className={theme.buttonPrimary + " h-12 rounded-full px-5"} disabled={!prompt.trim()} type="button">
                Generate
              </button>
            </div>

            {notice ? (
              <div className={cx("mx-auto mt-3 max-w-5xl rounded-2xl border px-4 py-3 text-sm", notice.tone === "success" ? "border-lime-300/25 bg-lime-300/10 text-lime-100" : "border-rose-300/25 bg-rose-300/10 text-rose-100")}>
                {notice.text}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </form>
  );
}
