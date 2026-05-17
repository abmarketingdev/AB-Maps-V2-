"use client";

import { cn } from "@/lib/utils";

// Convert Google Drive view link to direct image URL
function convertGoogleDriveUrl(url: string): string {
  const driveViewMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveViewMatch) {
    const fileId = driveViewMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  return url;
}

// Parse markdown-like content to HTML
function parseContent(content: string): string {
  if (!content) return "";

  let html = content;

  // Escape HTML special characters first (except for our markdown syntax)
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Headings: # to ######
  html = html.replace(/^###### (.+)$/gm, '<h6 class="text-sm font-semibold text-slate-800 mt-4 mb-2">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 class="text-base font-semibold text-slate-800 mt-4 mb-2">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-semibold text-slate-800 mt-5 mb-2">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-slate-900 mt-5 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-slate-900 mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-slate-900 mt-6 mb-4">$1</h1>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong class="font-semibold text-slate-900">$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em class="italic">$1</em>');

  // Underline: ~text~
  html = html.replace(/~(.+?)~/g, '<u class="underline">$1</u>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Blockquotes: > text
  html = html.replace(
    /^&gt; (.+)$/gm,
    '<blockquote class="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-4">$1</blockquote>'
  );

  // Horizontal rule: ---
  html = html.replace(/^---$/gm, '<hr class="border-t border-slate-200 my-6" />');

  // Images: ![alt](url) - convert Google Drive links - MUST be before links
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      const imageUrl = convertGoogleDriveUrl(url);
      return `<div class="my-4"><img src="${imageUrl}" alt="${alt || 'Bilde'}" class="max-w-full h-auto rounded-lg shadow-sm border border-slate-200" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div class="hidden items-center justify-center h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm">Bilde kunne ikke lastes</div></div>`;
    }
  );

  // Links: [text](url) - Process AFTER images
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 underline hover:text-blue-800 transition-colors" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Numbered lists: 1. item
  const numberedListRegex = /^(\d+)\. (.+)$/gm;
  let match;
  let lastIndex = 0;
  let inList = false;
  let result = "";

  const lines = html.split("\n");
  let processedLines: string[] = [];
  let currentList: string[] = [];
  let listType: "ul" | "ol" | null = null;

  for (const line of lines) {
    const numberedMatch = line.match(/^(\d+)\. (.+)$/);
    const bulletMatch = line.match(/^- (.+)$/);

    if (numberedMatch) {
      if (listType !== "ol") {
        if (currentList.length > 0) {
          processedLines.push(listType === "ul" ? `<ul class="list-disc list-inside space-y-2 my-4 text-slate-700">${currentList.join("")}</ul>` : currentList.join(""));
          currentList = [];
        }
        listType = "ol";
      }
      currentList.push(`<li class="ml-4">${numberedMatch[2]}</li>`);
    } else if (bulletMatch) {
      if (listType !== "ul") {
        if (currentList.length > 0) {
          processedLines.push(listType === "ol" ? `<ol class="list-decimal list-inside space-y-2 my-4 text-slate-700">${currentList.join("")}</ol>` : currentList.join(""));
          currentList = [];
        }
        listType = "ul";
      }
      currentList.push(`<li class="ml-4">${bulletMatch[1]}</li>`);
    } else {
      if (currentList.length > 0) {
        if (listType === "ol") {
          processedLines.push(`<ol class="list-decimal list-inside space-y-2 my-4 text-slate-700">${currentList.join("")}</ol>`);
        } else if (listType === "ul") {
          processedLines.push(`<ul class="list-disc list-inside space-y-2 my-4 text-slate-700">${currentList.join("")}</ul>`);
        }
        currentList = [];
        listType = null;
      }
      processedLines.push(line);
    }
  }

  // Close any remaining list
  if (currentList.length > 0) {
    if (listType === "ol") {
      processedLines.push(`<ol class="list-decimal list-inside space-y-2 my-4 text-slate-700">${currentList.join("")}</ol>`);
    } else if (listType === "ul") {
      processedLines.push(`<ul class="list-disc list-inside space-y-2 my-4 text-slate-700">${currentList.join("")}</ul>`);
    }
  }

  html = processedLines.join("\n");

  // Convert double newlines to paragraphs
  html = html
    .split(/\n\n+/)
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      // Don't wrap if already a block element
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<div")
      ) {
        return trimmed;
      }
      return `<p class="mb-4 leading-relaxed text-slate-700">${trimmed}</p>`;
    })
    .join("");

  // Convert single newlines to <br> within paragraphs
  html = html.replace(/\n/g, "<br />");

  return html;
}

interface FormattedContentProps {
  content: string;
  className?: string;
}

export function FormattedContent({ content, className }: FormattedContentProps) {
  if (!content) {
    return (
      <p className="text-slate-500 italic text-sm">
        Ingen innhold tilgjengelig for denne leksjonen.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-slate max-w-none",
        "prose-headings:font-bold prose-headings:text-slate-900",
        "prose-p:text-slate-700 prose-p:leading-relaxed",
        "prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800",
        "prose-strong:font-semibold prose-strong:text-slate-900",
        "prose-em:italic",
        "prose-ul:list-disc prose-ol:list-decimal",
        "prose-li:text-slate-700",
        "prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:pl-4 prose-blockquote:italic",
        "prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded",
        "prose-img:rounded-lg prose-img:shadow-sm",
        className
      )}
      dangerouslySetInnerHTML={{ __html: parseContent(content) }}
    />
  );
}

export default FormattedContent;
