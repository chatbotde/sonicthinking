import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"

interface CodeBlockProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  className?: string
  // Removed streamingText and isStreaming props
}

export function CodeBlock({
  code,
  language = "typescript",
  showLineNumbers = true,
  className,
}: CodeBlockProps) { // Removed streamingText, isStreaming
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={cn(
      "relative rounded-lg border bg-zinc-950 shadow-md",
      className
    )}>
      {/* Sticky Header with Copy Button */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400">{language}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-zinc-800"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-zinc-400" />
          )}
        </Button>
      </div>

      {/* Code Body */}
      <div className="max-h-[500px] overflow-auto">
        <div className="relative">
          {/* Removed streaming conditional rendering */}
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
              showLineNumbers={showLineNumbers}
              customStyle={{
                margin: 0,
                padding: "1rem",
                background: "transparent",
                fontSize: "0.875rem",
                lineHeight: "1.5",
              }}
              lineNumberStyle={{
                color: "#666",
                marginRight: "1rem",
                fontSize: "0.75rem",
                opacity: 0.5,
              }}
              wrapLines={true}
              wrapLongLines={true}
            >
              {code}
            </SyntaxHighlighter>
          {/* Removed closing parenthesis for streaming conditional */}
        </div>
      </div>
    </div>
  )
}
