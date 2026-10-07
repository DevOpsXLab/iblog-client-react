import { z } from "zod";
import { type Post, postSchema } from "@/contexts/reading/domain/post";
import { http, tokens } from "@/shared/api";
import { ApiError, dataEnvelope, type Page, type PageRequest, pageEnvelope } from "@/shared/http";
import { type Comment, type CommentInput, commentSchema } from "../domain/engagement";
import { type Notification, notificationSchema } from "../domain/notification";

export const engagementRepository = {
  async clap(postId: number, count: number): Promise<Post> {
    return (await http(`/posts/${postId}/clap`, { method: "POST", body: { count }, schema: dataEnvelope(postSchema) })).data;
  },
  async bookmark(postId: number, on: boolean): Promise<void> {
    await http(`/posts/${postId}/bookmark`, { method: on ? "POST" : "DELETE" });
  },
  async follow(username: string, on: boolean): Promise<void> {
    await http(`/users/${encodeURIComponent(username)}/follow`, { method: on ? "POST" : "DELETE" });
  },
  async comments(postId: number, req: PageRequest, signal?: AbortSignal): Promise<Page<Comment>> {
    return http(`/posts/${postId}/comments`, { query: { page: req.page, limit: req.limit, cursor: req.cursor }, schema: pageEnvelope(commentSchema), signal });
  },
  async comment(postId: number, input: CommentInput & { parent_id?: number }): Promise<Comment> {
    return (await http(`/posts/${postId}/comments`, { method: "POST", body: input, schema: dataEnvelope(commentSchema) })).data;
  },
  async editComment(id: number, text: string): Promise<Comment> {
    return (await http(`/comments/${id}`, { method: "PUT", body: { text }, schema: dataEnvelope(commentSchema) })).data;
  },
  async likeComment(id: number, on: boolean): Promise<void> {
    await http(`/comments/${id}/like`, { method: on ? "POST" : "DELETE" });
  },
  async report(target: { type: "post" | "comment" | "user"; id: number }, reason: string, note: string): Promise<void> {
    await http("/reports", { method: "POST", body: { target_type: target.type, target_id: target.id, reason, note } });
  },
  /** Single-use 30s ticket for the notification EventSource. */
  async streamTicket(): Promise<string> {
    return (await http("/me/stream-ticket", { method: "POST", schema: dataEnvelope(z.object({ ticket: z.string() })) })).data.ticket;
  },
  async deleteComment(id: number): Promise<void> {
    await http(`/comments/${id}`, { method: "DELETE" });
  },
  async notifications(req: PageRequest, signal?: AbortSignal): Promise<Page<Notification> & { unread: number }> {
    const body = await http("/me/notifications", {
      query: { page: req.page, limit: req.limit, cursor: req.cursor },
      schema: z
        .object({
          data: z.array(notificationSchema).nullable(),
          meta: z
            .object({ unread: z.number().default(0) })
            .loose()
            .optional(),
        })
        .loose(),
      signal,
    });
    const p = pageEnvelope(notificationSchema).parse(body);
    return { ...p, unread: body.meta?.unread ?? 0 };
  },
  async markAllRead(): Promise<void> {
    await http("/me/notifications/read", { method: "POST", body: { all: true } });
  },
  /** POST /uploads (multipart "file"); returns the URL to store. */
  async upload(file: File): Promise<string> {
    const fd = new FormData();
    fd.set("file", file);
    const t = tokens.get();
    const r = await fetch("/api/uploads", { method: "POST", body: fd, headers: t ? { Authorization: `Bearer ${t.token}` } : {} });
    const body = (await r.json().catch(() => ({}))) as { data?: { url?: string } };
    if (!r.ok || !body.data?.url) throw new ApiError(r.status, body as never);
    return body.data.url;
  },
};
