import { useMemo } from 'react'
import MockDriver from './MockDriver'
import RealtimeDriver from './RealtimeDriver'

export default function App() {
  // ?mock=1 keeps the original scenario switcher available for UI work without
  // a database. Everything else runs the real multiplayer adapter.
  const mock = useMemo(() => new URLSearchParams(window.location.search).has('mock'), [])
  return (
    <div dir="rtl">
      {mock ? <MockDriver /> : <RealtimeDriver />}
    </div>
  )
}
