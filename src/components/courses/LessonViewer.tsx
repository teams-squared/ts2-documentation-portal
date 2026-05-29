"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Components } from "react-markdown";
import { Spinner } from "@/components/ui/Spinner";

// react-markdown is ~50 KB and only needed for TEXT lessons. Load on demand.
const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-8">
      <Spinner size="md" />
    </div>
  ),
});
import type { LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";
import { toEmbedUrl } from "@/lib/video-embed";
import { LessonTitleHeader, estimateReadingMinutes } from "@/components/courses/LessonTitleHeader";
import { LinkLessonViewer } from "@/components/courses/LinkLessonViewer";
import { Button } from "@/components/ui/button";

/** Explicit Tailwind styling for every markdown element — no typography plugin needed. */
const mdComponents: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-6 font-display text-2xl font-bold text-foreground">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-5 font-display text-xl font-semibold text-foreground">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-4 font-display text-base font-semibold text-foreground">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-4 text-sm font-semibold text-foreground">{children}</h4>,
  p:  ({ children }) => <p className="mb-4 text-lg leading-[1.7] text-foreground">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-6 text-foreground text-lg">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-6 text-foreground text-lg">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary pl-4 italic text-foreground-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  a: ({ href, children }) => {
    // Defense-in-depth on outbound links from admin-authored markdown.
    // react-markdown v10 already strips javascript:/data:/vbscript: URLs
    // by default, so the protocol vector is closed. The remaining concern
    // is window.opener tab-nabbing on target=_blank — adding `rel` and
    // forcing `_blank` on external links eliminates that. Internal links
    // (relative or same-origin) stay in the same tab.
    const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="text-primary underline transition-colors hover:text-primary-hover"
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer nofollow" }
          : {})}
      >
        {children}
      </a>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-md border border-border bg-surface-muted p-4 text-sm">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    // Fenced code blocks have a language-* className; inline code does not
    const isBlock = Boolean(className?.startsWith("language-"));
    if (isBlock) {
      return <code className={`${className} font-mono text-sm text-foreground`}>{children}</code>;
    }
    return (
      <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-sm text-primary" {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-muted">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">{children}</th>,
  td: ({ children }) => <td className="border-t border-border px-4 py-2 text-foreground">{children}</td>,
};

interface LessonViewerProps {
  title: string;
  type: LessonType;
  content: string | null;
  lessonId?: string;
  /** Used by LINK lessons to suppress the "Opening unlocks Mark complete"
   *  hint on re-visit of an already-completed lesson. */
  alreadyCompleted?: boolean;
}

