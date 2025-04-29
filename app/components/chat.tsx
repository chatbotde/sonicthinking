import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "~/components/ui/promptinput"
import { ArrowUp, Square, X, Image, FileText, Film, Music, Paperclip } from "lucide-react"
import { useRef, useState, useEffect } from "react"
import { useChat } from "~/context/chat-context"
import { PlusIcon } from "~/components/icons" // Import PlusIcon from icons.tsx

// --- File Attach Dropdown Component ---
function FileAttachDropdown({
  open,
  onClose,
  onFileChange,
  refs,
  dropdownRef,
}: {
  open: boolean
  onClose: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>, type?: string) => void
  refs: {
    image: React.RefObject<HTMLInputElement>
    document: React.RefObject<HTMLInputElement>
    video: React.RefObject<HTMLInputElement>
    audio: React.RefObject<HTMLInputElement>
  }
  dropdownRef: React.RefObject<HTMLDivElement>
}) {
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl"
        onClick={onClose} // <-- fix: just call onClose (which toggles open/close)
        aria-label="Attach files"
      >
        <PlusIcon size={18} />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-2 z-10 w-44 rounded-lg border bg-popover p-2 shadow-lg">
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary"
            onClick={() => {
              onClose()
              refs.image.current?.click()
            }}
            type="button"
          >
            <Image className="size-4" />
            Image
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary"
            onClick={() => {
              onClose()
              refs.document.current?.click()
            }}
            type="button"
          >
            <FileText className="size-4" />
            Document
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary"
            onClick={() => {
              onClose()
              refs.video.current?.click()
            }}
            type="button"
          >
            <Film className="size-4" />
            Video
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-secondary"
            onClick={() => {
              onClose()
              refs.audio.current?.click()
            }}
            type="button"
          >
            <Music className="size-4" />
            Audio
          </button>
        </div>
      )}
      {/* Hidden file inputs */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={refs.image}
        className="hidden"
        onChange={(e) => onFileChange(e, "image")}
        tabIndex={-1}
      />
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple
        ref={refs.document}
        className="hidden"
        onChange={(e) => onFileChange(e, "document")}
        tabIndex={-1}
      />
      <input
        type="file"
        accept="video/*"
        multiple
        ref={refs.video}
        className="hidden"
        onChange={(e) => onFileChange(e, "video")}
        tabIndex={-1}
      />
      <input
        type="file"
        accept="audio/*"
        multiple
        ref={refs.audio}
        className="hidden"
        onChange={(e) => onFileChange(e, "audio")}
        tabIndex={-1}
      />
    </div>
  )
}

// --- File List Component ---
function FileList({
  files,
  onRemove,
}: {
  files: File[]
  onRemove: (index: number) => void
}) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Paperclip className="size-4" />
          <span className="max-w-[120px] truncate">{file.name}</span>
          <button
            onClick={() => onRemove(index)}
            className="hover:bg-secondary/50 rounded-full p-1"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// --- Main PromptInputWithActions Component ---
export function PromptInputWithActions({
  initialMessage,
  onSubmit,
  value,
  onChange,
  disabled = false, // New prop
  placeholder = "Type a message...", // New prop
}: {
  initialMessage?: string;
  onSubmit?: (message: string) => void;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean; // New prop
  placeholder?: string; // New prop
}) {
  // Use controlled or uncontrolled input based on props
  const [localInput, setLocalInput] = useState(initialMessage || "")
  const isControlled = value !== undefined && onChange !== undefined
  const inputValue = isControlled ? value : localInput
  const handleInputChange = isControlled ? onChange : (e: React.ChangeEvent<HTMLTextAreaElement>) => setLocalInput(e.target.value)

  // --- State and Refs ---
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { sendMessage, isLoading, stopGeneration } = useChat() // Get stopGeneration from context
  const initialRender = useRef(true)

  // Auto-submit initialMessage if provided
  useEffect(() => {
    if (initialMessage && initialRender.current && !isLoading) {
      initialRender.current = false
      handleSend()
    }
  }, [initialMessage, isLoading])

  // --- Dropdown Outside Click Handler ---
  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  // --- Handlers ---
  const handleSend = async () => {
    if ((inputValue.trim() || files.length > 0) && !isSubmitting) {
      setIsSubmitting(true);
      const currentInput = inputValue.trim();
      
      if (!isControlled) {
        setLocalInput("");
      }
      
      if (onSubmit) {
        onSubmit(currentInput);
        setFiles([]);
        setIsSubmitting(false);
        return;
      }
      
      try {
        await sendMessage(currentInput);
      } finally {
        setFiles([]);
        setIsSubmitting(false);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type?: string) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      setFiles((prev) => [...prev, ...newFiles])
    }
    event.target.value = ""
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = ""
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // --- Render ---
  return (
    <PromptInput
      value={inputValue}
      onValueChange={isControlled ? 
        (val) => onChange({ target: { value: val } } as any) : 
        setLocalInput}
      isLoading={isLoading}
      className="w-full max-w-(--breakpoint-md)"
    >
      <FileList files={files} onRemove={handleRemoveFile} />

      <PromptInputTextarea 
        placeholder={placeholder} // Use custom placeholder
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        disabled={disabled} // Use disabled prop
      />

      <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
        <PromptInputAction tooltip="Attach files">
          <FileAttachDropdown
            open={dropdownOpen}
            onClose={() => setDropdownOpen(v => !v)}
            onFileChange={handleFileChange}
            refs={{
              image: imageInputRef,
              document: documentInputRef,
              video: videoInputRef,
              audio: audioInputRef,
            }}
            dropdownRef={dropdownRef}
          />
        </PromptInputAction>
        <div className="flex-1" />
        {isLoading ? (
          <PromptInputAction tooltip="Stop generating">
            <button
              onClick={stopGeneration} // Call stopGeneration on click
              className="bg-primary hover:bg-primary/90 flex h-8 w-8 items-center justify-center rounded-2xl"
              aria-label="Stop generating"
            >
              <Square className="text-primary-foreground size-4" />
            </button>
          </PromptInputAction>
        ) : (
          <PromptInputAction tooltip="Send message">
            <button
              onClick={handleSend}
              disabled={isSubmitting || (!inputValue.trim() && files.length === 0)}
              className="bg-primary hover:bg-primary/90 flex h-8 w-8 items-center justify-center rounded-2xl disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <ArrowUp className="text-primary-foreground size-4" />
            </button>
          </PromptInputAction>
        )}
      </PromptInputActions>
    </PromptInput>
  )
}

