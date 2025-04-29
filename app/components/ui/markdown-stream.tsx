import React from "react"
import { UIMarkdown } from "./markdown" // Import renamed component
import { ResponseStream, Mode } from "./responsestream" // Import ResponseStream component

export type MarkdownStreamProps = {
  textStream: string | AsyncIterable<string>
  mode?: Mode
  speed?: number // 1-100, where 1 is slowest and 100 is fastest
  className?: string
  onComplete?: () => void
  fadeDuration?: number // Custom fade duration in ms (overrides speed)
  segmentDelay?: number // Custom delay between segments in ms (overrides speed)
  characterChunkSize?: number // Custom characters per frame for typewriter mode (overrides speed)
  onError?: (error: unknown) => void // Add onError prop
}

/**
 * MarkdownStream component that combines ResponseStream with Markdown rendering
 * This allows for streaming text with proper markdown formatting, including code blocks
 */
export function MarkdownStream({
  textStream,
  mode = "typewriter",
  speed = 20,
  className = "",
  onComplete,
  fadeDuration,
  segmentDelay,
  characterChunkSize,
  onError, // Destructure onError
}: MarkdownStreamProps) {
  // Define the render function for Markdown using the renamed component
  const renderMarkdown = (text: string) => {
    return <UIMarkdown>{text}</UIMarkdown> // Use renamed component
  }

  return (
    <ResponseStream
      textStream={textStream}
      mode={mode}
      speed={speed}
      className={className}
      onComplete={onComplete}
      fadeDuration={fadeDuration}
      segmentDelay={segmentDelay}
      characterChunkSize={characterChunkSize}
      renderText={renderMarkdown} // Pass the Markdown renderer
      onError={onError} // Pass onError down
      as="div" // Render as a div, which matches the original structure
    />
  )
}
