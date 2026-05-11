import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'A+ Mate - 대학생 팀플 팀원 매칭',
  description: '카카오 오픈채팅 기반 연락 + 블라인드 평가로 쌓이는 신뢰 배지 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  )
}
