import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { UIMarkdown } from "./markdown" // Use the renamed UIMarkdown
 
export type MessageProps = {
  children: React.ReactNode
  className?: string
  align?: "left" | "right"  // Add alignment prop
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, className, align = "left", ...props }: MessageProps) => (
  <div 
    className={cn(
      "flex gap-3 px-4", // Reduced padding to allow more width
      align === "right" ? "justify-end" : "justify-start",
      className
    )} 
    {...props}
  >
    {children}
  </div>
)

export type MessageAvatarProps = {
  src: string
  alt: string
  fallback?: string
  delayMs?: number
  className?: string
}

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarImage src={src} alt={alt} />
      {fallback && (
        <AvatarFallback delayMs={delayMs}>{fallback}</AvatarFallback>
      )}
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  className?: string
  variant?: "primary" | "secondary"  // Add variant prop for different styles
} // Removed ComponentProps and HTMLProps mixin here to avoid conflicts

// Define props specifically for the container div if needed, or handle them directly
const MessageContent = ({
  children,
  markdown = false,
  className,
  variant = "secondary",
  // Removed ...props to avoid spreading conflicting types
}: MessageContentProps) => {
  // Define classNames for the container or the Markdown component itself
  const containerClassNames = cn(
    // Base styles if not rendering markdown
    !markdown && "rounded-lg p-2 break-words whitespace-normal w-full", 
    variant === "primary" && !markdown
      ? "bg-[#52557A] text-white" 
      : !markdown ? "text-foreground" : "", // Apply text color only if not markdown
    className // Allow overriding container styles
  );

  const markdownClassNames = cn(
     // Base styles if rendering markdown
    markdown && "rounded-lg p-2 break-words whitespace-normal w-full prose", 
    variant === "primary" && markdown
      ? "bg-[#52557A] text-white dark:prose-invert" // Apply bg and ensure prose inversion works
      : markdown ? "text-foreground dark:prose-invert" : "", // Apply text color and prose inversion
    className // Allow overriding markdown styles
  )
  // Removed duplicate lines from previous SEARCH block

  // Pass only relevant props and the correct children type
  return markdown ? (
    <UIMarkdown className={markdownClassNames}> 
      {children as string} 
    </UIMarkdown>
  ) : (
    // Pass only relevant props to the div
    <div className={containerClassNames}> 
      {children}
    </div>
  )
}

export type MessageActionsProps = {
  children: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn("text-muted-foreground flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
)

export type MessageActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={className}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { Message, MessageAvatar, MessageContent, MessageActions, MessageAction }
