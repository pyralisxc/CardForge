"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Node, mergeAttributes, type JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Bold, Highlighter, Italic, List, ListOrdered, Palette, Redo2, Underline as UnderlineIcon, Undo2, Variable } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { templateTextToTiptapDoc, tiptapDocToTemplateText } from '@/lib/richTextDocument';

import { makerTheme } from '@/features/template-editor/lib/makerTheme';

const CardForgeVariableNode = Node.create({
  name: 'cardForgeVariable',
  group: 'inline',
  inline: true,
  content: 'inline*',
  selectable: true,
  isolating: true,

  addAttributes() {
    return {
      key: {
        default: 'variable',
        parseHTML: element => element.getAttribute('data-cardforge-variable-key') || 'variable',
        renderHTML: attributes => ({
          'data-cardforge-variable-key': attributes.key,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-cardforge-variable-key]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'cardforge-variable-token' }), 0];
  },
});

interface VariableMenuState {
  x: number;
  y: number;
  key: string;
}

interface CardForgeRichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  editorClassName?: string;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  placeholder?: string;
  activeVariableKey?: string | null;
  onActiveVariableChange?: (key: string | null) => void;
  onCreateVariable?: (selectedText: string) => string | undefined;
  onEditVariable?: (key: string) => void;
  onRenameVariable?: (key: string) => void;
  onRemoveVariable?: (key: string) => void;
  children?: React.ReactNode;
}

