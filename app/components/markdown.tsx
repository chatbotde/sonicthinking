import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from "@/components/code-block";
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';

interface MarkdownProps {
  content: string; // Make content required and primary prop
  editable?: boolean;
  onChangeContent?: (content: string) => void;
  // Removed children and isStreaming props
}

// Define component types for ReactMarkdown
interface ReactMarkdownComponentProps {
  node?: any;
  children?: React.ReactNode;
  className?: string;
  href?: string;
  // Add inline prop if it's expected by ReactMarkdown's component API
  inline?: boolean; 
}

export function Markdown({ content, editable = false, onChangeContent }: MarkdownProps) { // Removed children, isStreaming
  const [isEditing, setIsEditing] = useState(false);
  // Directly use content prop for editable state
  const [editableContent, setEditableContent] = useState(content); 

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableContent(e.target.value);
    onChangeContent?.(e.target.value);
  };

  const toggleEditMode = () => {
    if (isEditing && onChangeContent) {
      onChangeContent(editableContent);
    }
    setIsEditing(!isEditing);
  };

  // Update the local state when content prop changes
  React.useEffect(() => {
    setEditableContent(content);
  }, [content]);

  // Removed renderStreamingCode function

  if (isEditing && editable) {
    return (
      <div className="markdown-editor">
        <Textarea
          value={editableContent}
          onChange={handleContentChange}
          className="min-h-[200px] font-mono"
        />
        <div className="flex justify-end mt-2">
          <Button onClick={toggleEditMode}>
            Save & Preview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="markdown-content prose prose-slate dark:prose-invert max-w-none">
      {editable && (
        <div className="flex justify-end mb-2">
          <Button variant="outline" onClick={toggleEditMode}>
            Edit
          </Button>
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Cast the props to include 'inline' if necessary, or access it from 'node' if available
          code(props: ReactMarkdownComponentProps & { inline?: boolean, className?: string, children?: React.ReactNode }) {
            const { node, inline, className = '', children, ...rest } = props;
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : '';
            const value = String(children || '').replace(/\n$/, '');

            if (inline) {
              return (
                <code className="bg-zinc-800/50 px-1.5 py-0.5 rounded-md text-sm font-mono" {...rest}>
                  {children}
                </code>
              );
            }

            // Always render CodeBlock for non-inline code
            return (
              <CodeBlock
                code={value}
                language={language}
                className="my-4"
              />
            );
          },
          p(props) {
            return <p className="mb-4 last:mb-0 leading-relaxed" {...props} />;
          },
          ul(props) {
            return <ul className="list-disc pl-6 mb-4 space-y-2" {...props} />;
          },
          ol(props) {
            return <ol className="list-decimal pl-6 mb-4 space-y-2" {...props} />;
          },
          li(props) {
            return <li className="leading-relaxed" {...props} />;
          },
          h1(props) {
            return <h1 className="text-3xl font-bold mb-6 mt-8" {...props} />;
          },
          h2(props) {
            return <h2 className="text-2xl font-bold mb-4 mt-6" {...props} />;
          },
          h3(props) {
            return <h3 className="text-xl font-bold mb-3 mt-5" {...props} />;
          },
          a(props) {
            return (
              <a
                className="text-primary hover:underline font-medium"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            );
          },
          blockquote(props) {
            return (
              <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground" {...props} />
            );
          },
          hr(props) {
            return <hr className="my-8 border-muted" {...props} />;
          },
          table(props) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="w-full border-collapse" {...props} />
              </div>
            );
          },
          thead(props) {
            return <thead className="bg-muted/50" {...props} />;
          },
          tbody(props) {
            return <tbody {...props} />;
          },
          tr(props) {
            return <tr className="border-b border-border" {...props} />;
          },
          th(props) {
            return (
              <th className="border border-border px-4 py-2 text-left font-bold bg-muted/50" {...props} />
            );
          },
          td(props) {
            return <td className="border border-border px-4 py-2" {...props} />;
          },
        }}
      >
        {/* Pass content directly when not editing, editableContent when editing */}
        {isEditing ? editableContent : content}
      </ReactMarkdown>
    </div>
  );
}
