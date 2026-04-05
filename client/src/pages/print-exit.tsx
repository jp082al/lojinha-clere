import { useRoute } from "wouter";
import { useServiceOrder } from "@/hooks/use-service-orders";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { type SystemSettings } from "@shared/schema";
import { getOrderItemsSummary, hasOrderItems, isOrderItemFinalized } from "@/lib/service-order-items";
import { useAppliances } from "@/hooks/use-appliances";

export default function PrintExit() {
  const [, params] = useRoute("/print/exit/:id");
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
  const selectedItemNumbers = (urlParams.get("items") || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

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

  const itemSummaries = getOrderItemsSummary(order, appliances);
  const orderHasItems = hasOrderItems(order);
  const explicitlySelectedItems = selectedItemNumbers.length
    ? itemSummaries.filter((item) => selectedItemNumbers.includes(item.itemNumber))
    : [];
  const finalizedItems = itemSummaries.filter((item) => isOrderItemFinalized(item));
  const displayedItems = explicitlySelectedItems.length
    ? explicitlySelectedItems
    : orderHasItems
      ? (finalizedItems.length ? finalizedItems : itemSummaries)
      : itemSummaries;
  const serviceVal = orderHasItems
    ? displayedItems.reduce((sum, item) => sum + item.serviceValue, 0)
    : Number(order.serviceValue ?? 0);
  const partsVal = orderHasItems
    ? displayedItems.reduce((sum, item) => sum + item.partsValue, 0)
    : Number(order.partsValue ?? 0);
  const totalVal = orderHasItems
    ? displayedItems.reduce((sum, item) => sum + item.totalValue, 0)
    : Number(order.totalValue ?? (serviceVal + partsVal));
  const warrantyDays = displayedItems[0]?.warrantyDays ?? order.warrantyDays ?? 90;
  const customerAddress = order.customer.address || "Não informado";
  const deliveredTo = displayedItems
    .map((item) => item.deliveredTo)
    .find(Boolean) ?? order.deliveredTo;
  const finalNotes = displayedItems
    .map((item) => item.finalNotes)
    .filter(Boolean)
    .join("\n\n") || order.finalNotes;
  const exitDate = displayedItems
    .map((item) => item.exitDate)
    .filter(Boolean)
    .map((value) => new Date(value!))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? (order.exitDate ? new Date(order.exitDate) : new Date());
  const finalizedBy = displayedItems
    .map((item) => item.finalizedBy)
    .filter(Boolean)
    .at(-1) || order.finalizedBy;
  const paymentMethod = order.paymentMethod || null;
  const isPartialExit = orderHasItems
    ? displayedItems.length < itemSummaries.length || itemSummaries.some((item) => !isOrderItemFinalized(item))
    : false;

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
          <div>{settings?.phone || "(11) 99999-9999"}</div>
          {settings?.address && <div style={{ fontSize: "10px" }}>{settings.address}</div>}
        </div>

        <div className="title">
          {isPartialExit ? "NOTA DE SAÍDA PARCIAL" : "NOTA DE SAÍDA"}
        </div>

        <div className="os-number">
          {order.orderNumber}
        </div>

        <div className="divider" />

        <div className="section">
          <div className="label">Cliente</div>
          <div className="bold">{order.customer.name}</div>
          <div><span className="label">Telefone</span> {order.customer.phone}</div>
          <div><span className="label">Endereço</span> {customerAddress}</div>
        </div>

        <div className="divider" />

        {displayedItems.map((item, index) => (
          <div key={item.itemNumber}>
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
              <div style={{ whiteSpace: "pre-wrap" }}>{item.defect}</div>
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
                  <div className="label">Diagnóstico / Serviço Realizado</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{item.diagnosis}</div>
                </div>
              </>
            )}

            {item.partsDescription && (
              <>
                <div className="divider" />
                <div className="section">
                  <div className="label">Peças Utilizadas</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{item.partsDescription}</div>
                </div>
              </>
            )}
          </div>
        ))}

        <div className="divider" />

        <div className="section">
          <div className="row">
            <span className="label">Entrada:</span>
            <span>{order.entryDate && format(new Date(order.entryDate), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
          <div className="row">
            <span className="label">Saída:</span>
            <span>{format(exitDate, "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        </div>

        {order.createdBy && (
          <>
            <div className="divider" />
            <div className="section">
              <div className="label">Responsável pela Entrada</div>
              <div className="bold">{order.createdBy}</div>
            </div>
          </>
        )}

        {finalizedBy && (
          <>
            <div className="divider" />
            <div className="section">
              <div className="label">Responsável pela Saída</div>
              <div className="bold">{finalizedBy}</div>
            </div>
          </>
        )}

        {deliveredTo && (
          <>
            <div className="divider" />
            <div className="section">
              <div className="label">Entregue Para</div>
              <div className="bold">{deliveredTo}</div>
            </div>
          </>
        )}

        {finalNotes && (
          <>
            <div className="divider" />
            <div className="section">
              <div className="label">Observações Finais</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{finalNotes}</div>
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

        {paymentMethod && (
          <div className="section center">
            <span className="label">Forma de Pagamento: </span>
            <span className="bold">{paymentMethod}</span>
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
