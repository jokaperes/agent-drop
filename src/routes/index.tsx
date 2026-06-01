import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Waves, Inbox, Send, RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Uploader } from '#/components/uploader'
import { FileGrid } from '#/components/file-grid'
import { fetchFiles, usePoll } from '#/lib/api'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const inbox = usePoll(useCallback(() => fetchFiles('in'), []), 8000)
  const outbox = usePoll(useCallback(() => fetchFiles('out'), []), 5000)

  const outCount = outbox.data?.length ?? 0

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
          <Waves className="size-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight tracking-tight">Claude Drop</h1>
          <p className="text-sm text-muted-foreground">Files in and out, between you and Claude.</p>
        </div>
      </header>

      <Tabs defaultValue="from" className="w-full">
        <TabsList className="mb-5 grid w-full grid-cols-2">
          <TabsTrigger value="from" className="gap-2">
            <Inbox className="size-4" />
            From Claude
            {outCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {outCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-2">
            <Send className="size-4" />
            Send to Claude
          </TabsTrigger>
        </TabsList>

        <TabsContent value="from" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Files Claude has sent you. New drops appear automatically.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => outbox.refetch()}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
          <FileGrid
            box="out"
            files={outbox.data}
            loading={outbox.loading}
            emptyHint="Nothing here yet. Files Claude sends you will show up here."
            onChanged={outbox.refetch}
          />
        </TabsContent>

        <TabsContent value="send" className="space-y-6">
          <Uploader onDone={inbox.refetch} />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">You’ve sent</h2>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground"
                onClick={() => inbox.refetch()}
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>
            <FileGrid
              box="in"
              files={inbox.data}
              loading={inbox.loading}
              emptyHint="Files you send to Claude will be listed here."
              onChanged={inbox.refetch}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
