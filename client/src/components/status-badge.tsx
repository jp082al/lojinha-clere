import { cn } from "@/lib/utils";

const statusConfig: Record<string, { color: string; label: string }> = {
  "Recebido": { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Recebido" },
  "Em análise": { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Em Análise" },
  "Aguardando peça": { color: "bg-orange-100 text-orange-700 border-orange-200", label: "Aguardando Peça" },
  "Em reparo": { color: "bg-purple-100 text-purple-700 border-purple-200", label: "Em Reparo" },
  "Pronto": { color: "bg-green-100 text-green-700 border-green-200", label: "Pronto" },
  "Entregue": { color: "bg-gray-100 text-gray-700 border-gray-200", label: "Entregue" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { color: "bg-gray-100 text-gray-700", label: status };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-semibold border inline-flex items-center",
      config.color
    )}>
      {config.label}
    </span>
  );
}
