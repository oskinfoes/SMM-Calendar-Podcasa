export interface ParsedVideoEmbed {
  type:
    | 'youtube'
    | 'vimeo'
    | 'instagram'
    | 'drive'
    | 'direct'
    | 'image'
    | 'unsupported';
  embedUrl: string | null;
  canonicalUrl: string | null;
  providerLabel: string;
  isInstagram: boolean;
  isGoogleDrive: boolean;
}

export function parseVideoUrl(rawUrl: string): ParsedVideoEmbed {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      type: 'unsupported',
      embedUrl: null,
      canonicalUrl: null,
      providerLabel: '',
      isInstagram: false,
      isGoogleDrive: false,
    };
  }

  // Direct MP4/WebM/MOV video file
  if (/\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'direct',
      embedUrl: trimmed,
      canonicalUrl: trimmed,
      providerLabel: 'Direct Video',
      isInstagram: false,
      isGoogleDrive: false,
    };
  }

  // Direct external image URL
  if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'image',
      embedUrl: trimmed,
      canonicalUrl: trimmed,
      providerLabel: 'External Image',
      isInstagram: false,
      isGoogleDrive: false,
    };
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    // Instagram (/p/ID, /reel/ID, /reels/ID, /tv/ID, or /{username}/reel/ID)
    if (host === 'instagram.com' || host === 'instagr.am') {
      const match = url.pathname.match(
        /(?:^|\/)(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i
      );
      if (match?.[2]) {
        const rawKind = match[1].toLowerCase();
        const kind =
          rawKind === 'reels' || rawKind === 'reel'
            ? 'reel'
            : rawKind === 'tv'
            ? 'tv'
            : 'p';
        const postId = match[2];
        const embedUrl = `https://www.instagram.com/${kind}/${postId}/embed`;
        return {
          type: 'instagram',
          embedUrl,
          canonicalUrl: `https://www.instagram.com/${kind}/${postId}/`,
          providerLabel: 'Instagram',
          isInstagram: true,
          isGoogleDrive: false,
        };
      }
    }

    // Google Drive (/file/d/ID/view, /file/d/ID/preview, /open?id=ID, /uc?id=ID)
    if (host === 'drive.google.com') {
      const pathMatch = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
      const idParam = url.searchParams.get('id');
      const fileId = pathMatch?.[1] || idParam;
      if (fileId) {
        return {
          type: 'drive',
          embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
          canonicalUrl: `https://drive.google.com/file/d/${fileId}/view`,
          providerLabel: 'Google Drive',
          isInstagram: false,
          isGoogleDrive: true,
        };
      }
    }

    // YouTube (watch, shorts, youtu.be, embed)
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/shorts/')[1]?.split('/')[0];
        if (id) {
          return {
            type: 'youtube',
            embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
            canonicalUrl: `https://www.youtube.com/shorts/${id}`,
            providerLabel: 'YouTube Shorts',
            isInstagram: false,
            isGoogleDrive: false,
          };
        }
      }
      if (url.pathname.startsWith('/embed/')) {
        return {
          type: 'youtube',
          embedUrl: normalized,
          canonicalUrl: normalized,
          providerLabel: 'YouTube',
          isInstagram: false,
          isGoogleDrive: false,
        };
      }
      const v = url.searchParams.get('v');
      if (v) {
        return {
          type: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`,
          canonicalUrl: `https://www.youtube.com/watch?v=${v}`,
          providerLabel: 'YouTube',
          isInstagram: false,
          isGoogleDrive: false,
        };
      }
    }

    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (id) {
        return {
          type: 'youtube',
          embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
          canonicalUrl: `https://youtu.be/${id}`,
          providerLabel: 'YouTube',
          isInstagram: false,
          isGoogleDrive: false,
        };
      }
    }

    // Vimeo
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const match = url.pathname.match(/\/(\d+)/);
      if (match?.[1]) {
        return {
          type: 'vimeo',
          embedUrl: `https://player.vimeo.com/video/${match[1]}?autoplay=1`,
          canonicalUrl: `https://vimeo.com/${match[1]}`,
          providerLabel: 'Vimeo',
          isInstagram: false,
          isGoogleDrive: false,
        };
      }
    }
  } catch {
    return {
      type: 'unsupported',
      embedUrl: null,
      canonicalUrl: null,
      providerLabel: 'Invalid URL',
      isInstagram: false,
      isGoogleDrive: false,
    };
  }

  return {
    type: 'unsupported',
    embedUrl: null,
    canonicalUrl: null,
    providerLabel: 'External Link',
    isInstagram: false,
    isGoogleDrive: false,
  };
}

export function formatEmbedInputUrl(rawUrl: string): string {
  const parsed = parseVideoUrl(rawUrl);
  if ((parsed.isInstagram || parsed.isGoogleDrive) && parsed.embedUrl) {
    return parsed.embedUrl;
  }
  return rawUrl.trim();
}
