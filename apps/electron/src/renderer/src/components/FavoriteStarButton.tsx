import React, { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from './ui/button'
import type { Post } from '../gen/api/schemas'
import { usePostFavorite } from '../hooks/usePostFavorite'

export function FavoriteStarButton({
  post,
  onToggled
}: {
  post: Post
  onToggled?: () => void
}): React.JSX.Element {
  const { toggleFavorite } = usePostFavorite()
  const [favorited, setFavorited] = useState(post.is_favorited)
  const [popping, setPopping] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setFavorited(post.is_favorited)
  }, [post.id, post.is_favorited])

  const onToggle = useCallback(async () => {
    if (busy) return
    const previous = favorited
    const next = !previous
    setFavorited(next)
    setPopping(true)
    setBusy(true)
    window.setTimeout(() => setPopping(false), 280)
    try {
      await toggleFavorite({ ...post, is_favorited: previous })
      onToggled?.()
    } catch {
      setFavorited(previous)
    } finally {
      setBusy(false)
    }
  }, [busy, favorited, onToggled, post, toggleFavorite])

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 hover:text-foreground"
      onClick={() => void onToggle()}
      title={favorited ? 'Remove from favorites' : 'Add to favorites'}
      disabled={busy}
    >
      <Star
        className={`h-3.5 w-3.5 transition-colors duration-150 ${
          popping ? 'star-pop' : ''
        } ${favorited ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`}
      />
    </Button>
  )
}
