import { cn } from "@/lib/utils" // Keep only one import
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { CodeBlock } from "@/components/code-block" // Import the consistent CodeBlock

// Rename props type
export type UIMarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

// Define INITIAL_COMPONENTS correctly
const INITIAL_COMPONENTS: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    // Type assertion for node access
    const node = props.node as any;
    const isInline =
      !node?.position?.start.line ||
      node?.position?.start.line === node?.position?.end.line;

    // Corrected if block
    if (isInline) {
      return (
        <span
          className={cn(
            "bg-primary-foreground rounded-sm px-1 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    // Extract language from className (e.g., "language-tsx")
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : 'plaintext' // Default to plaintext if no language found
    const codeString = String(children).replace(/\n$/, '') // Get the code string

    // Use the imported CodeBlock component
    return (
      <CodeBlock
        code={codeString}
        language={language}
        className={cn("my-4", className)} // Add some margin like in the other markdown component
        {...props} // Pass down other props if necessary, though CodeBlock might not use them all
      />
    )
  },
  pre: function PreComponent({ children }) { // Keep the pre component override to avoid wrapping CodeBlock in another <pre>
    return <>{children}</>
  },
}

// Rename memoized component
const MemoizedUIMarkdownBlock = memo(
  function UIMarkdownBlock({ // Rename inner function
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedUIMarkdownBlock.displayName = "MemoizedUIMarkdownBlock" // Update display name

// Rename main component function
function UIMarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: UIMarkdownProps) { // Use renamed props type
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedUIMarkdownBlock // Use renamed memoized component
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

// Rename final exported component
const UIMarkdown = memo(UIMarkdownComponent)
UIMarkdown.displayName = "UIMarkdown" // Update display name

export { UIMarkdown } // Export renamed component
