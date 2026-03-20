import { useRoute } from "wouter";
import { useServiceOrder } from "@/hooks/use-service-orders";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { type SystemSettings } from "@shared/schema";

const FINAL_STATUS_LABELS: Record<string, string> = {
  "ENTREGUE": "Consertado e entregue",
  "NAO_AUTORIZADO": "Não autorizado (retirado)",
  "DESCARTE_AUTORIZADO": "Autorizado para descarte",
  "Consertado e entregue": "Consertado e entregue",
  "Não autorizado (retirado)": "Não autorizado (retirado)",
  "Autorizado para descarte": "Autorizado para descarte"
};

export default function PrintExit() {
  const [, params] = useRoute("/print/exit/:id");
  const osId = Number(params?.id);
  const { data: order, isLoading: orderLoading } = useServiceOrder(osId);

  const { data: settings, isLoading: settingsLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/settings"],
  });

  const isLoading = orderLoading || settingsLoading;

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

  const serviceVal = Number(order.serviceValue) || 0;
  const partsVal = Number(order.partsValue) || 0;
  const totalVal = Number(order.totalValue) || (serviceVal + partsVal);
  const warrantyDays = order.warrantyDays || 90;

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
        .title {
          font-size: 13px;
          font-weight: bold;
          text-align: center;
          border: 2px solid black;
          padding: 6px;
          margin: 8px 0;
        }
        .os-number {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          margin: 6px 0;
        }
        .divider {
          border-top: 1px dashed black;
          margin: 6px 0;
        }
        .section {
          margin: 6px 0;
        }
        .label {
          font-size: 9px;
          text-transform: uppercase;
          color: #666;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-weight: bold;
          font-size: 14px;
          border-top: 1px solid black;
          border-bottom: 1px solid black;
          margin: 4px 0;
        }
        .warranty {
          font-size: 10px;
          border: 1px solid black;
          padding: 6px;
          margin: 8px 0;
          text-align: center;
        }
        .signature {
          margin-top: 20px;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid black;
          width: 80%;
          margin: 0 auto;
          padding-top: 4px;
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
          <div className="bold" style={{ fontSize: "13px" }}>{settings?.businessName || "TechRepair Assistência Técnica"}</div>
          <div>WhatsApp: {settings?.phone || "(11) 99999-9999"}</div>
        </div>

        <div className="title">
          NOTA DE SAÍDA
        </div>

        <div className="os-number">
          {order.orderNumber}
        </div>

        <div className="divider" />

        <div className="section">
          <div className="label">Cliente</div>
          <div className="bold">{order.customer.name}</div>
          <div>Tel: {order.customer.phone}</div>
        </div>

        <div className="divider" />

        <div className="section">
          <div className="label">Aparelho</div>
          <div className="bold">{order.appliance.type} {order.appliance.brand}</div>
          <div>Modelo: {order.appliance.model}</div>
          {order.appliance.serialNumber && (
            <div>Série: {order.appliance.serialNumber}</div>
          )}
        </div>

        <div className="divider" />

        <div className="section">
          <div className="row">
            <span className="label">Entrada:</span>
            <span>{order.entryDate && format(new Date(order.entryDate), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
          <div className="row">
            <span className="label">Saída:</span>
            <span>{order.exitDate ? format(new Date(order.exitDate), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </div>

        <div className="divider" />

        <div className="section">
          <div className="label">Serviço Realizado</div>
          <div>{order.diagnosis || order.defect}</div>
        </div>

        {order.partsDescription && (
          <>
            <div className="divider" />
            <div className="section">
              <div className="label">Peças Utilizadas</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{order.partsDescription}</div>
            </div>
          </>
        )}

        <div className="divider" />

        <div className="section">
          <div className="row">
            <span>Mão de Obra:</span>
            <span>R$ {serviceVal.toFixed(2)}</span>
          </div>
          <div className="row">
            <span>Peças:</span>
            <span>R$ {partsVal.toFixed(2)}</span>
          </div>
        </div>

        <div className="total-row">
          <span>TOTAL:</span>
          <span>R$ {totalVal.toFixed(2)}</span>
        </div>

        {order.paymentMethod && (
          <div className="section center">
            <span className="label">Forma de Pagamento: </span>
            <span className="bold">{order.paymentMethod}</span>
          </div>
        )}

        <div className="warranty">
          <div className="bold">GARANTIA: {warrantyDays} DIAS</div>
          <div style={{ fontSize: "9px", marginTop: "4px" }}>
            Válida apenas para o serviço realizado, mediante apresentação deste comprovante.
            Não cobre mau uso, quedas ou danos elétricos.
          </div>
        </div>

        <div className="signature">
          <div className="signature-line">
            Assinatura do Cliente
          </div>
        </div>

        <div className="divider" style={{ marginTop: "12px" }} />

        <div className="center" style={{ fontSize: "9px" }}>
          Obrigado pela preferência!
        </div>
      </div>
    </>
  );
}
