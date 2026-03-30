"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OptimiserPanel } from "@/components/shareholders/optimiser-panel";

export default function OptimisePage() {
  const params = useParams<{ id: string }>();
  const [shareholder, setShareholder] = useState<{ name: string } | null>(null);

  useEffect(() => {
    fetch(`/api/shareholders/${params.id}`)
      .then((r) => r.json())
      .then(setShareholder);
  }, [params.id]);

  if (!shareholder) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Salary/Dividend Optimiser</h1>
        <p className="text-muted-foreground">{shareholder.name}</p>
      </div>
      <OptimiserPanel shareholderId={params.id} />
    </div>
  );
}
