import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Entry = {
  id: string;
  date: string;
  from_location: string;
  to_location: string;
  km: number;
  purpose: string | null;
  is_business: boolean;
};

type Props = {
  entries: Entry[];
};

export function LogbookTable({ entries }: Props) {
  const totalKm = entries
    .filter((e) => e.is_business)
    .reduce((sum, e) => sum + e.km, 0);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead className="text-right">Km</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.date}</TableCell>
              <TableCell>{e.from_location}</TableCell>
              <TableCell>{e.to_location}</TableCell>
              <TableCell className="text-right">{e.km.toFixed(1)}</TableCell>
              <TableCell>{e.purpose || "—"}</TableCell>
              <TableCell>
                <Badge variant={e.is_business ? "default" : "secondary"}>
                  {e.is_business ? "Business" : "Personal"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 text-sm text-muted-foreground">
        Total business km: <span className="font-medium">{totalKm.toFixed(1)}</span>
      </p>
    </div>
  );
}
