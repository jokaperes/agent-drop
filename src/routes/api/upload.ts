import { createFileRoute } from '@tanstack/react-router'
import { saveUpload } from '#/server/storage'

// POST /api/upload  (multipart/form-data, field name "files", multi-file)
// Saves every uploaded file into the inbox so Claude can read it.
export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData()
          const parts = form.getAll('files')
          const saved: string[] = []
          for (const part of parts) {
            if (typeof part === 'string') continue
            const buf = Buffer.from(await part.arrayBuffer())
            const name = await saveUpload('in', part.name || 'upload.bin', buf)
            saved.push(name)
          }
          if (saved.length === 0) {
            return Response.json({ error: 'no files in request' }, { status: 400 })
          }
          return Response.json({ saved })
        } catch (err) {
          return Response.json({ error: String((err as Error).message) }, { status: 500 })
        }
      },
    },
  },
})
