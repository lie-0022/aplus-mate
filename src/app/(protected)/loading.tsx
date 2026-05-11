export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 animate-spin rounded-full border-2 border-gray-200 border-t-primary mx-auto mb-4" />
        <p className="text-sm text-gray-500">로딩 중...</p>
      </div>
    </div>
  )
}
