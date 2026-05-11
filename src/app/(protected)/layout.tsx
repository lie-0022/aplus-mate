import BottomNav from '@/components/layout/BottomNav'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-md mx-auto">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
