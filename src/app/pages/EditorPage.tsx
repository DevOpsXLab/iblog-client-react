import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, HistoryIcon, ImageIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { myPublicationsQuery } from "@/contexts/collections/application/hooks";
import { engagementRepository } from "@/contexts/engagement/infrastructure/engagementRepository";
import { useMe } from "@/contexts/identity/application/session";
import { displayName } from "@/contexts/identity/domain/account";
import { useSaveStory } from "@/contexts/publishing/application/hooks";
import { diffStats } from "@/contexts/publishing/domain/revision";
import { emptyStory, normTags, type StoryForm, storyFormSchema, storyToForm } from "@/contexts/publishing/domain/story";
import { studioRepository } from "@/contexts/publishing/infrastructure/storyRepository";
import { postByIdQuery } from "@/contexts/reading/application/queries";
import { postPath, readTime } from "@/contexts/reading/domain/post";
import { cn } from "@/shared/lib/cn";
import { shortDate } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { inputBoxCls } from "@/shared/ui/form";
import { Lens, Modal } from "@/shared/ui/modal";
import { Bone } from "@/shared/ui/states";
import { toast } from "@/shared/ui/toast";

const MAX_COVER = 5 * 1024 * 1024;
const grow = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

function TopicsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const next = normTags([...value, draft]);
    if (next.length > 5) return;
    onChange(next);
    setDraft("");
  };
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong bg-card p-2 focus-within:border-fg focus-within:shadow-[2px_2px_0_0_var(--fg)]">
      {value.map((t) => (
        <span key={t} className="tag">
          <span className="min-w-0 truncate">#{t}</span>
          <button
            type="button"
            aria-label={`Remove ${t}`}
            className="grid size-5 place-items-center rounded-[2px] hover:bg-inverse hover:text-on-inverse"
            onClick={() => onChange(value.filter((x) => x !== t))}
          >
            <XIcon className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {value.length < 5 ? (
        <input
          value={draft}
          aria-label="Add a topic"
          placeholder="Add a topic…"
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
          onChange={(e) => setDraft(e.target.value.replace(",", ""))}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
        />
      ) : (
        <span className="self-center font-mono text-[11px] text-muted">Up to 5 topics</span>
      )}
      <span className="idx ml-auto self-center text-[11px]">{value.length}/5</span>
    </div>
  );
}

function PublishDialog({
  open,
  onOpenChange,
  form,
  onPublish,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: ReturnType<typeof useForm<StoryForm>>;
  onPublish: (when: "now" | "later") => void;
  pending: boolean;
}) {
  const { me } = useMe();
  const pubs = useQuery({ ...myPublicationsQuery(), enabled: open });
  const publicationId = useWatch({ control: form.control, name: "publicationId" });
  const publishAt = useWatch({ control: form.control, name: "publishAt" });
  const [later, setLater] = useState(!!publishAt);
  const cover = useWatch({ control: form.control, name: "coverUrl" });
  const tags = useWatch({ control: form.control, name: "tags" });
  const title = useWatch({ control: form.control, name: "title" });
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const step = "tile overflow-hidden";
  const stepHead = "tile-head";
  const stepBody = "p-3";
  const status = (done: boolean | "optional") => (
    <span className="ml-auto">
      <span aria-hidden>{done === true ? "✓" : "—"}</span>
      <span className="sr-only">{done === true ? "complete" : "optional"}</span>
    </span>
  );
  const timeOk = !later || (!!publishAt && !form.formState.errors.publishAt);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-fade fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] overflow-y-auto border-l border-line-strong bg-card p-6 md:p-8">
          <Dialog.Close asChild>
            <Button variant="ghost-icon" aria-label="Close" className="absolute top-4 right-4">
              <XIcon aria-hidden />
            </Button>
          </Dialog.Close>
          <Dialog.Title className="font-display text-2xl font-extrabold tracking-[-0.02em]">Ready to ship</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">Check these before it goes live.</Dialog.Description>
          <ol className="mt-6 space-y-3">
            <li className={step}>
              <div className={stepHead}>
                <span className="idx text-fg">01</span>
                <h3>Cover</h3>
                {status(!!cover)}
              </div>
              <div className={stepBody}>
                <label
                  className={`flex aspect-[16/9] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-dashed border-line-strong p-6 text-center font-mono text-[12px] text-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${cover ? "" : "hatch"}`}
                >
                  {cover ? (
                    <img src={cover} alt="Cover" className="size-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="mb-2 size-6" aria-hidden />
                      {uploading ? "Uploading…" : "Drop a cover image (PNG, JPG, WebP, GIF · max 5 MB)"}
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > MAX_COVER) return setErr("Image must be 5 MB or smaller.");
                      setErr("");
                      setUploading(true);
                      try {
                        form.setValue("coverUrl", await engagementRepository.upload(f), { shouldDirty: true });
                      } catch (x) {
                        toast.error(x);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </label>
                {cover ? (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => form.setValue("coverUrl", "", { shouldDirty: true })}>
                    Remove cover
                  </Button>
                ) : null}
                {err ? <p className="mt-2 font-mono text-[12px] text-danger">{err}</p> : null}
                <div aria-hidden className="mt-3 grid grid-cols-[1fr_auto] gap-3 border-t border-line pt-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-display text-[15px] leading-5 font-bold">{title || "Untitled"}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      {me ? `@${me.username}` : ""}
                      {tags[0] ? ` · #${tags[0]}` : ""}
                    </p>
                  </div>
                  {cover ? <img src={cover} alt="" className="h-12 w-16 rounded-[var(--radius-xs)] border border-line object-cover grayscale" /> : null}
                </div>
              </div>
            </li>
            <li className={step}>
              <div className={stepHead}>
                <span className="idx text-fg">02</span>
                <h3>Topics</h3>
                {status(tags.length > 0)}
              </div>
              <div className={stepBody}>
                <p className="font-mono text-[11px] text-muted">Up to 5 topics.</p>
                <div className="mt-2">
                  <TopicsInput value={tags} onChange={(v) => form.setValue("tags", v, { shouldDirty: true })} />
                </div>
              </div>
            </li>
            <li className={step}>
              <div className={stepHead}>
                <span className="idx text-fg">03</span>
                <h3>Byline</h3>
                {status(true)}
              </div>
              <div className={stepBody}>
                <label className="block font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                  Post as
                  <select
                    className={cn(inputBoxCls, "mt-1 font-sans normal-case tracking-normal text-fg")}
                    value={publicationId}
                    onChange={(e) => form.setValue("publicationId", Number(e.target.value), { shouldDirty: true })}
                  >
                    <option value={0}>{me ? displayName(me) : "Your profile"}</option>
                    {pubs.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
            <li className={step}>
              <div className={stepHead}>
                <span className="idx text-fg">04</span>
                <h3>When</h3>
                {status(timeOk)}
              </div>
              <div className={stepBody}>
                <Lens
                  label="When to ship"
                  value={later ? "later" : "now"}
                  onChange={(v) => setLater(v === "later")}
                  items={[
                    ["now", "Now"],
                    ["later", "Schedule"],
                  ]}
                />
                {later ? (
                  <label className="mt-3 block font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
                    Go live at
                    <input
                      type="datetime-local"
                      className={cn(inputBoxCls, "mt-1 font-sans normal-case tracking-normal text-fg")}
                      value={publishAt}
                      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                      onChange={(e) => form.setValue("publishAt", e.target.value, { shouldDirty: true })}
                    />
                    {form.formState.errors.publishAt ? (
                      <span className="mt-1 block normal-case tracking-normal text-danger">{form.formState.errors.publishAt.message}</span>
                    ) : null}
                  </label>
                ) : null}
              </div>
            </li>
          </ol>
          <div className="sticky bottom-0 -mx-6 mt-8 border-t border-line-strong bg-card px-6 py-4 md:-mx-8 md:px-8">
            <Button variant="accent" className="w-full" loading={pending} disabled={later && !publishAt} onClick={() => onPublish(later ? "later" : "now")}>
              {later ? "Schedule" : "Ship now"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Revisions({
  id,
  open,
  onOpenChange,
  onRestored,
}: {
  id: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRestored: (p: import("@/contexts/reading/domain/post").Post) => void;
}) {
  const list = useQuery({ queryKey: ["revisions", id], queryFn: ({ signal }) => studioRepository.revisions(id, signal), enabled: open });
  const [v, setV] = useState<number | null>(null);
  const detail = useQuery({ queryKey: ["revisions", id, v], queryFn: ({ signal }) => studioRepository.revision(id, v as number, signal), enabled: v !== null });
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: (version: number) => studioRepository.restore(id, version),
    onSuccess: async () => {
      const p = await qc.fetchQuery({ ...postByIdQuery(id), staleTime: 0 });
      toast.ok("Version restored");
      onRestored(p);
    },
    onError: toast.error,
  });
  const ops = detail.data?.diff.body ?? [];
  const st = diffStats(ops);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Revision history" className="md:w-[720px]">
      {list.isPending ? (
        <Bone className="h-24 w-full" />
      ) : !list.data?.length ? (
        <p className="text-sm text-muted">No earlier versions yet. Every save that changes the text keeps the previous version here.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <ul className="space-y-1">
            {list.data.map((r) => (
              <li key={r.version}>
                <button
                  type="button"
                  onClick={() => setV(r.version)}
                  aria-current={v === r.version || undefined}
                  className="w-full rounded-[var(--radius-xs)] px-3 py-2 text-left font-mono text-[12px] hover:bg-surface-2 aria-[current=true]:bg-inverse aria-[current=true]:text-on-inverse"
                >
                  Version {r.version}
                  <span className="block text-[11px] opacity-70">{shortDate(r.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            {v === null ? (
              <p className="text-sm text-muted">Pick a version to compare with the current text.</p>
            ) : detail.isPending ? (
              <Bone className="h-40 w-full" />
            ) : (
              <>
                <p className="font-mono text-[11px] text-muted">
                  +{st.added} / −{st.removed} lines vs. now
                </p>
                <pre className="mt-2 max-h-80 overflow-auto rounded-[var(--radius-sm)] border border-line-strong bg-card py-2 font-mono text-xs whitespace-pre-wrap">
                  {ops
                    .map((o, n) => ({ ...o, line: n + 1 }))
                    .map((o) => (
                      <div
                        key={o.line}
                        className={cn(
                          "grid grid-cols-[2.5rem_1fr] pr-3",
                          o.op === "+" ? "bg-surface-2 font-medium" : o.op === "-" ? "text-muted line-through" : "",
                        )}
                      >
                        <span aria-hidden className="idx pr-2 text-right select-none">
                          {o.line}
                        </span>
                        <span>
                          {o.op === "=" ? " " : o.op} {o.text}
                        </span>
                      </div>
                    ))}
                </pre>
                <Button variant="outline" size="sm" className="mt-3" loading={restore.isPending} onClick={() => restore.mutate(v)}>
                  Restore this version
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function EditorPage({ id }: { id?: number }) {
  const nav = useNavigate();
  const existing = useQuery({ ...postByIdQuery(id ?? 0), enabled: !!id });
  const [postId, setPostId] = useState(id);
  const save = useSaveStory(postId);
  const form = useForm<StoryForm>({ resolver: zodResolver(storyFormSchema), defaultValues: emptyStory() });
  const [status, setStatus] = useState<"Draft" | "Saving…" | "Saved" | "Couldn't save">("Draft");
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState(false);
  const body = useWatch({ control: form.control, name: "body" });
  const title = useWatch({ control: form.control, name: "title" });
  const loaded = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (existing.data && !loaded.current) {
      loaded.current = true;
      form.reset(storyToForm(existing.data));
      setStatus("Saved");
    }
  }, [existing.data, form]);

  const isPublished = existing.data?.status === "published";
  const chip = isPublished && status !== "Saving…" && status !== "Couldn't save" ? "Live" : status;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const dirty = form.formState.isDirty;
  useBlocker({
    shouldBlockFn: () => !leaving.current && dirty && !confirm("You have unsaved changes. Leave anyway?"),
    disabled: !dirty,
    enableBeforeUnload: () => dirty,
  });

  const submit = (s: "draft" | "published" | "scheduled") => {
    form.setValue("status", isPublished && s === "draft" ? "published" : s);
    return form.handleSubmit(
      (v) => {
        setStatus("Saving…");
        save.mutate(v, {
          onSuccess: (p) => {
            leaving.current = true;
            setPostId(p.id);
            form.reset(storyToForm(p));
            setStatus("Saved");
            if (v.status === "scheduled") {
              toast.ok(`Scheduled for ${shortDate(v.publishAt)}`);
              void nav({ to: "/me/stories" });
            } else if (v.status === "published") {
              toast.ok(isPublished ? "Your story is updated" : "Your story is live");
              void nav({ to: postPath(p) as "/" });
            } else if (!postId) void nav({ to: "/p/$id/edit", params: { id: String(p.id) }, replace: true });
            else leaving.current = false;
          },
          onError: (e) => {
            setStatus("Couldn't save");
            toast.error(e);
          },
        });
      },
      (errs) => toast.error(Object.values(errs)[0]?.message ?? "Check the story"),
    )();
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 h-12 border-b border-line-strong bg-card">
        <div className="mx-auto flex h-full max-w-[1040px] items-center gap-3 px-4">
          <Link to="/me/stories" className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-[0.12em] text-muted uppercase hover:text-fg">
            <ArrowLeftIcon className="size-4" aria-hidden /> Stories
          </Link>
          <span
            className={cn(
              "inline-flex h-7 divide-x divide-line rounded-[var(--radius-xs)] border border-line-strong font-mono text-[11px] text-muted uppercase [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:px-2",
              chip === "Couldn't save" && "border-danger",
            )}
          >
            <span aria-live="polite" className={chip === "Couldn't save" ? "text-danger" : undefined}>
              {chip === "Saved" || chip === "Live" ? <span aria-hidden className="size-1.5 bg-fg" /> : null}
              {chip === "Saving…" ? <span aria-hidden className="size-1.5 animate-pulse bg-fg" /> : null}
              {chip}
            </span>
            <span className="hidden! sm:flex!">{words} words</span>
            <span className="hidden! sm:flex!">{readTime(Math.ceil(words / 200))}</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            {postId ? (
              <Button variant="ghost-icon" aria-label="Revision history" onClick={() => setHistory(true)}>
                <HistoryIcon aria-hidden />
              </Button>
            ) : null}
            <span className="seg">
              <button type="button" className="seg-item h-7" onClick={() => setPreview(!preview)} aria-pressed={preview}>
                {preview ? "Edit" : "Preview"}
              </button>
            </span>
            {!isPublished ? (
              <Button variant="outline" size="sm" disabled={!title.trim()} loading={save.isPending && !publishing} onClick={() => submit("draft")}>
                Save draft
              </Button>
            ) : null}
            <Button variant="accent" size="sm" disabled={!title.trim() || !body.trim()} onClick={() => setPublishing(true)}>
              {isPublished ? "Update live story" : "Ship it"}
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1040px] gap-8 px-4">
        <p
          aria-hidden
          className="sticky top-20 hidden h-fit w-20 shrink-0 space-y-2 pt-12 font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase lg:block"
        >
          <span className="block">01 Title</span>
          <span className="block">02 Dek</span>
          <span className="block">03 Body</span>
        </p>
        <main id="main" className="mx-auto w-full max-w-feed min-w-0 pt-10 pb-24 md:border-l md:border-line md:pl-8">
          <textarea
            rows={1}
            aria-label="Title"
            placeholder="Untitled draft"
            className="w-full resize-none overflow-hidden bg-transparent font-display text-[40px] leading-[48px] font-bold tracking-tight outline-none placeholder:text-muted/60"
            {...form.register("title", { onChange: (e) => grow(e.target) })}
          />
          <textarea
            rows={1}
            aria-label="Subtitle"
            placeholder="One-line summary (optional)"
            className="mt-2 w-full resize-none overflow-hidden bg-transparent font-sans text-[22px] leading-8 text-muted outline-none placeholder:text-muted/60"
            {...form.register("subtitle", { onChange: (e) => grow(e.target) })}
          />
          {preview ? (
            <section className="tile mt-6 overflow-hidden" aria-label="Preview">
              <p className="tile-head">Preview · rendered</p>
              <div className="prose-article min-h-[60vh] p-5 whitespace-pre-wrap">{body || "Nothing to preview yet."}</div>
            </section>
          ) : (
            <textarea
              aria-label="Story body (Markdown)"
              placeholder="Start writing — Markdown supported"
              className="mt-6 min-h-[60vh] w-full resize-none bg-transparent font-mono text-[16px] leading-7 outline-none placeholder:text-muted/60"
              {...form.register("body")}
            />
          )}
          <p className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
            Markdown:
            {["**bold**", "_italic_", "# heading", "> quote", "``` code", "[link](url)"].map((k) => (
              <kbd key={k} className="kbd">
                {k}
              </kbd>
            ))}
          </p>
        </main>
      </div>
      <PublishDialog
        open={publishing}
        onOpenChange={setPublishing}
        form={form}
        pending={save.isPending}
        onPublish={(when) => submit(when === "later" ? "scheduled" : "published")}
      />
      {postId ? (
        <Revisions
          id={postId}
          open={history}
          onOpenChange={setHistory}
          onRestored={(p) => {
            form.reset(storyToForm(p));
            setHistory(false);
          }}
        />
      ) : null}
    </div>
  );
}
