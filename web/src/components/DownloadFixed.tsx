import { Download } from 'lucide-react';
import type { Result } from '../types';
import { assetUrl } from '../api';
import { cx, fixedFilename } from '../lib';
import { downloadFile } from '../download';
import { Tooltip } from './Tooltip';

/**
 * "Download fixed image". Uses fixed_download_url (served as an attachment with the right
 * filename) as a plain link; falls back to fetching images.fixed when the field is missing.
 */
export function DownloadFixed({ result, className, iconClassName = 'size-4', tipClassName }: {
  result: Result;
  className: string;
  iconClassName?: string;
  tipClassName?: string;
}) {
  const name = fixedFilename(result.filename);
  const href = assetUrl(result.fixed_download_url);
  const fixed = assetUrl(result.images.fixed);
  if (!href && !fixed) return null;
  const label = (
    <>
      <Download aria-hidden className={iconClassName} /> Download fixed image
    </>
  );
  return (
    <Tooltip content={`Save the fixed image as ${name}, ready to upload as your main image.`} className={tipClassName}>
      {href ? (
        <a href={href} download={name} className={cx(className)}>
          {label}
        </a>
      ) : (
        <button type="button" onClick={() => void downloadFile(fixed!, name)} className={className}>
          {label}
        </button>
      )}
    </Tooltip>
  );
}
