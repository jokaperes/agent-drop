import { createFileRoute } from '@tanstack/react-router'
import { deleteFile, fileResponse } from '#/server/storage'

// GET    /api/file/:box/:name        -> stream the file (inline, or ?dl=1 to download)
// DELETE /api/file/:box/:name        -> remove the file
export const Route = createFileRoute('/api/file/$box/$name')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const download = url.searchParams.get('dl') === '1'
        try {
          return await fileResponse(params.box, params.name, { download })
        } catch {
          return new Response('Not found', { status: 404 })
        }
      },
      DELETE: async ({ params }) => {
        try {
          await deleteFile(params.box, params.name)
          return Response.json({ ok: true })
        } catch (err) {
          return Response.json({ error: String((err as Error).message) }, { status: 400 })
        }
      },
    },
  },
})
