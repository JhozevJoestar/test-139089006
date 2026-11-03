import { useEffect, useRef, type ReactNode } from "react";
import { X, LoaderCircle } from "lucide-react";
import type { Status } from "../types";
import { statuses } from "../utils/workflow";
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statuses[status]}
    </span>
  );
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      Загрузка…
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error">
      {error}
      {retry && (
        <button className="secondary" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            type="button"
            aria-label="Закрыть"
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
