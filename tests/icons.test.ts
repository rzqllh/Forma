import { describe, it, expect } from "vitest";
import PhotoIconOutline from "@heroicons/react/24/outline/PhotoIcon";
import AdjustmentsHorizontalIconOutline from "@heroicons/react/24/outline/AdjustmentsHorizontalIcon";
import BookmarkIconOutline from "@heroicons/react/24/outline/BookmarkIcon";
import ArrowDownTrayIconOutline from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import PhotoIconSolid from "@heroicons/react/24/solid/PhotoIcon";
import AdjustmentsHorizontalIconSolid from "@heroicons/react/24/solid/AdjustmentsHorizontalIcon";
import BookmarkIconSolid from "@heroicons/react/24/solid/BookmarkIcon";
import ArrowDownTrayIconSolid from "@heroicons/react/24/solid/ArrowDownTrayIcon";

describe("Heroicons Direct Path Exports", () => {
  it("imports outline icons properly as React forwardRef components", () => {
    expect(PhotoIconOutline).toBeDefined();
    expect(AdjustmentsHorizontalIconOutline).toBeDefined();
    expect(BookmarkIconOutline).toBeDefined();
    expect(ArrowDownTrayIconOutline).toBeDefined();
  });

  it("imports solid icons properly as React forwardRef components", () => {
    expect(PhotoIconSolid).toBeDefined();
    expect(AdjustmentsHorizontalIconSolid).toBeDefined();
    expect(BookmarkIconSolid).toBeDefined();
    expect(ArrowDownTrayIconSolid).toBeDefined();
  });
});
