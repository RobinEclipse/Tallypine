function normalizedPathname(url: URL): string {
  return decodeURIComponent(url.pathname).replace(/\\/g, "/").toLocaleLowerCase("en-US");
}

export function isAllowedRendererNavigation(target: string, devServerUrl: string | undefined, packagedHtmlUrl: string): boolean {
  try {
    const candidate = new URL(target);

    if (devServerUrl) {
      const devServer = new URL(devServerUrl);
      return candidate.protocol === devServer.protocol && candidate.host === devServer.host;
    }

    const packagedHtml = new URL(packagedHtmlUrl);
    return candidate.protocol === "file:"
      && packagedHtml.protocol === "file:"
      && normalizedPathname(candidate) === normalizedPathname(packagedHtml);
  } catch {
    return false;
  }
}
