"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo } from "lucide-react";

type RichTextEditorProps = {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
};

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write your notes here...",
  disabled = false,
  minHeight = "120px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2 min-h-[120px]",
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            editor.isActive("bold") ? "bg-gray-200 dark:bg-neutral-800" : ""
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            editor.isActive("italic") ? "bg-gray-200 dark:bg-neutral-800" : ""
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-neutral-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            editor.isActive("bulletList") ? "bg-gray-200 dark:bg-neutral-800" : ""
          }`}
          title="Bullet List"
        >
          <List size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled || !editor.can().chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            editor.isActive("orderedList") ? "bg-gray-200 dark:bg-neutral-800" : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            editor.isActive("blockquote") ? "bg-gray-200 dark:bg-neutral-800" : ""
          }`}
          title="Quote"
        >
          <Quote size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-neutral-700 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          <Redo size={16} className="text-gray-700 dark:text-neutral-300" />
        </button>
      </div>
      
      {/* Editor */}
      <div style={{ minHeight }} className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

