type LineItem = {
  quantity: number;
  unit_price: number;
  gst_rate: number;
};

type Props = {
  lineItems: LineItem[];
  gstInclusive: boolean;
};

function fmt(n: number) {
  return n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoiceTotals({ lineItems, gstInclusive }: Props) {
  let subtotal = 0;
  let gstTotal = 0;

  for (const item of lineItems) {
    if (gstInclusive) {
      const lineTotal = (item.quantity * item.unit_price) / (1 + item.gst_rate);
      subtotal += lineTotal;
      gstTotal += item.quantity * item.unit_price - lineTotal;
    } else {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      gstTotal += lineTotal * item.gst_rate;
    }
  }

  const total = subtotal + gstTotal;

  return (
    <div className="ml-auto w-64 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>${fmt(subtotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">GST</span>
        <span>${fmt(gstTotal)}</span>
      </div>
      <div className="flex justify-between font-bold text-lg border-t pt-2">
        <span>Total</span>
        <span>${fmt(total)}</span>
      </div>
    </div>
  );
}
