import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";

import playgroundReadyImage from "../assets/playground-ready.png";
import { defaultAgencyBillingSettings } from "../lib/billing";
import { cx } from "../lib/cx";
import { improvePromptDraft } from "../lib/promptImprovement";
import { uploadReferenceFile } from "../lib/uploads";
import { INFLUENCER_MODELS_QUERY } from "../queries/model";
import { AGENCIES_QUERY, REQUEST_INFLUENCER_DRAFT_MUTATION } from "../queries/user";
import {
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
import type { AgencyRecord, BoardSettings, InfluencerModel, PlatformNotification, ReferenceSelection, UserRecord } from "../types";

interface AgencyInfluencerBuilderPageProps {
  currentUser: UserRecord;
  onCancel: () => void;
}

interface DraftReference {
  id: string;
  label: string;
  imageUrl: string;
  promptSnapshot: string;
}

const defaultPosePromptTemplate = "Keep the same framing and styling while varying the body pose for each multiplied shot.";
const maxDraftReferenceCount = 10;
const draftPortraitCount = 5;
const draftPortraitDragType = "application/x-autoscale-draft-portrait-id";

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
    quantity: Math.min(4, getMaxQuantityForGenerationModel(generationModel)),
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

function buildUploadedDraftPortrait(slotIndex: number, fileName: string, upload: Awaited<ReturnType<typeof uploadReferenceFile>>): DraftReference {
  return {
    id: `draft-uploaded-portrait-${slotIndex}-${upload.fileName}-${Date.now()}`,
    imageUrl: upload.url,
    label: fileName,
    promptSnapshot: "Uploaded portrait example",
  };
}

function buildUploadReference(slotIndex: number, fileName: string, upload: Awaited<ReturnType<typeof uploadReferenceFile>>): ReferenceSelection {
  return {
    id: `draft-generation-reference-${slotIndex}-${upload.fileName}-${Date.now()}`,
    slotIndex,
    label: fileName,
    sourceType: "UPLOAD",
    assetId: null,
    assetUrl: null,
    uploadPath: upload.filePath,
    uploadUrl: upload.url,
    asset: null,
  };
}

function previewSourceForReference(reference: ReferenceSelection): string | null {
  return reference.asset?.url || reference.assetUrl || reference.uploadUrl || null;
}

function filledDraftReferences(settings: BoardSettings): ReferenceSelection[] {
  return settings.globalReferences
    .filter((reference) => previewSourceForReference(reference))
    .sort((left, right) => left.slotIndex - right.slotIndex);
}

function normalizeDraftReferenceTray(references: ReferenceSelection[]): ReferenceSelection[] {
  return references
    .filter((reference) => previewSourceForReference(reference))
    .slice(0, maxDraftReferenceCount)
    .map((reference, index) => ({ ...reference, slotIndex: index }));
}

function moveReferenceToIndex(references: ReferenceSelection[], sourceReferenceId: string, targetIndex: number): ReferenceSelection[] {
  const sourceIndex = references.findIndex((reference) => reference.id === sourceReferenceId);

  if (sourceIndex === -1) {
    return references;
  }

  const nextReferences = [...references];
  const [sourceReference] = nextReferences.splice(sourceIndex, 1);
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, nextReferences.length));

  nextReferences.splice(boundedTargetIndex, 0, sourceReference);

  return nextReferences;
}

function removeDraftReference(settings: BoardSettings, referenceId: string): ReferenceSelection[] {
  return normalizeDraftReferenceTray(settings.globalReferences.filter((reference) => reference.id !== referenceId));
}

