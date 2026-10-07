import { BookmarkCheckIcon, BookmarkIcon, CheckIcon, PlusIcon, ZapIcon } from "lucide-react";
import { useState } from "react";
import { requireAuth } from "@/contexts/identity/application/authDialog";
import { useMe } from "@/contexts/identity/application/session";
import type { Post } from "@/contexts/reading/domain/post";
import { cn } from "@/shared/lib/cn";
import { compact } from "@/shared/lib/format";
import { AnimatePresence, motion, useReducedMotion } from "@/shared/motion";
import { Button } from "@/shared/ui/button";
import { toast } from "@/shared/ui/toast";
import { useBookmark, useClap, useFollow } from "../application/hooks";
import { CLAP_MAX } from "../domain/engagement";

export function BookmarkButton({
  post,
  className,
  compact: iconOnly,
}: {
  post: Pick<Post, "id" | "bookmarked">;
  className?: string;
  /** Icon-only key (PostCard footer). */
  compact?: boolean;
}) {
  const m = useBookmark();
  const on = post.bookmarked;
  return (
    <button
      type="button"
      className={cn("key", iconOnly && "size-9 justify-center px-0", className)}
      aria-label={on ? "Remove from saved" : "Save for later"}
      aria-pressed={on}
      onClick={requireAuth(() => m.mutate({ id: post.id, on: !on }, { onError: toast.error }))}
    >
      <motion.span
        key={String(on)}
        initial={{ scale: on ? 0.4 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 14 }}
        className="grid"
      >
        {on ? <BookmarkCheckIcon aria-hidden className="size-4 fill-current text-fg" /> : <BookmarkIcon aria-hidden className="size-4" strokeWidth={1.5} />}
      </motion.span>
      {iconOnly ? null : (
        <span aria-hidden className="hidden uppercase tracking-[0.08em] sm:inline">
          {on ? "Saved" : "Save"}
        </span>
      )}
    </button>
  );
}

const RAYS = [0, 60, 120, 180, 240, 300];

/** Six sparks flying out on every spark. */
function Burst({ id }: { id: number }) {
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-0">
      {RAYS.map((deg) => (
        <motion.span
          key={`${id}-${deg}`}
          className="absolute size-[2px] rounded-none bg-fg"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos((deg * Math.PI) / 180) * 22, y: Math.sin((deg * Math.PI) / 180) * 22, opacity: 0, scale: 0.4 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </span>
  );
}

export function ClapButton({ post }: { post: Pick<Post, "id" | "claps" | "my_claps" | "author"> }) {
  const { me } = useMe();
  const clap = useClap(post);
  const [burst, setBurst] = useState(0);
  const reduce = useReducedMotion();
  const own = me?.username === post.author;
  const maxed = post.my_claps >= CLAP_MAX;
  return (
    <button
      type="button"
      className="key relative"
      disabled={own}
      title={own ? "You can't spark your own story" : undefined}
      aria-disabled={maxed || undefined}
      aria-label={`Spark. ${post.claps} sparks total${post.my_claps ? `, you gave ${post.my_claps}` : ""}`}
      onClick={requireAuth(() => {
        if (clap()) setBurst((b) => b + 1);
      })}
    >
      <ZapIcon
        className={cn("size-4", post.my_claps > 0 && "fill-current text-fg", burst > 0 && "animate-clap-pop")}
        key={`i${burst}`}
        strokeWidth={1.5}
        aria-hidden
      />
      {burst > 0 && !reduce ? <Burst key={burst} id={burst} /> : null}
      <span aria-hidden className="hidden uppercase tracking-[0.08em] sm:inline">
        Spark
      </span>
      <span aria-live="polite" className="tag-count relative inline-grid min-w-6 overflow-hidden text-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={post.claps}
            initial={reduce ? false : { y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {compact(post.claps)}
          </motion.span>
        </AnimatePresence>
      </span>
      {maxed ? (
        <span className="idx text-[10px]" aria-hidden>
          MAX
        </span>
      ) : null}
    </button>
  );
}

/** "Track" a writer (API: follow). */
export function FollowButton({
  username,
  following,
  variant = "outline",
  size = "sm",
}: {
  username: string;
  following: boolean;
  variant?: "outline" | "accent" | "link";
  size?: "sm" | "md";
}) {
  const { me } = useMe();
  const m = useFollow();
  const [on, setOn] = useState(following);
  if (me?.username === username) return null;
  const toggle = requireAuth(() => {
    setOn(!on);
    m.mutate(
      { username, on: !on },
      {
        onError: (e) => {
          setOn(on);
          toast.error(e);
        },
      },
    );
  });
  const label = on ? `Stop tracking ${username}` : `Track ${username}`;
  if (variant === "link")
    return (
      <Button variant="link" className={cn(on && "text-muted")} aria-pressed={on} aria-label={label} onClick={toggle}>
        {on ? "Tracking" : "Track"}
      </Button>
    );
  return (
    <Button variant={on ? "outline" : variant} size={size} className={cn("group", on && "bg-surface-2")} aria-pressed={on} aria-label={label} onClick={toggle}>
      {on ? (
        <>
          <CheckIcon className="size-3.5" aria-hidden />
          <span aria-hidden className="group-hover:hidden">
            Tracking
          </span>
          <span aria-hidden className="hidden group-hover:inline">
            Untrack
          </span>
        </>
      ) : (
        <>
          <PlusIcon className="size-3.5" aria-hidden />
          Track
        </>
      )}
    </Button>
  );
}
