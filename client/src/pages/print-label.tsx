import { useRoute } from "wouter";
import { useServiceOrder } from "@/hooks/use-service-orders";
import { format } from "date-fns";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getOrderItemsSummary } from "@/lib/service-order-items";
import { useAppliances } from "@/hooks/use-appliances";

export default function PrintLabel() {
  const [, params] = useRoute("/print/label/:id");
  const osId = Number(params?.id);
  const { data: order, isLoading } = useServiceOrder(osId);
  const { data: appliances = [], isLoading: appliancesLoading } = useAppliances(order?.customerId || 0);

  const urlParams = new URLSearchParams(window.location.search);
  const size = urlParams.get("size") || "80";
  const width = size === "58" ? "48mm" : "72mm";

  useEffect(() => {
    if (order && !isLoading && !appliancesLoading) {
      setTimeout(() => window.print(), 500);
    }
  }, [order, isLoading, appliancesLoading]);

  if (isLoading || appliancesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Ordem de serviço não encontrada.</p>
      </div>
    );
  }
  const shortName = order.customer.name.split(' ').slice(0, 2).join(' ');
  const itemSummaries = getOrderItemsSummary(order, appliances);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${width} auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.3;
          background: white;
          color: black;
        }
        .print-label {
          width: ${width};
          padding: 3mm;
          margin: 0 auto;
          text-align: center;
        }
        .os-number {
          font-size: 32px;
          font-weight: bold;
          border: 3px solid black;
          padding: 6px;
          margin-bottom: 6px;
        }
        .customer-name {
          font-size: 13px;
          font-weight: bold;
          margin: 4px 0;
        }
        .appliance-info {
          font-size: 10px;
          margin: 4px 0;
          text-align: left;
        }
        .appliance-line {
          margin-bottom: 2px;
          white-space: pre-wrap;
        }
        .label {
          font-size: 9px;
          text-transform: uppercase;
          color: #666;
        }
        .date {
          font-size: 10px;
          color: #666;
        }
      `}</style>

      <div className="no-print fixed top-4 left-4 z-50">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
        >
          Imprimir
        </button>
        <button 
          onClick={() => window.close()}
          className="ml-2 bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
        >
          Fechar
        </button>
      </div>

      <div className="print-label">
        <div className="os-number">
          {order.orderNumber}
        </div>

        <div className="customer-name">
          <div className="label">Cliente</div>
          {shortName}
        </div>

        <div className="appliance-info">
          <div className="label">{itemSummaries.length > 1 ? "Aparelhos" : "Aparelho"}</div>
          {itemSummaries.map((item) => (
            <div key={item.itemNumber} className="appliance-line">
              {item.applianceLabel}
            </div>
          ))}
        </div>

        <div className="date">
          {order.entryDate && format(new Date(order.entryDate), "dd/MM/yyyy")}
        </div>
      </div>
    </>
  );
}
