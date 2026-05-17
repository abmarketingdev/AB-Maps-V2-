/**
 * Admin Mobile Components
 * 
 * Reusable mobile-optimized components for the Admin Dashboard Learning module.
 * These components provide consistent mobile UX patterns across all admin pages.
 */

export { default as MobileDialog } from "./MobileDialog";
export { default as MobileFormField } from "./MobileFormField";
export { default as MobileSelect } from "./MobileSelect";
export { default as MobileDataCard } from "./MobileDataCard";
export { default as ResponsiveTable } from "./ResponsiveTable";
export { default as MobileActionMenu, CommonActions } from "./MobileActionMenu";
export type { ActionItem } from "./MobileActionMenu";
export { SectionEditorModal } from "./SectionEditorModal";
export { SectionEditorContent } from "./SectionEditorContent";
export type { SectionEditorContentProps } from "./SectionEditorContent";
export { LessonEditorModal } from "./LessonEditorModal";
export { LessonEditorContent } from "./LessonEditorContent";
export type { LessonEditorContentProps } from "./LessonEditorContent";
export { RichTextEditor, FormattedContent } from "./RichTextEditor";
export { PromotionConfirmationModal } from "./PromotionConfirmationModal";
export type {
  PromotionUserInfo,
  PromotionType,
  PromotionConfirmationModalProps,
} from "./PromotionConfirmationModal";