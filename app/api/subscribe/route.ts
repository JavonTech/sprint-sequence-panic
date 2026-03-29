import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, score, rounds_completed } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getSupabase() as any)
      .from('game_signups')
      .upsert(
        { email, score, rounds_completed, signed_up_at: new Date().toISOString() },
        { onConflict: 'email' }
      )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Subscribe error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
