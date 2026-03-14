import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

export default function NavBar() {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg tracking-tight">AIDQA</Link>
        <nav className="flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="sm">New scan</Button>
          </Link>
          <Link to="/history">
            <Button variant="ghost" size="sm">History</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSignOut}>Sign out</Button>
        </nav>
      </div>
    </header>
  )
}
