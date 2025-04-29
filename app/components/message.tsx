import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from "~/components/ui/message"
import { Button } from "~/components/ui/button"
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp, Check, History, ChevronLeft, ChevronRight } from "lucide-react" // Added ChevronLeft, ChevronRight
import { useState, useMemo } from "react"
import { useChat } from "~/context/chat-context"
import { Markdown } from "~/components/markdown"
import { MarkdownStream } from "~/components/ui/markdown-stream"
// Removed Pagination imports as they are no longer used in the history block
import { cn } from "~/lib/utils";

// Define a type for the message object
interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  history?: string[]; // Define history as an array of strings
  isStreaming?: boolean;
  streamingContent?: string;
}

export function MessageWithActions() {
  const { messages } = useChat()

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to Sonicthinking</h2>
          <p className="text-muted-foreground">Start a conversation by typing a message below</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  )
}

// Use the defined type for the message prop
export function ChatMessage({ message }: { message: ChatMessageData }) {
  const [liked, setLiked] = useState<boolean | null>(null)
  const [copied, setCopied] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const history = useMemo(() => message.history || [], [message.history])
  const [page, setPage] = useState(1) // Start page at 1
  const itemsPerPage = 1
  const { regenerateMessage } = useChat() as { regenerateMessage?: (id: string) => Promise<void> }

  const totalPages = Math.ceil(history.length / itemsPerPage)
  // Adjust page calculation to be 1-based for display, but 0-based for slicing
  const currentPageIndex = page - 1;
  const paginatedHistory = history.slice(currentPageIndex * itemsPerPage, (currentPageIndex + 1) * itemsPerPage)
  const mainContent = message.content

  const handleRegenerate = () => {
    setPage(1) // Reset to first history item on regenerate
    setShowHistory(false) // Hide history on regenerate
    if (typeof regenerateMessage === "function") {
      regenerateMessage(message.id)
    } else {
      console.error("regenerateMessage function not found in chat context")
    }
  }

  const handleCopy = () => {
    const contentToCopy = message.content || message.streamingContent || ''
    navigator.clipboard.writeText(contentToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  };

  const toggleHistory = () => {
    setShowHistory(v => !v);
    // Optionally reset page to 1 when showing history
    // if (!showHistory) {
    //   setPage(1);
    // }
  }

  if (message.role === 'user') {
    return (
      <Message align="right" className="w-full">
        <MessageContent
          variant="primary"
          className="rounded-2xl px-5 py-3 ml-auto w-fit max-w-[85%] text-[15px]"
        >
          {message.content}
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message align="left" className="w-full">
      <MessageAvatar
        src="/avatars/ai.png"
        alt="AI"
        className="w-9 h-9 flex-shrink-0"
      />
      <div className="flex flex-col gap-3 w-[85%]">
        <MessageContent
          className="text-[15px] leading-relaxed rounded-2xl px-5 py-3"
        >
          {/* Display streaming content or main content */}
          {message.isStreaming ? (
            <MarkdownStream
              textStream={message.streamingContent ?? ''}
              mode="typewriter"
              speed={30}
              characterChunkSize={1}
              onComplete={() => {}}
              className="prose dark:prose-invert max-w-none"
            />
          ) : (
            <Markdown content={mainContent} />
          )}
        </MessageContent>

        {/* Show previous outputs history block with Carousel Controls */}
        {history.length > 0 && showHistory && (
          <div className="border rounded-lg p-3 bg-muted/40 mb-2">
            <div className="font-semibold mb-2 flex items-center justify-between"> {/* Use justify-between */}
              <div className="flex items-center gap-2"> {/* Group icon and text */}
                 <History className="w-4 h-4" /> Previous Outputs
              </div>
               {/* Carousel Navigation */}
               {totalPages > 1 && (
                 <div className="flex items-center gap-1">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-7 w-7 rounded-full" // Smaller buttons
                     onClick={handlePrevPage}
                     disabled={page === 1}
                   >
                     <ChevronLeft className="size-4" />
                   </Button>
                   <span className="text-sm font-medium text-muted-foreground">
                     {page}/{totalPages}
                   </span>
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-7 w-7 rounded-full" // Smaller buttons
                     onClick={handleNextPage}
                     disabled={page === totalPages}
                   >
                     <ChevronRight className="size-4" />
                   </Button>
                 </div>
               )}
            </div>
            {/* Display only the current page's history item */}
            {paginatedHistory.map((output, idx) => (
              <div key={currentPageIndex * itemsPerPage + idx} className="mb-2"> {/* Ensure key is unique */}
                <Markdown content={output} />
              </div>
            ))}
            {/* Removed the old Pagination component */}
          </div>
        )}

        {/* Render message actions */}
        <MessageActions>
          {/* Copy Button */}
          <MessageAction tooltip={copied ? "Copied!" : "Copy to clipboard"}>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${copied ? "bg-green-100" : ""}`}
              onClick={handleCopy}
              disabled={message.isStreaming && !message.streamingContent}
            >
              {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
            </Button>
          </MessageAction>

          {/* Regenerate Button */}
          <MessageAction tooltip="Regenerate response">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleRegenerate}
              disabled={message.isStreaming}
            >
              <RefreshCcw className={`size-4 ${message.isStreaming ? "animate-spin" : ""}`} />
            </Button>
          </MessageAction>

          {/* History Toggle Button (using History icon) */}
          {history.length > 0 && (
             <MessageAction tooltip={showHistory ? "Hide previous outputs" : "Show previous outputs"}>
               <Button
                 variant="ghost"
                 size="icon" // Use icon size for consistency
                 className={cn(
                   "h-8 w-8 rounded-full",
                   showHistory ? "bg-muted text-foreground" : "" // Highlight when active
                 )}
                 onClick={toggleHistory}
                 disabled={message.isStreaming} // Optional: disable during streaming
               >
                 <History className="size-4" />
               </Button>
             </MessageAction>
          )}
          {/* Removed the clickable <page/total> indicator from actions */}

          {/* Like Button */}
          <MessageAction tooltip="Helpful">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${liked === true ? "bg-green-100 text-green-500" : ""}`}
              onClick={() => setLiked(liked === true ? null : true)}
              disabled={message.isStreaming}
            >
              <ThumbsUp className="size-4" />
            </Button>
          </MessageAction>

          {/* Dislike Button */}
          <MessageAction tooltip="Not helpful">
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${liked === false ? "bg-red-100 text-red-500" : ""}`}
              onClick={() => setLiked(liked === false ? null : false)}
              disabled={message.isStreaming}
            >
              <ThumbsDown className="size-4" />
            </Button>
          </MessageAction>
        </MessageActions>
      </div>
    </Message>
  )
}
