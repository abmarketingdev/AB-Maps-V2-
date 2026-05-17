"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Eye,
  Edit3,
  X,
  Check,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Quote,
  Minus,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  label?: string;
  showPreview?: boolean;
}

// Convert Google Drive view link to direct image URL
function convertGoogleDriveUrl(url: string): string {
  // Check if it's a Google Drive link - multiple formats
  // Format 1: https://drive.google.com/file/d/FILE_ID/view...
  const driveViewMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveViewMatch) {
    const fileId = driveViewMatch[1];
    // Use Google's thumbnail API which is more reliable for embedding
    // s0 means original size, no cropping
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  
  // Format 2: https://drive.google.com/open?id=FILE_ID
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) {
    const fileId = driveOpenMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  
  // Format 3: Already a thumbnail or uc link - extract ID and convert
  const driveIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && url.includes('drive.google.com')) {
    const fileId = driveIdMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }
  
  // If already a direct link or other format, return as is
  return url;
}

// Enhanced markdown-like parser for preview
function parseContent(text: string): string {
  if (!text) return "";

  let html = text
    // Escape HTML first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers: # to ###### (H1 to H6)
  html = html.replace(/^###### (.+)$/gm, '<h6 class="text-xs font-semibold mt-3 mb-1 text-slate-600">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 class="text-sm font-semibold mt-3 mb-1 text-slate-700">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold mt-3 mb-2 text-slate-800">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-5 mb-3">$1</h1>');

  // Horizontal rule: ---
  html = html.replace(/^---$/gm, '<hr class="my-4 border-slate-200" />');

  // Blockquote: > text
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-slate-300 pl-4 my-2 text-slate-600 italic">$1</blockquote>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "<em>$1</em>");

  // Underline: ~~text~~
  html = html.replace(/~~(.+?)~~/g, "<u>$1</u>");

  // Code: `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>'
  );

  // IMPORTANT: Images MUST be processed BEFORE links!
  // Images: ![alt](url) - convert Google Drive links
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, alt, url) => {
      const imageUrl = convertGoogleDriveUrl(url);
      return `<div class="my-3"><img src="${imageUrl}" alt="${alt || 'Bilde'}" class="max-w-full h-auto rounded-lg shadow-sm border border-slate-200" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div class="hidden items-center justify-center h-32 bg-slate-100 rounded-lg border border-dashed border-slate-300 text-slate-400 text-sm">Bilde kunne ikke lastes</div></div>`;
    }
  );

  // Links: [text](url) - processed AFTER images
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Process lines for lists
  const lines = html.split('\n');
  let inUnorderedList = false;
  let inOrderedList = false;
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isUnorderedItem = /^- (.+)$/.test(line);
    const isOrderedItem = /^\d+\. (.+)$/.test(line);

    if (isUnorderedItem) {
      if (!inUnorderedList) {
        if (inOrderedList) {
          processedLines.push('</ol>');
          inOrderedList = false;
        }
        processedLines.push('<ul class="list-disc list-inside my-2 space-y-1">');
        inUnorderedList = true;
      }
      processedLines.push(line.replace(/^- (.+)$/, '<li class="text-slate-700">$1</li>'));
    } else if (isOrderedItem) {
      if (!inOrderedList) {
        if (inUnorderedList) {
          processedLines.push('</ul>');
          inUnorderedList = false;
        }
        processedLines.push('<ol class="list-decimal list-inside my-2 space-y-1">');
        inOrderedList = true;
      }
      processedLines.push(line.replace(/^\d+\. (.+)$/, '<li class="text-slate-700">$1</li>'));
    } else {
      if (inUnorderedList) {
        processedLines.push('</ul>');
        inUnorderedList = false;
      }
      if (inOrderedList) {
        processedLines.push('</ol>');
        inOrderedList = false;
      }
      // Regular paragraph - only wrap if not empty and not already a block element
      if (line.trim() && !line.startsWith('<h') && !line.startsWith('<blockquote') && !line.startsWith('<hr') && !line.startsWith('<div')) {
        processedLines.push(`<p class="my-1">${line}</p>`);
      } else if (line.trim()) {
        processedLines.push(line);
      } else {
        processedLines.push('<br />');
      }
    }
  }

  // Close any open lists
  if (inUnorderedList) processedLines.push('</ul>');
  if (inOrderedList) processedLines.push('</ol>');

  return processedLines.join('');
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Skriv innhold her...",
  minHeight = 300,
  label,
  showPreview = true,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  
  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [savedSelection, setSavedSelection] = useState({ start: 0, end: 0 });

  // Save selection before opening dialogs
  const saveSelection = useCallback(() => {
    if (textareaRef.current) {
      setSavedSelection({
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      });
    }
  }, []);

  // Insert text at cursor position
  const insertAtCursor = useCallback(
    (textToInsert: string, selectAfter = false) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { start, end } = savedSelection;
      const newValue = value.substring(0, start) + textToInsert + value.substring(end);
      onChange(newValue);

      // Focus and position cursor
      setTimeout(() => {
        textarea.focus();
        const newPos = start + textToInsert.length;
        textarea.setSelectionRange(selectAfter ? start : newPos, newPos);
      }, 0);
    },
    [value, onChange, savedSelection]
  );

  // Wrap selected text with formatting
  const wrapSelection = useCallback(
    (before: string, after: string, placeholder = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end) || placeholder;

      const newValue =
        value.substring(0, start) + before + selectedText + after + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        if (selectedText === placeholder) {
          // Select the placeholder
          textarea.setSelectionRange(start + before.length, start + before.length + placeholder.length);
        } else {
          // Position after the formatted text
          textarea.setSelectionRange(start + before.length + selectedText.length + after.length, start + before.length + selectedText.length + after.length);
        }
      }, 0);
    },
    [value, onChange]
  );

  // Insert at line start
  const insertAtLineStart = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", start);
      const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
      const currentLine = value.substring(lineStart, actualLineEnd);

      // Check if already has the prefix
      if (currentLine.startsWith(prefix)) {
        // Remove prefix
        const newValue = value.substring(0, lineStart) + currentLine.substring(prefix.length) + value.substring(actualLineEnd);
        onChange(newValue);
      } else {
        // Add prefix
        const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
        onChange(newValue);
      }

      setTimeout(() => {
        textarea.focus();
      }, 0);
    },
    [value, onChange]
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key === "b") {
        e.preventDefault();
        wrapSelection("**", "**", "fet tekst");
      } else if (isMod && e.key === "i") {
        e.preventDefault();
        wrapSelection("*", "*", "kursiv tekst");
      } else if (isMod && e.key === "u") {
        e.preventDefault();
        wrapSelection("~~", "~~", "understreket tekst");
      } else if (isMod && e.key === "k") {
        e.preventDefault();
        saveSelection();
        const selectedText = value.substring(
          textareaRef.current?.selectionStart || 0,
          textareaRef.current?.selectionEnd || 0
        );
        setLinkText(selectedText || "");
        setLinkUrl("");
        setLinkDialogOpen(true);
      } else if (e.key === "Enter") {
        // Auto-continue lists
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.substring(lineStart, start);

        // Check for bullet list
        const bulletMatch = currentLine.match(/^(\s*)- (.*)$/);
        if (bulletMatch) {
          if (bulletMatch[2].trim() === "") {
            // Empty bullet, remove it
            e.preventDefault();
            const newValue = value.substring(0, lineStart) + value.substring(start);
            onChange(newValue);
            setTimeout(() => {
              textarea.focus();
              textarea.setSelectionRange(lineStart, lineStart);
            }, 0);
          } else {
            // Continue bullet list
            e.preventDefault();
            const indent = bulletMatch[1];
            const newValue = value.substring(0, start) + "\n" + indent + "- " + value.substring(start);
            onChange(newValue);
            setTimeout(() => {
              textarea.focus();
              const newPos = start + indent.length + 3;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
          }
          return;
        }

        // Check for numbered list
        const numMatch = currentLine.match(/^(\s*)(\d+)\. (.*)$/);
        if (numMatch) {
          if (numMatch[3].trim() === "") {
            // Empty item, remove it
            e.preventDefault();
            const newValue = value.substring(0, lineStart) + value.substring(start);
            onChange(newValue);
            setTimeout(() => {
              textarea.focus();
              textarea.setSelectionRange(lineStart, lineStart);
            }, 0);
          } else {
            // Continue numbered list
            e.preventDefault();
            const indent = numMatch[1];
            const nextNum = parseInt(numMatch[2]) + 1;
            const newValue = value.substring(0, start) + "\n" + indent + nextNum + ". " + value.substring(start);
            onChange(newValue);
            setTimeout(() => {
              textarea.focus();
              const newPos = start + indent.length + String(nextNum).length + 3;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
          }
        }
      }
    },
    [value, onChange, wrapSelection, saveSelection]
  );

  // Handle link insert
  const handleInsertLink = () => {
    if (linkUrl) {
      const text = linkText || linkUrl;
      insertAtCursor(`[${text}](${linkUrl})`);
    }
    setLinkDialogOpen(false);
    setLinkText("");
    setLinkUrl("");
  };

  // Handle image insert
  const handleInsertImage = () => {
    if (imageUrl) {
      insertAtCursor(`![${imageAlt || "bilde"}](${imageUrl})\n`);
    }
    setImageDialogOpen(false);
    setImageAlt("");
    setImageUrl("");
  };

  // Toolbar button component
  const ToolbarButton = ({
    onClick,
    title,
    children,
    active = false,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    active?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded p-2 transition-colors",
        active
          ? "bg-slate-200 text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </label>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-2">
          <div className="flex items-center gap-0.5 flex-wrap">
            {/* Text formatting */}
            <ToolbarButton onClick={() => wrapSelection("**", "**", "fet tekst")} title="Fet (Ctrl+B)">
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => wrapSelection("*", "*", "kursiv")} title="Kursiv (Ctrl+I)">
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => wrapSelection("~~", "~~", "understreket")} title="Understreket (Ctrl+U)">
              <Underline className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-2 h-6 w-px bg-slate-300" />

            {/* Headings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  title="Overskrift"
                >
                  <Heading1 className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => insertAtLineStart("# ")} className="cursor-pointer">
                  <span className="text-2xl font-bold">H1</span>
                  <span className="ml-2 text-xs text-slate-500">Hovedtittel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtLineStart("## ")} className="cursor-pointer">
                  <span className="text-xl font-bold">H2</span>
                  <span className="ml-2 text-xs text-slate-500">Seksjonstittel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtLineStart("### ")} className="cursor-pointer">
                  <span className="text-lg font-semibold">H3</span>
                  <span className="ml-2 text-xs text-slate-500">Undertittel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtLineStart("#### ")} className="cursor-pointer">
                  <span className="text-base font-semibold">H4</span>
                  <span className="ml-2 text-xs text-slate-500">Liten tittel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtLineStart("##### ")} className="cursor-pointer">
                  <span className="text-sm font-semibold">H5</span>
                  <span className="ml-2 text-xs text-slate-500">Mini tittel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertAtLineStart("###### ")} className="cursor-pointer">
                  <span className="text-xs font-semibold">H6</span>
                  <span className="ml-2 text-xs text-slate-500">Minste tittel</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolbarButton onClick={() => insertAtLineStart("> ")} title="Sitat">
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-2 h-6 w-px bg-slate-300" />

            {/* Lists */}
            <ToolbarButton onClick={() => insertAtLineStart("- ")} title="Punktliste">
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => insertAtLineStart("1. ")} title="Nummerert liste">
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-2 h-6 w-px bg-slate-300" />

            {/* Media */}
            <ToolbarButton
              onClick={() => {
                saveSelection();
                const selectedText = value.substring(
                  textareaRef.current?.selectionStart || 0,
                  textareaRef.current?.selectionEnd || 0
                );
                setLinkText(selectedText || "");
                setLinkUrl("");
                setLinkDialogOpen(true);
              }}
              title="Sett inn lenke (Ctrl+K)"
            >
              <Link2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => {
                saveSelection();
                setImageAlt("");
                setImageUrl("");
                setImageDialogOpen(true);
              }}
              title="Sett inn bilde"
            >
              <ImageIcon className="h-4 w-4" />
            </ToolbarButton>

            <div className="mx-2 h-6 w-px bg-slate-300" />

            {/* Divider */}
            <ToolbarButton
              onClick={() => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                const start = textarea.selectionStart;
                const needsNewline = start > 0 && value[start - 1] !== "\n";
                insertAtCursor((needsNewline ? "\n" : "") + "---\n");
              }}
              title="Skillelinje"
            >
              <Minus className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {/* Edit/Preview toggle */}
          {showPreview && (
            <div className="flex items-center rounded-lg bg-slate-200/70 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  activeTab === "edit"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Rediger
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  activeTab === "preview"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Eye className="h-3.5 w-3.5" />
                Forhåndsvis
              </button>
            </div>
          )}
        </div>

        {/* Editor / Preview */}
        {activeTab === "edit" ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-3 text-base focus:outline-none resize-y leading-relaxed"
            style={{ minHeight: `${minHeight}px` }}
          />
        ) : (
          <div
            className="w-full px-4 py-3 prose prose-slate max-w-none overflow-y-auto bg-white"
            style={{ minHeight: `${minHeight}px` }}
          >
            {value ? (
              <div
                dangerouslySetInnerHTML={{ __html: parseContent(value) }}
                className="leading-relaxed text-base"
              />
            ) : (
              <p className="text-slate-400 italic">{placeholder}</p>
            )}
          </div>
        )}

        {/* Status bar */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-1.5 text-[11px] text-slate-400">
          <div>
            {value.length} tegn • {value.split(/\s+/).filter(Boolean).length} ord
          </div>
          <div className="flex items-center gap-3">
            <span>**fet**</span>
            <span>*kursiv*</span>
            <span># H1-H6</span>
            <span>[lenke](url)</span>
            <span>![bilde](drive-link)</span>
          </div>
        </div>
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sett inn lenke</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Lenketekst</label>
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Tekst som vises"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">URL</label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleInsertLink} disabled={!linkUrl}>
              <Check className="mr-2 h-4 w-4" />
              Sett inn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sett inn bilde fra Google Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Google Drive lenke</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                type="url"
                autoFocus
              />
              <p className="text-xs text-slate-500">
                Last opp bildet til Google Drive, del det, og lim inn lenken her. Bildet vises automatisk i innholdet.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Alternativ tekst (valgfritt)</label>
              <Input
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Beskrivelse av bildet"
              />
              <p className="text-xs text-slate-400">
                Beskrivelse for tilgjengelighet og hvis bildet ikke kan lastes.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleInsertImage} disabled={!imageUrl}>
              <Check className="mr-2 h-4 w-4" />
              Sett inn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simpler inline preview component for showing formatted content
export function FormattedContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;

  return (
    <div
      className={cn("prose prose-sm max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: parseContent(content) }}
    />
  );
}

export default RichTextEditor;
