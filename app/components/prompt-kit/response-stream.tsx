import React, { useEffect, useRef, useState } from "react"
import { cn } from "~/lib/utils"

interface ResponseStreamProps {
  textStream: string
  mode?: "typewriter" | "fade"
  speed?: number
  className?: string
  children?: React.ReactNode
}

export function ResponseStream({
  textStream,
  mode = "typewriter",
  speed = 20,
  className,
  children
}: ResponseStreamProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let currentIndex = 0
    const contentArray = textStream.split("")
    setDisplayedText("")
    setIsComplete(false)

    const interval = setInterval(() => {
      if (currentIndex < contentArray.length) {
        setDisplayedText(prev => prev + contentArray[currentIndex])
        currentIndex++
        
        // Auto scroll to bottom
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight
        }
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [textStream, speed])

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      {children}
    </div>
  )
} 