function PdfViewer({ proxyUrl, fileName }: { proxyUrl: string; fileName: string }) {
  // Pre-flight: fetch the file to verify it's accessible and populate the
  // browser cache (Cache-Control: private, max-age=900). The iframe then loads
  // the same URL from cache — no blob: URL needed, avoiding Chrome's
  // "Not allowed to load local resource: blob:" restriction.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(proxyUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await res.blob(); // consume body so browser caches it for the iframe
        setReady(true);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(true);
      });

    return () => controller.abort();
  }, [proxyUrl]);

  return (
    <div
      className="overflow-hidden rounded-lg border border-border h-[clamp(320px,70vh,calc(100vh-16rem))]"
    >
      {!ready && !error && (
        <div className="flex h-full w-full items-center justify-center bg-surface-muted">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-foreground-muted">Loading document…</p>
          </div>
        </div>
      )}
      {error ? (
        <div className="flex h-full w-full items-center justify-center bg-surface-muted p-8">
          <div className="max-w-sm text-center">
            <p className="mb-1 text-sm font-medium text-foreground">
              Unable to display document
            </p>
            <p className="mb-4 text-xs text-foreground-muted">
              The document could not be loaded. You can download it directly instead.
            </p>
            <Button asChild size="sm">
              <a href={proxyUrl} download={fileName}>
                Download {fileName}
              </a>
            </Button>
          </div>
        </div>
      ) : ready ? (
        // PDF viewer quick-fix per §8.12: hide pdf.js toolbar/sidebar/scrollbar
        // and fit-to-width by default so the viewer chrome doesn't compete with
        // the app shell. A custom react-pdf toolbar is the long-term target.
        <iframe
          src={`${proxyUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={fileName}
          className="h-full w-full border-0"
        />
      ) : null}
    </div>
  );
}

/**
 * Strips the first `# Heading` from markdown if it duplicates the lesson title,
 * preventing the page <h1> and the markdown heading from stacking identically.
 */
function stripLeadingTitle(content: string, title: string): string {
  const match = content.match(/^#\s+(.+)(\r?\n|$)/);
  if (!match) return content;
  if (match[1].trim().toLowerCase() === title.trim().toLowerCase()) {
    return content.slice(match[0].length);
  }
  return content;
}

function HtmlLessonViewer({ proxyUrl, fileName }: { proxyUrl: string; fileName: string }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-black min-h-[300px] sm:min-h-[480px]"
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={proxyUrl}
        title={fileName}
        className="h-full w-full border-0"
        // Scripts allowed (slide decks need JS for nav/transitions) but NOT
        // allow-same-origin — this forces the iframe into an opaque origin so
        // its JS cannot read LMS cookies or reach window.parent's DOM.
        sandbox="allow-scripts"
      />
    </div>
  );
}

export function LessonViewer({
  title,
  type,
  content,
  lessonId,
  alreadyCompleted = false,
}: LessonViewerProps) {
  if (type === "link") {
    return (
      <LinkLessonViewer
        lessonId={lessonId ?? ""}
        title={title}
        content={content}
        alreadyCompleted={alreadyCompleted}
      />
    );
  }

  if (type === "html") {
    let docRef: SharePointDocumentRef | null = null;
    if (content) {
      try {
        docRef = JSON.parse(content) as SharePointDocumentRef;
      } catch {
        docRef = null;
      }
    }
    const proxyUrl = docRef
      ? `/api/sharepoint/files/${docRef.driveId}/${docRef.itemId}`
      : null;

    return (
      <div>
        <LessonTitleHeader title={title} type="html" formatLabel="Interactive slides" />
        {docRef && proxyUrl ? (
          <HtmlLessonViewer proxyUrl={proxyUrl} fileName={docRef.fileName} />
        ) : (
          <p className="text-sm text-foreground-muted">No HTML file attached.</p>
        )}
      </div>
    );
  }

  if (type === "document") {
    let docRef: SharePointDocumentRef | null = null;
    if (content) {
      try {
        docRef = JSON.parse(content) as SharePointDocumentRef;
      } catch {
        docRef = null;
      }
    }

    const proxyUrl = docRef
      ? `/api/sharepoint/files/${docRef.driveId}/${docRef.itemId}`
      : null;
    const isPdf = docRef?.mimeType === "application/pdf";

    return (
      <div>
        <LessonTitleHeader
          title={title}
          type="document"
          formatLabel={
            docRef?.mimeType === "application/pdf"
              ? "PDF document"
              : docRef?.fileName
                ? "Document"
                : "Document"
          }
        />
        {!docRef ? (
          <p className="text-sm text-foreground-muted">
            No document attached.
          </p>
        ) : isPdf ? (
          <PdfViewer proxyUrl={proxyUrl!} fileName={docRef.fileName} />
        ) : (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-muted p-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {docRef.fileName}
              </p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {docRef.mimeType}
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href={proxyUrl!} download={docRef.fileName}>
                Download
              </a>
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (type === "video") {
    let videoRef: SharePointDocumentRef | null = null;
    if (content) {
      try {
        const parsed = JSON.parse(content) as SharePointDocumentRef;
        if (parsed?.driveId && parsed?.itemId && parsed.mimeType?.startsWith("video/")) {
          videoRef = parsed;
        }
      } catch {
        videoRef = null;
      }
    }

    return (
      <div>
        <LessonTitleHeader title={title} type="video" />
        {videoRef && lessonId ? (
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <video
              src={`/api/lessons/${lessonId}/video`}
              controls
              preload="metadata"
              className="h-full w-full"
            />
          </div>
        ) : content ? (
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <iframe
              src={toEmbedUrl(content)}
              title={title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-surface-muted">
            <p className="text-sm text-foreground-muted">
              No video URL provided.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Default: text (markdown) — also handles any other types gracefully
  const minutes = estimateReadingMinutes(content);
  return (
    <div>
      <LessonTitleHeader
        title={title}
        type="text"
        estimate={content ? `${minutes} min read` : null}
      />
      {content ? (
        <div className="max-w-none">
          <ReactMarkdown components={mdComponents}>{stripLeadingTitle(content, title)}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">
          No content yet.
        </p>
      )}
    </div>
  );
}