function reorderDraftReference(settings: BoardSettings, sourceReferenceId: string, targetIndex: number): ReferenceSelection[] {
  return normalizeDraftReferenceTray(moveReferenceToIndex(filledDraftReferences(settings), sourceReferenceId, targetIndex));
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "AI";
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function buildEmptyDraftPortraitSlots(): Array<DraftReference | null> {
  return Array.from({ length: draftPortraitCount }, () => null);
}

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20">
      <path
        d="M4.75 3.25h10.5c1.1 0 2 .9 2 2v9.5c0 1.1-.9 2-2 2H4.75c-1.1 0-2-.9-2-2v-9.5c0-1.1.9-2 2-2Zm0 1.5a.5.5 0 0 0-.5.5v7.36l2.59-2.35a1.5 1.5 0 0 1 2.05.03l1.36 1.3 2.18-2.58a1.5 1.5 0 0 1 2.24-.06l1.08 1.12V5.25a.5.5 0 0 0-.5-.5H4.75Zm11 7.47-2.16-2.24-2.17 2.57a1.5 1.5 0 0 1-2.18.11l-1.38-1.32-3.61 3.27v.14c0 .28.22.5.5.5h10.5a.5.5 0 0 0 .5-.5v-2.53ZM7.25 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AgencyInfluencerBuilderPage({ currentUser, onCancel }: AgencyInfluencerBuilderPageProps) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<BoardSettings>(() => buildInitialSettings());
  const [generatedDrafts, setGeneratedDrafts] = useState<DraftReference[]>([]);
  const [draftPortraitSlots, setDraftPortraitSlots] = useState<Array<DraftReference | null>>(() => buildEmptyDraftPortraitSlots());
  const [uploadingDraftPortrait, setUploadingDraftPortrait] = useState(false);
  const [uploadingGenerationReference, setUploadingGenerationReference] = useState(false);
  const [improvingPrompt, setImprovingPrompt] = useState(false);
  const [generatingDrafts, setGeneratingDrafts] = useState(false);
  const [draggedReferenceId, setDraggedReferenceId] = useState<string | null>(null);
  const [referenceDropIndex, setReferenceDropIndex] = useState<number | null>(null);
  const [referenceDragPreview, setReferenceDragPreview] = useState<{
    reference: ReferenceSelection;
    x: number;
    offsetX: number;
    railLeft: number;
    railRight: number;
    railTop: number;
    width: number;
    height: number;
  } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [submittedDraftNotification, setSubmittedDraftNotification] = useState<PlatformNotification | null>(null);
  const [closingAfterSubmit, setClosingAfterSubmit] = useState(false);
  const generationReferenceFileInputRef = useRef<HTMLInputElement | null>(null);
  const draftPortraitFileInputRef = useRef<HTMLInputElement | null>(null);
  const closeWorkspaceTimerRef = useRef<number | null>(null);
  const [requestInfluencerDraftMutation, { loading: submittingDraft }] = useMutation<{ requestInfluencerDraft: PlatformNotification }>(
    REQUEST_INFLUENCER_DRAFT_MUTATION,
  );
  const referenceTileElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const referenceRailRef = useRef<HTMLDivElement | null>(null);
  const { data } = useQuery<{ influencerModels: InfluencerModel[] }>(INFLUENCER_MODELS_QUERY, {
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
  const allowedAspectRatioOptions = getAspectRatioOptionsForGenerationModel(settings.generationModel);
  const allowedResolutionOptions = getResolutionOptionsForGenerationModel(settings.generationModel);
  const displayedAspectRatioOptions = allowedAspectRatioOptions;
  const maxQuantity = getMaxQuantityForGenerationModel(settings.generationModel);
  const quantityOptions = Array.from({ length: maxQuantity }, (_, index) => index + 1);
  const activeGlobalReferences = useMemo(() => filledDraftReferences(settings), [settings]);
  const nextReferenceSlot = activeGlobalReferences.length;
  const canAddReference = nextReferenceSlot < maxDraftReferenceCount;
  const activeReferenceImageUrls = useMemo(
    () => activeGlobalReferences.flatMap((reference) => previewSourceForReference(reference) ?? []),
    [activeGlobalReferences],
  );
  const draggedReference = draggedReferenceId ? activeGlobalReferences.find((reference) => reference.id === draggedReferenceId) ?? null : null;
  const referencesWithoutDragged = draggedReference
    ? activeGlobalReferences.filter((reference) => reference.id !== draggedReference.id)
    : activeGlobalReferences;
  const draggedReferenceOriginalIndex = draggedReference
    ? activeGlobalReferences.findIndex((reference) => reference.id === draggedReference.id)
    : -1;
  const activeReferenceDropIndex = draggedReference
    ? Math.max(0, Math.min(referenceDropIndex ?? draggedReferenceOriginalIndex, referencesWithoutDragged.length))
    : null;
  const previewReferenceItems = draggedReference
    ? [
        ...referencesWithoutDragged.slice(0, activeReferenceDropIndex ?? 0).map((reference) => ({ kind: "reference" as const, reference })),
        { kind: "drop-slot" as const, id: "reference-drop-slot" },
        ...referencesWithoutDragged.slice(activeReferenceDropIndex ?? 0).map((reference) => ({ kind: "reference" as const, reference })),
      ]
    : activeGlobalReferences.map((reference) => ({ kind: "reference" as const, reference }));
  const hasOpenPortraitSlot = draftPortraitSlots.some((reference) => !reference);
  const draftPortraitUrls = useMemo(
    () => draftPortraitSlots.flatMap((reference) => (reference ? [reference.imageUrl] : [])),
    [draftPortraitSlots],
  );
  const hasRequiredPortraits = draftPortraitUrls.length >= draftPortraitCount;
  const canSubmitDraft = Boolean(name.trim() && handle.trim() && hasRequiredPortraits && !submittingDraft);
  const generateDisabled = improvingPrompt || generatingDrafts;
  const controlClass =
    "h-10 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 text-xs font-semibold text-[color:var(--text-strong)] outline-none transition hover:bg-[color:var(--surface-soft-hover)] focus:border-[color:var(--focus-ring)]";
  const iconTileClass =
    "grid size-14 shrink-0 place-items-center rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-muted)] transition-all duration-200 ease-out hover:bg-[color:var(--surface-soft-hover)]";
  const addReferenceButtonClass =
    "relative -top-[5.5px] grid size-8 shrink-0 place-items-center rounded-[0.625rem] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] text-[color:var(--text-strong)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--accent-text)] focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45";

  useEffect(
    () => () => {
      if (closeWorkspaceTimerRef.current !== null) {
        window.clearTimeout(closeWorkspaceTimerRef.current);
      }
    },
    [],
  );

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

  function handleImprovePrompt(): void {
    const currentPrompt = prompt.trim();

    if (!currentPrompt || improvingPrompt) {
      return;
    }

    setImprovingPrompt(true);
    window.setTimeout(() => {
      setPrompt(improvePromptDraft(currentPrompt));
      setImprovingPrompt(false);
    }, 250);
  }

  function resolveReferenceDropIndex(clientX: number, sourceReferenceId: string): number {
    const tileBounds = [];

    for (const reference of activeGlobalReferences.filter((currentReference) => currentReference.id !== sourceReferenceId)) {
      const tile = referenceTileElementsRef.current.get(reference.id);
      if (!tile) {
        continue;
      }

      const bounds = tile.getBoundingClientRect();
      tileBounds.push({ centerX: bounds.left + bounds.width / 2, left: bounds.left });
    }

    const orderedTileBounds = tileBounds.sort((left, right) => left.left - right.left);
    const beforeIndex = orderedTileBounds.findIndex((bounds) => clientX < bounds.centerX);

    return beforeIndex === -1 ? orderedTileBounds.length : beforeIndex;
  }

  function finishReferenceDrag(): void {
    if (draggedReferenceId && referenceDropIndex !== null) {
      setSettings((current) => ({
        ...current,
        globalReferences: reorderDraftReference(current, draggedReferenceId, referenceDropIndex),
      }));
    }

    setDraggedReferenceId(null);
    setReferenceDropIndex(null);
    setReferenceDragPreview(null);
  }

  async function handleGenerationReferenceUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []).slice(0, maxDraftReferenceCount - activeGlobalReferences.length);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    setUploadingGenerationReference(true);
    setNotice(null);

    try {
      const uploadedReferences = await Promise.all(
        files.map(async (file, index) => buildUploadReference(nextReferenceSlot + index, file.name, await uploadReferenceFile(file))),
      );
      setSettings((current) => ({
        ...current,
        globalReferences: normalizeDraftReferenceTray([...current.globalReferences, ...uploadedReferences]),
      }));
      setNotice({
        tone: "success",
        text: `Added ${uploadedReferences.length} generation reference${uploadedReferences.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Reference upload failed." });
    } finally {
      setUploadingGenerationReference(false);
    }
  }

  async function handleDraftPortraitUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const openSlotIndexes = draftPortraitSlots.flatMap((reference, index) => (reference ? [] : [index]));
    const files = Array.from(event.target.files ?? []).slice(0, openSlotIndexes.length);
    event.target.value = "";

    if (!openSlotIndexes.length) {
      setNotice({ tone: "error", text: "Remove a portrait before uploading another one." });
      return;
    }

    if (!files.length) {
      return;
    }

    setUploadingDraftPortrait(true);
    setNotice(null);

    try {
      const uploadedReferences = await Promise.all(
        files.map(async (file, index) => buildUploadedDraftPortrait(openSlotIndexes[index] ?? index, file.name, await uploadReferenceFile(file))),
      );
      setDraftPortraitSlots((current) => {
        const nextSlots = Array.from({ length: draftPortraitCount }, (_, index) => current[index] ?? null);
        uploadedReferences.forEach((reference, index) => {
          const slotIndex = openSlotIndexes[index];

          if (slotIndex !== undefined) {
            nextSlots[slotIndex] = reference;
          }
        });

        return nextSlots;
      });
      setNotice({
        tone: "success",
        text: `Added ${uploadedReferences.length} uploaded portrait${uploadedReferences.length === 1 ? "" : "s"} to the draft slots.`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Portrait upload failed." });
    } finally {
      setUploadingDraftPortrait(false);
    }
  }

  function handleGenerateDrafts(): void {
    const trimmedPrompt = prompt.trim();
    if (generatingDrafts) {
      return;
    }

    if (!trimmedPrompt) {
      setNotice({ tone: "error", text: "Add a prompt before generating portrait options." });
      return;
    }

    setGeneratingDrafts(true);
    window.setTimeout(() => {
      const sourceImage = activeReferenceImageUrls[0] || playgroundReadyImage;
      const timestamp = Date.now();
      const nextDrafts = Array.from({ length: settings.quantity }, (_, index) => ({
        id: `draft-generated-${timestamp}-${index}`,
        imageUrl: sourceImage,
        label: `${workerModelLabels[settings.generationModel] || settings.generationModel} portrait ${index + 1}`,
        promptSnapshot: trimmedPrompt,
      }));

      setGeneratedDrafts((current) => {
        const uniqueDrafts = [...nextDrafts, ...current].filter(
          (reference, index, allReferences) => allReferences.findIndex((entry) => entry.id === reference.id) === index,
        );

        return uniqueDrafts.slice(0, 18);
      });
      setGeneratingDrafts(false);
      setNotice({ tone: "success", text: `Generated ${nextDrafts.length} temporary portrait draft${nextDrafts.length === 1 ? "" : "s"}. Select the best 5 from the grid.` });
    }, 350);
  }

  function handleToggleDraftPortrait(reference: DraftReference): void {
    const selectedIndex = draftPortraitSlots.findIndex((slotReference) => slotReference?.id === reference.id);

    if (selectedIndex !== -1) {
      setDraftPortraitSlots((current) =>
        Array.from({ length: draftPortraitCount }, (_, index) => (index === selectedIndex ? null : current[index] ?? null)),
      );
      return;
    }

    const openIndex = draftPortraitSlots.findIndex((slotReference) => !slotReference);

    if (openIndex === -1) {
      setNotice({ tone: "error", text: "Remove a selected portrait before adding another one." });
      return;
    }

    handleAssignDraftPortrait(reference, openIndex);
  }

  function handleAssignDraftPortrait(reference: DraftReference, slotIndex: number): void {
    setDraftPortraitSlots((current) => {
      const nextSlots = Array.from({ length: draftPortraitCount }, (_, index) => current[index] ?? null);
      const existingIndex = nextSlots.findIndex((slotReference) => slotReference?.id === reference.id);

      if (existingIndex !== -1) {
        nextSlots[existingIndex] = null;
      }

      nextSlots[slotIndex] = reference;

      return nextSlots;
    });
    setNotice(null);
  }

  function handleRemoveDraftPortrait(slotIndex: number): void {
    setDraftPortraitSlots((current) => Array.from({ length: draftPortraitCount }, (_, index) => (index === slotIndex ? null : current[index] ?? null)));
  }

  function handleDraftPortraitDragOver(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDropDraftPortrait(event: DragEvent<HTMLButtonElement>, slotIndex: number): void {
    event.preventDefault();

    const portraitId = event.dataTransfer.getData(draftPortraitDragType);
    const reference = generatedDrafts.find((currentReference) => currentReference.id === portraitId);

    if (!reference) {
      return;
    }

    handleAssignDraftPortrait(reference, slotIndex);
  }

  async function handleSubmitDraft(): Promise<void> {
    if (!canSubmitDraft) {
      if (!name.trim() || !handle.trim()) {
        setNotice({ tone: "error", text: "Add the draft influencer name and handle before sending it." });
      } else if (!hasRequiredPortraits) {
        setNotice({ tone: "error", text: "Add 5 portrait examples before sending the draft." });
      }
      return;
    }

    try {
      const { data } = await requestInfluencerDraftMutation({
        variables: {
          input: {
            name: name.trim(),
            handle: handle.trim(),
            prompt: prompt.trim(),
            portraitImageUrls: draftPortraitUrls.slice(0, draftPortraitCount),
          },
        },
      });

      const notification = data?.requestInfluencerDraft ?? null;
      setSubmittedDraftNotification(notification);
      setNotice({ tone: "success", text: "Draft sent. Closing workspace..." });
      setClosingAfterSubmit(true);
      closeWorkspaceTimerRef.current = window.setTimeout(() => {
        onCancel();
      }, 1200);
    } catch (error) {
      setClosingAfterSubmit(false);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not send influencer draft." });
    }
  }

  return (
    <div className="generation-workspace space-y-4">
      <section className={theme.cardStrong + " overflow-hidden"}>
        <div className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] font-display text-2xl text-[color:var(--text-strong)]">
                {getInitials(name)}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Generation workspace</p>
	                <div className="mt-2 flex flex-wrap items-center gap-2">
	                  <input
	                    className="w-full min-w-0 max-w-[24rem] rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-2 font-display text-2xl text-[color:var(--text-strong)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--focus-ring)] sm:w-auto sm:min-w-[13rem] sm:text-3xl"
	                    onChange={(event) => setName(event.target.value)}
	                    placeholder="Draft influencer"
	                    value={name}
	                  />
	                </div>
                <input
                  className="mt-2 w-full max-w-xs rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[color:var(--text-main)] outline-none transition placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--focus-ring)]"
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder="@handle"
                  value={handle}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1.5 uppercase tracking-[0.16em]">
                {draftPortraitUrls.length} / {draftPortraitCount} portraits
              </span>
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1.5 uppercase tracking-[0.16em]">
                {ownedInfluencers.length} / {influencerCapacity} used
              </span>
              <button className={theme.buttonSecondary + " rounded-xl px-3 py-2 text-xs"} onClick={onCancel} type="button">
                Cancel
              </button>
              <button className={theme.buttonPrimary + " rounded-xl px-3 py-2 text-xs"} disabled={submittingDraft || closingAfterSubmit} onClick={() => void handleSubmitDraft()} type="button">
                {closingAfterSubmit ? "Draft Sent" : submittingDraft ? "Sending..." : "Send Draft"}
              </button>
            </div>
          </div>
        </div>

        {notice ? (
          <div className="border-b border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3 sm:px-5">
            <div className={cx("mx-auto w-[min(100%,70rem)] rounded-2xl border px-4 py-3 text-sm font-semibold", notice.tone === "success" ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]" : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]")}>
              {notice.text}
            </div>
          </div>
        ) : null}

	        <div className="relative min-h-[76vh] overflow-hidden bg-[color:var(--surface-card-strong)] pb-6 sm:pb-8 lg:pb-10">
	          <div className="grid gap-px bg-[color:var(--surface-border)] sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {generatedDrafts.map((reference) => {
              const selectedPortraitIndex = draftPortraitSlots.findIndex((slotReference) => slotReference?.id === reference.id);
              const selected = selectedPortraitIndex !== -1;

              return (
                <button
                  key={reference.id}
                  className={cx(
                    "group relative aspect-[3/4] cursor-grab overflow-hidden bg-[color:var(--surface-card)] text-left ring-inset transition active:cursor-grabbing",
                    selected && "ring-2 ring-[color:var(--focus-ring)]",
                  )}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(draftPortraitDragType, reference.id);
                  }}
                  onClick={() => handleToggleDraftPortrait(reference)}
                  type="button"
                >
                  <img alt={reference.label} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={reference.imageUrl} />
                  <div className="absolute left-3 top-3 rounded-full border border-[rgba(255,255,255,0.16)] bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[rgba(255,255,255,0.82)] backdrop-blur">
                    {selected ? `Selected ${selectedPortraitIndex + 1}` : "Select"}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                    <p className="line-clamp-1 text-sm font-semibold text-[#fff]">{reference.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[rgba(255,255,255,0.72)]">{reference.promptSnapshot}</p>
                  </div>
                </button>
              );
            })}

	          </div>

          <form
            className="sticky bottom-4 z-30 mx-auto mt-4 w-[min(calc(100%-2rem),70rem)] rounded-[26px] border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-card-strong)] p-1 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              handleGenerateDrafts();
            }}
            style={{
              background:
                "linear-gradient(115deg, color-mix(in srgb, var(--text-strong) 8%, transparent) 27.54%, color-mix(in srgb, var(--surface-card) 38%, transparent) 85.5%), var(--surface-card-strong)",
            }}
          >
            <section className="mx-1 rounded-t-[22px] border border-b-0 border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-3 sm:mx-2">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[color:var(--text-strong)]">Draft influencer portraits</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--text-muted)]">Drop or upload 5 portrait images for the Ai Infuencer request.</p>
                </div>
                <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                  {draftPortraitUrls.length}/{draftPortraitCount}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  aria-label="Upload draft portrait images"
                  className={cx(addReferenceButtonClass, "top-0 size-14 rounded-xl")}
                  disabled={uploadingDraftPortrait || !hasOpenPortraitSlot}
                  onClick={() => {
                    if (!hasOpenPortraitSlot) {
                      setNotice({ tone: "error", text: "Remove a portrait before uploading another one." });
                      return;
                    }

                    draftPortraitFileInputRef.current?.click();
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-5" viewBox="0 0 20 20">
                    <path fill="currentColor" d="M9.16602 9.16602V4.16602H10.8327V9.16602H15.8327V10.8327H10.8327V15.8327H9.16602V10.8327H4.16602V9.16602H9.16602Z" />
                  </svg>
                </button>
                <input
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingDraftPortrait || !hasOpenPortraitSlot}
                  multiple
                  onChange={(event) => void handleDraftPortraitUpload(event)}
                  ref={draftPortraitFileInputRef}
                  type="file"
                />

                {draftPortraitSlots.map((reference, index) => (
                  <button
                    key={reference?.id ?? `portrait-placeholder-${index}`}
                    aria-label={reference ? `Remove portrait ${index + 1}` : `Drop generated portrait ${index + 1}`}
                    className={cx(
                      "group relative h-16 w-[3.15rem] shrink-0 overflow-hidden rounded-xl border bg-[color:var(--surface-card)] text-[color:var(--text-muted)] transition hover:border-[color:var(--focus-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] sm:h-[4.75rem] sm:w-[3.65rem] lg:h-20 lg:w-16",
                      reference ? "border-[color:var(--focus-ring)]" : "border-dashed border-[color:var(--surface-border)]",
                    )}
                    onClick={() => {
                      if (reference) {
                        handleRemoveDraftPortrait(index);
                      }
                    }}
                    onDragOver={handleDraftPortraitDragOver}
                    onDrop={(event) => handleDropDraftPortrait(event, index)}
                    title={reference ? "Click to remove" : "Drop image here"}
                    type="button"
                  >
                    {reference ? (
                      <>
                        <img alt={reference.label} className="h-full w-full object-cover" draggable={false} src={reference.imageUrl} />
                        <span className="absolute bottom-1 left-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[9px] font-bold text-[#fff]">
                          {index + 1}
                        </span>
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-[#fff] opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                          <svg aria-hidden="true" className="size-3" viewBox="0 0 20 20">
                            <path
                              fill="currentColor"
                              d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                            />
                          </svg>
                        </span>
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-[9px] font-bold leading-[10px] sm:text-[10px] sm:leading-3">
                        <ImagePlaceholderIcon className="size-4 opacity-70 sm:size-5" />
                        <span>Drop image here</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <fieldset className="flex min-w-0 flex-col gap-4 rounded-b-[22px] rounded-t-none border border-[color:var(--surface-border)] p-4 sm:p-5 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1 space-y-3">
                <div
                  className="relative flex min-h-16 items-center gap-2 overflow-x-auto overflow-y-visible pb-2"
                  onPointerCancel={finishReferenceDrag}
                  onPointerMove={(event) => {
                    if (!draggedReferenceId) {
                      return;
                    }

                    setReferenceDragPreview((current) => {
                      if (!current) {
                        return current;
                      }

                      const railBounds = referenceRailRef.current?.getBoundingClientRect();

                      return {
                        ...current,
                        railLeft: railBounds?.left ?? current.railLeft,
                        railRight: railBounds?.right ?? current.railRight,
                        x: event.clientX,
                      };
                    });
                    setReferenceDropIndex((current) => {
                      const nextDropIndex = resolveReferenceDropIndex(event.clientX, draggedReferenceId);
                      return current === nextDropIndex ? current : nextDropIndex;
                    });
                  }}
                  onPointerUp={finishReferenceDrag}
                  ref={referenceRailRef}
                >
                  {previewReferenceItems.map((item, index) => {
                    if (item.kind === "drop-slot") {
                      return (
                        <div
                          key={item.id}
                          className="size-14 shrink-0 rounded-xl border-2 border-dashed border-[color:var(--accent-main)] bg-[color:var(--surface-soft-hover)] shadow-[0_0_22px_color-mix(in_srgb,var(--accent-main)_28%,transparent)] transition-all duration-200"
                        />
                      );
                    }

                    const { reference } = item;
                    const previewSrc = previewSourceForReference(reference);

                    return (
                      <div
                        key={reference.id || index}
                        aria-grabbed={draggedReferenceId === reference.id}
                        className={cx(iconTileClass, "group relative cursor-grab touch-none select-none overflow-visible active:cursor-grabbing")}
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }

                          const bounds = event.currentTarget.getBoundingClientRect();
                          const railBounds = referenceRailRef.current?.getBoundingClientRect() ?? bounds;
                          try {
                            referenceRailRef.current?.setPointerCapture(event.pointerId);
                          } catch {
                            // Some browsers only allow the original pointer target to capture.
                          }
                          setDraggedReferenceId(reference.id);
                          setReferenceDropIndex(activeGlobalReferences.findIndex((currentReference) => currentReference.id === reference.id));
                          setReferenceDragPreview({
                            reference,
                            x: event.clientX,
                            offsetX: event.clientX - bounds.left,
                            railLeft: railBounds.left,
                            railRight: railBounds.right,
                            railTop: bounds.top,
                            width: bounds.width,
                            height: bounds.height,
                          });
                          event.preventDefault();
                        }}
                        ref={(node) => {
                          if (node) {
                            referenceTileElementsRef.current.set(reference.id, node);
                          } else {
                            referenceTileElementsRef.current.delete(reference.id);
                          }
                        }}
                        title="Drag to reorder"
                      >
                        <img alt={reference.label} className="h-full w-full rounded-xl object-cover" draggable={false} src={previewSrc ?? ""} />
                        <button
                          aria-label="Remove reference image"
                          className="absolute -right-2 -top-2 z-10 grid size-6 place-items-center rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card-strong)] text-[color:var(--text-muted)] opacity-100 shadow-[0_8px_22px_rgba(0,0,0,0.25)] transition hover:text-[color:var(--text-strong)] sm:opacity-0 sm:group-hover:opacity-100"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSettings((current) => ({
                              ...current,
                              globalReferences: removeDraftReference(current, reference.id),
                            }));
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          <svg aria-hidden="true" className="size-3.5" viewBox="0 0 20 20">
                            <path
                              fill="currentColor"
                              d="M4.22 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.72-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.72 4.72a.75.75 0 1 1-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  {canAddReference ? (
                    <div className="relative">
                      <button
                        aria-label="Add reference image"
                        className={addReferenceButtonClass}
                        disabled={uploadingGenerationReference}
                        onClick={() => generationReferenceFileInputRef.current?.click()}
                        type="button"
                      >
                        <svg aria-hidden="true" className="size-5" viewBox="0 0 20 20">
                          <path fill="currentColor" d="M9.16602 9.16602V4.16602H10.8327V9.16602H15.8327V10.8327H10.8327V15.8327H9.16602V10.8327H4.16602V9.16602H9.16602Z" />
                        </svg>
                      </button>
                      <input
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingGenerationReference}
                        multiple
                        onChange={(event) => void handleGenerationReferenceUpload(event)}
                        ref={generationReferenceFileInputRef}
                        type="file"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <button
                    className="absolute right-0 top-0 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-2.5 text-[11px] font-semibold text-[color:var(--text-main)] shadow-[0_8px_18px_rgba(0,0,0,0.10)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!prompt.trim() || improvingPrompt}
                    onClick={handleImprovePrompt}
                    title="Improve the current prompt without turning on Auto Prompt."
                    type="button"
                  >
                    <svg aria-hidden="true" className="size-3.5" viewBox="0 0 20 20">
                      <path
                        d="M10.9 2.9c.08-.48.76-.48.84 0l.18 1.1a5.28 5.28 0 0 0 4.36 4.36l1.1.18c.48.08.48.76 0 .84l-1.1.18a5.28 5.28 0 0 0-4.36 4.36l-.18 1.1c-.08.48-.76.48-.84 0l-.18-1.1a5.28 5.28 0 0 0-4.36-4.36l-1.1-.18c-.48-.08-.48-.76 0-.84l1.1-.18A5.28 5.28 0 0 0 10.72 4l.18-1.1Z"
                        fill="currentColor"
                      />
                      <path
                        d="M4.72 12.75c.06-.3.48-.3.54 0l.08.39a2.4 2.4 0 0 0 1.9 1.9l.39.08c.3.06.3.48 0 .54l-.39.08a2.4 2.4 0 0 0-1.9 1.9l-.08.39c-.06.3-.48.3-.54 0l-.08-.39a2.4 2.4 0 0 0-1.9-1.9l-.39-.08c-.3-.06-.3-.48 0-.54l.39-.08a2.4 2.4 0 0 0 1.9-1.9l.08-.39Z"
                        fill="currentColor"
                      />
                    </svg>
                    {improvingPrompt ? "Improving" : "Improve prompt"}
                  </button>
                  <textarea
                    className="min-h-16 max-h-32 w-full resize-none border-none bg-transparent pb-1 pr-36 pt-10 text-sm leading-6 text-[color:var(--text-strong)] outline-none placeholder:text-[color:var(--text-muted)]"
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Describe the scene you imagine"
                    value={prompt}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Worker model" className={controlClass + " min-w-40"} onChange={(event) => updateGenerationModel(event.target.value)} value={settings.generationModel}>
                    {imageGenerationModelOptions.map((option) => (
                      <option key={option} value={option}>
                        {workerModelLabels[option]}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Resolution"
                    className={controlClass + " w-24"}
                    onChange={(event) => setSettings((current) => ({ ...current, resolution: event.target.value }))}
                    value={settings.resolution}
                  >
                    {allowedResolutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {resolutionLabels[option]}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Aspect ratio"
                    className={controlClass + " w-24"}
                    onChange={(event) => setSettings((current) => ({ ...current, aspectRatio: event.target.value }))}
                    value={normalizeAspectRatioForGenerationModel(settings.generationModel, settings.aspectRatio)}
                  >
                    {displayedAspectRatioOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <div className="flex h-10 items-center gap-1 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-2">
                    <button
                      aria-label="Decrease quantity"
                      className="grid size-7 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:opacity-35"
                      disabled={settings.quantity <= 1}
                      onClick={() => setSettings((current) => ({ ...current, quantity: Math.max(1, current.quantity - 1) }))}
                      type="button"
                    >
                      -
                    </button>
                    <select
                      aria-label="Quantity"
                      className="h-8 bg-transparent px-1 text-center text-xs font-bold text-[color:var(--text-strong)] outline-none"
                      onChange={(event) => setSettings((current) => ({ ...current, quantity: Number(event.target.value) }))}
                      value={settings.quantity}
                    >
                      {quantityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}/{maxQuantity}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="Increase quantity"
                      className="grid size-7 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-soft-hover)] hover:text-[color:var(--text-strong)] disabled:opacity-35"
                      disabled={settings.quantity >= maxQuantity}
                      onClick={() => setSettings((current) => ({ ...current, quantity: Math.min(maxQuantity, current.quantity + 1) }))}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <button className={theme.buttonPrimary + " h-20 w-full rounded-2xl px-6 text-sm lg:w-36"} disabled={generateDisabled} type="submit">
                {generatingDrafts ? "Generating" : "Generate"}
              </button>
            </fieldset>
          </form>

          {referenceDragPreview ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-[90] overflow-hidden rounded-xl border border-[color:var(--focus-ring)] bg-[color:var(--surface-card-strong)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] ring-2 ring-[color:var(--focus-ring)]"
              style={{
                height: referenceDragPreview.height,
                left: Math.max(
                  referenceDragPreview.railLeft,
                  Math.min(referenceDragPreview.x - referenceDragPreview.offsetX, referenceDragPreview.railRight - referenceDragPreview.width),
                ),
                top: referenceDragPreview.railTop,
                transform: "scale(1.08)",
                transformOrigin: "center",
                width: referenceDragPreview.width,
              }}
            >
              <img
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
                src={previewSourceForReference(referenceDragPreview.reference) ?? ""}
              />
            </div>
          ) : null}

          <div className="mx-auto w-[min(calc(100%-2rem),70rem)]">
            {notice ? (
              <div className={cx("mt-3 rounded-2xl border px-4 py-3 text-sm", notice.tone === "success" ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]" : "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]")}>
                {notice.text}
              </div>
            ) : null}
            {submittedDraftNotification ? (
              <div className="mt-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] p-4 text-sm text-[color:var(--accent-text)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">Draft sent</p>
                    <p className="mt-1 text-xs leading-5">
                      Platform Admin notification created for {submittedDraftNotification.draftInfluencerName || name.trim()}.
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface-card)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent-text)]">
                    {submittedDraftNotification.draftPortraitUrls?.length ?? draftPortraitUrls.length}/5 images
                  </span>
                </div>
                {(submittedDraftNotification.draftPortraitUrls || draftPortraitUrls).length ? (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {(submittedDraftNotification.draftPortraitUrls || draftPortraitUrls).slice(0, 5).map((url, index) => (
                      <div key={`${submittedDraftNotification.id}-${url}-${index}`} className="aspect-[3/4] overflow-hidden rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--surface-soft)]">
                        <img alt={`Sent draft portrait ${index + 1}`} className="h-full w-full object-cover" src={url} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
