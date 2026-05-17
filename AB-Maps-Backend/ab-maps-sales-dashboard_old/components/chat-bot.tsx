"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ChevronDown, ChevronUp, X } from "lucide-react"

interface ChatBotProps {
  isOpen: boolean
  onClose: () => void
}

// Helper to generate unique IDs on the client
function generateId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [userId] = useState("user123")
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ id: string; role: string; content: string; reasoning?: string }[]>([])
  const [input, setInput] = useState("")
  const [showReasoning, setShowReasoning] = useState<{ [key: string]: boolean }>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  /**
   * ✅ Formats Final Answer & Thinking Process Separately
   */
  const formatResponse = (response: string) => {
    let reasoning = ""
    let finalAnswer = response

    // Extract reasoning process
    const reasoningMatch = response.match(/<THINKING_PROCESS_START>([\s\S]*?)<THINKING_PROCESS_END>/)
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim()
      finalAnswer = response.replace(reasoningMatch[0], "").trim()
    }

    // Ensure JSON is parsed correctly (if response is wrapped in JSON)
    try {
      const parsedResponse = JSON.parse(finalAnswer)
      finalAnswer = parsedResponse.content || finalAnswer
    } catch (error) {
      console.warn("Response is not in JSON format, proceeding as raw text.")
    }

    return { finalAnswer, reasoning }
  }

  /**
   * ✅ Formats Text for Final Answer & Thinking Process
   */
  const formatText = (text: any) => {
    if (typeof text !== "string") {
      console.error("formatText received non-string value:", text)
      return text
    }

    return text.split("\n").map((line, index) => {
      const match = line.match(/^(\d️⃣) (.+)/) // Matches numbered points like "1️⃣ **Text**"
      if (match) {
        return (
          <p key={index} className="mb-2">
            <strong>{match[1]}</strong> {match[2]}
          </p>
        )
      }
      return line.trim() ? (
        <p key={index} className="mb-2">
          {line}
        </p>
      ) : (
        <br key={index} />
      )
    })
  }

  /**
   * ✅ Handles Sending Message & Receiving AI Response
   */
  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim()) return

    // Add user message to chat
    const userMessage = { id: generateId(), role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])

    setInput("") // Clear input field

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          messages: [...messages, userMessage], // Include previous messages
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      // Read the response as a stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to get response body reader")
      }

      const decoder = new TextDecoder()
      let assistantMessage = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        assistantMessage += chunk.replace("data: ", "").trim() // Remove SSE formatting
      }

      // Format response & extract reasoning
      const { finalAnswer, reasoning } = formatResponse(assistantMessage)

      // Add assistant's response
      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "assistant", content: finalAnswer, reasoning },
      ])
    } catch (err) {
      console.error("Chat error:", err)
      setError("An error occurred while sending your message.")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md md:max-w-2xl h-[80vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AI Assistant</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-grow overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <div>
                  <p className="mb-2">How can I help you today?</p>
                  <p className="text-sm">Ask me about your sales data, performance metrics, or any other questions.</p>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`mb-4 ${message.role === "user" ? "text-right" : "text-left"}`}>
                <div
                  className={`inline-block p-3 rounded-lg max-w-[80%] text-left ${
                    message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {/* Format content when rendering */}
                  {message.role === "assistant" ? formatText(message.content) : message.content}
                </div>
                {/* Dropdown for Reasoning Process */}
                {message.reasoning && (
                  <div className="mt-2 text-left">
                    <button
                      className="flex items-center text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setShowReasoning((prev) => ({ ...prev, [message.id]: !prev[message.id] }))}
                    >
                      {showReasoning[message.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span className="ml-1">
                        {showReasoning[message.id] ? "Hide Thinking Process" : "Show Thinking Process"}
                      </span>
                    </button>
                    {showReasoning[message.id] && (
                      <div className="p-3 mt-2 bg-muted/50 border rounded-lg text-sm">
                        {formatText(message.reasoning)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form onSubmit={handleSendMessage} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-grow"
            />
            <Button type="submit">Send</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
