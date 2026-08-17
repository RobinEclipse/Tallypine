import { describe, expect, it } from "vitest";
import { isAllowedRendererNavigation } from "../electron/navigation";

const packagedHtml = "file:///C:/Program%20Files/Tallypine/resources/app.asar/dist/index.html";

describe("renderer navigation guard", () => {
  it("allows the packaged renderer and its in-document state", () => {
    expect(isAllowedRendererNavigation(packagedHtml, undefined, packagedHtml)).toBe(true);
    expect(isAllowedRendererNavigation(`${packagedHtml}?screen=dashboard#top`, undefined, packagedHtml)).toBe(true);
  });

  it("blocks adjacent files and external pages in packaged builds", () => {
    expect(isAllowedRendererNavigation("file:///C:/Program%20Files/Tallypine/resources/app.asar/dist/other.html", undefined, packagedHtml)).toBe(false);
    expect(isAllowedRendererNavigation("https://example.com", undefined, packagedHtml)).toBe(false);
  });

  it("allows only the configured development origin", () => {
    const devServer = "http://127.0.0.1:5173/";
    expect(isAllowedRendererNavigation("http://127.0.0.1:5173/settings", devServer, packagedHtml)).toBe(true);
    expect(isAllowedRendererNavigation("http://127.0.0.1:5174/", devServer, packagedHtml)).toBe(false);
    expect(isAllowedRendererNavigation("https://127.0.0.1:5173/", devServer, packagedHtml)).toBe(false);
  });
});
