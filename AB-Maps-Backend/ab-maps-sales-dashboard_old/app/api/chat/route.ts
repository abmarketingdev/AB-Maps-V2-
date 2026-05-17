import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    // Parse the request body properly
    const body = await req.json()
    const { messages, user_id } = body

    if (!messages || messages.length === 0) {
      throw new Error("No messages found in the request body")
    }

    const lastMessage = messages[messages.length - 1]

    // Construct payload
    const payload = {
      user_id,
      query: lastMessage.content,
    }

    console.log("Sending request to API:", payload)

    // Send request to backend
    const response = await fetch("http://0.0.0.0:8080/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`)
    }

    const data = await response.json()
    console.log("Received response from API:", data)

    if (!data.response) {
      throw new Error('API response is missing the "response" field')
    }

    // ✅ Properly formatted Server-Sent Event (SSE) response
    const stream = new ReadableStream({
      start(controller) {
        // Ensure each message starts with `data: ` and ends with `\n\n`
        const message = `data: ${JSON.stringify({ role: "assistant", content: data.response })}\n\n`
        controller.enqueue(message)
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error: unknown) {
    console.error("Error in chat API route:", error)

    let errorMessage = "An error occurred while processing your request"

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
