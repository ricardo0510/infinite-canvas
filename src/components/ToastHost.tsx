import { useToastStore } from "../store/toastStore";
import { Button } from "./ui/Button";

export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span className="toast-message">{toast.message}</span>
          <Button
            variant="ghost"
            size="xs"
            icon
            aria-label="关闭通知"
            onClick={() => dismiss(toast.id)}
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}
