import { createFileRoute } from '@tanstack/react-router'
import { listBox } from '#/server/storage'

// GET /api/files?box=in|out -> JSON list of files in that box.
export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const box = url.searchParams.get('box') ?? 'out'
        try {
          const files = await listBox(box)
          return Response.json({ box, files })
        } catch (err) {
          return Response.json({ error: String((err as Error).message) }, { status: 400 })
        }
      },
    },
  },
})
