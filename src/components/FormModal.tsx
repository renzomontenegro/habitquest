import { motion, AnimatePresence } from 'framer-motion'

// --- Modal bottom sheet ---
export function BottomSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 400 }}
            animate={{ y: 0 }}
            exit={{ y: 400 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="w-full max-w-lg bg-surface-800 rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto border-t-2 border-surface-600"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-surface-500 rounded-full mx-auto mb-4" />
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black text-white">{title}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface-700 border-2 border-surface-500 text-[#94A7B0] font-black text-sm flex items-center justify-center"
              >
                X
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Input reutilizable ---
export function FormInput({ label, value, onChange, placeholder, type, className, autoFocus }: {
  label?: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; className?: string; autoFocus?: boolean
}) {
  return (
    <div className={className}>
      {label && <label className="text-[11px] font-bold text-[#5C7680] uppercase tracking-wider mb-1.5 block">{label}</label>}
      <input
        type={type ?? 'text'}
        inputMode={type === 'number' ? 'numeric' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-11 bg-surface-700 text-white rounded-xl px-3 font-bold text-[15px] border-2 border-surface-500 outline-none focus:border-duo-blue transition-colors"
      />
    </div>
  )
}

// --- Toggle reutilizable ---
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-bold text-[#94A7B0]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full border-2 transition-all duration-200 relative ${
          value ? 'bg-duo-green border-duo-green-dark' : 'bg-surface-700 border-surface-500'
        }`}
      >
        <motion.div
          className="w-5 h-5 bg-white rounded-full shadow-sm absolute top-[1px]"
          animate={{ left: value ? 'calc(100% - 22px)' : '2px' }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        />
      </button>
    </div>
  )
}