export function CardForgeRichTextEditor({
  id,
  value,
  onChange,
  className,
  editorClassName,
  highlightColor,
  onHighlightColorChange,
  placeholder,
  activeVariableKey,
  onActiveVariableChange,
  onCreateVariable,
  onEditVariable,
  onRenameVariable,
  onRemoveVariable,
  children,
}: CardForgeRichTextEditorProps) {
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [pickedColor, setPickedColor] = useState('#f5d27b');
  const [variableMenu, setVariableMenu] = useState<VariableMenuState | null>(null);

  const initialContent = useMemo(() => templateTextToTiptapDoc(value), [value]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      CardForgeVariableNode,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        id: id || 'cardforge-rich-text-editor',
        class: cn(
          'cardforge-rich-text-editor min-h-[8rem] rounded-[5px] border border-[#252b35] bg-[#111720] px-3 py-2 text-sm text-[#f3ead7] outline-none transition focus-within:border-[#d5ad54]',
          editorClassName
        ),
        'data-placeholder': placeholder || '',
      },
      handleDOMEvents: {
        contextmenu: (_view, event) => {
          const target = event.target as HTMLElement | null;
          const variableElement = target?.closest?.('[data-cardforge-variable-key]') as HTMLElement | null;
          if (!variableElement) {
            const { from, to, empty } = _view.state.selection;
            if (empty || !onCreateVariable) return false;

            const selectedText = _view.state.doc.textBetween(from, to, '\n').trim();
            const key = onCreateVariable(selectedText || 'Variable');
            const variableNode = _view.state.schema.nodes.cardForgeVariable;
            if (!key || !variableNode) return false;

            const content = selectedText
              ? _view.state.schema.text(selectedText)
              : _view.state.schema.text(key);
            _view.dispatch(_view.state.tr.replaceSelectionWith(variableNode.create({ key }, content), false));
            event.preventDefault();
            onActiveVariableChange?.(key);
            return true;
          }

          const key = variableElement.getAttribute('data-cardforge-variable-key') || '';
          if (!key) return false;

          event.preventDefault();
          onActiveVariableChange?.(key);
          setVariableMenu({ x: event.clientX, y: event.clientY, key });
          return true;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onChange(tiptapDocToTemplateText(editor.getJSON()));
    },
    onSelectionUpdate: ({ editor }) => {
      const { $from } = editor.state.selection;
      let currentKey: string | null = null;
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === 'cardForgeVariable') {
          currentKey = node.attrs.key || null;
          break;
        }
      }
      onActiveVariableChange?.(currentKey);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const serialized = tiptapDocToTemplateText(editor.getJSON());
    if (serialized === value) return;
    editor.commands.setContent(templateTextToTiptapDoc(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    const close = () => setVariableMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  const btn = 'flex h-7 w-7 items-center justify-center rounded-[4px] border border-[#2d3340] bg-[#111720] text-[#d8d1c4] transition-colors hover:border-[#d5ad54] hover:text-[#f5d27b] disabled:cursor-not-allowed disabled:opacity-45';
  const isActive = useCallback((name: string, attrs?: Record<string, unknown>) => editor?.isActive(name, attrs) ?? false, [editor]);

  const insertVariableFromSelection = useCallback(() => {
    if (!editor || !onCreateVariable) return;
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === 'cardForgeVariable') {
        const currentKey = node.attrs.key || null;
        if (currentKey) {
          onActiveVariableChange?.(currentKey);
          onEditVariable?.(currentKey);
        }
        return;
      }
    }
    const selectedText = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, '\n').trim();
    const key = onCreateVariable(selectedText || 'Variable');
    if (!key) return;

    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: 'cardForgeVariable',
        attrs: { key },
        content: [{ type: 'text', text: selectedText || key }],
      })
      .run();
    onActiveVariableChange?.(key);
  }, [editor, onActiveVariableChange, onCreateVariable]);

  const findVariableRange = useCallback((key: string): { from: number; to: number } | null => {
    if (!editor) return null;
    let found: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'cardForgeVariable' && node.attrs.key === key) {
        found = { from: pos + 1, to: pos + node.nodeSize - 1 };
        return false;
      }
      return true;
    });
    return found;
  }, [editor]);

  const selectVariableText = useCallback((key: string) => {
    if (!editor) return;
    const found = findVariableRange(key);
    if (!found) return;
    editor.chain().focus().setTextSelection(found).run();
    onActiveVariableChange?.(key);
  }, [editor, findVariableRange, onActiveVariableChange]);

  const removeVariableKeepText = useCallback((key: string) => {
    if (!editor) return;
    let removed = false;
    const transaction = editor.state.tr;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'cardForgeVariable' && node.attrs.key === key) {
        transaction.replaceWith(pos, pos + node.nodeSize, node.content);
        removed = true;
        return false;
      }
      return true;
    });
    if (removed) {
      editor.view.dispatch(transaction);
      onRemoveVariable?.(key);
    }
  }, [editor, onRemoveVariable]);

  const applyHighlight = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color: highlightColor }).run();
  }, [editor, highlightColor]);

  const applyColor = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().setColor(pickedColor).run();
    setTextColorOpen(false);
  }, [editor, pickedColor]);

  const variableMenuStyle = variableMenu
    ? {
        left: Math.min(variableMenu.x, window.innerWidth - 260),
        top: Math.min(variableMenu.y, window.innerHeight - 220),
      }
    : undefined;

  return (
    <div className={cn('relative space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-[5px] border border-[#252b35] bg-[#0b0f15] px-1.5 py-1">
        {children}
        {children && <div className="h-4 w-px bg-[#2d3340]" />}
        <button type="button" className={cn(btn, isActive('bold') && 'border-[#d5ad54] text-[#f5d27b]')} aria-label="Bold" title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={cn(btn, isActive('italic') && 'border-[#d5ad54] text-[#f5d27b]')} aria-label="Italic" title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={cn(btn, isActive('underline') && 'border-[#d5ad54] text-[#f5d27b]')} aria-label="Underline" title="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={cn(btn, isActive('highlight') && 'border-[#d5ad54] text-[#f5d27b]')} aria-label="Highlight" title="Highlight" onClick={applyHighlight}>
          <Highlighter className="h-3.5 w-3.5" style={{ color: highlightColor }} />
        </button>
        <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={btn} aria-label="Highlight color" title="Highlight color">
              <span className="h-3.5 w-3.5 rounded-[2px] border border-[#2d3340]" style={{ backgroundColor: highlightColor }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-[#252b35] bg-[#0d1117] p-2" side="left" align="start">
            <HexColorPicker color={highlightColor} onChange={onHighlightColorChange} />
            <Input value={highlightColor} onChange={event => onHighlightColorChange(event.target.value)} className="mt-2 h-7 font-mono text-xs" />
          </PopoverContent>
        </Popover>
        <div className="h-4 w-px bg-[#2d3340]" />
        <button type="button" className={cn(btn, isActive('bulletList') && 'border-[#d5ad54] text-[#f5d27b]')} aria-label="Bullet list" title="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={cn(btn, isActive('orderedList') && 'border-[#d5ad54] text-[#f5d27b]')} aria-label="Numbered list" title="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
          <PopoverTrigger asChild>
            <button type="button" className={btn} aria-label="Text color" title="Text color">
              <Palette className="h-3.5 w-3.5" style={{ color: pickedColor }} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto border-[#252b35] bg-[#0d1117] p-2" side="left" align="start">
            <HexColorPicker color={pickedColor} onChange={setPickedColor} />
            <Input value={pickedColor} onChange={event => setPickedColor(event.target.value)} className="mt-2 h-7 font-mono text-xs" maxLength={7} />
            <Button type="button" className="mt-2 h-7 w-full text-xs" onClick={applyColor}>Apply Color</Button>
          </PopoverContent>
        </Popover>
        {onCreateVariable && (
          <>
            <div className="h-4 w-px bg-[#2d3340]" />
            <button type="button" className={btn} aria-label="Make variable" title="Make selected text a variable" onClick={insertVariableFromSelection}>
              <Variable className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <div className="h-4 w-px bg-[#2d3340]" />
        <button type="button" className={btn} aria-label="Undo" title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={btn} aria-label="Redo" title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="h-3.5 w-3.5" />
        </button>
        {activeVariableKey && (
          <span className="ml-auto truncate rounded-full border border-[#6d5323] px-2 py-0.5 text-[10px] text-[#d5ad54]">
            {activeVariableKey}
          </span>
        )}
      </div>

      <EditorContent editor={editor} />

      {variableMenu && (
        <div
          className="fixed z-[120] min-w-[230px] rounded-[7px] border border-[#353c48] bg-[#222831] py-1 text-sm text-[#f3ead7] shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
          style={variableMenuStyle}
          onPointerDown={event => event.stopPropagation()}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#d5ad54]">{variableMenu.key}</div>
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#2d3542]" onClick={() => { selectVariableText(variableMenu.key); onEditVariable?.(variableMenu.key); setVariableMenu(null); }}>
            Edit variable text
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#2d3542]" onClick={() => { onRenameVariable?.(variableMenu.key); setVariableMenu(null); }}>
            Rename variable
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#2d3542]" onClick={() => { editor?.chain().focus().unsetAllMarks().run(); setVariableMenu(null); }}>
            Revert selected styling
          </button>
          <button type="button" className="block w-full px-3 py-2 text-left text-[#f0b7b7] hover:bg-[#3a2730]" onClick={() => { removeVariableKeepText(variableMenu.key); setVariableMenu(null); }}>
            Remove variable, keep text
          </button>
        </div>
      )}

      <style jsx global>{`
        .cardforge-rich-text-editor.ProseMirror,
        .cardforge-rich-text-editor .ProseMirror {
          min-height: inherit;
          outline: none;
          white-space: pre-wrap;
        }

        .cardforge-rich-text-editor.ProseMirror p,
        .cardforge-rich-text-editor .ProseMirror p {
          margin: 0;
        }

        .cardforge-rich-text-editor.ProseMirror ul,
        .cardforge-rich-text-editor.ProseMirror ol,
        .cardforge-rich-text-editor .ProseMirror ul,
        .cardforge-rich-text-editor .ProseMirror ol {
          margin: 0;
          padding-left: 1.2rem;
        }

        .cardforge-rich-text-editor.ProseMirror:empty::before,
        .cardforge-rich-text-editor .ProseMirror:empty::before {
          color: #757d8c;
          content: attr(data-placeholder);
          pointer-events: none;
        }

        .cardforge-variable-token {
          border-radius: 4px;
          box-shadow: inset 0 0 0 1px rgba(213, 173, 84, 0.62);
          background: rgba(213, 173, 84, 0.08);
          padding: 0 2px;
          margin: 0 1px;
        }

        .cardforge-variable-token:hover {
          box-shadow: inset 0 0 0 1px rgba(245, 210, 123, 0.95), 0 0 0 2px rgba(213, 173, 84, 0.12);
        }
      `}</style>
    </div>
  );
}
