import { describe, expect, it } from "vitest";
import { describeNotification, notificationSchema } from "./notification";

const n = (type: string) => notificationSchema.parse({ id: 1, type, actor: "ali", post_id: 2, created_at: "x" });

describe("notifications", () => {
  it("describes each kind", () => {
    expect(describeNotification(n("follow"))).toBe("ali followed you");
    expect(describeNotification(n("like"))).toBe("ali sparked your story");
    expect(describeNotification(n("comment"))).toBe("ali responded to your story");
    expect(describeNotification(n("reply"))).toBe("ali replied to your response");
    expect(describeNotification(n("new_post"))).toBe("ali published a new story");
    expect(describeNotification(n("mention"))).toBe("ali mentioned you");
    expect(describeNotification(n("comment_like"))).toBe("ali liked your response");
    expect(describeNotification(n("weird"))).toBe("ali interacted with you");
  });
  it("unread when read_at is missing", () => {
    expect(n("follow").unread).toBe(true);
    expect(notificationSchema.parse({ id: 1, type: "x", created_at: "x", read_at: "y" }).unread).toBe(false);
  });
});
