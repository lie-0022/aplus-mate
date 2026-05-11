import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없습니다</h2>
        <p className="text-sm text-gray-500 mb-6">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <Link href="/dashboard" className="btn-primary">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
