/**
 * Save an image under a chosen filename. The `download` attribute is ignored for
 * cross-origin URLs (presigned S3 on AWS), so fetch it as a blob first; if that fails
 * (CORS), open it in a new tab instead.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
