export function IconButton({ 
  icon, 
  label, 
  selected, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  selected?: boolean; 
  onClick: () => void 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
        ${selected 
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' 
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      <div className="text-gray-600 dark:text-gray-400">
        {icon}
      </div>
      <span className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
    </button>
  );
}