import { useRoute } from "wouter";
import { useServiceOrder } from "@/hooks/use-service-orders";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { type SystemSettings } from "@shared/schema";
import { getOrderItemsSummary } from "@/lib/service-order-items";
import { useAppliances } from "@/hooks/use-appliances";

export default function PrintReceipt() {
  const [, params] = useRoute("/print/receipt/:id");
  const osId = Number(params?.id);
  const { data: order, isLoading: orderLoading } = useServiceOrder(osId);
  const { data: appliances = [], isLoading: appliancesLoading } = useAppliances(order?.customerId || 0);

  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
  });

  const isLoading = orderLoading || settingsLoading || appliancesLoading;

  const urlParams = new URLSearchParams(window.location.search);
  const size = urlParams.get("size") || "80";
  const width = size === "58" ? "48mm" : "72mm";

  useEffect(() => {
    if (order && !isLoading) {
      setTimeout(() => window.print(), 500);
    }
  }, [order, isLoading]);

  if (isLoading) {
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
  const customerAddress = order.customer.address || "Não informado";
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
          font-size: 12px;
          line-height: 1.4;
          background: white;
          color: black;
        }
        .receipt {
          width: ${width};
          padding: 4mm;
          margin: 0 auto;
        }
        .center {
          text-align: center;
        }
        .bold {
          font-weight: bold;
        }
        .os-number {
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          border: 2px solid black;
          padding: 8px;
          margin: 8px 0;
        }
        .divider {
          border-top: 1px dashed black;
          margin: 8px 0;
        }
        .section {
          margin: 8px 0;
        }
        .label {
          font-size: 10px;
          text-transform: uppercase;
          color: #666;
        }
        .terms {
          font-size: 9px;
          color: #666;
          margin-top: 12px;
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

      <div className="receipt">
        <div className="center">
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: "40px", marginBottom: "4px" }} />
          )}
          <div className="bold" style={{ fontSize: "14px" }}>{settings?.businessName || "TechRepair Assistência Técnica"}</div>
          <div>{settings?.phone || "(11) 99999-9999"}</div>
          {settings?.address && <div style={{ fontSize: "10px" }}>{settings.address}</div>}
        </div>

        <div className="divider" />

        <div className="os-number">
          {order.orderNumber}
        </div>

        <div className="section">
          <div className="label">Data de Entrada</div>
          <div className="bold">
            {order.entryDate && format(new Date(order.entryDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>

        {order.createdBy && (
          <div className="section">
            <div className="label">Responsável pela Entrada</div>
            <div className="bold">{order.createdBy}</div>
          </div>
        )}

        <div className="divider" />

        <div className="section">
          <div className="label">Cliente</div>
          <div className="bold">{order.customer.name}</div>
          <div><span className="label">Telefone</span> {order.customer.phone}</div>
          <div><span className="label">Endereço</span> {customerAddress}</div>
        </div>

        <div className="divider" />

        {itemSummaries.map((item, index) => (
          <div key={item.itemNumber}>
            <div className="divider" />
            <div className="section">
              <div className="label">Item {index + 1} - Aparelho</div>
              <div className="bold">{item.applianceLabel}</div>
              {item.appliance?.serialNumber && (
                <div>Série: {item.appliance.serialNumber}</div>
              )}
            </div>

            <div className="divider" />

            <div className="section">
              <div className="label">Defeito Relatado</div>
              <div>{item.defect}</div>
            </div>

            {item.observations && (
              <>
                <div className="divider" />
                <div className="section">
                  <div className="label">Observações</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{item.observations}</div>
                </div>
              </>
            )}

            {item.diagnosis && (
              <>
                <div className="divider" />
                <div className="section">
                  <div className="label">Diagnóstico</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{item.diagnosis}</div>
                </div>
              </>
            )}
          </div>
        ))}
        <div className="divider" />

        <div className="terms center">
          <p>* Prazo varia conforme diagnóstico</p>
          <p>* Guarde este comprovante</p>
          <p>* Após 90 dias sem retirada, o aparelho poderá ser descartado</p>
        </div>

        <div className="divider" />

        <div className="center" style={{ fontSize: "10px", marginTop: "8px" }}>
          Obrigado pela preferência!
        </div>
      </div>
    </>
  );
}
