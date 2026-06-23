type DiscordAuthButtonProps = {
  loading: boolean
  onClick: () => Promise<void>
}

export function DiscordAuthButton({ loading, onClick }: DiscordAuthButtonProps) {
  return (
    <button
      className="w-full rounded-2xl border border-[#ff8a3d]/30 bg-gradient-to-r from-[#ff8a3d] to-[#ff5a1f] px-4 py-3 text-sm font-semibold text-white transition hover:from-[#ff9e5a] hover:to-[#ff6a2f] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={loading}
      onClick={() => {
        void onClick()
      }}
      type="button"
    >
      {loading ? 'Connecting...' : 'Continue with Discord'}
    </button>
  )
}
