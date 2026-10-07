import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { tokens } from "@/shared/api";
import { makePost, signIn } from "@/test/fixtures";
import { renderRouted } from "@/test/render";
import { api, server } from "@/test/server";
import { HomePage } from "./HomePage";

const base = () =>
  server.use(
    http.get(api("/posts/trending"), () => HttpResponse.json({ data: [makePost({ title: "Hot story" })] })),
    http.get(api("/tags"), () => HttpResponse.json({ data: [{ name: "go", count: 3 }] })),
    http.get(api("/posts"), () => HttpResponse.json({ data: [], meta: {} })),
    http.get(api("/me/for-you"), () => HttpResponse.json({ data: [], meta: {} })),
    http.get(api("/me/suggestions/users"), () => HttpResponse.json({ data: [] })),
    http.get(api("/me/bookmarks"), () => HttpResponse.json({ data: [], meta: {} })),
    http.get(api("/me/posts"), () => HttpResponse.json({ data: [], meta: {} })),
  );

describe("landing", () => {
  it("shows the hero, trending and topics to signed-out visitors", async () => {
    base();
    await renderRouted(<HomePage tab={undefined} />);
    expect(screen.getByRole("heading", { level: 1, name: /Ideas worth/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open the stream/ })).toHaveAttribute("href", "/?tab=latest");
    expect((await screen.findAllByText("Hot story")).length).toBeGreaterThan(0);
    expect((await screen.findAllByRole("link", { name: "go" })).length).toBeGreaterThan(0);
  });
  it("signed-out readers who pick a tab get the feed", async () => {
    base();
    await renderRouted(<HomePage tab="latest" />);
    expect(screen.queryByRole("heading", { level: 1, name: /Human stories/ })).toBeNull();
    expect(screen.getByRole("radio", { name: "Newest" })).toBeInTheDocument();
  });
  it("signed-in readers never see the landing page", async () => {
    signIn();
    base();
    await renderRouted(<HomePage tab={undefined} />);
    expect(await screen.findByRole("radio", { name: "Picked for you" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /Human stories/ })).toBeNull();
    tokens.set(null);
  });
});
