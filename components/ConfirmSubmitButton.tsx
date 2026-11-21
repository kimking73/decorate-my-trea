"use client";
import { useFormStatus } from "react-dom";

// 되돌릴 수 없는 폼 제출 전에 한 번 더 묻는 버튼 (예: 관리자 편지 삭제)
export default function ConfirmSubmitButton({ confirm, pendingLabel, className, children }: {
  confirm: string;
  pendingLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={(e) => { if (!window.confirm(confirm)) e.preventDefault(); }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
