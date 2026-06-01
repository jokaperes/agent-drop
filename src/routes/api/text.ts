import { createFileRoute } from '@tanstack/react-router'
import { saveText } from '#/server/storage'

// POST /api/text  { text: string, title?: string }
// Saves pasted text as a note in the inbox.
export const Route = createFileRoute('/api/text')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { text?: string; title?: string }
          const text = (body.text ?? '').trim()
          if (!text) return Response.json({ error: 'empty text' }, { status: 400 })
          const name = await saveText('in', text, body.title)
          return Response.json({ saved: name })
        } catch (err) {
          return Response.json({ error: String((err as Error).message) }, { status: 500 })
        }
      },
    },
  },
})
