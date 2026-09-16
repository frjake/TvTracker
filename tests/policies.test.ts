import { describe, expect, it } from "vitest";
import { canEdit, canViewProfile, followActionFor } from "@/lib/policies";

const pub = { id: "p", isPrivate: false };
const priv = { id: "q", isPrivate: true };
const viewer = { id: "v" };

describe("canViewProfile", () => {
  it("public profiles are visible to everyone, signed in or not", () => {
    expect(canViewProfile(null, pub, "none")).toBe(true);
    expect(canViewProfile(viewer, pub, "none")).toBe(true);
  });

  it("private profiles are hidden from strangers and pending requesters", () => {
    expect(canViewProfile(null, priv, "none")).toBe(false);
    expect(canViewProfile(viewer, priv, "none")).toBe(false);
    expect(canViewProfile(viewer, priv, "pending")).toBe(false);
  });

  it("private profiles are visible to accepted followers and the owner", () => {
    expect(canViewProfile(viewer, priv, "accepted")).toBe(true);
    expect(canViewProfile({ id: "q" }, priv, "none")).toBe(true);
  });
});

describe("followActionFor", () => {
  it("asks anonymous viewers to log in", () => {
    expect(followActionFor(null, pub, "none")).toBe("login");
  });

  it("offers follow for public and request for private accounts", () => {
    expect(followActionFor(viewer, pub, "none")).toBe("follow");
    expect(followActionFor(viewer, priv, "none")).toBe("request");
  });

  it("reflects existing state", () => {
    expect(followActionFor(viewer, priv, "pending")).toBe("pending");
    expect(followActionFor(viewer, pub, "accepted")).toBe("unfollow");
    expect(followActionFor({ id: "p" }, pub, "none")).toBe("self");
  });
});

describe("canEdit", () => {
  it("only the owner may edit", () => {
    expect(canEdit(viewer, "v")).toBe(true);
    expect(canEdit(viewer, "p")).toBe(false);
    expect(canEdit(null, "v")).toBe(false);
  });
});
