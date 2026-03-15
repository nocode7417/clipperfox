import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Visibly bot tracking — added by npx visibly setup
  const _vua = request.headers.get('user-agent') ?? ''
  if (/GPTBot|ClaudeBot|anthropic-ai|PerplexityBot|Google-Extended|ChatGPT-User/.test(_vua))
    fetch(`https://visibly.io/api/bot-visit/5e09cf65-ac3b-40ea-9b6b-98c35f60e843`, { method: 'POST', headers: { 'user-agent': _vua } })
  // end Visibly

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
