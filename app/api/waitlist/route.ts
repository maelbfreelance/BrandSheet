import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend('ta_clé_resend_ici')

export async function POST(req: Request) {
  const { email } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const { error } = await supabase
    .from('waitlist')
    .insert([{ email }])

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Email déjà inscrit' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  await resend.emails.send({
    from: 'BrandSheet <hello@brandsheet.fr>',
    to: email,
    subject: 'Bienvenue sur BrandSheet 🎉',
    html: `
      <div style="font-family:'Georgia',serif;background:#050B18;color:#F0F4FF;padding:40px;max-width:560px;margin:0 auto;border-radius:16px;">
        <h1 style="font-size:28px;font-weight:700;margin-bottom:16px;background:linear-gradient(135deg,#4F8EF7,#7C3AED);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">BrandSheet</h1>
        <h2 style="font-size:22px;font-weight:400;font-style:italic;color:#F0F4FF;margin-bottom:24px;">Vous êtes sur la liste. 🎉</h2>
        <p style="font-size:16px;color:#6B84AA;line-height:1.8;margin-bottom:20px;">
          Merci de rejoindre BrandSheet. Vous faites partie des premiers freelances à découvrir un outil qui va transformer votre relation avec vos clients.
        </p>
        <p style="font-size:16px;color:#6B84AA;line-height:1.8;margin-bottom:32px;">
          Dès le lancement, vous serez les premiers informés — et les premiers à bénéficier de l'offre de lancement.
        </p>
        <div style="background:#0D1B35;border-radius:12px;padding:20px;margin-bottom:32px;">
          <p style="font-size:14px;color:#4F8EF7;font-style:italic;margin:0;">
            "Votre client voit sa propre identité sur votre facture. Il se souvient de vous."
          </p>
        </div>
        <p style="font-size:14px;color:#253A50;margin:0;">L'équipe BrandSheet</p>
      </div>
    `
  })

  return NextResponse.json({ success: true }, { status: 200 })
}