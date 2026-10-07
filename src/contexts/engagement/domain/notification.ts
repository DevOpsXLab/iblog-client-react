import { z } from "zod";

export const notificationSchema = z
  .object({
    id: z.number(),
    type: z.string(),
    actor: z.string().default("Someone"),
    post_id: z.number().default(0),
    comment_id: z.number().default(0),
    read_at: z.string().nullable().optional(),
    created_at: z.string(),
  })
  .transform((n) => ({ ...n, unread: !n.read_at }));
export type Notification = z.infer<typeof notificationSchema>;

const verbs: Record<string, string> = {
  follow: "followed you",
  like: "sparked your story",
  comment: "responded to your story",
  reply: "replied to your response",
  comment_like: "liked your response",
  new_post: "published a new story",
  mention: "mentioned you",
};

export const describeNotification = (n: Notification) => `${n.actor || "Someone"} ${verbs[n.type] ?? "interacted with you"}`;
